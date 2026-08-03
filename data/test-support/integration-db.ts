// Test harness for integration tests that hit a real Postgres database instead
// of mocking Prisma. It provisions a dedicated `dahlia_test` database on the
// same Postgres server as dev (so it never touches dev data), applies all
// migrations to it, and exposes a `testPrisma` client pointed at it.
//
// Integration tests are excluded from the default `pnpm test` run and executed
// via `pnpm test:integration` (see vitest.integration.config.mts), so a Postgres
// instance is only required for that command, not for the unit suite.
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client } from "pg";

// Connection string for the test database. Defaults to a `dahlia_test` database
// on the local docker Postgres; overridable via TEST_DATABASE_URL (e.g. in CI).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://dahlia:dahlia@localhost:5432/dahlia_test?schema=public";

// Dedicated Prisma client for tests. Unit tests mock `@/app/lib/prisma`; the
// integration tests mock it to return this client instead, so the real
// data-access functions run their actual Prisma queries against the test DB.
const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL });
export const testPrisma = new PrismaClient({ adapter });

// Extract the database name from the test URL (e.g. "dahlia_test").
function testDatabaseName(): string {
  return new URL(TEST_DATABASE_URL).pathname.replace(/^\//, "");
}

// Connect to the server's maintenance database (`postgres`) and create the test
// database if it does not exist yet. `CREATE DATABASE` cannot run inside the
// target database, hence the separate admin connection.
async function withAdminClient<T>(fn: (admin: Client) => Promise<T>): Promise<T> {
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

async function ensureDatabaseExists(): Promise<void> {
  const dbName = testDatabaseName();
  await withAdminClient(async (admin) => {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (existing.rowCount === 0) {
      // Database names cannot be parameterized; dbName comes from our own config.
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  });
}

// Drop and recreate the dedicated test database (never dev/prod). Equivalent to
// `prisma migrate reset` but scoped to `dahlia_test` and without Prisma's reset
// guardrails — safe because the database name comes from our own test config.
async function recreateTestDatabase(): Promise<void> {
  const dbName = testDatabaseName();
  await testPrisma.$disconnect();
  await withAdminClient(async (admin) => {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await admin.query(`CREATE DATABASE "${dbName}"`);
  });
}

function prismaEnv(): NodeJS.ProcessEnv {
  return { ...process.env, DATABASE_URL: TEST_DATABASE_URL };
}

// True when integration tests are launched with `--db-reset` (see
// vitest.integration.config.mts). Use after editing an already-applied migration
// so the test database is rebuilt from scratch instead of staying on stale SQL.
export function integrationDbResetRequested(): boolean {
  return process.env.DAHLIA_INTEGRATION_DB_RESET === "1";
}

// Provision the test database: create it if missing, then apply every migration
// (incl. the unaccent function and the GENERATED ALWAYS columns). By default uses
// `prisma migrate deploy` (idempotent). Pass `--db-reset` to drop and recreate
// the test database first (re-applies all migrations from scratch).
export async function setupTestDatabase(): Promise<void> {
  if (integrationDbResetRequested()) {
    await recreateTestDatabase();
  } else {
    await ensureDatabaseExists();
  }
  execSync("pnpm exec prisma migrate deploy", {
    cwd: process.cwd(),
    env: prismaEnv(),
    stdio: "inherit",
  });
}

// Tables truncated between seeds, in no particular order thanks to CASCADE.
// `RESTART IDENTITY` is harmless here (all our PKs are supplied explicitly).
const TABLES = [
  "attached_files",
  "file_family_types",
  "case_file_events",
  "measures",
  "actor_representations",
  "case_file_actors",
  "related_case_files",
  "last_decision_readings",
  "case_files",
  "hearings",
  "conclusions",
  "conclusion_operative_parts",
  "actors",
  "qualities",
  "statuses",
  "urgencies",
  "chambers",
  "legal_entity_divisions",
  "sessions",
  "accounts",
  "verifications",
  "users",
];

// Wipe all business tables so each test starts from a clean, known state.
export async function resetTestDatabase(): Promise<void> {
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
