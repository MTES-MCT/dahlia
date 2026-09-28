import { afterEach, describe, expect, it, vi } from "vitest";
import { logAdminAudit } from "./audit-log";

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
