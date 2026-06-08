import { login } from "./auth";

const API_HOST = "https://administrations.telerecours.fr";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:150.0) " + "Gecko/20100101 Firefox/150.0";
const PAGINATION_PAGE_SIZE = 30;
const MAX_LOGIN_ATTEMPTS = 10;

const MAX_FETCH_ATTEMPTS = 4;
const INITIAL_RETRY_DELAY_MS = 1000;

/**
 * Aplatit la chaîne `error.cause` (utile pour `TypeError: fetch failed` de
 * undici, dont la vraie raison — ECONNRESET, ENOTFOUND, UND_ERR_SOCKET… —
 * vit dans `cause`, parfois imbriqué sur plusieurs niveaux).
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
  // Node/undici lève un TypeError("fetch failed") dont `.cause` contient
  // le vrai code (ECONNRESET, ETIMEDOUT, ENOTFOUND, UND_ERR_SOCKET, …).
  return (
    error instanceof TypeError ||
    (error instanceof Error && error.message === "fetch failed")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ClientCredentials {
  username: string;
  password: string;
}

interface CaseFileResponse {
  [key: string]: unknown;
}

class TelerecoursCaseFileClient {
  private accessToken: string | null = null;
  private credentials: ClientCredentials;
  private isLoggingIn = false;

  constructor(credentials: ClientCredentials) {
    this.credentials = credentials;
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken) {
      return;
    }

    if (this.isLoggingIn) {
      let attempts = 0;
      while (this.isLoggingIn && attempts < MAX_LOGIN_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }
      if (this.accessToken) return;
      throw new Error(`Login failed: token still null after ${MAX_LOGIN_ATTEMPTS} attempts`);
    }

    await this.performLogin();
  }

  private async performLogin(): Promise<void> {
    this.isLoggingIn = true;
    try {
      this.accessToken = await login(this.credentials.username, this.credentials.password);
      console.log(`✓ Successfully authenticated for ${this.credentials.username}`);
    } catch (error) {
      this.accessToken = null;
      throw new Error(
        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.isLoggingIn = false;
    }
  }

  async get<T = CaseFileResponse>(path: string, jurisdiction: string): Promise<T> {
    await this.ensureAuthenticated();
    const url = path.startsWith("http") ? path : `${API_HOST}${path}`;

    try {
      return (await this.makeAuthenticatedRequest(url, jurisdiction)) as T;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        console.log(`⚠ Authentication expired, attempting to re-login and retry...`);
        this.accessToken = null;

        try {
          await this.ensureAuthenticated();
          return (await this.makeAuthenticatedRequest(url, jurisdiction)) as T;
        } catch (retryError) {
          throw new Error(
            `Failed after re-authentication: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
          );
        }
      }
      throw error;
    }
  }

  async getCaseFiles(
    jurisdiction: string,
    page: number,
    size: number,
    sort?: string,
    onlyEnrolled = true,
    legalEntityDivisionIds: number[] = [],
  ): Promise<CaseFileResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      size: size.toString(),
    });

    if (sort) {
      params.append("sort", sort);
    }
    if (onlyEnrolled) {
      params.append("onlyEnrolled", "true");
    }
    if (legalEntityDivisionIds.length > 0) {
      params.append("legalEntityDivisionIds", legalEntityDivisionIds.join(","));
    }

    return this.get(`/api/case-file?${params.toString()}`, jurisdiction);
  }

  getCaseFileDetail(caseFileNumber: string, jurisdiction: string): Promise<CaseFileResponse> {
    return this.get(`/api/case-file/${caseFileNumber}`, jurisdiction);
  }

  getCaseFileHearings(
    caseFileNumber: string,
    jurisdiction: string,
    page = 0,
    size = PAGINATION_PAGE_SIZE,
  ): Promise<CaseFileResponse> {
    return this.get(
      `/api/case-file/${caseFileNumber}/hearings?page=${page}&size=${size}`,
      jurisdiction,
    );
  }

  getCaseFileMeasures(
    caseFileNumber: string,
    jurisdiction: string,
    page = 0,
    size = PAGINATION_PAGE_SIZE,
  ): Promise<CaseFileResponse> {
    return this.get(
      `/api/case-file/${caseFileNumber}/measures?page=${page}&size=${size}`,
      jurisdiction,
    );
  }

  getCaseFileRelatedReport(
    caseFileNumber: string,
    jurisdiction: string,
  ): Promise<CaseFileResponse> {
    return this.get(`/api/case-file/${caseFileNumber}/related-case-files-report`, jurisdiction);
  }

  getCaseFileAttachedFiles(
    caseFileNumber: string,
    jurisdiction: string,
    page = 0,
    size = PAGINATION_PAGE_SIZE,
  ): Promise<CaseFileResponse> {
    return this.get(`/api/file-api/${caseFileNumber}?page=${page}&size=${size}`, jurisdiction);
  }

  private async makeAuthenticatedRequest(
    url: string,
    jurisdiction: string,
  ): Promise<CaseFileResponse> {
    if (!this.accessToken) {
      throw new Error("No access token available");
    }

    let attempt = 0;
    let lastError: unknown;

    while (attempt < MAX_FETCH_ATTEMPTS) {
      attempt++;
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": USER_AGENT,
            Authorization: `Bearer ${this.accessToken}`,
            "X-Jurisdiction-Code": jurisdiction,
            Accept: "application/json",
          },
        });

        if (response.status === 401 || response.status === 403) {
          throw new AuthenticationError(
            `Authentication required: ${response.status} ${response.statusText}`,
          );
        }

        // 429 / 5xx → erreurs typiquement transitoires, on retente.
        if (
          response.status === 429 ||
          (response.status >= 500 && response.status < 600)
        ) {
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

        return (await response.json()) as CaseFileResponse;
      } catch (error) {
        // Erreurs de logique métier (auth expirée, 4xx non transitoires) :
        // on remonte tout de suite, c'est à l'appelant de gérer.
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
          // Plus de tentatives → on rejette en gardant la cause originelle.
          throw new Error(
            `GET ${url} failed after ${attempt} attempts — ${describeError(error)}`,
            { cause: error },
          );
        }

        throw error;
      }
    }

    // Inatteignable en théorie, mais on respecte les types.
    throw new Error(
      `GET ${url} failed after ${MAX_FETCH_ATTEMPTS} attempts — ${describeError(lastError)}`,
      { cause: lastError instanceof Error ? lastError : undefined },
    );
  }
}

function backoffDelay(attempt: number): number {
  // Backoff exponentiel + jitter : 1s, 2s, 4s (+0–250ms).
  return INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

const clients = new Map<string, TelerecoursCaseFileClient>();

export function getTelerecoursCaseFileClient(
  credentials: ClientCredentials,
): TelerecoursCaseFileClient {
  const key = `${credentials.username}`;

  if (!clients.has(key)) {
    clients.set(key, new TelerecoursCaseFileClient(credentials));
  }

  return clients.get(key)!;
}
