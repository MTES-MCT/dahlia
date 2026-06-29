import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    // Integration tests need a real Postgres database and are run separately via
    // `pnpm test:integration` (vitest.integration.config.mts). Keep the default
    // suite Postgres-free.
    exclude: ["**/node_modules/**", "**/dist/**", "**/*.integration.test.{ts,tsx}"],
  },
});
