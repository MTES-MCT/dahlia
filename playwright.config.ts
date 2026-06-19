import { defineConfig, devices } from "@playwright/test";
import {
  APP_PORT,
  APP_URL,
  MOCK_PROCONNECT_PORT,
  MOCK_PROCONNECT_URL,
  PROCONNECT_CLIENT_ID,
  PROCONNECT_CLIENT_SECRET,
  BETTER_AUTH_SECRET,
  TEST_AGENT,
  DATABASE_URL,
} from "./tests/e2e/constants";

const isCI = !!process.env.CI;

// Environment shared by the app under test. Real environment variables take
// precedence over the repo `.env` in Next.js, so these override the developer's
// local config (dev database, real ProConnect, …) for the duration of the run.
const appEnv = {
  ...process.env,
  DATABASE_URL,
  ENVIRONMENT: "test",
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: APP_URL,
  PROCONNECT_URL: MOCK_PROCONNECT_URL,
  PROCONNECT_CLIENT_ID,
  PROCONNECT_CLIENT_SECRET,
  // Isolated build output so the e2e server never clobbers a running `next dev`.
  NEXT_DIST_DIR: ".next-e2e",
};

const mockEnv = {
  ...process.env,
  MOCK_PROCONNECT_PORT: String(MOCK_PROCONNECT_PORT),
  MOCK_PROCONNECT_ISSUER: MOCK_PROCONNECT_URL,
  MOCK_PROCONNECT_CLIENT_ID: PROCONNECT_CLIENT_ID,
  MOCK_PROCONNECT_SUB: TEST_AGENT.sub,
  MOCK_PROCONNECT_EMAIL: TEST_AGENT.email,
  MOCK_PROCONNECT_GIVEN_NAME: TEST_AGENT.givenName,
  MOCK_PROCONNECT_USUAL_NAME: TEST_AGENT.usualName,
};

export default defineConfig({
  testDir: "./tests/e2e",
  // Tests share one database and the single test-agent account, so run serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/mock-proconnect/server.mjs",
      url: `${MOCK_PROCONNECT_URL}/api/v2/.well-known/openid-configuration`,
      env: mockEnv,
      reuseExistingServer: !isCI,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `pnpm exec next build && pnpm exec next start --port ${APP_PORT}`,
      url: APP_URL,
      env: appEnv,
      reuseExistingServer: !isCI,
      timeout: 240_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
