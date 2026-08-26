import { expect, test, type Page } from "@playwright/test";

async function interceptSimulationConfig(
  page: Page,
  overrides: Record<string, number>,
) {
  await page.addInitScript((nextOverrides) => {
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(Target, args) {
        const worker = Reflect.construct(Target, args) as Worker;
        const nativePostMessage = worker.postMessage.bind(worker) as (
          message: unknown,
          transferOrOptions?: Transferable[] | StructuredSerializeOptions,
        ) => void;
        const patchedPostMessage = (
          message: unknown,
          transferOrOptions?: Transferable[] | StructuredSerializeOptions,
        ) => {
          if (
            typeof message === "object" &&
            message !== null &&
            "type" in message &&
            message.type === "initialize" &&
            "config" in message
          ) {
            const request = message as { config: Record<string, number> };
            message = {
              ...request,
              type: "initialize",
              config: { ...request.config, ...nextOverrides },
            };
          }
          nativePostMessage(message, transferOrOptions);
        };
        worker.postMessage = patchedPostMessage as Worker["postMessage"];
        return worker;
      },
    });
  }, overrides);
}

function timerSeconds(raw: string | null): number {
  const match = raw?.match(/(\d{2}):(\d{2})/);
  if (!match) throw new Error(`Expected a MM:SS timer, received ${raw ?? "nothing"}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

async function readRemainingSeconds(page: Page): Promise<number> {
  return timerSeconds(await page.locator(".status-strip .timer").textContent());
}

async function expectLockedPids(page: Page) {
  await expect(page.getByRole("spinbutton", { name: "Total level proportional gain" })).toBeDisabled();
  await expect(page.getByRole("spinbutton", { name: "Interface proportional gain" })).toBeDisabled();
}

async function expectResetLevels(page: Page) {
  await expect(page.getByRole("group", { name: "Total level live values" })).toContainText("50.0%");
  await expect(page.getByRole("group", { name: "Interface live values" })).toContainText("20.0%");
}

/**
 * The quick-start modal covers the dashboard on a first visit and would intercept
 * every click. Seeding the dismissal reproduces a returning visitor, which is the
 * state these flows are about.
 */
async function skipFirstRunModal(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "separator-control-onboarding-v1",
      JSON.stringify({ quickStartDismissed: true, guidedTourDismissed: true }),
    );
  });
}

/**
 * Start is disabled until the Worker reports ready. Clicking earlier is silently
 * ignored, so every flow waits for it rather than racing the handshake.
 */
async function startAttempt(page: Page) {
  const start = page.getByRole("button", { name: "Start attempt" });
  await expect(start).toBeEnabled();
  await start.click();
}

test.describe("separator control challenge", () => {
  test.beforeEach(async ({ page }) => {
    await skipFirstRunModal(page);
  });

  test("starts, pauses, resumes, and resets an attempt", async ({ page }) => {
    await page.goto("/challenge");

    await expect(page.getByRole("heading", { name: "Separator Control Challenge" })).toBeVisible();
    await expect(page.locator('input[value="feed-step"]')).toBeChecked();

    await startAttempt(page);
    await expect(page.getByRole("spinbutton", { name: "Total level proportional gain" })).toBeDisabled();
    await page.getByRole("button", { name: "Pause attempt" }).click();
    await expect(page.getByRole("button", { name: "Resume attempt" })).toBeVisible();
    await page.getByRole("button", { name: "Resume attempt" }).click();
    await expect(page.getByRole("button", { name: "Pause attempt" })).toBeVisible();
    await page.getByRole("button", { name: "Reset attempt" }).click();

    await expect(page.getByRole("button", { name: "Start attempt" })).toBeVisible();
    await expect(page.getByRole("spinbutton", { name: "Total level proportional gain" })).toBeEnabled();
  });

  test("runs the primary dual-loop workflow without changing simulation semantics", async ({ page }) => {
    // Loads a real scene and then walks the whole transport sequence, so it needs
    // the same budget as the other scene-backed flows.
    test.setTimeout(90_000);
    // Long enough that the run cannot end while transport is being exercised; the
    // modal result panel would otherwise cover the controls. Reaching the results
    // screen is covered by the accelerated attempt test.
    await interceptSimulationConfig(page, { durationS: 600 });
    await page.goto("/challenge");

    await page.getByRole("radio", { name: /Water-rich (liquid )?slug/ }).check();
    await page.getByRole("spinbutton", { name: "Total level proportional gain" }).fill("5");
    await page.getByRole("spinbutton", { name: "Interface proportional gain" }).fill("3");
    await expect(page.getByRole("spinbutton", { name: "Total level proportional gain" })).toHaveValue("5");
    await expect(page.getByRole("spinbutton", { name: "Interface proportional gain" })).toHaveValue("3");

    await startAttempt(page);
    await expectLockedPids(page);
    await page.getByRole("button", { name: "Pause attempt" }).click();
    await expect(page.getByRole("button", { name: "Resume attempt" })).toBeVisible();
    // A tick already in flight when Pause was clicked still lands, so wait for the
    // clock to settle before asserting that it stays put.
    await expect.poll(async () => {
      const before = await readRemainingSeconds(page);
      await page.waitForTimeout(250);
      return (await readRemainingSeconds(page)) === before;
    }).toBe(true);
    const pausedAt = await readRemainingSeconds(page);
    await page.waitForTimeout(500);
    expect(await readRemainingSeconds(page)).toBe(pausedAt);
    await page.getByRole("button", { name: "Resume attempt" }).click();
    await expect.poll(() => readRemainingSeconds(page)).toBeLessThan(pausedAt);

    await page.getByRole("button", { name: "Reset attempt" }).click();
    await expect(page.getByRole("button", { name: "Start attempt" })).toBeVisible();
    await expectResetLevels(page);

    await expect(page.getByRole("spinbutton", { name: "Total level proportional gain" })).toBeEnabled();
    await expect(page.getByRole("spinbutton", { name: "Interface proportional gain" })).toBeEnabled();
  });

  test("selects a deterministic scenario before gains lock", async ({ page }) => {
    await page.goto("/challenge");

    await page.getByRole("radio", { name: /Noisy interface sensor/ }).check();
    await expect(page.locator('input[value="noisy-interface"]')).toBeChecked();
    // The seed is engineering detail, tucked behind a disclosure.
    await page.getByText("Run details", { exact: true }).click();
    await expect(page.getByText("1006", { exact: true })).toBeVisible();

    await startAttempt(page);
    await expect(page.locator('input[value="noisy-interface"]')).toBeDisabled();
  });

  test("completes an accelerated deterministic attempt and shows results", async ({ page }) => {
    await interceptSimulationConfig(page, { durationS: 1 });
    await page.goto("/challenge");

    await page.getByRole("button", { name: "4× speed" }).click();
    await startAttempt(page);

    const results = page.getByRole("dialog", { name: "Attempt results" });
    await expect(results).toBeVisible({ timeout: 15_000 });
    await expect(results.getByText("FINAL SCORE")).toBeVisible();
    await expect(results.getByRole("heading", { name: "Total level loop" })).toBeVisible();
    await expect(results.getByRole("heading", { name: "Oil/water interface loop" })).toBeVisible();
    await expect(results.getByRole("button", { name: "Tune and retry" })).toBeVisible();
  });

  test("publishes an unsafe initial high-high trip and applies the trip modifier", async ({ page }) => {
    await interceptSimulationConfig(page, {
      durationS: 5,
      totalLowLowPct: 10,
      totalLowAlarmPct: 20,
      totalHighAlarmPct: 40,
      totalHighHighPct: 49.99,
    });
    await page.goto("/challenge");

    const results = page.getByRole("dialog", { name: "Attempt results" });
    await expect(results).toBeVisible({ timeout: 15_000 });
    await expect(results.getByRole("listitem")).toContainText(
      "Total level high-high trip cap",
    );
    const sceneTrip = page.locator(".scene-safety-label.is-trip");
    await expect(sceneTrip).toContainText("TRIP", { timeout: 30_000 });
    await expect(sceneTrip).toContainText("Total level high-high trip");
    await expect(sceneTrip).toHaveAttribute("data-pulsing", "false");
  });

  test("reports a forced interface high-high trip through the public Worker protocol", async ({ page }) => {
    await interceptSimulationConfig(page, {
      durationS: 5,
      interfaceLowLowPct: 3,
      interfaceLowAlarmPct: 8,
      interfaceHighAlarmPct: 19,
      interfaceHighHighPct: 19.99,
    });
    await page.goto("/challenge");

    const results = page.getByRole("dialog", { name: "Attempt results" });
    await expect(results).toBeVisible({ timeout: 15_000 });
    await expect(results.getByText("Interface high-high trip", { exact: true }).first()).toBeVisible();
    await expect(results.getByRole("listitem")).toContainText("Interface high-high trip cap");
    const score = await results.locator(".score-ring strong").textContent();
    expect(Number(score)).toBeLessThanOrEqual(35);
    await expect(
      page.locator(".scene-safety-label.is-trip").or(page.locator(".alarm-badge.trip")),
    ).toContainText("Interface high-high trip");
  });

  test("keeps the mobile dashboard inside the viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile layout assertion");
    await page.goto("/challenge");

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      root: document.documentElement.scrollWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(widths.root).toBeLessThanOrEqual(widths.viewport);
    const instrumentTypography = await page.locator(".process-instrument-grid").first().evaluate((grid) => ({
      label: Number.parseFloat(getComputedStyle(grid.querySelector("dt")!).fontSize),
      value: Number.parseFloat(getComputedStyle(grid.querySelector("dd")!).fontSize),
    }));
    expect(instrumentTypography.label).toBeGreaterThanOrEqual(11);
    expect(instrumentTypography.value).toBeGreaterThanOrEqual(11);
    await expect(page.getByRole("group", { name: "Critical separator instruments" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start attempt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset attempt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "4× speed" })).toBeVisible();
  });

  test("keeps the hero first in reading order and PID targets readable at rest and locked", async ({ page }) => {
    await page.goto("/challenge");
    const bayOrder = await page.locator(".process-bay").evaluate((bay) =>
      Array.from(bay.children).map((child) => child.className),
    );
    expect(bayOrder).toEqual([
      "process-bay__hero",
      "instrument-dock instrument-dock--oil",
      "instrument-dock instrument-dock--water",
    ]);
    const sliders = page.locator(".gain-slider");
    await expect(sliders).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      const box = await sliders.nth(index).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await startAttempt(page);
    const lockedStyle = await page.locator(".gain-control").first().evaluate((element) => ({
      opacity: getComputedStyle(element).opacity,
      helperSize: getComputedStyle(element.querySelector(".gain-hint")!).fontSize,
    }));
    expect(lockedStyle.opacity).toBe("1");
    expect(Number.parseFloat(lockedStyle.helperSize)).toBeGreaterThanOrEqual(11);
    await expect(page.getByText("Locked for this attempt").first()).toBeVisible();
  });

  test("mounts the real 3D hero when WebGL is available and keeps its controls usable", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(testInfo.project.name === "mobile", "Desktop Chromium is the required real-WebGL gate");
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => runtimeErrors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") runtimeErrors.push(message.text());
    });
    await page.goto("/challenge");

    const resetView = page.getByRole("button", { name: "Reset 3D view" });
    await expect(resetView).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".separator-canvas canvas")).toBeVisible();
    await expect(page.locator('[data-valve-tag="LV-101"]')).toContainText("50.0% actual");
    await expect(page.locator('[data-valve-tag="WV-101"]')).toContainText("50.0% actual");
    const sceneLabelTypography = await page.locator('[data-valve-tag="LV-101"]').evaluate((label) => ({
      description: Number.parseFloat(getComputedStyle(label.querySelector("span")!).fontSize),
      actual: Number.parseFloat(getComputedStyle(label.querySelector("output")!).fontSize),
      title: Number.parseFloat(getComputedStyle(label.querySelector("strong")!).fontSize),
    }));
    expect(sceneLabelTypography.description).toBeGreaterThanOrEqual(10);
    expect(sceneLabelTypography.actual).toBeGreaterThanOrEqual(10);
    expect(sceneLabelTypography.title).toBeGreaterThanOrEqual(11);
    const safetySourceSize = await page.locator(".scene-safety-label span").evaluate((source) =>
      Number.parseFloat(getComputedStyle(source).fontSize),
    );
    expect(safetySourceSize).toBeGreaterThanOrEqual(10);
    await expect(page.locator('[data-flow-name="Feed"]')).toHaveAttribute("data-flow-direction", "1");
    await expect(page.getByRole("region", { name: /separator process cutaway/i })).toHaveCount(0);
    const resetBox = await resetView.boundingBox();
    expect(resetBox?.height).toBeGreaterThanOrEqual(44);
    await resetView.click();

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      root: document.documentElement.scrollWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(widths.root).toBeLessThanOrEqual(widths.viewport);
    expect(runtimeErrors).toEqual([]);
  });

  test("freezes real 3D flow phase while paused and resumes continuously", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(testInfo.project.name === "mobile", "Desktop Chromium is the required real-WebGL gate");
    await page.goto("/challenge");
    await expect(page.getByRole("button", { name: "Reset 3D view" })).toBeVisible({ timeout: 30_000 });
    const feed = page.locator('[data-flow-name="Feed"]');
    await startAttempt(page);
    // Scene state reaches the DOM through the R3F reconciler and a rendered frame.
    // Shader compilation is GPU-serialised across the suite, so this needs more than
    // the default assertion window when other specs have just built a scene.
    const sceneSettle = { timeout: 20_000 };
    await expect(feed).toHaveAttribute("data-motion", "moving", sceneSettle);
    await expect.poll(() => feed.getAttribute("data-phase"), sceneSettle).not.toBe("0.18000");
    await page.getByRole("button", { name: "Pause attempt" }).click();
    await expect(feed).toHaveAttribute("data-motion", "frozen", sceneSettle);
    const frozenPhase = await feed.getAttribute("data-phase");
    await page.waitForTimeout(500);
    expect(await feed.getAttribute("data-phase")).toBe(frozenPhase);
    await page.getByRole("button", { name: "Resume attempt" }).click();
    await expect(feed).toHaveAttribute("data-motion", "moving", sceneSettle);
    await expect.poll(() => feed.getAttribute("data-phase"), sceneSettle).not.toBe(frozenPhase);
  });

  test("keeps process state visible but motion static with reduced motion", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(testInfo.project.name === "mobile", "Desktop Chromium is the required real-WebGL gate");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/challenge");
    await expect(page.getByRole("button", { name: "Reset 3D view" })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-valve-tag="LV-101"]')).toBeVisible();
    // The slug moves the level far enough to prove the readout is still live while
    // the scene itself stays frozen.
    await page.getByRole("radio", { name: /Water-rich (liquid )?slug/ }).check();
    await page.getByRole("button", { name: "4× speed" }).click();
    await startAttempt(page);
    await expect(page.locator('[data-flow-name="Feed"]')).toHaveAttribute("data-motion", "frozen");
    const reducedPhase = await page.locator('[data-flow-name="Feed"]').getAttribute("data-phase");
    await page.waitForTimeout(500);
    expect(await page.locator('[data-flow-name="Feed"]').getAttribute("data-phase")).toBe(reducedPhase);
    const totalProcessValue = page
      .getByRole("group", { name: "Total level live values" })
      .locator("div")
      .filter({ has: page.getByText("Total level process value", { exact: true }) })
      .locator("dd");
    await expect.poll(() => totalProcessValue.textContent(), { timeout: 15_000 })
      .not.toBe("50.0%");
    await expect(page.locator(".scene-safety-label")).toContainText("Normal operating envelope");
  });

  test("keeps the semantic fallback and controls usable without WebGL", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type, options) {
        if (type === "webgl" || type === "webgl2") return null;
        return original.call(this, type, options);
      } as typeof original;
    });
    await page.goto("/challenge");

    await expect(page.getByRole("region", { name: /separator process cutaway/i })).toBeVisible();
    await expect(page.locator(".separator-canvas canvas")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reset 3D view" })).toHaveCount(0);
    await startAttempt(page);
    await expect(page.getByRole("button", { name: "Pause attempt" })).toBeVisible();

    const widths = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      body: document.body.scrollWidth,
      root: document.documentElement.scrollWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(widths.root).toBeLessThanOrEqual(widths.viewport);
  });

  test("keeps HUD and Worker time usable through a desktop WebGL context loss", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(testInfo.project.name === "mobile", "Desktop Chromium owns the WebGL context-loss gate");
    await page.goto("/challenge");
    await expect(page.getByRole("button", { name: "Reset 3D view" })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "4× speed" }).click();
    await startAttempt(page);
    await expect.poll(() => readRemainingSeconds(page)).toBeLessThan(180);
    const beforeLoss = await readRemainingSeconds(page);

    const contextExtension = await page.locator(".separator-canvas canvas").evaluate((element) => {
      const canvas = element as HTMLCanvasElement;
      const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
      const extension = context?.getExtension("WEBGL_lose_context");
      if (!extension) return false;
      extension.loseContext();
      window.setTimeout(() => extension.restoreContext(), 250);
      return true;
    });
    test.skip(!contextExtension, "WEBGL_lose_context is unavailable in this Chromium environment");

    await expect(page.getByRole("button", { name: "Pause attempt" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset attempt" })).toBeVisible();
    await expect.poll(() => readRemainingSeconds(page)).toBeLessThan(beforeLoss);
    await expect(page.locator(".separator-canvas canvas").or(page.getByRole("region", { name: /separator process cutaway/i }))).toBeVisible({ timeout: 30_000 });
  });
});
