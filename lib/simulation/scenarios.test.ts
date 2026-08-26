import { describe, expect, it } from "vitest";

import { MESSAGES } from "@/lib/i18n/messages";

import goldenRuns from "./__fixtures__/golden-runs.json";
import { DUAL_SCENARIOS, getScenario, SCENARIOS, scenarioAt } from "./scenarios";

const PUBLIC_IDS = [
  "normal", "feed-step", "water-rich-slug", "oil-outlet-restriction",
  "slow-water-dump", "noisy-interface", "gor-surge",
] as const;

describe("canonical scenario catalogue", () => {
  it("contains one catalogue with stable seeds and golden keys", () => {
    expect(SCENARIOS.map(({ id }) => id)).toEqual(PUBLIC_IDS);
    expect(DUAL_SCENARIOS).toBe(SCENARIOS);
    expect(SCENARIOS.map(({ seed }) => seed)).toEqual([1001, 1002, 1003, 1004, 1005, 1006, 1007]);
    expect(Object.keys(goldenRuns)).toEqual(PUBLIC_IDS);
    expect(PUBLIC_IDS.map((id) => getScenario(id).id)).toEqual(PUBLIC_IDS);
  });

  it("describes the affected feed, phase, sensor, or actuator in the catalogue", () => {
    // Scenario prose moved to the message catalogue when the engine was made
    // language-neutral; the catalogue is what a reader actually sees.
    const descriptions = SCENARIOS.map(({ id }) => MESSAGES.en.simulation.scenario[id].description);
    expect(descriptions.join(" ")).toMatch(
      /oil.*water.*feed.*water fraction.*oil dump-valve.*water valve.*interface sensor/i,
    );
    for (const locale of ["en", "es"] as const) {
      for (const { id } of SCENARIOS) {
        expect(MESSAGES[locale].simulation.scenario[id].name.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("canonical dual-loop scenario state", () => {
  it("provides the steady oil and water base state with derived flat aliases", () => {
    const state = scenarioAt("normal", 0);
    expect(state).toMatchObject({
      totalInletM3H: 50, waterCutFraction: 0.3,
      oilCapacityFactor: 1, waterCapacityFactor: 1,
      oilActuatorTauS: 3, waterActuatorTauS: 3,
      totalSensorNoisePct: 0, interfaceSensorNoisePct: 0,
      totalSensorSampleS: 0.2, interfaceSensorSampleS: 0.2,
    });
  });

  it("applies the feed step at exactly 30 seconds", () => {
    expect(scenarioAt("feed-step", 29.95).totalInletM3H).toBe(50);
    expect(scenarioAt("feed-step", 30).totalInletM3H).toBe(70);
  });

  it("models the water-rich slug at its boundaries and peak", () => {
    const start = scenarioAt("water-rich-slug", 35);
    const peak = scenarioAt("water-rich-slug", 45);
    const end = scenarioAt("water-rich-slug", 55);
    expect(start.totalInletM3H).toBeCloseTo(50, 10);
    expect(peak.totalInletM3H).toBeCloseTo(110, 10);
    expect(peak.waterCutFraction).toBeCloseTo(0.65, 10);
    expect(end.totalInletM3H).toBeCloseTo(50, 10);
    expect(end.waterCutFraction).toBeCloseTo(0.3, 10);
  });

  it("restricts only oil capacity at exactly 45 seconds", () => {
    expect(scenarioAt("oil-outlet-restriction", 44.95).oilCapacityFactor).toBe(1);
    expect(scenarioAt("oil-outlet-restriction", 45)).toMatchObject({ oilCapacityFactor: 0.6, waterCapacityFactor: 1 });
  });

  it("keeps the water actuator slow and raises water cut at 30 seconds", () => {
    expect(scenarioAt("slow-water-dump", 29.95)).toMatchObject({ waterActuatorTauS: 12, waterCutFraction: 0.3 });
    expect(scenarioAt("slow-water-dump", 30)).toMatchObject({ waterActuatorTauS: 12, waterCutFraction: 0.5, totalInletM3H: 50 });
  });

  it("adds deterministic noise and sample hold only to the interface sensor", () => {
    expect(scenarioAt("noisy-interface", 0)).toMatchObject({
      interfaceSensorNoisePct: 1.5, interfaceSensorSampleS: 0.5,
      totalSensorNoisePct: 0, totalSensorSampleS: 0.2,
    });
  });

  it("returns fresh canonical states", () => {
    const first = scenarioAt("slow-water-dump", 30);
    const second = scenarioAt("slow-water-dump", 30);
    expect(first).not.toBe(second);
    first.totalInletM3H = 999;
    expect(second.totalInletM3H).toBe(50);
  });
});
