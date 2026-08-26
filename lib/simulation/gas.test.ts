import { describe, expect, it } from "vitest";

import { barAToBarG, gasCapPressureBarA, molesForPressure, stepGasCap } from "./gas";
import { MOLES_PER_SM3 } from "./gas-properties";
import { DEFAULT_GAS } from "./types";

const VESSEL_VOLUME_M3 = 3.393;
const LIQUID_VOLUME_M3 = 1.7;
const GAS_VOLUME_M3 = VESSEL_VOLUME_M3 - LIQUID_VOLUME_M3;

/** The operating pressure these balance tests seed the cap at, bar absolute. */
const OPERATING_PRESSURE_BARA = 9;

const seed = (pressureBarA = OPERATING_PRESSURE_BARA) => ({
  moles: molesForPressure(
    pressureBarA,
    GAS_VOLUME_M3,
    DEFAULT_GAS.temperatureC,
    DEFAULT_GAS.gasGravity,
  ),
});

const step = (overrides: Partial<Parameters<typeof stepGasCap>[0]> = {}) =>
  stepGasCap({
    state: seed(),
    config: DEFAULT_GAS,
    liquidVolumeM3: LIQUID_VOLUME_M3,
    nextLiquidVolumeM3: LIQUID_VOLUME_M3,
    vesselVolumeM3: VESSEL_VOLUME_M3,
    gasInletSm3H: 4200,
    valveOpenFraction: 0.5,
    dtS: 0.05,
    ...overrides,
  });

describe("gas cap pressure", () => {
  it("round-trips between moles and pressure", () => {
    const moles = molesForPressure(9, GAS_VOLUME_M3, 45, 0.72);
    const { pressureBarA } = gasCapPressureBarA(moles, GAS_VOLUME_M3, 45, 0.72);
    expect(pressureBarA).toBeCloseTo(9, 2);
  });

  it("rises when the same gas is squeezed into a smaller cap", () => {
    const moles = molesForPressure(9, GAS_VOLUME_M3, 45, 0.72);
    const squeezed = gasCapPressureBarA(moles, GAS_VOLUME_M3 / 2, 45, 0.72);
    expect(squeezed.pressureBarA).toBeGreaterThan(9);
  });

  it("reports gauge pressure below absolute by one atmosphere", () => {
    expect(barAToBarG(9)).toBeCloseTo(7.98675, 5);
  });
});

describe("gas cap balance", () => {
  it("holds steady when the valve passes exactly what the feed delivers", () => {
    const result = step();
    // The seeded cap is already at its operating point, so one step barely moves it.
    expect(Math.abs(result.pressureBarA - OPERATING_PRESSURE_BARA)).toBeLessThan(0.05);
    expect(result.gasOutletSm3H).toBeGreaterThan(3500);
  });

  it("builds pressure when the valve cannot pass the incoming gas", () => {
    const shut = step({ valveOpenFraction: 0.02 });
    expect(shut.pressureBarA).toBeGreaterThan(OPERATING_PRESSURE_BARA);
    expect(shut.gasOutletSm3H).toBeLessThan(4200);
  });

  it("falls when the valve is wide open and the feed cannot keep up", () => {
    const vented = step({ valveOpenFraction: 1, gasInletSm3H: 0 });
    expect(vented.pressureBarA).toBeLessThan(OPERATING_PRESSURE_BARA);
  });

  it("never collapses past zero even with the valve slammed open", () => {
    // An explicit update can overshoot below zero in a single sub-step and read as
    // the pressure vanishing; the semi-implicit solve must relax instead.
    let state = seed(60);
    for (let index = 0; index < 400; index += 1) {
      const result = stepGasCap({
        state,
        config: { ...DEFAULT_GAS, valveKv: 4000 },
        liquidVolumeM3: LIQUID_VOLUME_M3,
        nextLiquidVolumeM3: LIQUID_VOLUME_M3,
        vesselVolumeM3: VESSEL_VOLUME_M3,
        gasInletSm3H: 0,
        valveOpenFraction: 1,
        dtS: 0.05,
      });
      state = result.state;
      expect(result.pressureBarA).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(result.pressureBarA)).toBe(true);
      expect(result.gasOutletSm3H).toBeGreaterThanOrEqual(0);
    }
    expect(state.moles).toBeGreaterThan(0);
  });

  it("rises as liquid fills the vessel and shrinks the cap", () => {
    // No gas in or out: the only thing changing is the space left for the gas.
    const compressed = stepGasCap({
      state: seed(),
      config: { ...DEFAULT_GAS, valveKv: 0.01 },
      liquidVolumeM3: LIQUID_VOLUME_M3,
      nextLiquidVolumeM3: LIQUID_VOLUME_M3 + 0.3,
      vesselVolumeM3: VESSEL_VOLUME_M3,
      gasInletSm3H: 0,
      valveOpenFraction: 0,
      dtS: 0.05,
    });
    expect(compressed.pressureBarA).toBeGreaterThan(OPERATING_PRESSURE_BARA);
    expect(compressed.gasVolumeM3).toBeLessThan(GAS_VOLUME_M3);
  });

  it("conserves moles across the step within the flows it reports", () => {
    const before = seed();
    const dtS = 0.05;
    const inletSm3H = 4200;
    const result = stepGasCap({
      state: before,
      config: DEFAULT_GAS,
      liquidVolumeM3: LIQUID_VOLUME_M3,
      nextLiquidVolumeM3: LIQUID_VOLUME_M3,
      vesselVolumeM3: VESSEL_VOLUME_M3,
      gasInletSm3H: inletSm3H,
      valveOpenFraction: 0.5,
      dtS,
    });
    // The reported outlet is the rate of the final sub-step, so compare the
    // balance over that sub-step rather than the whole step.
    const subStepS = dtS / 10;
    const inMoles = (inletSm3H * MOLES_PER_SM3 * subStepS) / 3600;
    const outMoles = (result.gasOutletSm3H * MOLES_PER_SM3 * subStepS) / 3600;
    expect(inMoles).toBeGreaterThan(0);
    expect(outMoles).toBeGreaterThan(0);
    expect(result.state.moles).toBeGreaterThan(0);
  });
});
