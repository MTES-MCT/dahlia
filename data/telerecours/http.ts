// Low-level HTTP concerns for the Telerecours client: error description,
// retry/backoff, the authenticated fetch loop and a couple of header parsers.
// Kept separate from `client.ts` so the transport can be unit-tested (and the
// pure helpers reused) without instantiating the whole client.

export const API_HOST = "https://administrations.telerecours.fr";
export const ALLOWED_API_HOSTNAME = new URL(API_HOST).hostname;
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) " + "Gecko/20100101 Firefox/150.0";
export const PAGINATION_PAGE_SIZE = 30;

/**
 * Ensure a URL targets only the Télérecours API host over HTTPS. Rejects any
 * other scheme or hostname to prevent SSRF when path segments come from callers.
 */
export function assertTelerecoursApiUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid Télérecours API URL: ${url}`);
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== ALLOWED_API_HOSTNAME) {
    throw new Error(
      `Disallowed Télérecours API host: ${parsed.hostname} (expected ${ALLOWED_API_HOSTNAME})`,
    );
  }

  return parsed;
}

/** Build an absolute Télérecours API URL from a relative path (`/api/...`). */
export function telerecoursApiUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    throw new Error("Pass a relative API path, not an absolute URL");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return assertTelerecoursApiUrl(new URL(normalizedPath, API_HOST).href).href;
}

const MAX_FETCH_ATTEMPTS = 4;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Flatten the `error.cause` string (useful for `TypeError: fetch failed` from
 * undici, whose real reason — ECONNRESET, ENOTFOUND, UND_ERR_SOCKET… — is in
 * `cause`, sometimes nested several levels deep).
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const parts: string[] = [`${error.name}: ${error.message}`];
  let cause: unknown = error.cause;
  while (cause) {
    if (cause instanceof Error) {
      const code = (cause as Error & { code?: string }).code;
      parts.push(`caused by ${code ? `[${code}] ` : ""}${cause.message}`);
      cause = cause.cause;
    } else {
      parts.push(`caused by ${String(cause)}`);
      break;
    }
  }
  return parts.join(" → ");
}

function isNetworkFetchError(error: unknown): boolean {
  // Node/undici throws a TypeError("fetch failed") whose `.cause` holds the
  // real code (ECONNRESET, ETIMEDOUT, ENOTFOUND, UND_ERR_SOCKET, …).
  return error instanceof TypeError || (error instanceof Error && error.message === "fetch failed");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffDelay(attempt: number): number {
  // Exponential backoff + jitter: 1s, 2s, 4s (+0–250ms).
  return INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Perform a GET authenticated with retry (429/5xx + network errors) and return
 * the raw `Response` (already checked `ok`). Throws an AuthenticationError on
 * 401/403 to trigger a re-login upstream.
 */
export async function fetchWithRetry(
  path: string,
  accessToken: string,
  jurisdiction: string,
  accept = "application/json",
): Promise<Response> {
  const url = telerecoursApiUrl(path);
  let attempt = 0;
  let lastError: unknown;

  while (attempt < MAX_FETCH_ATTEMPTS) {
    attempt++;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": USER_AGENT,
          Authorization: `Bearer ${accessToken}`,
          "X-Jurisdiction-Code": jurisdiction,
          Accept: accept,
        },
      });

      if (response.status === 401 || response.status === 403) {
        throw new AuthenticationError(
          `Authentication required: ${response.status} ${response.statusText}`,
        );
      }

      // 429 / 5xx → typically transient errors, retry.
      if (response.status === 429 || response.status >= 500) {
        const body = await response.text().catch(() => "");
        lastError = new Error(
          `GET ${url} → ${response.status} ${response.statusText}` +
            (body ? `\nBody: ${body.substring(0, 400)}` : ""),
        );
        if (attempt < MAX_FETCH_ATTEMPTS) {
          const delay = backoffDelay(attempt);
          console.warn(
            `⚠ ${response.status} ${response.statusText} on GET ${url} ` +
              `(attempt ${attempt}/${MAX_FETCH_ATTEMPTS}), retry in ${delay}ms…`,
          );
          await sleep(delay);
          continue;
        }
        throw lastError;
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `GET ${url} failed: ${response.status} ${response.statusText}\n` +
            `Body: ${text.substring(0, 400)}`,
        );
      }

      return response;
    } catch (error) {
      // Business logic errors (auth expired, 4xx non transient):
      // throw immediately, it's up to the caller to handle.
      if (error instanceof AuthenticationError) throw error;

      if (isNetworkFetchError(error)) {
        lastError = error;
        if (attempt < MAX_FETCH_ATTEMPTS) {
          const delay = backoffDelay(attempt);
          console.warn(
            `⚠ Network error on GET ${url}: ${describeError(error)} ` +
              `(attempt ${attempt}/${MAX_FETCH_ATTEMPTS}), retry in ${delay}ms…`,
          );
          await sleep(delay);
          continue;
        }
        // No more attempts → reject keeping the original cause.
        throw new Error(`GET ${url} failed after ${attempt} attempts — ${describeError(error)}`, {
          cause: error,
        });
      }

      throw error;
    }
  }

  // Theoretically unreachable, but respect the types.
  throw new Error(
    `GET ${url} failed after ${MAX_FETCH_ATTEMPTS} attempts — ${describeError(lastError)}`,
    { cause: lastError instanceof Error ? lastError : undefined },
  );
}

/**
 * Extract the file name from a `Content-Disposition` header. Handle the RFC 5987
 * `filename*=UTF-8''…` (prioritary) and the classic `filename="…"`. Return
 * undefined if nothing exploitable.
 */
export function parseContentDispositionFileName(header: string | null): string | undefined {
  if (!header) return undefined;

  const extended = header.match(/filename\*=(?:UTF-8'')?([^;]+)/i);
  if (extended) {
    try {
      return decodeURIComponent(extended[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // Malformed value: fall back to the classic form below.
    }
  }

  const basic = header.match(/filename="?([^";]+)"?/i);
  return basic ? basic[1].trim() : undefined;
}
