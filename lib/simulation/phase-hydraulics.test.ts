import { describe, expect, it } from "vitest";

import {
  calculatePhaseOutletFlows,
  integratePhaseInventories,
  MIN_TIMESTEP_S,
  splitFeed,
} from "./phase-hydraulics";
import { DEFAULT_SIMULATION } from "./types";

describe("splitFeed", () => {
  it("splits a feed by water cut", () => {
    expect(splitFeed(50, 0.3)).toEqual({
      oilInletM3H: 35,
      waterInletM3H: 15,
    });
    expect(splitFeed(50, 0)).toEqual({
      oilInletM3H: 50,
      waterInletM3H: 0,
    });
    expect(splitFeed(50, 1)).toEqual({
      oilInletM3H: 0,
      waterInletM3H: 50,
    });
  });

  it("clamps total flow and water cut to physical bounds", () => {
    expect(splitFeed(50, -1)).toEqual({
      oilInletM3H: 50,
      waterInletM3H: 0,
    });
    expect(splitFeed(50, 2)).toEqual({
      oilInletM3H: 0,
      waterInletM3H: 50,
    });
    expect(splitFeed(-50, 0.3)).toEqual({
      oilInletM3H: 0,
      waterInletM3H: 0,
    });
    expect(splitFeed(50, Number.POSITIVE_INFINITY)).toEqual({
      oilInletM3H: 0,
      waterInletM3H: 50,
    });
    expect(splitFeed(Number.NaN, Number.NaN)).toEqual({
      oilInletM3H: 0,
      waterInletM3H: 0,
    });
  });
});

describe("calculatePhaseOutletFlows", () => {
  const equilibriumInput = {
    totalLevelPct: 50,
    interfaceLevelPct: 20,
    oilValvePct: 50,
    waterValvePct: 50,
    oilCapacityFactor: 1,
    waterCapacityFactor: 1,
    config: DEFAULT_SIMULATION,
  };

  it("matches both rated phase flows at the reference levels", () => {
    const result = calculatePhaseOutletFlows(equilibriumInput);

    expect(result.oilOutletM3H).toBeCloseTo(35, 12);
    expect(result.waterOutletM3H).toBeCloseTo(15, 12);
  });

  it("returns zero phase flow for a closed valve", () => {
    const result = calculatePhaseOutletFlows({
      ...equilibriumInput,
      oilValvePct: 0,
      waterValvePct: 0,
    });

    expect(result).toEqual({ oilOutletM3H: 0, waterOutletM3H: 0 });
  });

  it("clamps valve openings, capacity factors, and levels safely", () => {
    const bounded = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: 150,
      interfaceLevelPct: -20,
      oilValvePct: 150,
      waterValvePct: -10,
      oilCapacityFactor: -2,
      waterCapacityFactor: 2,
    });
    const invalid = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: Number.NaN,
      interfaceLevelPct: Number.POSITIVE_INFINITY,
      oilValvePct: Number.NaN,
      waterValvePct: Number.POSITIVE_INFINITY,
      oilCapacityFactor: Number.POSITIVE_INFINITY,
      waterCapacityFactor: Number.NaN,
    });

    expect(bounded.oilOutletM3H).toBe(0);
    expect(bounded.waterOutletM3H).toBe(0);
    for (const flow of Object.values(invalid)) {
      expect(Number.isFinite(flow)).toBe(true);
      expect(flow).toBeGreaterThanOrEqual(0);
    }

    const upperBounded = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: Number.POSITIVE_INFINITY,
      interfaceLevelPct: Number.NEGATIVE_INFINITY,
      oilValvePct: Number.POSITIVE_INFINITY,
    });
    const explicitUpperBounds = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: 100,
      interfaceLevelPct: 0,
      oilValvePct: 100,
    });
    expect(upperBounded.oilOutletM3H).toBeCloseTo(
      explicitUpperBounds.oilOutletM3H,
      12,
    );
  });

  it("stays finite at empty, full, and crossed interface levels", () => {
    for (const [totalLevelPct, interfaceLevelPct] of [
      [0, 0],
      [100, 100],
      [20, 80],
    ]) {
      const result = calculatePhaseOutletFlows({
        ...equilibriumInput,
        totalLevelPct,
        interfaceLevelPct,
      });

      expect(Number.isFinite(result.oilOutletM3H)).toBe(true);
      expect(Number.isFinite(result.waterOutletM3H)).toBe(true);
      expect(result.oilOutletM3H).toBeGreaterThanOrEqual(0);
      expect(result.waterOutletM3H).toBeGreaterThanOrEqual(0);
    }
  });

  it("uses the independently clamped interface for crossed levels", () => {
    const crossed = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: 20,
      interfaceLevelPct: 80,
    });
    const capped = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: 20,
      interfaceLevelPct: 20,
    });

    expect(crossed.oilOutletM3H).toBeCloseTo(capped.oilOutletM3H, 14);
    expect(crossed.waterOutletM3H).toBeCloseTo(15.286289003633277, 12);
    expect(crossed.waterOutletM3H).toBeGreaterThan(capped.waterOutletM3H);
    expect(Number.isFinite(crossed.waterOutletM3H)).toBe(true);
  });

  it("saturates an overflowing capacity product monotonically", () => {
    const nominal = calculatePhaseOutletFlows(equilibriumInput);
    const high = calculatePhaseOutletFlows({
      ...equilibriumInput,
      oilCapacityFactor: Number.MAX_VALUE / 100,
    });
    const saturated = calculatePhaseOutletFlows({
      ...equilibriumInput,
      oilCapacityFactor: Number.MAX_VALUE,
    });

    expect(Number.isFinite(saturated.oilOutletM3H)).toBe(true);
    expect(saturated.oilOutletM3H).toBeGreaterThan(nominal.oilOutletM3H);
    expect(saturated.oilOutletM3H).toBeGreaterThanOrEqual(high.oilOutletM3H);
    expect(saturated.oilOutletM3H).toBe(Number.MAX_VALUE);
  });

  it("does not reduce oil flow when the oil layer grows", () => {
    const shallowOil = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: 30,
      interfaceLevelPct: 20,
    });
    const deepOil = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: 70,
      interfaceLevelPct: 20,
    });

    expect(deepOil.oilOutletM3H).toBeGreaterThanOrEqual(shallowOil.oilOutletM3H);
  });

  it("does not reduce water flow when a valid interface rises", () => {
    const lowInterface = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: 70,
      interfaceLevelPct: 10,
    });
    const highInterface = calculatePhaseOutletFlows({
      ...equilibriumInput,
      totalLevelPct: 70,
      interfaceLevelPct: 40,
    });

    expect(highInterface.waterOutletM3H).toBeGreaterThanOrEqual(
      lowInterface.waterOutletM3H,
    );
  });
});

describe("integratePhaseInventories", () => {
  it("does not normalize inventory for an unsupported time step", () => {
    expect(MIN_TIMESTEP_S).toBe(1e-9);

    for (const dtS of [
      0,
      -1,
      1e-300,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ]) {
      const result = integratePhaseInventories({
        oilVolumeM3: 3,
        waterVolumeM3: 1,
        oilInletM3H: 36,
        waterInletM3H: 36,
        oilOutletM3H: 360,
        waterOutletM3H: 360,
        dtS,
        fullVolumeM3: 2,
      });

      expect(result).toEqual({
        oilVolumeM3: 3,
        waterVolumeM3: 1,
        actualOilOutletM3H: 0,
        actualWaterOutletM3H: 0,
        acceptedOilInletM3H: 0,
        acceptedWaterInletM3H: 0,
        normalizationOilDiscardM3: 0,
        normalizationWaterDiscardM3: 0,
      });
    }
  });

  it("conserves oil and water independently", () => {
    const result = integratePhaseInventories({
      oilVolumeM3: 0.8,
      waterVolumeM3: 0.4,
      oilInletM3H: 35,
      waterInletM3H: 15,
      oilOutletM3H: 20,
      waterOutletM3H: 10,
      dtS: 0.05,
      fullVolumeM3: 4,
    });

    expect(result.oilVolumeM3).toBeCloseTo(0.8 + (35 - 20) * 0.05 / 3600, 14);
    expect(result.waterVolumeM3).toBeCloseTo(0.4 + (15 - 10) * 0.05 / 3600, 14);
    expect(result.actualOilOutletM3H).toBe(20);
    expect(result.actualWaterOutletM3H).toBe(10);
    expect(result.acceptedOilInletM3H).toBe(35);
    expect(result.acceptedWaterInletM3H).toBe(15);
    expect(result.normalizationOilDiscardM3).toBe(0);
    expect(result.normalizationWaterDiscardM3).toBe(0);
    expect(
      0.8 -
        result.normalizationOilDiscardM3 -
        result.actualOilOutletM3H * 0.05 / 3600 +
        result.acceptedOilInletM3H * 0.05 / 3600,
    ).toBeCloseTo(result.oilVolumeM3, 14);
    expect(
      0.4 -
        result.normalizationWaterDiscardM3 -
        result.actualWaterOutletM3H * 0.05 / 3600 +
        result.acceptedWaterInletM3H * 0.05 / 3600,
    ).toBeCloseTo(result.waterVolumeM3, 14);
  });

  it("limits each outlet to its available starting inventory", () => {
    const result = integratePhaseInventories({
      oilVolumeM3: 0.001,
      waterVolumeM3: 0.002,
      oilInletM3H: 0,
      waterInletM3H: 0,
      oilOutletM3H: 1000,
      waterOutletM3H: 1000,
      dtS: 3.6,
      fullVolumeM3: 4,
    });

    expect(result.oilVolumeM3).toBe(0);
    expect(result.waterVolumeM3).toBe(0);
    expect(result.actualOilOutletM3H).toBeCloseTo(1, 12);
    expect(result.actualWaterOutletM3H).toBeCloseTo(2, 12);
  });

  it("returns no flow for a nonpositive time step", () => {
    for (const dtS of [0, -0.05]) {
      const result = integratePhaseInventories({
        oilVolumeM3: 0.8,
        waterVolumeM3: 0.4,
        oilInletM3H: 35,
        waterInletM3H: 15,
        oilOutletM3H: 20,
        waterOutletM3H: 10,
        dtS,
        fullVolumeM3: 4,
      });

      expect(result).toEqual({
        oilVolumeM3: 0.8,
        waterVolumeM3: 0.4,
        actualOilOutletM3H: 0,
        actualWaterOutletM3H: 0,
        acceptedOilInletM3H: 0,
        acceptedWaterInletM3H: 0,
        normalizationOilDiscardM3: 0,
        normalizationWaterDiscardM3: 0,
      });
    }
  });

  it("keeps zero and non-finite inputs finite and nonnegative", () => {
    const empty = integratePhaseInventories({
      oilVolumeM3: 0,
      waterVolumeM3: 0,
      oilInletM3H: 0,
      waterInletM3H: 0,
      oilOutletM3H: 20,
      waterOutletM3H: 10,
      dtS: 0.05,
      fullVolumeM3: 4,
    });
    const result = integratePhaseInventories({
      oilVolumeM3: Number.NaN,
      waterVolumeM3: Number.NEGATIVE_INFINITY,
      oilInletM3H: Number.POSITIVE_INFINITY,
      waterInletM3H: Number.NaN,
      oilOutletM3H: Number.NEGATIVE_INFINITY,
      waterOutletM3H: Number.NaN,
      dtS: 0.05,
      fullVolumeM3: Number.NaN,
    });

    for (const candidate of [empty, result]) {
      for (const value of Object.values(candidate)) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
    expect(empty.oilVolumeM3 + empty.waterVolumeM3).toBe(0);
    expect(result.oilVolumeM3 + result.waterVolumeM3).toBe(0);
  });

  it("accepts oversized phase inlets proportionally to available capacity", () => {
    const result = integratePhaseInventories({
      oilVolumeM3: 0.7,
      waterVolumeM3: 0.2,
      oilInletM3H: 72,
      waterInletM3H: 36,
      oilOutletM3H: 0,
      waterOutletM3H: 0,
      dtS: 10,
      fullVolumeM3: 1,
    });

    expect(result.acceptedOilInletM3H).toBeCloseTo(24, 12);
    expect(result.acceptedWaterInletM3H).toBeCloseTo(12, 12);
    expect(result.oilVolumeM3).toBeCloseTo(0.7 + 24 * 10 / 3600, 14);
    expect(result.waterVolumeM3).toBeCloseTo(0.2 + 12 * 10 / 3600, 14);
    expect(result.oilVolumeM3 + result.waterVolumeM3).toBeCloseTo(1, 14);
  });

  it("accepts finite phase inlets when capacity is unbounded", () => {
    const result = integratePhaseInventories({
      oilVolumeM3: 1,
      waterVolumeM3: 1,
      oilInletM3H: 36,
      waterInletM3H: 36,
      oilOutletM3H: 0,
      waterOutletM3H: 0,
      dtS: 1,
      fullVolumeM3: Number.POSITIVE_INFINITY,
    });

    expect(result.oilVolumeM3).toBeCloseTo(1.01, 14);
    expect(result.waterVolumeM3).toBeCloseTo(1.01, 14);
    expect(result.actualOilOutletM3H).toBe(0);
    expect(result.actualWaterOutletM3H).toBe(0);
    expect(result.acceptedOilInletM3H).toBe(36);
    expect(result.acceptedWaterInletM3H).toBe(36);
    expect(result.normalizationOilDiscardM3).toBe(0);
    expect(result.normalizationWaterDiscardM3).toBe(0);
  });

  it("reports overcapacity normalization separately from physical outlet flow", () => {
    const dtS = 1;
    const result = integratePhaseInventories({
      oilVolumeM3: 3,
      waterVolumeM3: 1,
      oilInletM3H: 0,
      waterInletM3H: 0,
      oilOutletM3H: 360,
      waterOutletM3H: 0,
      dtS,
      fullVolumeM3: 2,
    });
    const stepHours = dtS / 3600;

    expect(result.actualOilOutletM3H).toBeCloseTo(360, 12);
    expect(result.actualWaterOutletM3H).toBe(0);
    expect(result.acceptedOilInletM3H).toBe(0);
    expect(result.acceptedWaterInletM3H).toBe(0);
    expect(result.normalizationOilDiscardM3).toBeCloseTo(1.5, 14);
    expect(result.normalizationWaterDiscardM3).toBeCloseTo(0.5, 14);
    expect(
      3 -
        result.normalizationOilDiscardM3 -
        result.actualOilOutletM3H * stepHours +
        result.acceptedOilInletM3H * stepHours,
    ).toBeCloseTo(result.oilVolumeM3, 14);
    expect(
      1 -
        result.normalizationWaterDiscardM3 -
        result.actualWaterOutletM3H * stepHours +
        result.acceptedWaterInletM3H * stepHours,
    ).toBeCloseTo(result.waterVolumeM3, 14);
  });

  it("keeps maximal finite starting inventory corrections finite", () => {
    const result = integratePhaseInventories({
      oilVolumeM3: Number.MAX_VALUE,
      waterVolumeM3: Number.MAX_VALUE,
      oilInletM3H: 0,
      waterInletM3H: 0,
      oilOutletM3H: 0,
      waterOutletM3H: 0,
      dtS: 1,
      fullVolumeM3: 1,
    });

    for (const value of Object.values(result)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(result.normalizationOilDiscardM3).toBeGreaterThan(0);
    expect(result.normalizationWaterDiscardM3).toBeGreaterThan(0);
    expect(result.actualOilOutletM3H).toBe(0);
    expect(result.actualWaterOutletM3H).toBe(0);
    expect(result.oilVolumeM3 + result.waterVolumeM3).toBeLessThanOrEqual(1);
  });

  it("accepts overflowing finite inlet requests without non-finite results", () => {
    const dtS = Number.MAX_VALUE;
    const result = integratePhaseInventories({
      oilVolumeM3: 0,
      waterVolumeM3: 0,
      oilInletM3H: Number.MAX_VALUE,
      waterInletM3H: Number.MAX_VALUE,
      oilOutletM3H: 0,
      waterOutletM3H: 0,
      dtS,
      fullVolumeM3: 2,
    });
    const stepHours = dtS / 3600;

    for (const value of Object.values(result)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(result.oilVolumeM3).toBeCloseTo(1, 14);
    expect(result.waterVolumeM3).toBeCloseTo(1, 14);
    expect(result.oilVolumeM3 + result.waterVolumeM3).toBeLessThanOrEqual(2);
    expect(result.acceptedOilInletM3H * stepHours).toBeCloseTo(
      result.oilVolumeM3,
      14,
    );
    expect(result.acceptedWaterInletM3H * stepHours).toBeCloseTo(
      result.waterVolumeM3,
      14,
    );
  });

  it("limits unbounded physical capacity to representable inventory", () => {
    const result = integratePhaseInventories({
      oilVolumeM3: 0,
      waterVolumeM3: 0,
      oilInletM3H: Number.MAX_VALUE,
      waterInletM3H: Number.MAX_VALUE,
      oilOutletM3H: 0,
      waterOutletM3H: 0,
      dtS: Number.MAX_VALUE,
      fullVolumeM3: Number.POSITIVE_INFINITY,
    });

    for (const value of Object.values(result)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(result.oilVolumeM3 + result.waterVolumeM3).toBeLessThanOrEqual(
      Number.MAX_VALUE,
    );
  });

  it("normalizes an unbounded starting inventory to the arithmetic ceiling", () => {
    const result = integratePhaseInventories({
      oilVolumeM3: Number.MAX_VALUE,
      waterVolumeM3: Number.MAX_VALUE,
      oilInletM3H: 0,
      waterInletM3H: 0,
      oilOutletM3H: 0,
      waterOutletM3H: 0,
      dtS: 1,
      fullVolumeM3: Number.POSITIVE_INFINITY,
    });

    for (const value of Object.values(result)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(result.oilVolumeM3 + result.waterVolumeM3).toBeLessThanOrEqual(
      Number.MAX_VALUE,
    );
    expect(result.normalizationOilDiscardM3).toBeGreaterThan(0);
    expect(result.normalizationWaterDiscardM3).toBeGreaterThan(0);
    expect(
      result.normalizationOilDiscardM3 / result.normalizationWaterDiscardM3,
    ).toBeCloseTo(1, 14);
    expect(Number.MAX_VALUE - result.normalizationOilDiscardM3).toBe(
      result.oilVolumeM3,
    );
    expect(Number.MAX_VALUE - result.normalizationWaterDiscardM3).toBe(
      result.waterVolumeM3,
    );
  });

  it("normalizes an overfilled starting inventory before applying flows", () => {
    const result = integratePhaseInventories({
      oilVolumeM3: 3,
      waterVolumeM3: 1,
      oilInletM3H: 0,
      waterInletM3H: 0,
      oilOutletM3H: 0,
      waterOutletM3H: 0,
      dtS: 1,
      fullVolumeM3: 2,
    });

    expect(result.oilVolumeM3).toBeCloseTo(1.5, 14);
    expect(result.waterVolumeM3).toBeCloseTo(0.5, 14);
    expect(result.normalizationOilDiscardM3).toBeCloseTo(1.5, 14);
    expect(result.normalizationWaterDiscardM3).toBeCloseTo(0.5, 14);
    expect(result.actualOilOutletM3H).toBe(0);
    expect(result.actualWaterOutletM3H).toBe(0);
    expect(result.oilVolumeM3 + result.waterVolumeM3).toBeCloseTo(2, 14);
  });
});
