import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { NONCE_HEADER, buildSecurityHeaders, generateNonce } from "@/app/lib/security-headers";

// public paths (accessible without being connected).
const PUBLIC_PATHS = ["/", "/connexion"];

const CSP_HEADER = "Content-Security-Policy";

function withSecurityHeaders(
  response: NextResponse,
  securityHeaders: Record<string, string>,
): NextResponse {
  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }
  return response;
}

// Optimistic protection based on the presence of the session cookie (no DB call here).
// The real check (valid session + isValidated account) is done in app/(protected)/layout.tsx,
// Server Component side.
//
// Also the single place where the HTTP security headers are set (CSP with a
// per-request nonce, nosniff, frame options, HSTS…).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = generateNonce();
  const securityHeaders = buildSecurityHeaders({
    nonce,
    isDevelopment: process.env.NODE_ENV === "development",
  });

  const isPublic = pathname.startsWith("/api/auth") || PUBLIC_PATHS.includes(pathname);

  if (!isPublic && !getSessionCookie(request)) {
    return withSecurityHeaders(
      NextResponse.redirect(new URL("/connexion", request.url)),
      securityHeaders,
    );
  }

  // Next.js recovers the nonce from the request CSP header to stamp its own
  // scripts; `x-nonce` is what app/layout.tsx forwards to react-dsfr.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_HEADER, securityHeaders[CSP_HEADER]);
  requestHeaders.set(NONCE_HEADER, nonce);

  return withSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    securityHeaders,
  );
}

export const config = {
  // Execute the proxy everywhere except on Next.js static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
