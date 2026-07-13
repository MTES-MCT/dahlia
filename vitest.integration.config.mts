import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Custom flag consumed by integration-db.ts; strip it so Vitest does not choke.
if (process.argv.includes("--db-reset")) {
  process.env.DAHLIA_INTEGRATION_DB_RESET = "1";
  process.argv.splice(process.argv.indexOf("--db-reset"), 1);
}

// Integration tests (`*.integration.test.{ts,tsx}`) run against a real Postgres
// database (see data/test-support/integration-db.ts). Run with
// `pnpm test:integration` (or `pnpm test:integration -- --db-reset` to wipe and
// re-apply all migrations); unit tests use `*.unit.test.{ts,tsx}` via `pnpm test:unit`.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "data/test-support/server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["**/*.integration.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    // All integration tests share one Postgres database (dahlia_test); run files
    // sequentially so reset/seed hooks do not race across test files.
    fileParallelism: false,
    // Booting the DB + migrations can take a little while on the first run.
    hookTimeout: 60000,
  },
});
