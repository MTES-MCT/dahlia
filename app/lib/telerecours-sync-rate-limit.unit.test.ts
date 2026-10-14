import { beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiterRes } from "rate-limiter-flexible";

const { consumeMock, mockGetCurrentUserId } = vi.hoisted(() => ({
  consumeMock: vi.fn(),
  mockGetCurrentUserId: vi.fn(),
}));

vi.mock("rate-limiter-flexible", () => {
  class RateLimiterRes {
    readonly remainingPoints: number;
    readonly msBeforeNext: number;
    readonly consumedPoints: number;
    readonly isFirstInDuration: boolean;

    constructor(
      remainingPoints = 0,
      msBeforeNext = 0,
      consumedPoints = 0,
      isFirstInDuration = false,
    ) {
      this.remainingPoints = remainingPoints;
      this.msBeforeNext = msBeforeNext;
      this.consumedPoints = consumedPoints;
      this.isFirstInDuration = isFirstInDuration;
    }
  }

  class RateLimiterPostgres {
    consume = consumeMock;
  }

  return { RateLimiterRes, RateLimiterPostgres };
});

vi.mock("@/app/lib/prisma", () => ({
  pgPool: {},
}));

vi.mock("@/app/lib/case-file-scope", () => ({
  getCurrentUserId: (...args: unknown[]) => mockGetCurrentUserId(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "203.0.113.4" }),
}));

import { TELERECOURS_SYNC_RATE_LIMIT_MESSAGE } from "@/app/lib/telerecours-sync-rate-limit-message";
import { consumeTelerecoursSyncRateLimit } from "@/app/lib/telerecours-sync-rate-limit";
import { TELERECOURS_SYNC_RATE_LIMIT_DURATION_SECONDS } from "@/app/lib/telerecours-sync-rate-limiter";

const TARGET = { jurisdictionCode: "TA069", caseFileNumber: "TA069/2024/001" };

describe("consumeTelerecoursSyncRateLimit", () => {
  const info = vi.spyOn(console, "info").mockImplementation(() => {});
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
    delete (globalThis as { telerecoursSyncRateLimiter?: unknown }).telerecoursSyncRateLimiter;
    mockGetCurrentUserId.mockResolvedValue("user-1");
    consumeMock.mockResolvedValue(undefined);
  });

  it("associe le message public à une fenêtre d'une minute", () => {
    expect(TELERECOURS_SYNC_RATE_LIMIT_DURATION_SECONDS).toBe(60);
    expect(TELERECOURS_SYNC_RATE_LIMIT_MESSAGE).toContain("une minute");
  });

  it("consomme un point pour l'utilisateur validé", async () => {
    await expect(consumeTelerecoursSyncRateLimit(TARGET)).resolves.toEqual({ allowed: true });
    expect(consumeMock).toHaveBeenCalledWith("user-1");
  });

  it("refuse sans consommer de point quand il n'y a pas d'utilisateur validé", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);

    await expect(consumeTelerecoursSyncRateLimit(TARGET)).resolves.toEqual({
      allowed: false,
      limited: false,
      error: "Dossier introuvable.",
    });
    expect(consumeMock).not.toHaveBeenCalled();
  });

  it("refuse et trace l'abus quand le budget est épuisé", async () => {
    consumeMock.mockRejectedValue(new RateLimiterRes(0, 1500, 21, false));

    await expect(consumeTelerecoursSyncRateLimit(TARGET)).resolves.toEqual({
      allowed: false,
      limited: true,
      retryAfterSeconds: 2,
      error: TELERECOURS_SYNC_RATE_LIMIT_MESSAGE,
    });
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toEqual(
      expect.objectContaining({
        type: "audit",
        outcome: "denied",
        actorId: "user-1",
        action: "telerecours.sync.rate_limited",
        reason: "rate_limited",
        ip: "203.0.113.4",
        target: {
          resource: "telerecours_sync",
          jurisdictionCode: "TA069",
          caseFileNumber: "TA069/2024/001",
        },
      }),
    );
  });

  it("échoue fermé quand Postgres ne répond pas", async () => {
    consumeMock.mockRejectedValue(new Error("connection refused"));

    await expect(consumeTelerecoursSyncRateLimit(TARGET)).resolves.toEqual({
      allowed: false,
      limited: false,
      error: "Échec de la synchronisation",
    });
    expect(errorLog).toHaveBeenCalledWith(
      "Télérecours sync rate limiter failed",
      "connection refused",
    );
    expect(info).not.toHaveBeenCalled();
  });
});
