import { test, expect } from "@playwright/test";

// Page de garde, sans connexion.
test.describe("Page de garde (non connecté)", () => {
  test("affiche la page d'accueil publique", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Hello World" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Visualiser les dossiers" })).toBeVisible();

    // Header : proposition de connexion, pas d'identité affichée.
    await expect(page.getByRole("link", { name: /Se connecter/i })).toBeVisible();
  });

  test("redirige vers /connexion quand on tente d'accéder aux dossiers sans session", async ({
    page,
  }) => {
    await page.goto("/case_files");

    await expect(page).toHaveURL(/\/connexion$/);
    await expect(page.getByRole("heading", { name: "Connexion" })).toBeVisible();
    await expect(page.getByRole("button", { name: /ProConnect/i })).toBeVisible();
  });
});
