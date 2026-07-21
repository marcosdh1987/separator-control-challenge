import type {
  ActuatorMetrics,
  LoopId,
  LoopMetrics,
  LoopSample,
  PhaseRunTotals,
  RunMetrics,
  SimulationConfig,
  SimulationSample,
  TripKind,
} from "./types";

const RECENT_WINDOW_S = 60;
const RECOVERY_DWELL_S = 10;
const UNSETTLED_RECOVERY_S = 90;
const SATURATION_MARGIN_PCT = 0.5;
const CLOCK_EPSILON_S = 1e-9;

type IntegralLimits = Record<LoopId, number>;

interface LoopMetricInputs {
  id: LoopId;
  samples: SimulationSample[];
  durationsS: number[];
  targetBandPct: number;
  lowAlarmPct: number;
  highAlarmPct: number;
  disturbanceEndS: number;
}

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function finiteNonnegative(value: number): number {
  return Math.max(0, finiteOrZero(value));
}

function loopAt(sample: SimulationSample, id: LoopId): LoopSample {
  return sample[id];
}

/**
 * Each sample is the right endpoint of its interval. The first retained sample
 * represents [0, timeS], which preserves the full run when the 900-sample chart
 * window has discarded the original t=0 sample. Regressing or non-finite clocks
 * contribute no time and do not move the last accepted endpoint.
 */
function durationsFor(samples: SimulationSample[]): number[] {
  let previousTimeS = 0;

  return samples.map((sample) => {
    if (!Number.isFinite(sample.timeS) || sample.timeS < previousTimeS) return 0;

    const durationS = sample.timeS - previousTimeS;
    previousTimeS = sample.timeS;
    return Number.isFinite(durationS) && durationS > 0 ? durationS : 0;
  });
}

function safeLoopError(loop: LoopSample): number {
  if (!Number.isFinite(loop.processValuePct) || !Number.isFinite(loop.setpointPct)) return 0;
  return loop.processValuePct - loop.setpointPct;
}

function crossingCount(errors: number[]): number {
  let crossings = 0;
  let previousSign = 0;
  for (const error of errors) {
    const sign = Math.sign(error);
    if (sign === 0) continue;
    if (previousSign !== 0 && sign !== previousSign) crossings += 1;
    previousSign = sign;
  }
  return crossings;
}

function isFiniteMetricSample(sample: SimulationSample): boolean {
  const metricValues = [
    sample.total.processValuePct,
    sample.total.setpointPct,
    sample.total.valveCommandPct,
    sample.total.valvePositionPct,
    sample.total.integralTerm,
    sample.interface.processValuePct,
    sample.interface.setpointPct,
    sample.interface.valveCommandPct,
    sample.interface.valvePositionPct,
    sample.interface.integralTerm,
    sample.oilLayerPct,
    sample.oilVolumeM3,
    sample.waterVolumeM3,
    sample.flows.oilInletM3H,
    sample.flows.waterInletM3H,
    sample.flows.oilOutletM3H,
    sample.flows.waterOutletM3H,
  ];
  return metricValues.every(Number.isFinite);
}

/**
 * Metrics accept only strictly increasing, finite, nonnegative timestamps and
 * samples whose metric-bearing values are finite. Duplicate timestamps are
 * rejected with regressions so zero-duration snapshots cannot alter extrema,
 * travel, crossings, or the terminal inventory.
 */
function acceptedMetricSamples(samples: SimulationSample[]): SimulationSample[] {
  let lastTimeS = Number.NEGATIVE_INFINITY;
  const accepted: SimulationSample[] = [];

  for (const sample of samples) {
    if (
      !Number.isFinite(sample.timeS) ||
      sample.timeS < 0 ||
      sample.timeS <= lastTimeS ||
      !isFiniteMetricSample(sample)
    ) continue;
    accepted.push(sample);
    lastTimeS = sample.timeS;
  }

  return accepted;
}

function calculateLoopMetrics({
  id,
  samples,
  durationsS,
  targetBandPct,
  lowAlarmPct,
  highAlarmPct,
  disturbanceEndS,
}: LoopMetricInputs): LoopMetrics {
  const loops = samples.map((sample) => loopAt(sample, id));
  const errors = loops.map(safeLoopError);
  const fallbackSetpoint = finiteOrZero(loops[0]?.setpointPct ?? 0);
  const processValues = loops.map((loop) =>
    Number.isFinite(loop.processValuePct) ? loop.processValuePct : fallbackSetpoint
  );
  const mae = errors.reduce((sum, error) => sum + Math.abs(error), 0) / samples.length;
  const maximumPct = Math.max(...processValues);
  const minimumPct = Math.min(...processValues);
  const safeBandPct = finiteNonnegative(targetBandPct);
  const alarmTimeS = loops.reduce((total, loop, index) =>
    total + (
      Number.isFinite(loop.processValuePct) &&
        (loop.processValuePct <= lowAlarmPct || loop.processValuePct >= highAlarmPct)
        ? durationsS[index]
        : 0
    ), 0);
  const targetBandTimeOutsideS = loops.reduce((total, loop, index) =>
    total + (
      Number.isFinite(loop.processValuePct) &&
        Number.isFinite(loop.setpointPct) &&
        Math.abs(loop.processValuePct - loop.setpointPct) > safeBandPct
        ? durationsS[index]
        : 0
    ), 0);

  const finiteTimes = samples
    .map((sample) => sample.timeS)
    .filter((timeS) => Number.isFinite(timeS));
  const finalTimeS = finiteTimes.length > 0 ? Math.max(...finiteTimes) : 0;
  const recentStartS = Math.max(0, finalTimeS - RECENT_WINDOW_S);
  const recentErrors = samples.flatMap((sample) => {
    if (!Number.isFinite(sample.timeS) || sample.timeS < recentStartS) return [];
    return [safeLoopError(loopAt(sample, id))];
  });
  const stableErrors = recentErrors.length > 0 ? recentErrors : [0];
  const recentMean = stableErrors.reduce((sum, value) => sum + value, 0) /
    stableErrors.length;
  const stabilityStdDev = Math.sqrt(
    stableErrors.reduce((sum, value) => sum + (value - recentMean) ** 2, 0) /
      stableErrors.length,
  );
  const oscillationPeakToPeakPct = Math.max(...stableErrors) - Math.min(...stableErrors);
  const recovery = calculateRecovery(
    samples,
    disturbanceEndS,
    (sample) => isInBand(loopAt(sample, id), targetBandPct),
  );

  return {
    alarmTimeS: finiteNonnegative(alarmTimeS),
    mae: finiteNonnegative(mae),
    maximumPct: finiteOrZero(maximumPct),
    minimumPct: finiteOrZero(minimumPct),
    targetBandTimeOutsideS: finiteNonnegative(targetBandTimeOutsideS),
    stabilityStdDev: finiteNonnegative(stabilityStdDev),
    oscillationCrossings: crossingCount(stableErrors),
    oscillationPeakToPeakPct: finiteNonnegative(oscillationPeakToPeakPct),
    ...recovery,
  };
}

function valveTravel(samples: SimulationSample[], id: LoopId): number {
  let previousPositionPct: number | null = null;
  let travelPct = 0;

  for (const sample of samples) {
    const positionPct = loopAt(sample, id).valvePositionPct;
    if (!Number.isFinite(positionPct)) {
      previousPositionPct = null;
      continue;
    }
    if (previousPositionPct !== null) {
      travelPct += Math.abs(positionPct - previousPositionPct);
    }
    previousPositionPct = positionPct;
  }

  return finiteNonnegative(travelPct);
}

function actuatorMetrics(
  samples: SimulationSample[],
  durationsS: number[],
  id: LoopId,
  integralLimit: number,
): ActuatorMetrics {
  const safeIntegralLimit = finiteNonnegative(integralLimit);
  const integralTolerance = Math.max(0.01, safeIntegralLimit * 0.005);
  let saturationTimeS = 0;
  let integralLimitTimeS = 0;

  samples.forEach((sample, index) => {
    const loop = loopAt(sample, id);
    if (
      Number.isFinite(loop.valveCommandPct) &&
      (
        loop.valveCommandPct <= SATURATION_MARGIN_PCT ||
        loop.valveCommandPct >= 100 - SATURATION_MARGIN_PCT
      )
    ) saturationTimeS += durationsS[index];

    if (
      safeIntegralLimit > 0 &&
      Number.isFinite(loop.integralTerm) &&
      Math.abs(loop.integralTerm) >= safeIntegralLimit - integralTolerance
    ) integralLimitTimeS += durationsS[index];
  });

  return {
    travelPct: valveTravel(samples, id),
    saturationTimeS: finiteNonnegative(saturationTimeS),
    integralLimitTimeS: finiteNonnegative(integralLimitTimeS),
  };
}

function addFlowVolume(currentM3: number, flowM3H: number, durationS: number): number {
  const safeFlowM3H = finiteNonnegative(flowM3H);
  const safeDurationS = finiteNonnegative(durationS);
  const incrementM3 = safeFlowM3H * safeDurationS / 3600;
  if (!Number.isFinite(incrementM3) || currentM3 > Number.MAX_VALUE - incrementM3) {
    return Number.MAX_VALUE;
  }
  return currentM3 + incrementM3;
}

function calculatePhaseTotals(
  samples: SimulationSample[],
  durationsS: number[],
): PhaseRunTotals {
  let oilInletM3 = 0;
  let waterInletM3 = 0;
  let oilOutletM3 = 0;
  let waterOutletM3 = 0;

  samples.forEach((sample, index) => {
    const durationS = durationsS[index];
    oilInletM3 = addFlowVolume(oilInletM3, sample.flows.oilInletM3H, durationS);
    waterInletM3 = addFlowVolume(waterInletM3, sample.flows.waterInletM3H, durationS);
    oilOutletM3 = addFlowVolume(oilOutletM3, sample.flows.oilOutletM3H, durationS);
    waterOutletM3 = addFlowVolume(waterOutletM3, sample.flows.waterOutletM3H, durationS);
  });

  const finalSample = samples.at(-1)!;
  return {
    oilInletM3: finiteNonnegative(oilInletM3),
    waterInletM3: finiteNonnegative(waterInletM3),
    oilOutletM3: finiteNonnegative(oilOutletM3),
    waterOutletM3: finiteNonnegative(waterOutletM3),
    finalOilVolumeM3: finiteNonnegative(finalSample.oilVolumeM3),
    finalWaterVolumeM3: finiteNonnegative(finalSample.waterVolumeM3),
  };
}

function isInBand(loop: LoopSample, targetBandPct: number): boolean {
  return Number.isFinite(loop.processValuePct) &&
    Number.isFinite(loop.setpointPct) &&
    Math.abs(loop.processValuePct - loop.setpointPct) <= finiteNonnegative(targetBandPct);
}

function calculateRecovery(
  samples: SimulationSample[],
  disturbanceEndS: number,
  qualifies: (sample: SimulationSample) => boolean,
): Pick<RunMetrics, "recoveryTimeS" | "settled"> {
  const safeDisturbanceEndS = finiteNonnegative(disturbanceEndS);
  let windowStartS: number | null = null;
  let previousTimeS = safeDisturbanceEndS;

  for (const sample of samples) {
    if (!Number.isFinite(sample.timeS) || sample.timeS < previousTimeS) {
      windowStartS = null;
      continue;
    }
    previousTimeS = sample.timeS;
    if (sample.timeS < safeDisturbanceEndS) continue;

    if (!qualifies(sample)) {
      windowStartS = null;
      continue;
    }
    windowStartS ??= sample.timeS;
    if (sample.timeS - windowStartS + CLOCK_EPSILON_S >= RECOVERY_DWELL_S) {
      return {
        recoveryTimeS: finiteNonnegative(windowStartS - safeDisturbanceEndS),
        settled: true,
      };
    }
  }

  return { recoveryTimeS: UNSETTLED_RECOVERY_S, settled: false };
}

function calculateJointRecovery(
  samples: SimulationSample[],
  disturbanceEndS: number,
  config: SimulationConfig,
): Pick<RunMetrics, "recoveryTimeS" | "settled"> {
  return calculateRecovery(
    samples,
    disturbanceEndS,
    (sample) => isInBand(sample.total, config.totalTargetBandPct) &&
      isInBand(sample.interface, config.interfaceTargetBandPct),
  );
}

function isAlarm(sample: SimulationSample, config: SimulationConfig): boolean {
  const total = sample.total.processValuePct;
  const interfaceLevel = sample.interface.processValuePct;
  const totalAlarm = Number.isFinite(total) &&
    (total <= config.totalLowAlarmPct || total >= config.totalHighAlarmPct);
  const interfaceAlarm = Number.isFinite(interfaceLevel) &&
    (
      interfaceLevel <= config.interfaceLowAlarmPct ||
      interfaceLevel >= config.interfaceHighAlarmPct
    );
  return totalAlarm || interfaceAlarm;
}

export function calculateMetrics(
  samples: SimulationSample[],
  config: SimulationConfig,
  trip: TripKind,
  disturbanceEndS: number,
  integralLimits: IntegralLimits,
): RunMetrics {
  if (samples.length === 0) throw new Error("Metrics require at least one sample");
  const metricSamples = acceptedMetricSamples(samples);
  if (metricSamples.length === 0) {
    throw new Error("Metrics require at least one valid sample");
  }

  const durationsS = durationsFor(metricSamples);
  const loops: RunMetrics["loops"] = {
    total: calculateLoopMetrics({
      id: "total",
      samples: metricSamples,
      durationsS,
      targetBandPct: config.totalTargetBandPct,
      lowAlarmPct: config.totalLowAlarmPct,
      highAlarmPct: config.totalHighAlarmPct,
      disturbanceEndS,
    }),
    interface: calculateLoopMetrics({
      id: "interface",
      samples: metricSamples,
      durationsS,
      targetBandPct: config.interfaceTargetBandPct,
      lowAlarmPct: config.interfaceLowAlarmPct,
      highAlarmPct: config.interfaceHighAlarmPct,
      disturbanceEndS,
    }),
  };
  const actuators: RunMetrics["actuators"] = {
    oil: actuatorMetrics(metricSamples, durationsS, "total", integralLimits.total),
    water: actuatorMetrics(
      metricSamples,
      durationsS,
      "interface",
      integralLimits.interface,
    ),
  };
  const alarmTimeS = metricSamples.reduce((total, sample, index) =>
    total + (isAlarm(sample, config) ? durationsS[index] : 0), 0);
  const minimumOilLayerPct = metricSamples.reduce((minimum, sample) =>
    Number.isFinite(sample.oilLayerPct)
      ? Math.min(minimum, Math.max(0, sample.oilLayerPct))
      : minimum, Number.POSITIVE_INFINITY);
  const recovery = calculateJointRecovery(metricSamples, disturbanceEndS, config);
  return {
    alarmTimeS: finiteNonnegative(alarmTimeS),
    ...recovery,
    minimumOilLayerPct: Number.isFinite(minimumOilLayerPct) ? minimumOilLayerPct : 0,
    loops,
    actuators,
    phaseTotals: calculatePhaseTotals(metricSamples, durationsS),
    trip,
  };
}
