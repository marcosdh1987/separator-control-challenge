import { describe, expect, it } from "vitest";

import { calculateScore, rankForScore } from "./scoring";
import type { RunMetrics, TripKind } from "./types";

const perfectMetrics: RunMetrics = {
  alarmTimeS: 0,
  recoveryTimeS: 0,
  settled: true,
  minimumOilLayerPct: 30,
  loops: {
    total: {
      alarmTimeS: 0,
      mae: 0,
      maximumPct: 50,
      minimumPct: 50,
      targetBandTimeOutsideS: 0,
      stabilityStdDev: 0,
      oscillationCrossings: 0,
      oscillationPeakToPeakPct: 0,
      recoveryTimeS: 0,
      settled: true,
    },
    interface: {
      alarmTimeS: 0,
      mae: 0,
      maximumPct: 20,
      minimumPct: 20,
      targetBandTimeOutsideS: 0,
      stabilityStdDev: 0,
      oscillationCrossings: 0,
      oscillationPeakToPeakPct: 0,
      recoveryTimeS: 0,
      settled: true,
    },
  },
  actuators: {
    oil: { travelPct: 0, saturationTimeS: 0, integralLimitTimeS: 0 },
    water: { travelPct: 0, saturationTimeS: 0, integralLimitTimeS: 0 },
  },
  phaseTotals: {
    oilInletM3: 0,
    waterInletM3: 0,
    oilOutletM3: 0,
    waterOutletM3: 0,
    finalOilVolumeM3: 1.2,
    finalWaterVolumeM3: 0.48,
  },
  trip: null,
};

describe("dual-loop score", () => {
  it("awards exactly 100 points to perfect control", () => {
    expect(calculateScore(perfectMetrics).total).toBe(100);
  });

  it("uses the exact weighted base formulas", () => {
    const score = calculateScore({
      ...perfectMetrics,
      alarmTimeS: 9,
      recoveryTimeS: 45,
      loops: {
        total: { ...perfectMetrics.loops.total, mae: 3, stabilityStdDev: 4 },
        interface: { ...perfectMetrics.loops.interface, mae: 2, stabilityStdDev: 2.5 },
      },
      actuators: {
        oil: { ...perfectMetrics.actuators.oil, travelPct: 150 },
        water: {
          ...perfectMetrics.actuators.water,
          travelPct: 300,
          saturationTimeS: 22.5,
        },
      },
    });

    expect(score.safety).toBeCloseTo(28, 12);
    expect(score.tracking).toBeCloseTo(20, 12);
    expect(score.stability).toBeCloseTo(7.5, 12);
    expect(score.recovery).toBeCloseTo(7.5, 12);
    expect(score.valveEfficiency).toBeCloseTo(4.5, 12);
    expect(score.total).toBe(68);
  });

  it("sets safety to zero and caps an interface trip at 35", () => {
    const score = calculateScore({ ...perfectMetrics, trip: "INTERFACE_HH" });

    expect(score.safety).toBe(0);
    expect(score.total).toBe(35);
    expect(score.modifiers).toContainEqual({
      id: "trip",
      label: "Interface high-high trip cap",
      points: 0,
    });
    expect(score.diagnosis).toContain("Interface");
    expect(score.suggestion).toContain("water valve");
  });

  it("emits exact per-loop and per-actuator modifiers", () => {
    const score = calculateScore({
      ...perfectMetrics,
      loops: {
        total: {
          ...perfectMetrics.loops.total,
          oscillationCrossings: 6,
          oscillationPeakToPeakPct: 8,
        },
        interface: {
          ...perfectMetrics.loops.interface,
          oscillationCrossings: 6,
          oscillationPeakToPeakPct: 6,
        },
      },
      actuators: {
        oil: { travelPct: 301, saturationTimeS: 31, integralLimitTimeS: 11 },
        water: { travelPct: 301, saturationTimeS: 31, integralLimitTimeS: 11 },
      },
    });

    expect(score.modifiers).toEqual([
      expect.objectContaining({ id: "total-oscillation", points: -5 }),
      expect.objectContaining({ id: "interface-oscillation", points: -5 }),
      expect.objectContaining({ id: "oil-saturation", points: -4 }),
      expect.objectContaining({ id: "water-saturation", points: -4 }),
      expect.objectContaining({ id: "oil-travel", points: -2.5 }),
      expect.objectContaining({ id: "water-travel", points: -2.5 }),
      expect.objectContaining({ id: "total-windup", points: -2.5 }),
      expect.objectContaining({ id: "interface-windup", points: -2.5 }),
    ]);
  });

  it("does not apply strict modifiers at their exact boundary", () => {
    const score = calculateScore({
      ...perfectMetrics,
      actuators: {
        oil: { travelPct: 300, saturationTimeS: 30, integralLimitTimeS: 10 },
        water: { travelPct: 300, saturationTimeS: 30, integralLimitTimeS: 10 },
      },
    });

    expect(score.modifiers).toEqual([]);
  });

  it("chooses a deterministic responsible loop when modifiers tie", () => {
    const score = calculateScore({
      ...perfectMetrics,
      loops: {
        total: {
          ...perfectMetrics.loops.total,
          oscillationCrossings: 6,
          oscillationPeakToPeakPct: 8,
        },
        interface: {
          ...perfectMetrics.loops.interface,
          oscillationCrossings: 6,
          oscillationPeakToPeakPct: 6,
        },
      },
    });

    expect(score.diagnosis).toContain("Total level");
    expect(score.suggestion).toContain("total level loop");
  });

  it("chooses total level deterministically when normalized tracking losses tie", () => {
    const score = calculateScore({
      ...perfectMetrics,
      loops: {
        total: { ...perfectMetrics.loops.total, mae: 3 },
        interface: { ...perfectMetrics.loops.interface, mae: 2 },
      },
    });

    expect(score.diagnosis).toContain("Total level tracking");
    expect(score.suggestion).toContain("total level loop");
  });

  it("chooses safety deterministically when normalized base categories tie", () => {
    const score = calculateScore({
      ...perfectMetrics,
      alarmTimeS: 9,
      loops: {
        total: { ...perfectMetrics.loops.total, mae: 6 },
        interface: perfectMetrics.loops.interface,
      },
    });

    expect(score.diagnosis).toContain("Total level");
    expect(score.diagnosis).toContain("oil valve");
    expect(score.suggestion).toContain("Total level");
    expect(score.suggestion).toContain("oil valve");
  });

  it.each([
    {
      name: "total level",
      totalAlarmTimeS: 20,
      interfaceAlarmTimeS: 5,
      expectedLoop: "Total level",
      expectedActuator: "oil valve",
    },
    {
      name: "interface",
      totalAlarmTimeS: 5,
      interfaceAlarmTimeS: 20,
      expectedLoop: "Interface",
      expectedActuator: "water valve",
    },
    {
      name: "stable total-level tie-break",
      totalAlarmTimeS: 20,
      interfaceAlarmTimeS: 20,
      expectedLoop: "Total level",
      expectedActuator: "oil valve",
    },
  ])("attributes dominant safety loss to $name evidence", ({
    totalAlarmTimeS,
    interfaceAlarmTimeS,
    expectedLoop,
    expectedActuator,
  }) => {
    const score = calculateScore({
      ...perfectMetrics,
      alarmTimeS: 20,
      loops: {
        total: { ...perfectMetrics.loops.total, alarmTimeS: totalAlarmTimeS },
        interface: { ...perfectMetrics.loops.interface, alarmTimeS: interfaceAlarmTimeS },
      },
    });

    expect(score.diagnosis).toContain(expectedLoop);
    expect(score.diagnosis).toContain(expectedActuator);
    expect(score.suggestion).toContain(expectedLoop);
    expect(score.suggestion).toContain(expectedActuator);
  });

  it.each([
    {
      name: "total level",
      totalRecoveryTimeS: 60,
      totalSettled: false,
      interfaceRecoveryTimeS: 20,
      interfaceSettled: true,
      expectedLoop: "Total level",
      expectedActuator: "oil valve",
    },
    {
      name: "interface",
      totalRecoveryTimeS: 20,
      totalSettled: true,
      interfaceRecoveryTimeS: 60,
      interfaceSettled: false,
      expectedLoop: "Interface",
      expectedActuator: "water valve",
    },
    {
      name: "stable total-level tie-break",
      totalRecoveryTimeS: 60,
      totalSettled: false,
      interfaceRecoveryTimeS: 60,
      interfaceSettled: false,
      expectedLoop: "Total level",
      expectedActuator: "oil valve",
    },
  ])("attributes dominant recovery loss to $name evidence", ({
    totalRecoveryTimeS,
    totalSettled,
    interfaceRecoveryTimeS,
    interfaceSettled,
    expectedLoop,
    expectedActuator,
  }) => {
    const score = calculateScore({
      ...perfectMetrics,
      recoveryTimeS: 60,
      loops: {
        total: {
          ...perfectMetrics.loops.total,
          recoveryTimeS: totalRecoveryTimeS,
          settled: totalSettled,
        },
        interface: {
          ...perfectMetrics.loops.interface,
          recoveryTimeS: interfaceRecoveryTimeS,
          settled: interfaceSettled,
        },
      },
    });

    expect(score.diagnosis).toContain(expectedLoop);
    expect(score.diagnosis).toContain(expectedActuator);
    expect(score.suggestion).toContain(expectedLoop);
    expect(score.suggestion).toContain(expectedActuator);
  });

  it.each([
    ["TOTAL_LL", "Total level low-low", "oil valve"],
    ["TOTAL_HH", "Total level high-high", "oil valve"],
    ["INTERFACE_LL", "Interface low-low", "water valve"],
    ["INTERFACE_HH", "Interface high-high", "water valve"],
    ["OIL_LAYER_LL", "Oil-layer low-low", "water valve"],
  ] satisfies Array<[Exclude<TripKind, null>, string, string]>)
    ("names the exact %s trip source and direction", (trip, diagnosis, actuator) => {
      const score = calculateScore({ ...perfectMetrics, trip });

      expect(score.diagnosis).toContain(diagnosis);
      expect(score.suggestion).toContain(actuator);
    });
});

describe("performance ranks", () => {
  it.each([
    [39, "Trainee Operator"],
    [40, "Control Technician"],
    [60, "Process Engineer"],
    [75, "Loop Tuning Specialist"],
    [90, "Separator Control Master"],
  ])("maps %i to %s", (score, rank) => {
    expect(rankForScore(score)).toBe(rank);
  });
});
