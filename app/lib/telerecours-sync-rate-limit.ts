import { headers } from "next/headers";
import { RateLimiterRes } from "rate-limiter-flexible";
import { clientIpFrom, logSecurityDenial } from "@/app/lib/audit-log";
import type { CaseFileKey } from "@/app/lib/case-file-key";
import { getCurrentUserId } from "@/app/lib/case-file-scope";
import { pgPool } from "@/app/lib/prisma";
import { TELERECOURS_SYNC_RATE_LIMIT_MESSAGE } from "@/app/lib/telerecours-sync-rate-limit-message";
import {
  TELERECOURS_SYNC_RATE_LIMIT_DURATION_SECONDS,
  createTelerecoursSyncRateLimiter,
} from "@/app/lib/telerecours-sync-rate-limiter";

export type TelerecoursSyncRateLimitDecision =
  | { allowed: true }
  | { allowed: false; limited: true; retryAfterSeconds: number; error: string }
  | { allowed: false; limited: false; error: string };

const globalForLimiter = globalThis as unknown as {
  telerecoursSyncRateLimiter?: ReturnType<typeof createTelerecoursSyncRateLimiter>;
};

function limiter() {
  // Lazy: importing this module must not open Postgres (unit tests mock the
  // pool and never call consume). One instance per process, including HMR.
  globalForLimiter.telerecoursSyncRateLimiter ??= createTelerecoursSyncRateLimiter(pgPool);
  return globalForLimiter.telerecoursSyncRateLimiter;
}

function retryAfterSeconds(msBeforeNext: number): number {
  if (!Number.isFinite(msBeforeNext) || msBeforeNext <= 0) {
    return TELERECOURS_SYNC_RATE_LIMIT_DURATION_SECONDS;
  }
  return Math.max(1, Math.ceil(msBeforeNext / 1000));
}

// Consume one point for the validated user. Refuses the sync when the budget
// is spent, when the caller is anonymous, or when Postgres cannot be asked —
// the shared Télérecours credentials are not called in those cases.
export async function consumeTelerecoursSyncRateLimit(
  target: CaseFileKey,
): Promise<TelerecoursSyncRateLimitDecision> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { allowed: false, limited: false, error: "Dossier introuvable." };
  }

  try {
    await limiter().consume(userId);
    return { allowed: true };
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      const requestHeaders = await headers();
      logSecurityDenial({
        action: "telerecours.sync.rate_limited",
        actorId: userId,
        reason: "rate_limited",
        ip: clientIpFrom(requestHeaders),
        target: {
          resource: "telerecours_sync",
          jurisdictionCode: target.jurisdictionCode,
          caseFileNumber: target.caseFileNumber,
        },
      });
      return {
        allowed: false,
        limited: true,
        retryAfterSeconds: retryAfterSeconds(error.msBeforeNext),
        error: TELERECOURS_SYNC_RATE_LIMIT_MESSAGE,
      };
    }

    console.error(
      "Télérecours sync rate limiter failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { allowed: false, limited: false, error: "Échec de la synchronisation" };
  }
}
