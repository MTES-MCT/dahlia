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
async function ensureDatabaseExists(): Promise<void> {
  const dbName = testDatabaseName();
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (existing.rowCount === 0) {
      // Database names cannot be parameterized; dbName comes from our own config.
      await admin.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await admin.end();
  }
}

// Provision the test database: create it if missing, then apply every migration
// (incl. the unaccent function and the GENERATED ALWAYS columns) via
// `prisma migrate deploy`. Idempotent — safe to call before each run.
export async function setupTestDatabase(): Promise<void> {
  await ensureDatabaseExists();
  execSync("pnpm exec prisma migrate deploy", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
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
];

// Wipe all business tables so each test starts from a clean, known state.
export async function resetTestDatabase(): Promise<void> {
  const list = TABLES.map((t) => `"${t}"`).join(", ");
  await testPrisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
