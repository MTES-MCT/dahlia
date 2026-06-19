import { type Page } from "@playwright/test";

// Drives the ProConnect login flow end-to-end against the mock provider:
// open /connexion, click the ProConnect button and wait until better-auth has
// completed the OAuth round-trip and redirected to the post-login target.
export async function loginWithProConnect(page: Page): Promise<void> {
  await page.goto("/connexion");

  await page.getByRole("button", { name: /ProConnect/i }).click();

  // The flow bounces through the mock authorize/token/userinfo endpoints and
  // lands back on the app, where the protected layout takes over.
  await page.waitForURL(/\/case_files/, { timeout: 15_000 });
}
