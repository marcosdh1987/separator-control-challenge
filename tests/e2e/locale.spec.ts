import { expect, test } from "@playwright/test";

const STORAGE_KEY = "scc.locale";

test.describe("language selection", () => {
  // A Spanish-speaking operator should land in Spanish without touching anything.
  test.use({ locale: "es-AR" });

  test.beforeEach(async ({ page }) => {
    // A returning visitor: the first-run modal would otherwise cover the deck.
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "separator-control-onboarding-v1",
        JSON.stringify({ quickStartDismissed: true, guidedTourDismissed: true }),
      );
    });
  });

  test("follows a Spanish browser and keeps the simulator usable", async ({ page }) => {
    await page.goto("/challenge");
    await expect(page.locator("html")).toHaveAttribute("lang", "es");

    const start = page.getByRole("button", { name: "Iniciar intento", exact: true });
    await expect(start).toBeEnabled();
    await start.click();

    await expect(page.getByRole("button", { name: "Pausar intento", exact: true })).toBeVisible();
    // Instrument tags stay in their published form; only the prose is translated.
    await expect(page.getByText("Válvula de petróleo LV-101").first()).toBeVisible();
  });

  test("lets an explicit choice outrank the browser preference", async ({ page }) => {
    await page.goto("/challenge");
    await expect(page.getByRole("button", { name: "Iniciar intento", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("button", { name: "Start attempt", exact: true })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await page.reload();
    await expect(page.getByRole("button", { name: "Start attempt", exact: true })).toBeVisible();
    expect(
      await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY),
    ).toBe("en");
  });
});
