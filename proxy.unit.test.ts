import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { proxy } from "./proxy";

vi.mock("better-auth/cookies", () => ({
  getSessionCookie: vi.fn(),
}));

const mockedGetSessionCookie = vi.mocked(getSessionCookie);

function makeRequest(path: string): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"));
}

// NextResponse.redirect redirects the target URL in the `location` header.
function redirectLocation(response: Response): string | null {
  return response.headers.get("location");
}

// NextResponse.next() sets the internal `x-middleware-next: 1` header.
function isNext(response: Response): boolean {
  return response.headers.get("x-middleware-next") === "1";
}

describe("proxy (contrôle d’accès)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("laisse passer les routes /api/auth sans vérifier le cookie de session", () => {
    const response = proxy(makeRequest("/api/auth/callback/proconnect"));

    expect(isNext(response)).toBe(true);
    expect(mockedGetSessionCookie).not.toHaveBeenCalled();
  });

  it.each(["/", "/connexion"])(
    "laisse passer le chemin public %s sans vérifier le cookie",
    (path) => {
      const response = proxy(makeRequest(path));

      expect(isNext(response)).toBe(true);
      expect(mockedGetSessionCookie).not.toHaveBeenCalled();
    },
  );

  it("redirige vers /connexion quand aucun cookie de session n’est présent", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(makeRequest("/case_files"));

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe("http://localhost:3000/connexion");
  });

  it("laisse passer une route protégée quand un cookie de session est présent", () => {
    mockedGetSessionCookie.mockReturnValue("session-token");

    const response = proxy(makeRequest("/case_files"));

    expect(isNext(response)).toBe(true);
    expect(mockedGetSessionCookie).toHaveBeenCalledOnce();
  });

  it("ne considère pas un sous-chemin de chemin public comme public", () => {
    // "/connexion/autre" n'est pas dans PUBLIC_PATHS (égalité stricte) → protégé.
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(makeRequest("/connexion/autre"));

    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toBe("http://localhost:3000/connexion");
  });
});

describe("proxy (en-têtes de sécurité)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetSessionCookie.mockReturnValue("session-token");
  });

  it.each([
    ["X-Content-Type-Options", "nosniff"],
    ["X-Frame-Options", "DENY"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ])("pose %s sur les réponses", (header, value) => {
    const response = proxy(makeRequest("/case_files"));

    expect(response.headers.get(header)).toBe(value);
  });

  it("pose une CSP avec un nonce et l'expose via x-nonce à l'application", () => {
    const response = proxy(makeRequest("/case_files"));

    const csp = response.headers.get("content-security-policy");
    expect(csp).toBeTruthy();

    // Next.js relit le nonce depuis l'en-tête CSP de *requête* pour l'apposer
    // sur ses propres scripts : les deux doivent concorder.
    const nonce = response.headers.get("x-middleware-request-x-nonce");
    expect(nonce).toBeTruthy();
    expect(csp).toContain(`'nonce-${nonce}'`);
    expect(response.headers.get("x-middleware-request-content-security-policy")).toBe(csp);
  });

  it("renouvelle le nonce à chaque requête", () => {
    const first = proxy(makeRequest("/case_files"));
    const second = proxy(makeRequest("/case_files"));

    expect(first.headers.get("x-middleware-request-x-nonce")).not.toBe(
      second.headers.get("x-middleware-request-x-nonce"),
    );
  });

  it("pose aussi les en-têtes sur la redirection vers /connexion", () => {
    mockedGetSessionCookie.mockReturnValue(null);

    const response = proxy(makeRequest("/case_files"));

    expect(response.status).toBe(307);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  it("pose les en-têtes sur les chemins publics", () => {
    const response = proxy(makeRequest("/connexion"));

    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(mockedGetSessionCookie).not.toHaveBeenCalled();
  });
});
