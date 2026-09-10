import { describe, it, expect } from "vitest";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
  generateNonce,
} from "./security-headers";

// Same regex Next.js uses to recover the nonce from the request CSP header
// (next/dist/server/app-render/get-script-nonce-from-header).
const CSP_NONCE_SOURCE_REGEX = /^'nonce-([A-Za-z0-9+/_-]+={0,2})'$/;

function directive(policy: string, name: string): string | undefined {
  return policy
    .split(";")
    .map((part) => part.trim())
    .find((part) => part === name || part.startsWith(`${name} `));
}

describe("generateNonce", () => {
  it("produit un nonce base64 reconnu par Next.js", () => {
    expect(`'nonce-${generateNonce()}'`).toMatch(CSP_NONCE_SOURCE_REGEX);
  });

  it("produit un nonce différent à chaque appel", () => {
    expect(generateNonce()).not.toBe(generateNonce());
  });
});

describe("buildContentSecurityPolicy", () => {
  const production = buildContentSecurityPolicy({ nonce: "abc123", isDevelopment: false });

  it("verrouille les sources par défaut sur l'origine", () => {
    expect(directive(production, "default-src")).toBe("default-src 'self'");
    expect(directive(production, "base-uri")).toBe("base-uri 'self'");
    expect(directive(production, "form-action")).toBe("form-action 'self'");
  });

  it("n'autorise les scripts que via le nonce et 'strict-dynamic'", () => {
    const scriptSrc = directive(production, "script-src");

    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("interdit l'inclusion du site dans une frame (clickjacking)", () => {
    expect(directive(production, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("autorise <object> en même origine pour la prévisualisation des pièces", () => {
    expect(directive(production, "object-src")).toBe("object-src 'self'");
  });

  it("force HTTPS en production", () => {
    expect(directive(production, "upgrade-insecure-requests")).toBe("upgrade-insecure-requests");
  });

  it("assouplit la politique en développement (eval + websocket HMR)", () => {
    const development = buildContentSecurityPolicy({ nonce: "abc123", isDevelopment: true });

    expect(directive(development, "script-src")).toContain("'unsafe-eval'");
    expect(directive(development, "connect-src")).toContain("ws:");
    expect(directive(development, "upgrade-insecure-requests")).toBeUndefined();
  });
});

describe("buildSecurityHeaders", () => {
  it("expose les en-têtes de sécurité attendus en production", () => {
    const headers = buildSecurityHeaders({ nonce: "abc123", isDevelopment: false });

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Strict-Transport-Security"]).toBe(
      "max-age=31536000; includeSubDomains; preload",
    );
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Content-Security-Policy"]).toContain("'nonce-abc123'");
  });

  it("n'envoie pas de HSTS en développement (http local)", () => {
    const headers = buildSecurityHeaders({ nonce: "abc123", isDevelopment: true });

    expect(headers["Strict-Transport-Security"]).toBeUndefined();
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });
});
