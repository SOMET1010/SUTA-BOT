import { expect, test } from "@playwright/test";

/**
 * Écran public voice-first (scène de nuit). Réaligné sur l'interface réelle :
 * l'ancienne version de ce spec vérifiait des textes disparus depuis
 * plusieurs refontes (« Comment puis-je vous aider ? », suggestions du
 * premier squelette) et échouait avant même la scène de nuit.
 */
test.describe("Écran principal SUTA", () => {
  test("affiche l'invitation, SUTA comme bouton vocal et les amorces", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Parlez-moi, je vous écoute." })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Activer le microphone/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Mon village est-il connecté ?" })).toBeVisible();
  });

  test("le composeur clavier est replié puis s'ouvre à la demande", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByLabel("Écrire un message à SUTA")).not.toBeVisible();
    await page.getByRole("button", { name: "Écrire à SUTA au clavier" }).click();
    await expect(page.getByLabel("Écrire un message à SUTA")).toBeVisible();
  });

  test("une amorce envoie la question dans la conversation", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Mon village est-il connecté ?" }).click();
    await expect(page.getByText("Je voudrais savoir si mon village est connecté.")).toBeVisible();
  });

  test("l'endpoint /api/health répond avec un statut", async ({ request }) => {
    const response = await request.get("/api/health");
    const body = await response.json();
    expect(body.status).toBeDefined();
    expect(body.checks).toBeDefined();
  });
});
