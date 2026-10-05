import { afterEach, describe, expect, it, vi } from "vitest";
import { logAdminAudit, logSecurityDenial, oauthCallbackDenial } from "./audit-log";

describe("logAdminAudit", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("écrit une ligne JSON avec auteur, action, cible et horodatage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T15:25:00.000Z"));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logAdminAudit({
      actorId: "admin-1",
      action: "user.update",
      target: {
        id: "u2",
        email: "bob@example.gouv.fr",
        isAdmin: true,
        changes: { isAdmin: { from: false, to: true } },
      },
    });

    expect(info).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual({
      type: "audit",
      timestamp: "2026-09-28T15:25:00.000Z",
      actorId: "admin-1",
      action: "user.update",
      target: {
        id: "u2",
        email: "bob@example.gouv.fr",
        isAdmin: true,
        changes: { isAdmin: { from: false, to: true } },
      },
    });
  });
});

describe("logSecurityDenial", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("journalise un refus avec acteur, motif et horodatage", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00.000Z"));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logSecurityDenial({
      actorId: "u1",
      action: "auth.admin.denied",
      reason: "not_admin",
      ip: "203.0.113.4",
      target: { providerId: "proconnect" },
    });

    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual({
      type: "audit",
      timestamp: "2026-10-05T12:00:00.000Z",
      outcome: "denied",
      actorId: "u1",
      action: "auth.admin.denied",
      reason: "not_admin",
      ip: "203.0.113.4",
      target: { providerId: "proconnect" },
    });
  });

  it("neutralise un motif qui n'est pas un code", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    logSecurityDenial({
      actorId: null,
      action: "auth.login.failed",
      reason: "email leaked <script>",
    });

    expect(JSON.parse(String(info.mock.calls[0]?.[0])).reason).toBe("unspecified");
  });
});

describe("oauthCallbackDenial", () => {
  it("ignore une redirection de connexion réussie", () => {
    expect(
      oauthCallbackDenial({
        path: "/oauth2/callback/:providerId",
        statusCode: 302,
        location: "https://dahlia.example/case_files",
      }),
    ).toBeNull();
  });

  it("retient le code d'erreur du callback OAuth", () => {
    expect(
      oauthCallbackDenial({
        path: "/oauth2/callback/:providerId",
        statusCode: 302,
        location: "https://dahlia.example/api/auth/error?error=oauth_code_verification_failed",
      }),
    ).toEqual({ reason: "oauth_code_verification_failed" });
  });

  it("retient un échec HTTP hors redirection", () => {
    expect(
      oauthCallbackDenial({
        path: "/oauth2/callback/:providerId",
        statusCode: 401,
        location: null,
      }),
    ).toEqual({ reason: "http_401" });
  });

  it("ignore les autres routes", () => {
    expect(
      oauthCallbackDenial({
        path: "/get-session",
        statusCode: 401,
        location: null,
      }),
    ).toBeNull();
  });
});
