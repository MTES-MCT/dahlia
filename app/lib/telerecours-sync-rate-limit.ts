import { headers } from "next/headers";
import { RateLimiterRes } from "rate-limiter-flexible";
import { clientIpFrom, logSecurityDenial } from "@/app/lib/audit-log";
import type { SecurityAuditAction } from "@/app/lib/audit-log";
import type { CaseFileKey } from "@/app/lib/case-file-key";
import { getCurrentUserId } from "@/app/lib/case-file-scope";
import { pgPool } from "@/app/lib/prisma";
import { TELERECOURS_USER_RATE_LIMIT_MESSAGE } from "@/app/lib/telerecours-sync-rate-limit-message";
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

type ConsumeContext = {
  auditAction: SecurityAuditAction;
  auditResource: string;
  infrastructureError: string;
};

async function consumeTelerecoursUserRateLimit(
  target: CaseFileKey,
  points: number,
  context: ConsumeContext,
): Promise<TelerecoursSyncRateLimitDecision> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { allowed: false, limited: false, error: "Dossier introuvable." };
  }

  if (!Number.isFinite(points) || points < 1) {
    return { allowed: false, limited: false, error: context.infrastructureError };
  }

  try {
    await limiter().consume(userId, points);
    return { allowed: true };
  } catch (error) {
    if (error instanceof RateLimiterRes) {
      const requestHeaders = await headers();
      logSecurityDenial({
        action: context.auditAction,
        actorId: userId,
        reason: "rate_limited",
        ip: clientIpFrom(requestHeaders),
        target: {
          resource: context.auditResource,
          jurisdictionCode: target.jurisdictionCode,
          caseFileNumber: target.caseFileNumber,
        },
      });
      return {
        allowed: false,
        limited: true,
        retryAfterSeconds: retryAfterSeconds(error.msBeforeNext),
        error: TELERECOURS_USER_RATE_LIMIT_MESSAGE,
      };
    }

    console.error(
      "Télérecours user rate limiter failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { allowed: false, limited: false, error: context.infrastructureError };
  }
}

// Consume one point for the validated user. Refuses the sync when the budget
// is spent, when the caller is anonymous, or when Postgres cannot be asked —
// the shared Télérecours credentials are not called in those cases.
export async function consumeTelerecoursSyncRateLimit(
  target: CaseFileKey,
): Promise<TelerecoursSyncRateLimitDecision> {
  return consumeTelerecoursUserRateLimit(target, 1, {
    auditAction: "telerecours.sync.rate_limited",
    auditResource: "telerecours_sync",
    infrastructureError: "Échec de la synchronisation",
  });
}

// Same per-user budget as manual sync (one point per pièce fetched from
// Télérecours). Refuses before downloadFile when the budget is spent.
export async function consumeTelerecoursPieceDownloadRateLimit(
  target: CaseFileKey,
  points = 1,
): Promise<TelerecoursSyncRateLimitDecision> {
  return consumeTelerecoursUserRateLimit(target, points, {
    auditAction: "telerecours.piece_download.rate_limited",
    auditResource: "telerecours_piece_download",
    infrastructureError: "Échec du téléchargement",
  });
}
