import { test, expect } from "@playwright/test";

test.describe("Catalogue et fiche produit", () => {
  test("la page catalogue affiche le titre et la recherche", async ({ page }) => {
    await page.goto("/catalogue");
    await expect(page).toHaveURL(/\/(catalogue|login)/);
    if (page.url().includes("/login")) {
      test.skip();
      return;
    }
    await expect(page.getByRole("heading", { name: /Catalogue/i })).toBeVisible();
    await expect(page.getByPlaceholder(/Rechercher/i)).toBeVisible();
  });

  test("la fiche produit affiche les onglets (Résumé, Qualité, Champs, Enrichissement)", async ({
    page,
  }) => {
    await page.goto("/catalogue");
    if (page.url().includes("/login")) {
      test.skip();
      return;
    }
    const firstProductLink = page.locator('a[href*="/catalogue/"]').first();
    const count = await firstProductLink.count();
    if (count === 0) {
      await expect(page.getByText(/Aucun produit|Aucun catalogue/i)).toBeVisible();
      test.skip();
      return;
    }
    await firstProductLink.click();
    await expect(page).toHaveURL(/\/catalogue\/[^/]+/);
    await expect(page.getByRole("button", { name: /Résumé/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Qualité/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Tous les champs/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Enrichissement/i })).toBeVisible();
  });

  test("onglet Résumé affiche un résumé produit", async ({ page }) => {
    await page.goto("/catalogue");
    if (page.url().includes("/login")) {
      test.skip();
      return;
    }
    const firstProductLink = page.locator('a[href*="/catalogue/"]').first();
    if ((await firstProductLink.count()) === 0) {
      test.skip();
      return;
    }
    await firstProductLink.click();
    await expect(page).toHaveURL(/\/catalogue\/[^/]+/);
    await expect(page.getByRole("button", { name: /Résumé/i })).toBeVisible();
    await expect(page.getByText(/Voir qualité|Voir tous les champs/i)).toBeVisible();
  });
});
