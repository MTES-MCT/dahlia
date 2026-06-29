import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Integration tests (`*.integration.test.{ts,tsx}`) run against a real Postgres
// database (see data/test-support/integration-db.ts). Run with
// `pnpm test:integration`; they are excluded from the default `pnpm test` suite.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    include: ["**/*.integration.test.{ts,tsx}"],
    // Booting the DB + migrations can take a little while on the first run.
    hookTimeout: 60000,
  },
});
