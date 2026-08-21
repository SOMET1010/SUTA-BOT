import { expect, test } from "@playwright/test";

/**
 * L'écran d'appui : ce que SUTA montre pendant qu'il parle.
 *
 * La recherche est interceptée plutôt qu'exécutée : ces tests portent sur
 * l'affichage, et dépendre d'une base réelle les rendrait tributaires du
 * contenu indexé au moment de leur exécution.
 */
const YAMOUSSOUKRO = {
  title: "YAMOUSSOUKRO (DISTRICT AUTONOME DE YAMOUSSOUKRO)",
  content: "Localité de YAMOUSSOUKRO. Population : 340 234 habitants.",
  source: "Observatoire ANSUT",
  score: 0.71,
  location: { lat: 6.81819, lng: -5.27786, label: "YAMOUSSOUKRO" },
};

const DOCTRINE = {
  title: "Typologie des zones : blanche, grise, noire",
  content: "La typologie concurrentielle classe chaque localité...",
  source: "Observatoire ANSUT",
  score: 0.49,
};

test("affiche une invitation tant qu'aucun lieu n'a été évoqué", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/la carte s'affiche ici/i).first()).toBeVisible();
});

test("affiche la carte du lieu dont SUTA parle", async ({ page }) => {
  await page.route("**/api/tools/search-knowledge", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [YAMOUSSOUKRO, DOCTRINE] }),
    });
  });

  await page.goto("/");
  await page.getByRole("textbox").first().fill("Est-ce que Yamoussoukro est couverte ?");
  await page.keyboard.press("Enter");

  // `.first()` : la carte est rendue deux fois, une par disposition
  // (grand écran et mobile), une seule étant visible à la fois.
  await expect(page.locator(".leaflet-container").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("YAMOUSSOUKRO", { exact: true }).first()).toBeVisible();
});

test("n'affiche aucune carte pour une question de doctrine", async ({ page }) => {
  await page.route("**/api/tools/search-knowledge", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: [DOCTRINE] }),
    });
  });

  await page.goto("/");
  await page.getByRole("textbox").first().fill("Qu'est-ce qu'une zone blanche ?");
  await page.keyboard.press("Enter");

  await expect(page.getByText(DOCTRINE.content.slice(0, 30), { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  // Une réponse sans dimension géographique ne doit pas produire de carte.
  await expect(page.locator(".leaflet-container")).toHaveCount(0);
});
