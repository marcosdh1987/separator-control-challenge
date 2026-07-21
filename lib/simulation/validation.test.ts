import { describe, expect, it } from "vitest";

import {
  sanitizeDualPidConfig,
  sanitizePidConfig,
  sanitizeSimulationConfig,
} from "./validation";
import { DEFAULT_DUAL_PID, DEFAULT_PID, DEFAULT_SIMULATION } from "./types";

describe("simulation configuration validation", () => {
  it("exports the approved dual-loop simulation defaults", () => {
    expect(DEFAULT_SIMULATION).toMatchObject({
      dtS: 0.05,
      durationS: 180,
      chartSampleS: 0.2,
      diameterM: 1.2,
      lengthM: 3,
      oilDensityKgM3: 850,
      waterDensityKgM3: 1000,
      totalSetpointPct: 50,
      interfaceSetpointPct: 20,
      totalTargetBandPct: 5,
      interfaceTargetBandPct: 3,
      totalLowLowPct: 10,
      totalLowAlarmPct: 25,
      totalHighAlarmPct: 75,
      totalHighHighPct: 90,
      interfaceLowLowPct: 3,
      interfaceLowAlarmPct: 8,
      interfaceHighAlarmPct: 35,
      interfaceHighHighPct: 45,
      oilLayerLowLowPct: 5,
      oilRatedFlowM3H: 70,
      waterRatedFlowM3H: 30,
      actuatorTauS: 3,
      actuatorStrokeRatePctS: 20,
    });
  });

  it("exports independent immutable PID defaults", () => {
    expect(DEFAULT_DUAL_PID.total).not.toBe(DEFAULT_PID);
    expect(DEFAULT_DUAL_PID.interface).not.toBe(DEFAULT_PID);
    expect(DEFAULT_DUAL_PID.total).not.toBe(DEFAULT_DUAL_PID.interface);
    expect(Object.isFrozen(DEFAULT_PID)).toBe(true);
    expect(Object.isFrozen(DEFAULT_DUAL_PID)).toBe(true);
    expect(Object.isFrozen(DEFAULT_DUAL_PID.total)).toBe(true);
    expect(Object.isFrozen(DEFAULT_DUAL_PID.interface)).toBe(true);
  });

  it("exports an immutable simulation default", () => {
    expect(Object.isFrozen(DEFAULT_SIMULATION)).toBe(true);
  });

  it("clamps unsafe PID values before they reach the engine", () => {
    const sanitized = sanitizePidConfig({
      ...DEFAULT_PID,
      kp: Number.NaN,
      ki: 9,
      sampleTimeS: 0,
      derivativeFilterTauS: -2,
    });

    expect(sanitized.kp).toBe(DEFAULT_PID.kp);
    expect(sanitized.ki).toBe(0.3);
    expect(sanitized.sampleTimeS).toBe(0.1);
    expect(sanitized.derivativeFilterTauS).toBe(0);
  });

  it("sanitizes the total and interface PID configurations independently", () => {
    const sanitized = sanitizeDualPidConfig({
      total: { ...DEFAULT_PID, kp: 99, ki: -1 },
      interface: { ...DEFAULT_PID, kd: 99, integralLimit: 999 },
    });

    expect(sanitized).toEqual({
      total: { ...DEFAULT_DUAL_PID.total, kp: 10, ki: 0 },
      interface: { ...DEFAULT_DUAL_PID.interface, kd: 30, integralLimit: 40 },
    });
  });

  it("keeps physical thresholds ordered and finite", () => {
    const sanitized = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      dtS: 0,
      totalLowLowPct: 80,
      totalLowAlarmPct: 20,
      totalHighAlarmPct: 10,
      totalHighHighPct: Number.NaN,
    });

    expect(sanitized.dtS).toBe(0.01);
    expect(sanitized.totalLowLowPct).toBeLessThan(sanitized.totalLowAlarmPct);
    expect(sanitized.totalLowAlarmPct).toBeLessThan(sanitized.totalHighAlarmPct);
    expect(sanitized.totalHighAlarmPct).toBeLessThan(sanitized.totalHighHighPct);
  });

  it("keeps both safety envelopes ordered by at least 0.1 percentage point", () => {
    const sanitized = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalLowLowPct: 80,
      totalLowAlarmPct: 60,
      totalHighAlarmPct: 40,
      totalHighHighPct: 20,
      interfaceLowLowPct: 40,
      interfaceLowAlarmPct: 30,
      interfaceHighAlarmPct: 20,
      interfaceHighHighPct: 10,
    });

    expect(sanitized.totalLowAlarmPct - sanitized.totalLowLowPct).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.totalHighAlarmPct - sanitized.totalLowAlarmPct).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.totalHighHighPct - sanitized.totalHighAlarmPct).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.interfaceLowAlarmPct - sanitized.interfaceLowLowPct).toBeGreaterThanOrEqual(
      0.1,
    );
    expect(sanitized.interfaceHighAlarmPct - sanitized.interfaceLowAlarmPct).toBeGreaterThanOrEqual(
      0.1,
    );
    expect(
      sanitized.interfaceHighHighPct - sanitized.interfaceHighAlarmPct,
    ).toBeGreaterThanOrEqual(0.1);
  });

  it("leaves the interface thresholds unchanged when only total thresholds are invalid", () => {
    const sanitized = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalLowLowPct: 80,
      totalLowAlarmPct: 60,
      totalHighAlarmPct: 40,
      totalHighHighPct: 20,
      interfaceLowLowPct: 1,
      interfaceLowAlarmPct: 10,
      interfaceHighAlarmPct: 30,
      interfaceHighHighPct: 50,
    });

    expect([
      sanitized.interfaceLowLowPct,
      sanitized.interfaceLowAlarmPct,
      sanitized.interfaceHighAlarmPct,
      sanitized.interfaceHighHighPct,
    ]).toEqual([1, 10, 30, 50]);
    expect([
      sanitized.totalLowLowPct,
      sanitized.totalLowAlarmPct,
      sanitized.totalHighAlarmPct,
      sanitized.totalHighHighPct,
    ]).toEqual([10, 25, 75, 90]);
  });

  it("leaves the total thresholds unchanged when only interface thresholds are invalid", () => {
    const sanitized = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalLowLowPct: 2,
      totalLowAlarmPct: 20,
      totalHighAlarmPct: 80,
      totalHighHighPct: 98,
      interfaceLowLowPct: 40,
      interfaceLowAlarmPct: 30,
      interfaceHighAlarmPct: 20,
      interfaceHighHighPct: 10,
    });

    expect([
      sanitized.totalLowLowPct,
      sanitized.totalLowAlarmPct,
      sanitized.totalHighAlarmPct,
      sanitized.totalHighHighPct,
    ]).toEqual([2, 20, 80, 98]);
    expect([
      sanitized.interfaceLowLowPct,
      sanitized.interfaceLowAlarmPct,
      sanitized.interfaceHighAlarmPct,
      sanitized.interfaceHighHighPct,
    ]).toEqual([3, 8, 35, 45]);
  });

  it("guarantees literal 0.1 threshold gaps near the 0 and 100 percent boundaries", () => {
    const sanitized = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalLowLowPct: 0,
      totalLowAlarmPct: 0.1,
      totalHighAlarmPct: 99.9,
      totalHighHighPct: 100,
      interfaceLowLowPct: 0,
      interfaceLowAlarmPct: 0.1,
      interfaceHighAlarmPct: 99.9,
      interfaceHighHighPct: 100,
    });

    expect(sanitized.totalLowAlarmPct - sanitized.totalLowLowPct).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.totalHighAlarmPct - sanitized.totalLowAlarmPct).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.totalHighHighPct - sanitized.totalHighAlarmPct).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.interfaceLowAlarmPct - sanitized.interfaceLowLowPct).toBeGreaterThanOrEqual(
      0.1,
    );
    expect(sanitized.interfaceHighAlarmPct - sanitized.interfaceLowAlarmPct).toBeGreaterThanOrEqual(
      0.1,
    );
    expect(
      sanitized.interfaceHighHighPct - sanitized.interfaceHighAlarmPct,
    ).toBeGreaterThanOrEqual(0.1);
  });

  it("keeps total thresholds ordered after clamping them to 0 through 100 percent", () => {
    const sanitized = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalLowLowPct: -10,
      totalLowAlarmPct: 0.1,
      totalHighAlarmPct: 99.8,
      totalHighHighPct: 110,
    });

    expect(sanitized.totalLowLowPct).toBe(0);
    expect(sanitized.totalLowAlarmPct).toBe(0.1);
    expect(sanitized.totalHighAlarmPct).toBe(99.8);
    expect(sanitized.totalHighHighPct).toBe(100);
    expect(sanitized.totalLowAlarmPct - sanitized.totalLowLowPct).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.totalHighAlarmPct - sanitized.totalLowAlarmPct).toBeGreaterThanOrEqual(0.1);
    expect(sanitized.totalHighHighPct - sanitized.totalHighAlarmPct).toBeGreaterThanOrEqual(0.1);
  });

  it("allows ordered total thresholds throughout the full 0 through 100 percent range", () => {
    const nearLowerBoundary = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalLowLowPct: 0,
      totalLowAlarmPct: 0.2,
      totalHighAlarmPct: 0.5,
      totalHighHighPct: 0.8,
    });
    const nearUpperBoundary = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalLowLowPct: 99.1,
      totalLowAlarmPct: 99.4,
      totalHighAlarmPct: 99.7,
      totalHighHighPct: 100,
    });

    expect([
      nearLowerBoundary.totalLowLowPct,
      nearLowerBoundary.totalLowAlarmPct,
      nearLowerBoundary.totalHighAlarmPct,
      nearLowerBoundary.totalHighHighPct,
    ]).toEqual([0, 0.2, 0.5, 0.8]);
    expect([
      nearUpperBoundary.totalLowLowPct,
      nearUpperBoundary.totalLowAlarmPct,
      nearUpperBoundary.totalHighAlarmPct,
      nearUpperBoundary.totalHighHighPct,
    ]).toEqual([99.1, 99.4, 99.7, 100]);
  });

  it("clamps both phase densities at their lower and upper bounds", () => {
    const lower = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      oilDensityKgM3: -1,
      waterDensityKgM3: -1,
    });
    const upper = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      oilDensityKgM3: 5000,
      waterDensityKgM3: 5000,
    });

    expect(lower.oilDensityKgM3).toBe(100);
    expect(lower.waterDensityKgM3).toBe(100);
    expect(upper.oilDensityKgM3).toBe(3000);
    expect(upper.waterDensityKgM3).toBe(3000);
  });

  it("clamps loop setpoints and both target bands", () => {
    const lower = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalSetpointPct: 0,
      interfaceSetpointPct: 100,
      totalTargetBandPct: 0,
      interfaceTargetBandPct: 0,
    });
    const upper = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      totalSetpointPct: 100,
      interfaceSetpointPct: 0,
      totalTargetBandPct: 99,
      interfaceTargetBandPct: 99,
    });

    expect(lower.totalSetpointPct).toBe(1);
    expect(lower.interfaceSetpointPct).toBe(99);
    expect(upper.totalSetpointPct).toBe(99);
    expect(upper.interfaceSetpointPct).toBe(1);
    expect(lower.totalTargetBandPct).toBe(0.1);
    expect(lower.interfaceTargetBandPct).toBe(0.1);
    expect(upper.totalTargetBandPct).toBe(20);
    expect(upper.interfaceTargetBandPct).toBe(20);
  });

  it("clamps oil-layer protection at both bounds", () => {
    const lower = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      oilLayerLowLowPct: -1,
    });
    const upper = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      oilLayerLowLowPct: 101,
    });

    expect(lower.oilLayerLowLowPct).toBe(0);
    expect(upper.oilLayerLowLowPct).toBe(100);
  });

  it("clamps both rated phase flows at their lower and upper bounds", () => {
    const lower = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      oilRatedFlowM3H: 0,
      waterRatedFlowM3H: 0,
    });
    const upper = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      oilRatedFlowM3H: 5000,
      waterRatedFlowM3H: 5000,
    });

    expect(lower.oilRatedFlowM3H).toBe(0.1);
    expect(lower.waterRatedFlowM3H).toBe(0.1);
    expect(upper.oilRatedFlowM3H).toBe(1000);
    expect(upper.waterRatedFlowM3H).toBe(1000);
  });

  it("clamps actuator settings at their lower and upper bounds", () => {
    const lower = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      actuatorTauS: 0,
      actuatorStrokeRatePctS: 0,
    });
    const upper = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      actuatorTauS: 1000,
      actuatorStrokeRatePctS: 1000,
    });

    expect(lower.actuatorTauS).toBe(0.05);
    expect(lower.actuatorStrokeRatePctS).toBe(0.1);
    expect(upper.actuatorTauS).toBe(60);
    expect(upper.actuatorStrokeRatePctS).toBe(100);
  });

  it("replaces every non-finite physical setting with its approved default", () => {
    const sanitized = sanitizeSimulationConfig({
      ...DEFAULT_SIMULATION,
      oilDensityKgM3: Number.NaN,
      waterDensityKgM3: Number.POSITIVE_INFINITY,
      totalSetpointPct: Number.NaN,
      interfaceSetpointPct: Number.POSITIVE_INFINITY,
      totalTargetBandPct: Number.NaN,
      interfaceTargetBandPct: Number.POSITIVE_INFINITY,
      totalLowLowPct: Number.NaN,
      totalLowAlarmPct: Number.POSITIVE_INFINITY,
      totalHighAlarmPct: Number.NaN,
      totalHighHighPct: Number.POSITIVE_INFINITY,
      interfaceLowLowPct: Number.NaN,
      interfaceLowAlarmPct: Number.POSITIVE_INFINITY,
      interfaceHighAlarmPct: Number.NaN,
      interfaceHighHighPct: Number.POSITIVE_INFINITY,
      oilLayerLowLowPct: Number.NaN,
      oilRatedFlowM3H: Number.POSITIVE_INFINITY,
      waterRatedFlowM3H: Number.NaN,
      actuatorTauS: Number.POSITIVE_INFINITY,
      actuatorStrokeRatePctS: Number.NaN,
    });

    expect(sanitized).toEqual(DEFAULT_SIMULATION);
  });
});
