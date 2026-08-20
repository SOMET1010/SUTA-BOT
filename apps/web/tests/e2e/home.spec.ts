import { expect, test } from "@playwright/test";

test.describe("Écran principal SUTA", () => {
  test("affiche le nom SUTA, la question d'accueil et le micro", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "SUTA" })).toBeVisible();
    await expect(page.getByText("Comment puis-je vous aider ?")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Activer le microphone/i }),
    ).toBeVisible();
  });

  test("permet d'envoyer une question via le champ texte et affiche une réponse", async ({
    page,
  }) => {
    await page.goto("/");

    await page.getByLabel("Écrire un message à SUTA").fill("Qui es-tu ?");
    await page.getByRole("button", { name: "Envoyer" }).click();

    await expect(page.getByText("Qui es-tu ?")).toBeVisible();
    await expect(page.getByText(/SUTA/, { exact: false }).first()).toBeVisible();
  });

  test("le mode kiosque masque le pied de page technique", async ({ page }) => {
    await page.goto("/?mode=kiosk");
    await expect(page.getByText("Démonstrateur — MVP Salon")).not.toBeVisible();
  });

  test("l'endpoint /api/health répond avec un statut", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBeDefined();
    expect(body.services.realtime).toBe("ok");
  });
});
