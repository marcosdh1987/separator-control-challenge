import { describe, expect, it } from "vitest";

import { createMimicModel, severityFor, valveStateFor } from "@/components/mimic/mimic-bindings";
import type { GasSample, LoopSample, SafetyState, SimulationSample } from "@/lib/simulation/types";

const loop = (overrides: Partial<LoopSample> = {}): LoopSample => ({
  processValuePct: 50,
  measuredValuePct: 50,
  setpointPct: 50,
  errorPct: 0,
  valveCommandPct: 40,
  valvePositionPct: 40,
  proportionalTerm: 0,
  integralTerm: 0,
  derivativeTerm: 0,
  ...overrides,
});

const safe: SafetyState = { severity: "safe", source: null, condition: "normal", trip: null };

const gasSample = (overrides: Partial<GasSample> = {}): GasSample => ({
  pressureBarG: 8.2,
  measuredPressureBarG: 8.1,
  setpointBarG: 8,
  inletSm3H: 4200,
  outletSm3H: 4150,
  gasVolumeM3: 1.4,
  ...overrides,
});

const sampleWith = (overrides: Partial<SimulationSample> = {}): SimulationSample => ({
  timeS: 12,
  total: loop(),
  interface: loop({ processValuePct: 20, measuredValuePct: 21, setpointPct: 20, valveCommandPct: 30, valvePositionPct: 28 }),
  oilVolumeM3: 1,
  waterVolumeM3: 1,
  oilLayerPct: 30,
  flows: {
    totalInletM3H: 50,
    waterCutFraction: 0.35,
    oilInletM3H: 32.5,
    waterInletM3H: 17.5,
    oilOutletM3H: 31,
    waterOutletM3H: 18,
  },
  safety: safe,
  disturbance: "steady",
  ...overrides,
});

describe("valveStateFor", () => {
  it("calls only the ends of travel shut or open", () => {
    expect(valveStateFor(0)).toBe("shut");
    expect(valveStateFor(0.004)).toBe("shut");
    expect(valveStateFor(0.02)).toBe("throttling");
    expect(valveStateFor(0.5)).toBe("throttling");
    expect(valveStateFor(0.99)).toBe("throttling");
    expect(valveStateFor(1)).toBe("open");
  });
});

describe("createMimicModel", () => {
  it("maps levels to fractions of vessel height", () => {
    const model = createMimicModel(sampleWith());

    expect(model.levels.totalFraction).toBeCloseTo(0.5);
    expect(model.levels.interfaceFraction).toBeCloseTo(0.2);
    expect(model.levels.oilLayerFraction).toBeCloseTo(0.3);
    expect(model.levels.gasFraction).toBeCloseTo(0.5);
  });

  it("never lets the interface be drawn above the total surface", () => {
    const model = createMimicModel(sampleWith({
      total: loop({ processValuePct: 30 }),
      interface: loop({ processValuePct: 60 }),
    }));

    expect(model.levels.interfaceFraction).toBeCloseTo(0.3);
    expect(model.levels.oilLayerFraction).toBe(0);
  });

  it("clamps out-of-range and non-finite readings instead of tearing the geometry", () => {
    const model = createMimicModel(sampleWith({
      total: loop({ processValuePct: Number.NaN, valvePositionPct: 140 }),
      interface: loop({ processValuePct: -25, valvePositionPct: Number.POSITIVE_INFINITY }),
      flows: {
        totalInletM3H: Number.NaN,
        waterCutFraction: 0.3,
        oilInletM3H: 0,
        waterInletM3H: 0,
        oilOutletM3H: 12,
        waterOutletM3H: 8,
      },
    }));

    expect(model.levels.totalFraction).toBe(0);
    expect(model.levels.interfaceFraction).toBe(0);
    expect(model.valves.oil.openFraction).toBe(1);
    expect(model.valves.oil.state).toBe("open");
    expect(model.valves.water.openFraction).toBe(0);
    expect(model.valves.water.state).toBe("shut");
    expect(model.flows.inletM3H).toBe(0);
  });

  it("omits the pressure loop, the gas valve and the gas flow when the gas cap is disabled", () => {
    const model = createMimicModel(sampleWith());

    expect(model.gasEnabled).toBe(false);
    expect(model.transmitters.pressure).toBeNull();
    expect(model.valves.gas).toBeNull();
    expect(model.flows.gasSm3H).toBeNull();
    expect(model.transmitters.total.tag).toBe("LT-101");
    expect(model.transmitters.interface.tag).toBe("LT-102");
  });

  it("binds the pressure loop in bar gauge when the gas cap is enabled", () => {
    const model = createMimicModel(sampleWith({
      gas: gasSample(),
      pressure: loop({ processValuePct: 8.2, setpointPct: 8, valveCommandPct: 61, valvePositionPct: 58 }),
    }));

    expect(model.gasEnabled).toBe(true);
    expect(model.transmitters.pressure).toMatchObject({
      tag: "PT-101",
      controller: "PIC-101",
      processValue: 8.2,
      measuredValue: 8.1,
      setpoint: 8,
      unit: "barGauge",
    });
    expect(model.valves.gas).toMatchObject({ tag: "PCV-101", state: "throttling" });
    expect(model.valves.gas?.openFraction).toBeCloseTo(0.58);
    expect(model.flows.gasSm3H).toBe(4150);
  });

  it("keeps the gas branch drawable when the sample carries a gas cap but no pressure loop", () => {
    const model = createMimicModel(sampleWith({ gas: gasSample() }));

    expect(model.gasEnabled).toBe(true);
    expect(model.valves.gas).toMatchObject({ tag: "PCV-101", openFraction: 0, state: "shut" });
  });

  it("attributes an alarm to the instrument that raised it and to no other", () => {
    const model = createMimicModel(sampleWith({
      safety: { severity: "alarm", source: "total", condition: "total-high", trip: null },
    }));

    expect(model.transmitters.total.severity).toBe("alarm");
    expect(model.transmitters.interface.severity).toBe("safe");
    expect(model.safety.tripped).toBe(false);
  });

  it("flags an oil-layer trip on both level transmitters, since the layer is their difference", () => {
    const model = createMimicModel(sampleWith({
      safety: { severity: "trip", source: "oil-layer", condition: "oil-layer-low-low", trip: "OIL_LAYER_LL" },
    }));

    expect(model.transmitters.total.severity).toBe("trip");
    expect(model.transmitters.interface.severity).toBe("trip");
    expect(model.safety.tripped).toBe(true);
    expect(model.safety.condition).toBe("oil-layer-low-low");
  });

  it("carries a pressure trip on PT-101 only", () => {
    const model = createMimicModel(sampleWith({
      gas: gasSample({ pressureBarG: 12.4 }),
      pressure: loop({ processValuePct: 12.4 }),
      safety: { severity: "trip", source: "pressure", condition: "pressure-high-high", trip: "PRESSURE_HH" },
    }));

    expect(model.transmitters.pressure?.severity).toBe("trip");
    expect(model.transmitters.total.severity).toBe("safe");
    expect(model.transmitters.interface.severity).toBe("safe");
  });

  it("reports every instrument safe while the envelope is normal", () => {
    expect(severityFor("LT-101", safe)).toBe("safe");
    expect(severityFor("LT-102", safe)).toBe("safe");
    expect(severityFor("PT-101", safe)).toBe("safe");
  });
});
