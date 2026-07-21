import {
  DEFAULT_PID,
  DEFAULT_SIMULATION,
  type DualPidConfig,
  type PidConfig,
  type SimulationConfig,
} from "./types";

const finiteOr = (value: number, fallback: number) =>
  Number.isFinite(value) ? value : fallback;

const clamp = (value: number, minimum: number, maximum: number, fallback: number) =>
  Math.max(minimum, Math.min(maximum, finiteOr(value, fallback)));

type Thresholds = [number, number, number, number];

const enforceThresholdOrder = (thresholds: Thresholds, fallback: Thresholds): Thresholds =>
  thresholds.every(
    (value, index) => index === 0 || value - thresholds[index - 1] >= 0.1,
  )
    ? thresholds
    : fallback;

export function sanitizePidConfig(config: PidConfig): PidConfig {
  const outputMin = clamp(config.outputMin, 0, 100, DEFAULT_PID.outputMin);
  const outputMax = clamp(config.outputMax, 0, 100, DEFAULT_PID.outputMax);
  return {
    kp: clamp(config.kp, 0, 10, DEFAULT_PID.kp),
    ki: clamp(config.ki, 0, 0.3, DEFAULT_PID.ki),
    kd: clamp(config.kd, 0, 30, DEFAULT_PID.kd),
    sampleTimeS: clamp(config.sampleTimeS, 0.1, 1, DEFAULT_PID.sampleTimeS),
    outputMin: outputMin < outputMax ? outputMin : DEFAULT_PID.outputMin,
    outputMax: outputMax > outputMin ? outputMax : DEFAULT_PID.outputMax,
    integralLimit: clamp(config.integralLimit, 0, 40, DEFAULT_PID.integralLimit),
    derivativeFilterTauS: clamp(
      config.derivativeFilterTauS,
      0,
      5,
      DEFAULT_PID.derivativeFilterTauS,
    ),
  };
}

export function sanitizeDualPidConfig(config: DualPidConfig): DualPidConfig {
  return {
    total: sanitizePidConfig(config.total),
    interface: sanitizePidConfig(config.interface),
  };
}

export function sanitizeSimulationConfig(config: SimulationConfig): SimulationConfig {
  const sanitized: SimulationConfig = {
    dtS: clamp(config.dtS, 0.01, 0.5, DEFAULT_SIMULATION.dtS),
    durationS: clamp(config.durationS, 0.05, 3600, DEFAULT_SIMULATION.durationS),
    chartSampleS: clamp(config.chartSampleS, 0.05, 5, DEFAULT_SIMULATION.chartSampleS),
    diameterM: clamp(config.diameterM, 0.1, 10, DEFAULT_SIMULATION.diameterM),
    lengthM: clamp(config.lengthM, 0.1, 100, DEFAULT_SIMULATION.lengthM),
    oilDensityKgM3: clamp(
      config.oilDensityKgM3,
      100,
      3000,
      DEFAULT_SIMULATION.oilDensityKgM3,
    ),
    waterDensityKgM3: clamp(
      config.waterDensityKgM3,
      100,
      3000,
      DEFAULT_SIMULATION.waterDensityKgM3,
    ),
    totalSetpointPct: clamp(
      config.totalSetpointPct,
      1,
      99,
      DEFAULT_SIMULATION.totalSetpointPct,
    ),
    interfaceSetpointPct: clamp(
      config.interfaceSetpointPct,
      1,
      99,
      DEFAULT_SIMULATION.interfaceSetpointPct,
    ),
    totalTargetBandPct: clamp(
      config.totalTargetBandPct,
      0.1,
      20,
      DEFAULT_SIMULATION.totalTargetBandPct,
    ),
    interfaceTargetBandPct: clamp(
      config.interfaceTargetBandPct,
      0.1,
      20,
      DEFAULT_SIMULATION.interfaceTargetBandPct,
    ),
    totalLowLowPct: clamp(
      config.totalLowLowPct,
      0,
      100,
      DEFAULT_SIMULATION.totalLowLowPct,
    ),
    totalLowAlarmPct: clamp(
      config.totalLowAlarmPct,
      0,
      100,
      DEFAULT_SIMULATION.totalLowAlarmPct,
    ),
    totalHighAlarmPct: clamp(
      config.totalHighAlarmPct,
      0,
      100,
      DEFAULT_SIMULATION.totalHighAlarmPct,
    ),
    totalHighHighPct: clamp(
      config.totalHighHighPct,
      0,
      100,
      DEFAULT_SIMULATION.totalHighHighPct,
    ),
    interfaceLowLowPct: clamp(
      config.interfaceLowLowPct,
      0,
      100,
      DEFAULT_SIMULATION.interfaceLowLowPct,
    ),
    interfaceLowAlarmPct: clamp(
      config.interfaceLowAlarmPct,
      0,
      100,
      DEFAULT_SIMULATION.interfaceLowAlarmPct,
    ),
    interfaceHighAlarmPct: clamp(
      config.interfaceHighAlarmPct,
      0,
      100,
      DEFAULT_SIMULATION.interfaceHighAlarmPct,
    ),
    interfaceHighHighPct: clamp(
      config.interfaceHighHighPct,
      0,
      100,
      DEFAULT_SIMULATION.interfaceHighHighPct,
    ),
    oilLayerLowLowPct: clamp(
      config.oilLayerLowLowPct,
      0,
      100,
      DEFAULT_SIMULATION.oilLayerLowLowPct,
    ),
    oilRatedFlowM3H: clamp(
      config.oilRatedFlowM3H,
      0.1,
      1000,
      DEFAULT_SIMULATION.oilRatedFlowM3H,
    ),
    waterRatedFlowM3H: clamp(
      config.waterRatedFlowM3H,
      0.1,
      1000,
      DEFAULT_SIMULATION.waterRatedFlowM3H,
    ),
    actuatorTauS: clamp(config.actuatorTauS, 0.05, 60, DEFAULT_SIMULATION.actuatorTauS),
    actuatorStrokeRatePctS: clamp(
      config.actuatorStrokeRatePctS,
      0.1,
      100,
      DEFAULT_SIMULATION.actuatorStrokeRatePctS,
    ),
  };

  [
    sanitized.totalLowLowPct,
    sanitized.totalLowAlarmPct,
    sanitized.totalHighAlarmPct,
    sanitized.totalHighHighPct,
  ] = enforceThresholdOrder(
    [
      sanitized.totalLowLowPct,
      sanitized.totalLowAlarmPct,
      sanitized.totalHighAlarmPct,
      sanitized.totalHighHighPct,
    ],
    [
      DEFAULT_SIMULATION.totalLowLowPct,
      DEFAULT_SIMULATION.totalLowAlarmPct,
      DEFAULT_SIMULATION.totalHighAlarmPct,
      DEFAULT_SIMULATION.totalHighHighPct,
    ],
  );
  [
    sanitized.interfaceLowLowPct,
    sanitized.interfaceLowAlarmPct,
    sanitized.interfaceHighAlarmPct,
    sanitized.interfaceHighHighPct,
  ] = enforceThresholdOrder(
    [
      sanitized.interfaceLowLowPct,
      sanitized.interfaceLowAlarmPct,
      sanitized.interfaceHighAlarmPct,
      sanitized.interfaceHighHighPct,
    ],
    [
      DEFAULT_SIMULATION.interfaceLowLowPct,
      DEFAULT_SIMULATION.interfaceLowAlarmPct,
      DEFAULT_SIMULATION.interfaceHighAlarmPct,
      DEFAULT_SIMULATION.interfaceHighHighPct,
    ],
  );
  return sanitized;
}
