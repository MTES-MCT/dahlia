import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    // Playwright end-to-end specs (tests/e2e/**) run with their own runner.
    exclude: ["**/node_modules/**", "**/dist/**", ".next/**", "tests/e2e/**"],
  },
});
