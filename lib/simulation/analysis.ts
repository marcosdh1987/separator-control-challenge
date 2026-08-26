/**
 * Post-run response analysis: the classical control-performance figures a trainee
 * compares between two attempts.
 *
 * ## Boundary with `metrics.ts`
 *
 * `metrics.ts` is the **scored, live** side of the run. It is fed by the engine as
 * the run advances, it decides alarm exposure, recovery and valve travel, and its
 * output feeds `scoring.ts`. Nothing here changes a score.
 *
 * This module is **post-process and read-only**. It takes the retained trace after
 * the run has finished and computes the textbook figures — IAE, ISE, ITAE,
 * overshoot, settling time, rise time and total variation of the control effort —
 * that let a trainee say *why* one attempt beat another. It deliberately does not
 * recompute anything `metrics.ts` already reports:
 *
 * | Question | Lives in |
 * |---|---|
 * | How long was the loop in alarm? | `metrics.ts` — `LoopMetrics.alarmTimeS` |
 * | How far did the valve actually move? | `metrics.ts` — `ActuatorMetrics.travelPct` (valve **position**) |
 * | How much did the controller *ask* it to move? | here — `ActuatorAnalysis.totalVariationPct` (valve **command**) |
 * | Did the run recover? | `metrics.ts` — `recoveryTimeS`, `settled` |
 * | How long until it stayed inside the band? | here — `LoopAnalysis.settlingTimeS` |
 *
 * The two travel figures are complements, not duplicates. Position travel is
 * mechanical wear: the actuator's first-order lag and stroke-rate limit have
 * already smoothed away whatever the controller asked for. Command total
 * variation is what the controller *wanted*, so a controller chattering on sensor
 * noise shows up here long before the packing wears out.
 *
 * ## What "with noise present" means for each figure
 *
 * Every liquid loop carries a noisy measurement (`LoopSample.measuredValuePct`)
 * alongside the true state (`LoopSample.processValuePct`). The distinction decides
 * each definition:
 *
 * - **Errors, integrals, overshoot, settling and rise are measured on
 *   `processValuePct`**, the true process. Measuring settling on the noisy signal
 *   would report a band exit every time the sensor twitched, and a noisier scenario
 *   would score worse than a quieter one at identical tuning. What the trainee is
 *   being graded on is where the liquid actually was.
 * - **Total variation is measured on `valveCommandPct`**, which *is* driven by the
 *   noisy measurement — and that is the point. Noise-driven chatter is a real
 *   defect of the tuning, and command TV is where it becomes visible.
 * - **Overshoot is relative to the excursion the disturbance caused**, not to the
 *   setpoint's absolute value. These are load-disturbance rejections, not setpoint
 *   steps: the loop is pushed off setpoint and overshoot is how far past setpoint
 *   it swings coming back, as a percentage of how far it was pushed. On a classical
 *   step response — process starting at rest, setpoint held — this reduces exactly
 *   to the textbook percent overshoot, which is what the unit tests pin it against.
 *
 * ## Numerical conventions
 *
 * - Error sign follows the engine: `e = PV − SP`.
 * - Integrals use the **trapezoidal rule** over the retained trace. The trace is
 *   the chart grid (`chartSampleS`, coarser than the engine's `dtS`), so these are
 *   estimates of the true integrals, consistent between two attempts of the same
 *   scenario rather than exact to the integrator.
 * - ITAE weights by time elapsed **since the analysis window opened**, not since
 *   `t = 0`, so a chart window that has discarded early samples cannot inflate it.
 * - Threshold crossings for rise time are **linearly interpolated** between
 *   samples, so the figure does not quantise to the sample interval.
 * - Non-finite values and non-increasing timestamps are dropped, matching the
 *   discipline in `metrics.ts`. An empty or fully rejected trace yields a neutral
 *   analysis rather than throwing, because the interface may render before a run
 *   has produced anything worth analysing.
 */

import type {
  LiquidLoopId,
  LoopId,
  LoopSample,
  PhaseId,
  SimulationConfig,
  SimulationSample,
} from "./types";

/**
 * Command movement below this is float dust or a single least-significant step,
 * not a direction change worth reporting as chatter.
 */
const COMMAND_REVERSAL_FLOOR_PCT = 0.05;

/** Fraction of the analysis window treated as the steady tail for offset. */
const STEADY_TAIL_FRACTION = 0.2;

/** Classical 10–90% rise time. */
const RISE_START_FRACTION = 0.9;
const RISE_END_FRACTION = 0.1;

/** One point of a controlled response: the true process value against its target. */
export interface ResponsePoint {
  timeS: number;
  /** The true process value. Never the noisy measurement — see the module note. */
  valuePct: number;
  setpointPct: number;
}

/** One point of an actuator signal, in percent of travel. */
export interface SignalPoint {
  timeS: number;
  valuePct: number;
}

export interface ResponseAnalysisOptions {
  /**
   * Half-width of the band settling is judged against, in the loop's own units
   * (percent of height for a level loop, bar for the pressure loop).
   */
  bandPct: number;
  /**
   * When the analysis window opens. Callers pass the scenario's disturbance start
   * so the transient — not the quiet approach to it — is what gets measured.
   * Defaults to the first accepted sample.
   */
  startS?: number;
}

export interface LoopAnalysis {
  /** ∫|PV − SP| dt over the window, in loop-units·seconds. */
  iae: number;
  /** ∫(PV − SP)² dt. Penalises one large excursion far more than IAE does. */
  ise: number;
  /** ∫ t·|PV − SP| dt, t from the window start. Penalises error that lingers. */
  itae: number;
  /** Largest |PV − SP| in the window, signed by which side of setpoint it was on. */
  peakDeviationPct: number;
  /** When that peak occurred, in run time. */
  peakTimeS: number;
  /**
   * How far past setpoint the response swung while recovering, as a percentage of
   * the peak deviation. Zero when the response never crossed setpoint again.
   */
  overshootPct: number;
  /**
   * Seconds from the window opening until |PV − SP| entered the band and stayed
   * there for the rest of the trace. `null` when it never did.
   */
  settlingTimeS: number | null;
  /**
   * Seconds to go from 90% of the peak deviation down to 10% of it, measured from
   * the peak. `null` when the response never reaches 10%.
   */
  riseTimeS: number | null;
  /**
   * Time-weighted mean error over the last fifth of the window — the persistent
   * offset a proportional-only controller cannot remove.
   */
  steadyOffsetPct: number;
  /** The band the settling figure was judged against, echoed for display. */
  settlingBandPct: number;
}

export interface ActuatorAnalysis {
  /** Σ|Δu| of the valve **command**: how much movement the controller asked for. */
  totalVariationPct: number;
  /** That total spread over the window, in percent of travel per second. */
  variationRatePctS: number;
  /** Direction changes in the command. High counts mean chatter, not control. */
  reversals: number;
}

export interface RunAnalysis {
  windowStartS: number;
  windowEndS: number;
  loops: Record<LiquidLoopId, LoopAnalysis>;
  /** Present only when the run had a gas cap, and so a pressure loop to analyse. */
  pressureLoop?: LoopAnalysis;
  actuators: Record<PhaseId, ActuatorAnalysis>;
  gasActuator?: ActuatorAnalysis;
}

export interface RunAnalysisOptions {
  /** See `ResponseAnalysisOptions.startS`. */
  startS?: number;
}

/** What a fully rejected or empty trace analyses to. */
const NEUTRAL_LOOP_ANALYSIS: LoopAnalysis = Object.freeze({
  iae: 0,
  ise: 0,
  itae: 0,
  peakDeviationPct: 0,
  peakTimeS: 0,
  overshootPct: 0,
  settlingTimeS: null,
  riseTimeS: null,
  steadyOffsetPct: 0,
  settlingBandPct: 0,
});

const NEUTRAL_ACTUATOR_ANALYSIS: ActuatorAnalysis = Object.freeze({
  totalVariationPct: 0,
  variationRatePctS: 0,
  reversals: 0,
});

function errorOf(point: ResponsePoint): number {
  return point.valuePct - point.setpointPct;
}

/**
 * Keeps only finite, strictly increasing points. A duplicate timestamp would give
 * a zero-width trapezoid and an ambiguous peak, so it is dropped rather than
 * averaged.
 */
function acceptedResponse(
  series: readonly ResponsePoint[],
  startS: number | undefined,
): ResponsePoint[] {
  const accepted: ResponsePoint[] = [];
  let lastTimeS = Number.NEGATIVE_INFINITY;

  for (const point of series) {
    if (
      !Number.isFinite(point.timeS) ||
      !Number.isFinite(point.valuePct) ||
      !Number.isFinite(point.setpointPct) ||
      point.timeS <= lastTimeS
    ) continue;
    lastTimeS = point.timeS;
    if (startS !== undefined && Number.isFinite(startS) && point.timeS < startS) continue;
    accepted.push(point);
  }

  return accepted;
}

function acceptedSignal(
  series: readonly SignalPoint[],
  startS: number | undefined,
): SignalPoint[] {
  return acceptedResponse(
    series.map((point) => ({ ...point, setpointPct: 0 })),
    startS,
  ).map(({ timeS, valuePct }) => ({ timeS, valuePct }));
}

/**
 * Trapezoidal integral of `integrand` over the accepted points. `elapsedS` is time
 * since the first accepted point, which is what makes ITAE independent of where
 * the retained chart window happens to start.
 */
function integrate(
  points: readonly ResponsePoint[],
  integrand: (errorPct: number, elapsedS: number) => number,
): number {
  if (points.length < 2) return 0;
  const originS = points[0].timeS;
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const stepS = current.timeS - previous.timeS;
    const before = integrand(errorOf(previous), previous.timeS - originS);
    const after = integrand(errorOf(current), current.timeS - originS);
    total += ((before + after) / 2) * stepS;
  }

  return Number.isFinite(total) ? total : 0;
}

/** ∫|e| dt. Every unit of error counts the same, whenever it happened. */
export function integralAbsoluteError(
  series: readonly ResponsePoint[],
  options: { startS?: number } = {},
): number {
  return integrate(acceptedResponse(series, options.startS), (errorPct) => Math.abs(errorPct));
}

/** ∫e² dt. One large excursion outweighs a long small one. */
export function integralSquaredError(
  series: readonly ResponsePoint[],
  options: { startS?: number } = {},
): number {
  return integrate(acceptedResponse(series, options.startS), (errorPct) => errorPct * errorPct);
}

/** ∫t·|e| dt. Error that is still there late costs more than error at the start. */
export function integralTimeAbsoluteError(
  series: readonly ResponsePoint[],
  options: { startS?: number } = {},
): number {
  return integrate(
    acceptedResponse(series, options.startS),
    (errorPct, elapsedS) => elapsedS * Math.abs(errorPct),
  );
}

/**
 * First time at or after `fromIndex` when |error| falls to `threshold`, linearly
 * interpolated between the bracketing samples so the answer does not quantise to
 * the sample interval.
 */
function crossingTimeS(
  points: readonly ResponsePoint[],
  errors: readonly number[],
  fromIndex: number,
  threshold: number,
): number | null {
  for (let index = fromIndex; index < points.length; index += 1) {
    const after = Math.abs(errors[index]);
    if (after > threshold) continue;
    if (index === fromIndex) return points[index].timeS;

    const before = Math.abs(errors[index - 1]);
    if (before <= after) return points[index].timeS;
    const fraction = (before - threshold) / (before - after);
    return points[index - 1].timeS +
      fraction * (points[index].timeS - points[index - 1].timeS);
  }

  return null;
}

/**
 * Time-weighted mean error over the last `STEADY_TAIL_FRACTION` of the window. A
 * time weighting rather than a plain average so uneven sampling cannot let a dense
 * patch of the trace dominate the offset a trainee is asked to read.
 */
function steadyOffset(points: readonly ResponsePoint[], errors: readonly number[]): number {
  const lastIndex = points.length - 1;
  if (lastIndex < 1) return errors[lastIndex] ?? 0;

  const windowS = points[lastIndex].timeS - points[0].timeS;
  const tailStartS = points[lastIndex].timeS - windowS * STEADY_TAIL_FRACTION;
  let weighted = 0;
  let durationS = 0;

  for (let index = 1; index <= lastIndex; index += 1) {
    if (points[index].timeS <= tailStartS) continue;
    const stepS = points[index].timeS - Math.max(points[index - 1].timeS, tailStartS);
    if (stepS <= 0) continue;
    weighted += ((errors[index - 1] + errors[index]) / 2) * stepS;
    durationS += stepS;
  }

  return durationS > 0 ? weighted / durationS : errors[lastIndex];
}

/**
 * Seconds from the window opening until the error entered the band and stayed
 * inside it. `null` when the trace ends outside the band: an unsettled run has no
 * settling time, and reporting the run duration instead would let a worse attempt
 * look merely slow.
 */
function settlingTime(
  points: readonly ResponsePoint[],
  errors: readonly number[],
  bandPct: number,
): number | null {
  const band = Math.max(0, Number.isFinite(bandPct) ? bandPct : 0);
  let lastOutside = -1;

  for (let index = 0; index < points.length; index += 1) {
    if (Math.abs(errors[index]) > band) lastOutside = index;
  }

  if (lastOutside === points.length - 1) return null;
  if (lastOutside < 0) return 0;
  return points[lastOutside + 1].timeS - points[0].timeS;
}

/** Analyses one controlled response. Pure; safe on an empty or ragged series. */
export function analyseResponse(
  series: readonly ResponsePoint[],
  options: ResponseAnalysisOptions,
): LoopAnalysis {
  const bandPct = Math.max(0, Number.isFinite(options.bandPct) ? options.bandPct : 0);
  const points = acceptedResponse(series, options.startS);
  if (points.length === 0) return { ...NEUTRAL_LOOP_ANALYSIS, settlingBandPct: bandPct };

  const errors = points.map(errorOf);
  let peakIndex = 0;
  for (let index = 1; index < errors.length; index += 1) {
    if (Math.abs(errors[index]) > Math.abs(errors[peakIndex])) peakIndex = index;
  }

  const peakDeviationPct = errors[peakIndex];
  const peakMagnitude = Math.abs(peakDeviationPct);
  const peakSign = Math.sign(peakDeviationPct);

  // How far the response swung past setpoint on the far side while recovering.
  let counterSwing = 0;
  for (let index = peakIndex + 1; index < errors.length; index += 1) {
    counterSwing = Math.max(counterSwing, -peakSign * errors[index]);
  }
  const overshootPct = peakMagnitude > 0 ? (Math.max(0, counterSwing) / peakMagnitude) * 100 : 0;

  const riseStartS = peakMagnitude > 0
    ? crossingTimeS(points, errors, peakIndex, peakMagnitude * RISE_START_FRACTION)
    : null;
  const riseEndS = peakMagnitude > 0
    ? crossingTimeS(points, errors, peakIndex, peakMagnitude * RISE_END_FRACTION)
    : null;
  const riseTimeS = riseStartS !== null && riseEndS !== null
    ? Math.max(0, riseEndS - riseStartS)
    : null;

  return {
    iae: integrate(points, (errorPct) => Math.abs(errorPct)),
    ise: integrate(points, (errorPct) => errorPct * errorPct),
    itae: integrate(points, (errorPct, elapsedS) => elapsedS * Math.abs(errorPct)),
    peakDeviationPct,
    peakTimeS: points[peakIndex].timeS,
    overshootPct,
    settlingTimeS: settlingTime(points, errors, bandPct),
    riseTimeS,
    steadyOffsetPct: steadyOffset(points, errors),
    settlingBandPct: bandPct,
  };
}

/**
 * Total variation of a control signal: Σ|Δu|. Direction changes smaller than
 * `COMMAND_REVERSAL_FLOOR_PCT` are counted toward the total but not toward the
 * reversal count, so rounding dust does not read as chatter.
 */
export function analyseCommand(
  series: readonly SignalPoint[],
  options: { startS?: number } = {},
): ActuatorAnalysis {
  const points = acceptedSignal(series, options.startS);
  if (points.length < 2) return { ...NEUTRAL_ACTUATOR_ANALYSIS };

  let totalVariationPct = 0;
  let reversals = 0;
  let lastDirection = 0;

  for (let index = 1; index < points.length; index += 1) {
    const delta = points[index].valuePct - points[index - 1].valuePct;
    totalVariationPct += Math.abs(delta);
    if (Math.abs(delta) < COMMAND_REVERSAL_FLOOR_PCT) continue;
    const direction = Math.sign(delta);
    if (lastDirection !== 0 && direction !== lastDirection) reversals += 1;
    lastDirection = direction;
  }

  const windowS = points[points.length - 1].timeS - points[0].timeS;
  return {
    totalVariationPct,
    variationRatePctS: windowS > 0 ? totalVariationPct / windowS : 0,
    reversals,
  };
}

function responseSeries(
  samples: readonly SimulationSample[],
  id: LoopId,
): ResponsePoint[] {
  return samples.flatMap((sample) => {
    const loop: LoopSample | undefined = sample[id];
    if (!loop) return [];
    return [{
      timeS: sample.timeS,
      valuePct: loop.processValuePct,
      setpointPct: loop.setpointPct,
    }];
  });
}

function commandSeries(samples: readonly SimulationSample[], id: LoopId): SignalPoint[] {
  return samples.flatMap((sample) => {
    const loop: LoopSample | undefined = sample[id];
    return loop ? [{ timeS: sample.timeS, valuePct: loop.valveCommandPct }] : [];
  });
}

/**
 * Analyses a finished run. Works with or without the gas cap: the pressure loop and
 * its actuator appear only when every retained sample carried one, matching how
 * `metrics.ts` decides whether the run had a third loop to score.
 */
export function analyseRun(
  samples: readonly SimulationSample[],
  config: SimulationConfig,
  options: RunAnalysisOptions = {},
): RunAnalysis {
  const times = samples
    .map((sample) => sample.timeS)
    .filter((timeS) => Number.isFinite(timeS));
  const firstTimeS = times.length > 0 ? Math.min(...times) : 0;
  const windowStartS = options.startS !== undefined && Number.isFinite(options.startS)
    ? Math.max(firstTimeS, options.startS)
    : firstTimeS;
  const windowEndS = times.length > 0 ? Math.max(...times) : windowStartS;
  const startS = options.startS;

  const gas = config.gas;
  const hasPressure = Boolean(gas) && samples.length > 0 &&
    samples.every((sample) => sample.pressure !== undefined);

  return {
    windowStartS,
    windowEndS,
    loops: {
      total: analyseResponse(responseSeries(samples, "total"), {
        bandPct: config.totalTargetBandPct,
        startS,
      }),
      interface: analyseResponse(responseSeries(samples, "interface"), {
        bandPct: config.interfaceTargetBandPct,
        startS,
      }),
    },
    ...(gas && hasPressure
      ? {
          pressureLoop: analyseResponse(responseSeries(samples, "pressure"), {
            bandPct: gas.targetBandBarG,
            startS,
          }),
        }
      : {}),
    actuators: {
      oil: analyseCommand(commandSeries(samples, "total"), { startS }),
      water: analyseCommand(commandSeries(samples, "interface"), { startS }),
    },
    ...(hasPressure
      ? { gasActuator: analyseCommand(commandSeries(samples, "pressure"), { startS }) }
      : {}),
  };
}
