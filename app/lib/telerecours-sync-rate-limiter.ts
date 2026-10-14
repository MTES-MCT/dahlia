import { RateLimiterPostgres } from "rate-limiter-flexible";
import type { Pool } from "pg";

// One sync per case-file page view. 20 per minute leaves room to browse
// dossiers one after another, and cuts off a parallel script before it can
// hammer the jurisdiction's shared Télérecours credentials or the database.
// The public message says "une minute", so this window stays 60 seconds.
export const TELERECOURS_SYNC_RATE_LIMIT_POINTS = 20;
export const TELERECOURS_SYNC_RATE_LIMIT_DURATION_SECONDS = 60;

export const TELERECOURS_SYNC_RATE_LIMIT_TABLE = "telerecours_sync_rate_limits";

type LimiterOverrides = {
  points?: number;
  duration?: number;
  clearExpiredByTimeout?: boolean;
};

// RateLimiterPostgres upserts with INSERT … ON CONFLICT, which locks the row.
// RateLimiterPrisma is not used: it reads then writes and loses increments
// when several requests arrive together.
// `tableCreated` is required. The library would otherwise CREATE TABLE at
// runtime, and the next `prisma migrate dev` would report drift.
export function createTelerecoursSyncRateLimiter(
  storeClient: Pool,
  overrides?: LimiterOverrides,
): RateLimiterPostgres {
  const points = overrides?.points ?? TELERECOURS_SYNC_RATE_LIMIT_POINTS;
  const duration = overrides?.duration ?? TELERECOURS_SYNC_RATE_LIMIT_DURATION_SECONDS;

  return new RateLimiterPostgres({
    storeClient,
    storeType: "pool",
    tableName: TELERECOURS_SYNC_RATE_LIMIT_TABLE,
    tableCreated: true,
    keyPrefix: "user",
    points,
    duration,
    // After the budget is spent, reject for the rest of the window instead of
    // allowing a second burst when the fixed window rolls over.
    blockDuration: duration,
    // Once this process has seen the budget exhausted, skip further Postgres
    // round-trips for that user. Other instances still consult Postgres.
    inMemoryBlockOnConsumed: points,
    inMemoryBlockDuration: duration,
    clearExpiredByTimeout: overrides?.clearExpiredByTimeout ?? true,
  });
}
