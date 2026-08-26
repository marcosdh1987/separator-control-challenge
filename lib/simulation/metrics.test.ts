import { describe, expect, it } from "vitest";

import { calculateMetrics } from "./metrics";
import {
  DEFAULT_SIMULATION,
  type LiquidLoopId,
  type SimulationSample,
} from "./types";

type SampleOptions = {
  totalProcess?: number;
  totalMeasured?: number;
  totalCommand?: number;
  totalPosition?: number;
  totalIntegral?: number;
  interfaceProcess?: number;
  interfaceMeasured?: number;
  interfaceCommand?: number;
  interfacePosition?: number;
  interfaceIntegral?: number;
  oilLayerPct?: number;
  oilVolumeM3?: number;
  waterVolumeM3?: number;
  oilInletM3H?: number;
  waterInletM3H?: number;
  oilOutletM3H?: number;
  waterOutletM3H?: number;
};

const sample = (timeS: number, options: SampleOptions = {}): SimulationSample => {
  const totalProcess = options.totalProcess ?? 50;
  const totalMeasured = options.totalMeasured ?? totalProcess;
  const interfaceProcess = options.interfaceProcess ?? 20;
  const interfaceMeasured = options.interfaceMeasured ?? interfaceProcess;
  const oilInletM3H = options.oilInletM3H ?? 35;
  const waterInletM3H = options.waterInletM3H ?? 15;
  const oilOutletM3H = options.oilOutletM3H ?? 35;
  const waterOutletM3H = options.waterOutletM3H ?? 15;
  const total = {
    processValuePct: totalProcess,
    measuredValuePct: totalMeasured,
    setpointPct: 50,
    errorPct: 50 - totalMeasured,
    valveCommandPct: options.totalCommand ?? 50,
    valvePositionPct: options.totalPosition ?? 50,
    proportionalTerm: 0,
    integralTerm: options.totalIntegral ?? 0,
    derivativeTerm: 0,
  };
  const interfaceLoop = {
    processValuePct: interfaceProcess,
    measuredValuePct: interfaceMeasured,
    setpointPct: 20,
    errorPct: 20 - interfaceMeasured,
    valveCommandPct: options.interfaceCommand ?? 50,
    valvePositionPct: options.interfacePosition ?? 50,
    proportionalTerm: 0,
    integralTerm: options.interfaceIntegral ?? 0,
    derivativeTerm: 0,
  };

  return {
    timeS,
    total,
    interface: interfaceLoop,
    oilVolumeM3: options.oilVolumeM3 ?? 1.2,
    waterVolumeM3: options.waterVolumeM3 ?? 0.48,
    oilLayerPct: options.oilLayerPct ?? totalProcess - interfaceProcess,
    flows: {
      totalInletM3H: oilInletM3H + waterInletM3H,
      waterCutFraction: waterInletM3H / (oilInletM3H + waterInletM3H),
      oilInletM3H,
      waterInletM3H,
      oilOutletM3H,
      waterOutletM3H,
    },
    safety: {
      severity: "safe",
      source: null,
      condition: "normal",
      trip: null,
    },
    disturbance: "steady",
  };
};

const limits: Record<LiquidLoopId, number> = { total: 10, interface: 20 };

describe("dual-loop run metrics", () => {
  it("rejects an empty sample history", () => {
    expect(() => calculateMetrics([], DEFAULT_SIMULATION, null, 0, limits)).toThrow(
      "Metrics require at least one sample",
    );
  });

  it("calculates both loops, both actuators, overlapping alarms, and phase totals", () => {
    const config = {
      ...DEFAULT_SIMULATION,
      totalLowAlarmPct: 46,
      totalHighAlarmPct: 54,
      interfaceLowAlarmPct: 19,
      interfaceHighAlarmPct: 21,
    };
    const samples = [
      sample(0, {
        totalProcess: 45,
        totalMeasured: 99,
        interfaceProcess: 18,
        interfaceMeasured: 99,
        totalPosition: 20,
        interfacePosition: 40,
      }),
      sample(0.2, {
        totalProcess: 55,
        totalMeasured: 1,
        interfaceProcess: 22,
        interfaceMeasured: 1,
        totalPosition: 40,
        interfacePosition: 50,
      }),
      sample(0.4, {
        totalProcess: 55,
        totalMeasured: 1,
        interfaceProcess: 22,
        interfaceMeasured: 1,
        totalPosition: 60,
        interfacePosition: 60,
        oilLayerPct: 12,
        oilVolumeM3: 1.1,
        waterVolumeM3: 0.58,
      }),
    ];

    const metrics = calculateMetrics(samples, config, null, 0, limits);

    expect(metrics.loops.total.mae).toBeCloseTo(5, 8);
    expect(metrics.loops.interface.mae).toBeCloseTo(2, 8);
    expect(metrics.loops.total.maximumPct).toBe(55);
    expect(metrics.loops.total.minimumPct).toBe(45);
    expect(metrics.loops.total.alarmTimeS).toBe(0.4);
    expect(metrics.loops.interface.alarmTimeS).toBe(0.4);
    expect(metrics.actuators.oil.travelPct).toBe(40);
    expect(metrics.actuators.water.travelPct).toBe(20);
    expect(metrics.alarmTimeS).toBe(0.4);
    expect(metrics.minimumOilLayerPct).toBe(12);
    expect(metrics.phaseTotals.oilInletM3).toBeCloseTo((35 * 0.4) / 3600, 12);
    expect(metrics.phaseTotals.waterInletM3).toBeCloseTo((15 * 0.4) / 3600, 12);
    expect(metrics.phaseTotals.oilOutletM3).toBeCloseTo((35 * 0.4) / 3600, 12);
    expect(metrics.phaseTotals.waterOutletM3).toBeCloseTo((15 * 0.4) / 3600, 12);
    expect(metrics.phaseTotals.finalOilVolumeM3).toBe(1.1);
    expect(metrics.phaseTotals.finalWaterVolumeM3).toBe(0.58);
  });

  it("uses actual irregular intervals with a right-rectangle convention", () => {
    const outside = {
      totalProcess: 80,
      interfaceProcess: 40,
      totalCommand: 100,
      interfaceCommand: 0,
      totalIntegral: 10,
      interfaceIntegral: 20,
      oilInletM3H: 36,
      waterInletM3H: 18,
      oilOutletM3H: 24,
      waterOutletM3H: 12,
    };
    const samples = [
      sample(1, outside),
      sample(3, {
        oilInletM3H: 72,
        waterInletM3H: 36,
        oilOutletM3H: 48,
        waterOutletM3H: 24,
      }),
      sample(2, outside),
      sample(5, outside),
    ];

    const metrics = calculateMetrics(samples, DEFAULT_SIMULATION, null, 0, limits);

    // t=0..1 and t=3..5 use the current outside sample. The regressing t=2
    // sample contributes no duration; t=1..3 uses the safe sample at t=3.
    expect(metrics.alarmTimeS).toBe(3);
    expect(metrics.loops.total.targetBandTimeOutsideS).toBe(3);
    expect(metrics.loops.interface.targetBandTimeOutsideS).toBe(3);
    expect(metrics.actuators.oil.saturationTimeS).toBe(3);
    expect(metrics.actuators.water.saturationTimeS).toBe(3);
    expect(metrics.actuators.oil.integralLimitTimeS).toBe(3);
    expect(metrics.actuators.water.integralLimitTimeS).toBe(3);
    expect(metrics.phaseTotals.oilInletM3).toBeCloseTo((36 * 3 + 72 * 2) / 3600, 12);
    expect(metrics.phaseTotals.waterOutletM3).toBeCloseTo((12 * 3 + 24 * 2) / 3600, 12);
  });

  it("includes t=0 to the first retained sample for a one-sample history", () => {
    const metrics = calculateMetrics(
      [sample(2, {
        totalProcess: 80,
        interfaceProcess: 40,
        totalCommand: 100,
        interfaceCommand: 0,
        totalIntegral: 10,
        interfaceIntegral: 20,
        oilInletM3H: 36,
      })],
      DEFAULT_SIMULATION,
      null,
      0,
      limits,
    );

    expect(metrics.alarmTimeS).toBe(2);
    expect(metrics.loops.total.targetBandTimeOutsideS).toBe(2);
    expect(metrics.actuators.oil.saturationTimeS).toBe(2);
    expect(metrics.actuators.oil.integralLimitTimeS).toBe(2);
    expect(metrics.phaseTotals.oilInletM3).toBeCloseTo((36 * 2) / 3600, 12);
    expect(metrics.actuators.oil.travelPct).toBe(0);
    expect(metrics.recoveryTimeS).toBe(90);
    expect(metrics.settled).toBe(false);
  });

  it("starts joint recovery only when both loops enter and remain in band", () => {
    const samples = [
      sample(0, { totalProcess: 60, interfaceProcess: 30 }),
      sample(5, { totalProcess: 50, interfaceProcess: 30 }),
      sample(12, { totalProcess: 50, interfaceProcess: 20 }),
      sample(18, { totalProcess: 50, interfaceProcess: 20 }),
      sample(22, { totalProcess: 50, interfaceProcess: 20 }),
    ];

    const metrics = calculateMetrics(samples, DEFAULT_SIMULATION, null, 0, limits);

    expect(metrics.recoveryTimeS).toBe(12);
    expect(metrics.settled).toBe(true);
    expect(metrics.loops.total.recoveryTimeS).toBe(5);
    expect(metrics.loops.total.settled).toBe(true);
    expect(metrics.loops.interface.recoveryTimeS).toBe(12);
    expect(metrics.loops.interface.settled).toBe(true);
  });

  it("ignores an in-band period before the disturbance ends", () => {
    const samples = [
      sample(0),
      sample(9),
      sample(10, { totalProcess: 60, interfaceProcess: 30 }),
      sample(12),
      sample(22),
    ];

    const metrics = calculateMetrics(samples, DEFAULT_SIMULATION, null, 10, limits);

    expect(metrics.recoveryTimeS).toBe(2);
    expect(metrics.settled).toBe(true);
  });

  it("keeps joint recovery unsettled when individual qualifying windows do not overlap", () => {
    const samples = [
      sample(0, { totalProcess: 50, interfaceProcess: 30 }),
      sample(10, { totalProcess: 50, interfaceProcess: 30 }),
      sample(12, { totalProcess: 60, interfaceProcess: 20 }),
      sample(22, { totalProcess: 60, interfaceProcess: 20 }),
    ];

    const metrics = calculateMetrics(samples, DEFAULT_SIMULATION, null, 0, limits);

    expect(metrics.loops.total).toMatchObject({ recoveryTimeS: 0, settled: true });
    expect(metrics.loops.interface).toMatchObject({ recoveryTimeS: 12, settled: true });
    expect(metrics.recoveryTimeS).toBe(90);
    expect(metrics.settled).toBe(false);
  });

  it("detects each loop oscillating at its exact final-60-second threshold", () => {
    const samples = Array.from({ length: 7 }, (_, index) => sample(120 + index * 10, {
      totalProcess: 50 + (index % 2 === 0 ? -4 : 4),
      interfaceProcess: 20 + (index % 2 === 0 ? -3 : 3),
    }));

    const metrics = calculateMetrics(samples, DEFAULT_SIMULATION, null, 0, limits);

    expect(metrics.loops.total.oscillationCrossings).toBe(6);
    expect(metrics.loops.total.oscillationPeakToPeakPct).toBe(8);
    expect(metrics.loops.interface.oscillationCrossings).toBe(6);
    expect(metrics.loops.interface.oscillationPeakToPeakPct).toBe(6);
  });

  it.each([
    { name: "touch and return", errors: [-1, 0, -1], crossings: 0 },
    { name: "true pass-through", errors: [-1, 0, 1], crossings: 1 },
    { name: "zero plateau", errors: [-1, 0, 0, 1, 0, 0, -1], crossings: 2 },
  ])("treats exact setpoint samples as neutral for $name crossings", ({ errors, crossings }) => {
    const samples = errors.map((error, index) => sample(120 + index, {
      totalProcess: 50 + error,
      interfaceProcess: 20 + error,
    }));

    const metrics = calculateMetrics(samples, DEFAULT_SIMULATION, null, 0, limits);

    expect(metrics.loops.total.oscillationCrossings).toBe(crossings);
    expect(metrics.loops.interface.oscillationCrossings).toBe(crossings);
  });

  it("rejects malformed and regressing samples from every metric", () => {
    const samples = [
      sample(0, {
        totalPosition: 10,
        interfacePosition: 20,
        oilInletM3H: 10,
        oilVolumeM3: 1,
        waterVolumeM3: 0.4,
      }),
      sample(2, {
        totalProcess: 60,
        interfaceProcess: 22,
        totalPosition: 20,
        interfacePosition: 30,
        oilInletM3H: 20,
        oilVolumeM3: 1.1,
        waterVolumeM3: 0.5,
      }),
      sample(1, {
        totalProcess: 99,
        interfaceProcess: 99,
        totalPosition: 100,
        interfacePosition: 100,
        oilInletM3H: 1_000,
        oilVolumeM3: 99,
        waterVolumeM3: 99,
      }),
      sample(3, {
        totalProcess: Number.POSITIVE_INFINITY,
        interfaceProcess: 20,
        totalPosition: 100,
        interfacePosition: 100,
        oilInletM3H: 1_000,
        oilVolumeM3: 99,
        waterVolumeM3: 99,
      }),
      sample(Number.NaN, {
        totalProcess: 100,
        interfaceProcess: 100,
        totalPosition: 0,
        interfacePosition: 0,
      }),
      sample(-1, { totalProcess: 100, interfaceProcess: 100 }),
      sample(4, {
        totalProcess: 40,
        interfaceProcess: 18,
        totalPosition: 30,
        interfacePosition: 50,
        oilInletM3H: 40,
        oilVolumeM3: 1.4,
        waterVolumeM3: 0.6,
      }),
    ];

    const metrics = calculateMetrics(samples, DEFAULT_SIMULATION, null, 0, limits);

    expect(metrics.loops.total.mae).toBeCloseTo(20 / 3, 12);
    expect(metrics.loops.total.maximumPct).toBe(60);
    expect(metrics.loops.total.minimumPct).toBe(40);
    expect(metrics.loops.total.oscillationCrossings).toBe(1);
    expect(metrics.actuators.oil.travelPct).toBe(20);
    expect(metrics.actuators.water.travelPct).toBe(30);
    expect(metrics.phaseTotals.oilInletM3).toBeCloseTo((20 * 2 + 40 * 2) / 3600, 12);
    expect(metrics.phaseTotals.finalOilVolumeM3).toBe(1.4);
    expect(metrics.phaseTotals.finalWaterVolumeM3).toBe(0.6);
  });

  it("throws when timestamp and process validation rejects the whole history", () => {
    const samples = [
      sample(Number.NaN),
      sample(-1),
      sample(0, { totalProcess: Number.POSITIVE_INFINITY }),
    ];

    expect(() => calculateMetrics(samples, DEFAULT_SIMULATION, null, 0, limits)).toThrow(
      "Metrics require at least one valid sample",
    );
  });
});
