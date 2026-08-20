import { expect, test } from "@playwright/test";

test.describe("Accès administration", () => {
  test("l'accès non authentifié à /admin redirige vers /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test("la page de connexion affiche le formulaire", async ({ page }) => {
    await page.goto("/admin/login");
    await expect(page.getByLabel("Mot de passe administrateur")).toBeVisible();
    await expect(page.getByRole("button", { name: /Se connecter/ })).toBeVisible();
  });

  test("l'accès non authentifié aux API admin renvoie 401 ou 503", async ({ request }) => {
    const response = await request.get("/api/admin/documents");
    expect([401, 503]).toContain(response.status());
  });
});
