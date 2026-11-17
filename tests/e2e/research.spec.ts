import { expect, test, type Page } from "@playwright/test";

/**
 * Research Lab, end to end: pick a real published run, replay it fast, see the
 * valves, compare controllers, read the metrics and walk the envelope, all
 * read-only and without any simulator running.
 */

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe("Research Lab", () => {
  test.use({ locale: "en-US" });

  test("lists the experiments with their data availability", async ({ page }) => {
    await page.goto("/research");
    await expect(page.getByRole("heading", { level: 1, name: "Replay real research runs" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open experiment" })).toHaveCount(3);
    await expect(page.getByText("Pending", { exact: true })).toBeVisible();
    await expect(page.getByText("Not publishable", { exact: true })).toBeVisible();
    await noHorizontalScroll(page);
  });

  test("replays the actuator-lag runs, pauses before the band exit and compares the controllers", async ({ page }) => {
    await page.goto("/research/c2-lcv102-actuator-lag");
    await expect(page.getByText(/Paired runs: scenario high_rate-000, seed 7100/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("research-shifts")).toContainText("shift -396 s");
    await expect(page.getByText(/signals verified bit for bit/).first()).toBeVisible({ timeout: 20_000 });

    // Seek close to the documented band exit and play at x50: the clock must
    // stop 30 simulated seconds before 12,415 s.
    const slider = page.getByRole("slider", { name: "Simulated time" });
    await slider.fill("12300");
    await page.getByRole("button", { name: "×50" }).click();
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Paused 30 s of simulated time before" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("research-time")).toHaveText("3:26:25");

    await page.getByRole("button", { name: /Technical \(P&ID\)/ }).click();
    const diagram = page.getByRole("img", { name: /Piping and instrumentation view/ });
    await expect(diagram).toBeVisible();
    await expect(diagram.getByText("LCV-102", { exact: true })).toBeVisible();

    const metrics = page.getByRole("region", { name: "Metrics" });
    await expect(metrics.getByText("12,415 s after hold start")).toBeVisible();
    await expect(page.getByText("agrees")).toHaveCount(4);
    await noHorizontalScroll(page);
  });

  test("plays and pauses from the keyboard", async ({ page }) => {
    await page.goto("/research/c2-lcv102-stiction");
    const play = page.getByRole("button", { name: "Play", exact: true });
    await expect(play).toBeEnabled({ timeout: 20_000 });
    await play.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });

  test("walks the envelope and opens a published point's replay", async ({ page }) => {
    await page.goto("/research/envelope");
    await expect(page.getByRole("button", { name: /__nominal__s7100:/ })).toHaveCount(40, { timeout: 20_000 });
    await page.getByRole("button", { name: /^oat-bean_64th-2__nominal__s7100:/ }).click();
    await expect(page.getByText("Selected run")).toBeVisible();
    await page.getByRole("link", { name: "Open the replay" }).click();
    await expect(page).toHaveURL(/\/research\/replay\/nominal-pilot-20261113T234459Z\/oat-bean_64th-2__nominal__s7100$/);
    await expect(page.getByTestId("research-frame")).toBeVisible({ timeout: 20_000 });
    await noHorizontalScroll(page);
  });

  test("is reachable from the training course", async ({ page }) => {
    await page.goto("/training");
    await page.getByRole("link", { name: "Open the Research Lab" }).click();
    await expect(page).toHaveURL(/\/research$/);
  });
});
