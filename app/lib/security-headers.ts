// HTTP security headers (CWE-693), built per request in `proxy.ts`.
//
// The Content-Security-Policy carries a fresh nonce on every request. Next.js
// reads that nonce back from the *request* `content-security-policy` header to
// stamp its own bootstrap/streaming scripts, and `app/layout.tsx` forwards it
// to react-dsfr through the `x-nonce` request header.

// Header carrying the request nonce down to the Server Components.
export const NONCE_HEADER = "x-nonce";

const NONCE_BYTE_LENGTH = 16;

// PieceViewer embeds GET …/pieces/<id>/data in an `<object>`. Matches both
// `/case_files/…` and the `/dossiers/…` rewrite.
const PIECE_DATA_PATH = /\/pieces\/[^/]+\/data\/?$/;

export function isPieceDataPath(pathname: string): boolean {
  return PIECE_DATA_PATH.test(pathname);
}

// Base64 of 128 random bits — the shape Next.js expects in `'nonce-…'`.
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(NONCE_BYTE_LENGTH));
  return btoa(String.fromCharCode(...bytes));
}

type SecurityHeadersOptions = {
  nonce: string;
  // The dev server needs looser rules (eval-based sourcemaps, HMR websocket)
  // and must not be pinned to HTTPS by HSTS.
  isDevelopment: boolean;
  // PDF `/data` responses must allow same-origin embedding: `X-Frame-Options:
  // DENY` also blocks `<object>`, and Chromium checks `frame-src` for PDFs.
  allowSameOriginEmbed?: boolean;
};

export function buildContentSecurityPolicy({
  nonce,
  isDevelopment,
  allowSameOriginEmbed = false,
}: SecurityHeadersOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      // Browsers honouring 'strict-dynamic' ignore 'self' and trust only the
      // nonced scripts plus whatever they load (Next.js chunks, react-dsfr).
      "'strict-dynamic'",
      // Next.js dev builds compile with eval-based sourcemaps / React Refresh.
      ...(isDevelopment ? ["'unsafe-eval'"] : []),
    ],
    // The DSFR and several components use inline `style` attributes, which a
    // nonce cannot cover. Inline styles are not a script execution vector.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    // Same-origin fetches only, plus the dev-server HMR websocket.
    "connect-src": ["'self'", ...(isDevelopment ? ["ws:"] : [])],
    // `<object>` previews of pièces are streamed by our own download route.
    "object-src": ["'self'"],
    // Chromium treats a PDF in `<object>` as a nested frame, so `frame-src`
    // must allow same-origin documents (not `'none'`).
    "frame-src": ["'self'"],
    "frame-ancestors": [allowSameOriginEmbed ? "'self'" : "'none'"],
    "form-action": ["'self'"],
  };

  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);

  if (!isDevelopment) {
    policy.push("upgrade-insecure-requests");
  }

  return policy.join("; ");
}

export function buildSecurityHeaders(options: SecurityHeadersOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Security-Policy": buildContentSecurityPolicy(options),
    "X-Content-Type-Options": "nosniff",
    // Redundant with `frame-ancestors` but still honoured by older browsers.
    // SAMEORIGIN (not DENY) on pièce `/data`: DENY also blocks `<object>`.
    "X-Frame-Options": options.allowSameOriginEmbed ? "SAMEORIGIN" : "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  // HSTS is only meaningful over TLS: sending it in local http dev would pin
  // localhost to https for a year.
  if (!options.isDevelopment) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
}
