import { test, expect } from "@playwright/test";
import { loginWithProConnect } from "./helpers/auth";
import { deleteUser } from "./helpers/db";
import { TEST_AGENT, TEST_AGENT_FULL_NAME } from "./constants";

// Processus de connexion via le mock ProConnect.
test.describe("Connexion ProConnect", () => {
  test.beforeEach(async () => {
    // Repartir d'un état propre : le compte est (re)créé par le flux OAuth.
    await deleteUser(TEST_AGENT.email);
  });

  test("connecte l'agent et affiche son identité dans le header", async ({ page }) => {
    await loginWithProConnect(page);

    // Session établie : le header bascule sur l'identité de l'agent + déconnexion.
    // (Si la session n'existait pas, le layout protégé renverrait vers /connexion.)
    // Le header DSFR rend les items deux fois (desktop + mobile) → `.first()`.
    await expect(page.getByText(TEST_AGENT_FULL_NAME).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Se déconnecter/i }).first()).toBeVisible();
  });
});
