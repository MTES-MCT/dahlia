// Shared constants for the Playwright end-to-end suite.
//
// These values wire together three processes started by Playwright:
//   1. the mock ProConnect (OIDC) server  — tests/e2e/mock-proconnect/server.mjs
//   2. the Next.js application under test  — `next dev`
//   3. the Playwright test runner          — the *.spec.ts files
//
// The app and the mock must agree on the OIDC client id, the issuer URL and the
// identity returned after login, so everything lives here and is injected into
// each process through environment variables (see playwright.config.ts).

export const APP_PORT = 3100;
export const APP_URL = `http://localhost:${APP_PORT}`;

export const MOCK_PROCONNECT_PORT = 9990;
export const MOCK_PROCONNECT_URL = `http://localhost:${MOCK_PROCONNECT_PORT}`;

// OIDC client credentials — arbitrary, shared by the app and the mock provider.
export const PROCONNECT_CLIENT_ID = "dahlia-e2e-client";
export const PROCONNECT_CLIENT_SECRET = "dahlia-e2e-secret"; // pragma: allowlist secret

// Secret used by better-auth to sign session cookies during the tests.
export const BETTER_AUTH_SECRET = "dahlia-e2e-better-auth-secret-0123456789ab"; // pragma: allowlist secret

// Identity returned by the mock ProConnect after a successful login. The app
// creates the corresponding `users` row on the first connection.
export const TEST_AGENT = {
  sub: "e2e-agent-sub",
  email: "agent.e2e@example.gouv.fr",
  givenName: "Camille",
  usualName: "Martin",
} as const;

// Full name as displayed in the header once connected (`firstName lastName`).
export const TEST_AGENT_FULL_NAME = `${TEST_AGENT.givenName} ${TEST_AGENT.usualName}`;

// Test database. Defaults to a dedicated `dahlia_test` database so local runs
// never touch the development data; CI overrides it through DATABASE_URL.
export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://dahlia:dahlia@localhost:5432/dahlia_test?schema=public"; // pragma: allowlist secret
