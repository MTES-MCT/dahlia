import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { RateLimiterRes } from "rate-limiter-flexible";
import { setupTestDatabase, TEST_DATABASE_URL } from "@/data/test-support/integration-db";
import { createTelerecoursSyncRateLimiter } from "@/app/lib/telerecours-sync-rate-limiter";

// The table is created by Prisma. This checks that its columns match the
// atomic upsert rate-limiter-flexible sends (INSERT … ON CONFLICT).
describe("telerecours sync rate limiter (postgres)", () => {
  let pool: Pool;

  beforeAll(async () => {
    await setupTestDatabase();
    pool = new Pool({ connectionString: TEST_DATABASE_URL });
  });

  afterAll(async () => {
    await pool?.end();
  });

  async function limiterFor(points: number) {
    return createTelerecoursSyncRateLimiter(pool, {
      points,
      duration: 60,
      clearExpiredByTimeout: false,
    });
  }

  async function deleteUser(userId: string) {
    await pool.query(`DELETE FROM telerecours_sync_rate_limits WHERE key = $1`, [`user:${userId}`]);
  }

  it("autorise le budget d'un utilisateur puis refuse la suite, y compris en parallèle", async () => {
    const userId = `sync-${crypto.randomUUID()}`;
    const limiter = await limiterFor(3);

    try {
      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => limiter.consume(userId)),
      );
      const allowed = results.filter((result) => result.status === "fulfilled");
      const rejected = results.filter((result) => result.status === "rejected");

      expect(allowed).toHaveLength(3);
      expect(rejected).toHaveLength(5);
      for (const result of rejected) {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") {
          expect(result.reason).toBeInstanceOf(RateLimiterRes);
          expect(result.reason).not.toBeInstanceOf(Error);
        }
      }
    } finally {
      await deleteUser(userId);
    }
  });

  it("ne partage pas le budget entre deux utilisateurs", async () => {
    const first = `sync-${crypto.randomUUID()}`;
    const second = `sync-${crypto.randomUUID()}`;
    const limiter = await limiterFor(2);

    try {
      await expect(limiter.consume(first)).resolves.toBeInstanceOf(RateLimiterRes);
      await expect(limiter.consume(first)).resolves.toBeInstanceOf(RateLimiterRes);
      await expect(limiter.consume(first)).rejects.toBeInstanceOf(RateLimiterRes);

      await expect(limiter.consume(second)).resolves.toBeInstanceOf(RateLimiterRes);
      await expect(limiter.consume(second)).resolves.toBeInstanceOf(RateLimiterRes);
    } finally {
      await deleteUser(first);
      await deleteUser(second);
    }
  });
});
