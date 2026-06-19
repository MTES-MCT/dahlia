import { test, expect } from "@playwright/test";
import { loginWithProConnect } from "./helpers/auth";
import { validateUser } from "./helpers/db";
import { TEST_AGENT } from "./constants";

// Accès à la liste des dossiers une fois connecté ET validé.
test.describe("Liste des dossiers (connecté)", () => {
  test("un compte non validé voit le message d'attente", async ({ page }) => {
    await loginWithProConnect(page);

    // Compte fraîchement créé → non validé → page d'attente, pas de dossiers.
    await expect(page.getByText("Compte en attente de validation")).toBeVisible();
  });

  test("un compte validé accède à la liste des dossiers de test", async ({ page }) => {
    await loginWithProConnect(page);

    // Un administrateur valide le compte (cf. app/(protected)/layout.tsx).
    const updated = await validateUser(TEST_AGENT.email);
    expect(updated).toBe(true);

    await page.goto("/case_files");

    await expect(
      page.getByRole("heading", { name: /Affaires suivies par la DDETS du Rhône/i }),
    ).toBeVisible();

    // Données de seed : 2 dossiers au statut filtré par défaut.
    await expect(page.getByRole("link", { name: "2400001" })).toBeVisible();
    await expect(page.getByRole("link", { name: "2400002" })).toBeVisible();

    // Requérant / défendeur des dossiers de test (cf. tests/e2e/seed.ts).
    await expect(page.getByText("DUPONT Jean")).toBeVisible();
    await expect(page.getByText("PRÉFECTURE DU RHÔNE").first()).toBeVisible();

    // Le dossier au statut « Clôture d'instruction » est masqué par le filtre par défaut.
    await expect(page.getByRole("link", { name: "2400003" })).toHaveCount(0);
  });
});
