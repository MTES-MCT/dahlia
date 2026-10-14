import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Singleton PrismaClient. In dev, Next.js reloads on every edit (HMR), which
// would otherwise create a new client each time and exhaust the Postgres pool.
// The instance is stored on globalThis so it is reused.
//
// Since Prisma 7 the client needs a driver adapter (`pg` here). The URL comes
// from `process.env.DATABASE_URL`. The same pool is shared with the Télérecours
// sync rate limiter so we don't open a second set of connections.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPgPool() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // An idle client error with no listener crashes the process.
  pool.on("error", (error) => {
    console.error("Postgres pool error", error.message);
  });
  return pool;
}

export const pgPool = globalForPrisma.pgPool ?? createPgPool();

function createPrismaClient() {
  const adapter = new PrismaPg(pgPool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pgPool;
}
