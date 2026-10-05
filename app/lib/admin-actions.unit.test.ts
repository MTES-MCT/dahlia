import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetSession = vi.fn();
const info = vi.hoisted(() => vi.spyOn(console, "info").mockImplementation(() => {}));

vi.mock("@/app/lib/auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { requireAdmin } from "./admin-actions";

const ACCESS_DENIED = { ok: false, error: "Accès réservé aux administrateurs." };

function mockSession(user: { id: string; isValidated: boolean; isAdmin: boolean } | null) {
  mockGetSession.mockResolvedValue(user ? { user } : null);
}

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function denial() {
    return JSON.parse(String(info.mock.calls[0]?.[0])) as {
      action: string;
      actorId: string | null;
      reason: string;
    };
  }

  it("refuse une session absente", async () => {
    mockSession(null);

    expect(await requireAdmin()).toEqual(ACCESS_DENIED);
    expect(denial()).toEqual(
      expect.objectContaining({
        action: "auth.admin.denied",
        actorId: null,
        reason: "unauthenticated",
      }),
    );
  });

  it("refuse un utilisateur validé qui n'est pas administrateur", async () => {
    mockSession({ id: "u1", isValidated: true, isAdmin: false });

    expect(await requireAdmin()).toEqual(ACCESS_DENIED);
    expect(denial()).toEqual(
      expect.objectContaining({
        action: "auth.admin.denied",
        actorId: "u1",
        reason: "not_admin",
      }),
    );
  });

  it("refuse un administrateur non validé", async () => {
    mockSession({ id: "admin-1", isValidated: false, isAdmin: true });

    expect(await requireAdmin()).toEqual(ACCESS_DENIED);
    expect(denial()).toEqual(
      expect.objectContaining({
        action: "auth.admin.denied",
        actorId: "admin-1",
        reason: "not_validated",
      }),
    );
  });

  it("accepte un administrateur validé", async () => {
    mockSession({ id: "admin-1", isValidated: true, isAdmin: true });

    expect(await requireAdmin()).toEqual({ ok: true, userId: "admin-1" });
    expect(info).not.toHaveBeenCalled();
  });
});
