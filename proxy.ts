import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// public paths (accessible without being connected).
const PUBLIC_PATHS = ["/", "/connexion"];

// Optimistic protection based on the presence of the session cookie (no DB call here).
// The real check (valid session + validated account) is done in app/(protected)/layout.tsx,
// Server Component side.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/auth") || PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Execute the proxy everywhere except on Next.js static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
