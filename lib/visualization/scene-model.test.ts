import { describe, expect, it } from "vitest";

import type { SimulationSample } from "@/lib/simulation/types";
import { createSceneModel, createProcessSummary, formatEngineeringValue } from "./scene-model";

function sampleAt(overrides: {
  total?: number;
  measuredTotal?: number;
  interface?: number;
  measuredInterface?: number;
  inletFlow?: number;
  oilFlow?: number;
  waterFlow?: number;
  oilValve?: number;
  waterValve?: number;
  safety?: Partial<SimulationSample["safety"]>;
} = {}): SimulationSample {
  const total = overrides.total ?? 50;
  const interfaceLevel = overrides.interface ?? 20;
  return {
    timeS: 12,
    total: { processValuePct: total, measuredValuePct: overrides.measuredTotal ?? total, setpointPct: 50, errorPct: 50 - total, valveCommandPct: 51, valvePositionPct: overrides.oilValve ?? 50, proportionalTerm: 0, integralTerm: 0, derivativeTerm: 0 },
    interface: { processValuePct: interfaceLevel, measuredValuePct: overrides.measuredInterface ?? interfaceLevel, setpointPct: 20, errorPct: 20 - interfaceLevel, valveCommandPct: 49, valvePositionPct: overrides.waterValve ?? 50, proportionalTerm: 0, integralTerm: 0, derivativeTerm: 0 },
    oilVolumeM3: 1.2,
    waterVolumeM3: 0.48,
    oilLayerPct: total - interfaceLevel,
    flows: { totalInletM3H: overrides.inletFlow ?? 50, waterCutFraction: 0.3, oilInletM3H: 35, waterInletM3H: 15, oilOutletM3H: overrides.oilFlow ?? 35, waterOutletM3H: overrides.waterFlow ?? 15 },
    safety: { severity: "safe", source: null, label: "Normal operating envelope", trip: null, ...overrides.safety },
    disturbance: "Steady oil/water feed",
  };
}

describe("scene model", () => {
  it("maps process percentages to vessel coordinates", () => {
    const model = createSceneModel(sampleAt({ total: 50, interface: 20 }));
    expect(model.totalSurfaceY).toBeCloseTo(0, 10);
    expect(model.interfaceSurfaceY).toBeCloseTo(-0.36, 10);
    expect(model.oilLayerHeightM).toBeCloseTo(0.36, 10);
    expect(model.waterHeightM).toBeCloseTo(0.24, 10);
    expect(model.oilRegionHeightM).toBeCloseTo(0.36, 10);
    expect(model.gasHeightM).toBeCloseTo(0.6, 10);
    expect(model.totalChordWidthM).toBeCloseTo(1.2, 10);
    expect(model.interfaceChordWidthM).toBeCloseTo(0.96, 10);
  });

  it("maps signed flow, maximum flow, zero flow, and actual valves", () => {
    const model = createSceneModel(sampleAt({ inletFlow: -55, oilFlow: 110, waterFlow: 0, oilValve: 140, waterValve: 42 }));
    expect(model.inletFlow).toEqual({ direction: -1, speed: 0.24, visibleFraction: 0.5 });
    expect(model.oilFlow).toEqual({ direction: 1, speed: 0.4, visibleFraction: 1 });
    expect(model.waterFlow).toEqual({ direction: 0, speed: 0, visibleFraction: 0 });
    expect(model.oilValve.openFraction).toBe(1);
    expect(model.waterValve.openFraction).toBeCloseTo(0.42, 10);
  });

  it.each([
    ["TOTAL_LL", "total"],
    ["TOTAL_HH", "total"],
    ["INTERFACE_LL", "interface"],
    ["INTERFACE_HH", "interface"],
    ["OIL_LAYER_LL", "oil-layer"],
  ] as const)("maps %s trip presentation", (trip, source) => {
    const model = createSceneModel(sampleAt({ safety: { severity: "trip", source, trip, label: `${trip} trip` } }));
    expect(model.safety).toMatchObject({ severity: "trip", source, label: `${trip} trip`, motionEnabled: false, pulseHz: 0 });
  });

  it("preserves explicit alarm and safe presentations", () => {
    expect(createSceneModel(sampleAt()).safety).toMatchObject({ severity: "safe", source: null, motionEnabled: true, pulseHz: 0, markerY: null });
    expect(createSceneModel(sampleAt({ safety: { severity: "alarm", source: "interface", label: "Interface high alarm" } })).safety)
      .toMatchObject({
        severity: "alarm",
        source: "interface",
        label: "Interface high alarm",
        motionEnabled: true,
        markerY: -0.36,
        pulseHz: 0.7,
      });
  });

  it.each([
    ["total", 0],
    ["interface", -0.36],
    ["oil-layer", -0.18],
  ] as const)("targets the %s phase boundary without changing the safety label", (source, markerY) => {
    const model = createSceneModel(sampleAt({ safety: { severity: "alarm", source, label: `${source} warning` } }));
    expect(model.safety.source).toBe(source);
    expect(model.safety.label).toBe(`${source} warning`);
    expect(model.safety.markerY).toBeCloseTo(markerY, 10);
    expect(model.safety.beaconIntensity).toBeGreaterThan(0);
    expect(model.safety.rimIntensity).toBeGreaterThan(0);
    expect(model.safety.pulseHz).toBeLessThan(2);
  });

  it("clamps out-of-range and non-finite process values without emitting non-finite numbers", () => {
    const sample = sampleAt({ total: Number.POSITIVE_INFINITY, interface: -20, inletFlow: Number.NaN, oilFlow: Number.NEGATIVE_INFINITY, waterFlow: 999, oilValve: -8, waterValve: Number.NaN });
    const model = createSceneModel(sample);
    const numericValues = JSON.stringify(model).match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    expect(numericValues.every(Number.isFinite)).toBe(true);
    expect(model.totalSurfaceY).toBe(0.6);
    expect(model.interfaceSurfaceY).toBe(-0.6);
    expect(model.oilLayerHeightM).toBe(1.2);
    expect(model.gasHeightM).toBe(0);
    expect(model.inletFlow.visibleFraction).toBe(0);
    expect(model.oilFlow.visibleFraction).toBe(0);
    expect(model.waterFlow.visibleFraction).toBe(1);
    expect(model.oilValve.openFraction).toBe(0);
    expect(model.waterValve.openFraction).toBe(0);
  });

  it("derives from canonical nested fields, returns fresh objects, and never mutates the sample", () => {
    const sample = sampleAt({ total: 40, inletFlow: 30 });
    const before = structuredClone(sample);
    const first = createSceneModel(sample);
    const second = createSceneModel(sample);
    expect(sample).toEqual(before);
    expect(first).not.toBe(second);
    expect(first.inletFlow).not.toBe(second.inletFlow);
    expect(first.totalSurfaceY).toBeCloseTo(-0.12, 10);
    expect(first.inletFlow.visibleFraction).toBeCloseTo(30 / 110, 10);
  });

  it("creates a complete accessible engineering summary", () => {
    const summary = createProcessSummary(sampleAt({ total: 52.3, measuredTotal: 51.9, interface: 19.2, measuredInterface: 20.1, inletFlow: 70, oilFlow: 40, waterFlow: 15, oilValve: 72, waterValve: 48, safety: { severity: "alarm", source: "total", label: "Total level high alarm" } }));
    expect(summary).toContain("gas, oil, and water");
    expect(summary.toLowerCase()).toContain("true total level 52.3 percent; measured total level 51.9 percent");
    expect(summary.toLowerCase()).toContain("true interface 19.2 percent; measured interface 20.1 percent");
    expect(summary.toLowerCase()).toContain("total inlet 70.0 cubic metres per hour");
    expect(summary.toLowerCase()).toContain("oil outlet 40.0 cubic metres per hour");
    expect(summary.toLowerCase()).toContain("water outlet 15.0 cubic metres per hour");
    expect(summary.toLowerCase()).toContain("actual oil valve 72.0 percent");
    expect(summary.toLowerCase()).toContain("actual water valve 48.0 percent");
    expect(summary).toContain("Total level high alarm");
  });

  it("formats finite engineering values and never prints non-finite tokens", () => {
    expect(formatEngineeringValue(42.125, { unit: "%", separator: "", digits: 1 })).toBe("42.1%");
    expect(formatEngineeringValue(Number.NaN, { unit: "%", separator: "" })).toBe("—%");
    expect(formatEngineeringValue(Number.POSITIVE_INFINITY, { unit: "m³/h" })).toBe("— m³/h");
    expect(formatEngineeringValue(Number.NEGATIVE_INFINITY, { invalid: "unavailable" })).toBe("unavailable");
  });

  it("describes invalid raw values as unavailable in the accessible summary", () => {
    const sample = sampleAt({ total: Number.NaN, measuredTotal: Number.POSITIVE_INFINITY, inletFlow: Number.NEGATIVE_INFINITY, oilValve: Number.NaN });
    const summary = createProcessSummary(sample);
    expect(summary).not.toMatch(/NaN|Infinity/);
    expect(summary).toMatch(/true total level unavailable/i);
    expect(summary).toMatch(/measured total level unavailable/i);
    expect(summary).toMatch(/total inlet unavailable/i);
    expect(summary).toMatch(/actual oil valve unavailable/i);
  });
});
