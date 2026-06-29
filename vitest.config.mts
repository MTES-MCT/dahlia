import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "data/test-support/server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    // Integration tests need a real Postgres database and are run separately via
    // `pnpm test:integration` (vitest.integration.config.mts). Keep the default
    // suite Postgres-free.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.{ts,tsx}"],
  },
});
