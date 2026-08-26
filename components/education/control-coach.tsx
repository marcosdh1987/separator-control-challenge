"use client";

import { Compass } from "lucide-react";

import type { DiagnosisPatternId } from "@/lib/education/diagnosis";
import { gainAdvisory } from "@/lib/education/diagnosis";
import type { GainId } from "@/lib/education/pid-content";
import { useMessages } from "@/lib/i18n/provider";
import { P_ONLY_PID_PRESET } from "@/lib/onboarding/presets";
import type { ActuatorAnalysis, LoopAnalysis, RunAnalysis } from "@/lib/simulation/analysis";
import type {
  ActuatorMetrics,
  DualPidConfig,
  LoopId,
  LoopMetrics,
  PidConfig,
  RunMetrics,
} from "@/lib/simulation/types";

/**
 * Deterministic post-run coaching.
 *
 * There is no model here and there will not be one: the project runs entirely in
 * the browser with no backend and no AI at runtime, so the diagnosis has to be a
 * rule the trainee could have applied themselves. That is also the pedagogy — a
 * rule they can learn beats an answer they must trust.
 *
 * The rules read `lib/simulation/analysis.ts` (post-run response shape) together
 * with `lib/simulation/metrics.ts` (scored run figures), and name their finding
 * with a `DiagnosisPatternId` — the same vocabulary the learning panel teaches, so
 * the coach can never invent a symptom the panel cannot explain. The output is the
 * one gain to move next, and by how much.
 */

/** Share of the run a valve may sit against a limit before it is the headline. */
const SATURATION_SHARE = 0.25;
/** Share of the run the integrator may sit against its clamp before it counts. */
const WINDUP_SHARE = 0.2;
/** Command direction changes per second above which the valve is chattering. */
const CHATTER_REVERSALS_PER_S = 1;
/** Setpoint crossings in the last minute that mean the loop is still cycling. */
const OSCILLATION_CROSSINGS = 6;
const HUNTING_CROSSINGS = 4;
/** Percent overshoot beyond which the recovery is worth calling out. */
const OVERSHOOT_PCT = 20;
/** Fraction of the target band the steady offset must exceed to be an offset. */
const OFFSET_BAND_FRACTION = 0.5;
/** Settling slower than this, with a calm response, reads as sluggish. */
const SLOW_SETTLING_S = 60;
const CALM_OVERSHOOT_PCT = 5;

/** Every suggested move is one multiplicative step, so it is reversible by eye. */
const GAIN_STEP = 1.4;
/** Where integral action starts when a loop has none and needs some. */
const SEED_KI = 0.02;

/** Matches the clamps in `lib/simulation/validation.ts`; a suggestion must be loadable. */
const GAIN_LIMITS: Record<GainId, { minimum: number; maximum: number; decimals: number }> = {
  kp: { minimum: 0, maximum: 10, decimals: 2 },
  ki: { minimum: 0, maximum: 0.3, decimals: 3 },
  kd: { minimum: 0, maximum: 30, decimals: 1 },
};

/** Headline order: the fault that makes the others unreadable comes first. */
const PATTERN_SEVERITY: readonly DiagnosisPatternId[] = [
  "valve-saturation",
  "sustained-oscillation",
  "noisy-command",
  "hunting",
  "overshoot",
  "offset",
  "sluggish",
];

export type CoachMoveKind = "raise" | "lower" | "remove" | "hold";

export interface CoachMove {
  kind: CoachMoveKind;
  /** Null only when the move is `hold`. */
  gain: GainId | null;
  fromValue: number;
  toValue: number;
}

export interface CoachLoopVerdict {
  loop: LoopId;
  /** Null when no rule fired and the gains court no particular risk either. */
  pattern: DiagnosisPatternId | null;
  move: CoachMove;
  analysis: LoopAnalysis;
  actuator: ActuatorAnalysis;
}

export interface CoachLoopInput {
  loop: LoopId;
  gains: PidConfig;
  analysis: LoopAnalysis;
  metrics: LoopMetrics;
  actuator: ActuatorAnalysis;
  actuatorMetrics: ActuatorMetrics;
  /** Length of the run, used to turn saturation and windup seconds into shares. */
  runDurationS: number;
  noisyMeasurement: boolean;
}

function roundGain(gain: GainId, value: number): number {
  const { minimum, maximum, decimals } = GAIN_LIMITS[gain];
  const clamped = Math.min(maximum, Math.max(minimum, value));
  return Number(clamped.toFixed(decimals));
}

function raise(gain: GainId, from: number): CoachMove {
  const target = from > 0 ? from * GAIN_STEP : gain === "ki" ? SEED_KI : GAIN_STEP;
  return { kind: "raise", gain, fromValue: from, toValue: roundGain(gain, target) };
}

function lower(gain: GainId, from: number): CoachMove {
  return { kind: "lower", gain, fromValue: from, toValue: roundGain(gain, from / GAIN_STEP) };
}

const HOLD: CoachMove = { kind: "hold", gain: null, fromValue: 0, toValue: 0 };

/**
 * The concrete move each pattern calls for. Where a pattern admits two answers the
 * gains decide: reining in a loop that has no integral action to rein in would
 * leave the trainee changing a number that cannot be the cause.
 */
function moveFor(pattern: DiagnosisPatternId | null, gains: PidConfig): CoachMove {
  switch (pattern) {
    case "valve-saturation":
      return gains.ki > 0 ? lower("ki", gains.ki) : lower("kp", gains.kp);
    case "noisy-command":
      return gains.kd > 0
        ? { kind: "remove", gain: "kd", fromValue: gains.kd, toValue: 0 }
        : lower("kp", gains.kp);
    case "sustained-oscillation":
      return lower("kp", gains.kp);
    case "hunting":
      return gains.ki > 0 ? lower("ki", gains.ki) : lower("kp", gains.kp);
    case "overshoot":
      return gains.ki >= 0.12 ? lower("ki", gains.ki) : lower("kp", gains.kp);
    case "offset":
      return raise("ki", gains.ki);
    case "sluggish":
      return raise("kp", gains.kp);
    default:
      return HOLD;
  }
}

/**
 * First rule that fires wins. The order is the order a control engineer would work
 * in: a saturated valve or a chattering command invalidates every figure below it,
 * so those are named before anything is said about overshoot or offset.
 */
export function diagnoseLoop(input: CoachLoopInput): CoachLoopVerdict {
  const {
    analysis,
    metrics,
    actuator,
    actuatorMetrics,
    gains,
    runDurationS,
    noisyMeasurement,
  } = input;
  const durationS = runDurationS > 0 ? runDurationS : 1;
  const reversalRate = actuator.reversals / durationS;
  const band = analysis.settlingBandPct;

  const pattern = ((): DiagnosisPatternId | null => {
    if (
      actuatorMetrics.saturationTimeS / durationS > SATURATION_SHARE ||
      actuatorMetrics.integralLimitTimeS / durationS > WINDUP_SHARE
    ) return "valve-saturation";

    if (
      reversalRate > CHATTER_REVERSALS_PER_S &&
      (gains.kd > 0 || noisyMeasurement)
    ) return "noisy-command";

    if (!metrics.settled && metrics.oscillationCrossings >= OSCILLATION_CROSSINGS) {
      return "sustained-oscillation";
    }

    if (metrics.oscillationCrossings >= HUNTING_CROSSINGS && gains.ki > 0) return "hunting";

    if (analysis.overshootPct >= OVERSHOOT_PCT) return "overshoot";

    if (band > 0 && Math.abs(analysis.steadyOffsetPct) > band * OFFSET_BAND_FRACTION) {
      return "offset";
    }

    if (
      (analysis.settlingTimeS === null || analysis.settlingTimeS > SLOW_SETTLING_S) &&
      analysis.overshootPct < CALM_OVERSHOOT_PCT
    ) return "sluggish";

    // Nothing in the response dominates; fall back to what the gains alone risk.
    return gainAdvisory(gains, { noisyMeasurement });
  })();

  return { loop: input.loop, pattern, move: moveFor(pattern, gains), analysis, actuator };
}

export interface CoachRunInput {
  analysis: RunAnalysis;
  metrics: RunMetrics;
  pid: DualPidConfig;
  noisyMeasurement?: boolean;
}

/** Diagnoses every loop the run actually had, in dashboard order. */
export function coachRun({
  analysis,
  metrics,
  pid,
  noisyMeasurement = false,
}: CoachRunInput): CoachLoopVerdict[] {
  const runDurationS = Math.max(0, analysis.windowEndS);
  const verdicts: CoachLoopVerdict[] = [
    diagnoseLoop({
      loop: "total",
      gains: pid.total,
      analysis: analysis.loops.total,
      metrics: metrics.loops.total,
      actuator: analysis.actuators.oil,
      actuatorMetrics: metrics.actuators.oil,
      runDurationS,
      noisyMeasurement,
    }),
    diagnoseLoop({
      loop: "interface",
      gains: pid.interface,
      analysis: analysis.loops.interface,
      metrics: metrics.loops.interface,
      actuator: analysis.actuators.water,
      actuatorMetrics: metrics.actuators.water,
      runDurationS,
      noisyMeasurement,
    }),
  ];

  if (analysis.pressureLoop && metrics.pressureLoop && pid.pressure) {
    verdicts.push(diagnoseLoop({
      loop: "pressure",
      gains: pid.pressure,
      analysis: analysis.pressureLoop,
      metrics: metrics.pressureLoop,
      actuator: analysis.gasActuator ?? { totalVariationPct: 0, variationRatePctS: 0, reversals: 0 },
      actuatorMetrics: metrics.gasActuator ?? {
        travelPct: 0,
        saturationTimeS: 0,
        integralLimitTimeS: 0,
      },
      runDurationS,
      noisyMeasurement,
    }));
  }

  return verdicts;
}

/** The verdict worth putting at the top: the most severe pattern that fired. */
export function headlineVerdict(verdicts: readonly CoachLoopVerdict[]): CoachLoopVerdict | null {
  let best: CoachLoopVerdict | null = null;
  let bestRank = PATTERN_SEVERITY.length;

  for (const verdict of verdicts) {
    if (!verdict.pattern) continue;
    const rank = PATTERN_SEVERITY.indexOf(verdict.pattern);
    if (rank >= 0 && rank < bestRank) {
      best = verdict;
      bestRank = rank;
    }
  }

  return best;
}

export interface ControlCoachProps {
  analysis: RunAnalysis;
  metrics: RunMetrics;
  pid: DualPidConfig;
  /** True on scenarios that feed a noisy measurement, such as `noisy-interface`. */
  noisyMeasurement?: boolean;
  /**
   * Supplied by the dashboard to let the coach load a teaching preset. Omit it and
   * the experiment is described but not offered.
   */
  onApplyPreset?: (config: DualPidConfig) => void;
}

export function ControlCoach({
  analysis,
  metrics,
  pid,
  noisyMeasurement = false,
  onApplyPreset,
}: ControlCoachProps) {
  const messages = useMessages();
  const { coach, diagnosisPattern } = messages.education;
  const { unavailable, percentValue, secondsValue } = messages.education.analysis;
  const loopName = messages.simulation.loop;
  const loopValve = messages.simulation.loopValve;

  const verdicts = coachRun({ analysis, metrics, pid, noisyMeasurement });
  const headline = headlineVerdict(verdicts);
  const presetCopy = coach.preset["p-only"];

  function moveText(move: CoachMove): string {
    if (move.kind === "hold" || !move.gain) return coach.move.hold;
    const gainName = coach.gainName[move.gain];
    const decimals = GAIN_LIMITS[move.gain].decimals;
    const from = move.fromValue.toFixed(decimals);
    const to = move.toValue.toFixed(decimals);
    if (move.kind === "remove") return coach.move.remove(gainName);
    return move.kind === "raise"
      ? coach.move.raise(gainName, from, to)
      : coach.move.lower(gainName, from, to);
  }

  return (
    <section aria-label={coach.ariaLabel} className="control-coach">
      <div className="control-coach__heading">
        <Compass aria-hidden="true" />
        <div><p>{coach.eyebrow}</p><h2>{coach.title}</h2></div>
      </div>

      <p className="control-coach__headline">
        {headline?.pattern
          ? coach.headline(loopName[headline.loop], diagnosisPattern[headline.pattern].title)
          : coach.headlineClean}
      </p>

      <ol className="control-coach__loops">
        {verdicts.map((verdict) => (
          <li key={verdict.loop}>
            <h3>{coach.loopHeading(loopName[verdict.loop], loopValve[verdict.loop])}</h3>
            {verdict.pattern ? (
              <>
                <p className="control-coach__pattern">
                  {diagnosisPattern[verdict.pattern].title}
                </p>
                <p>{diagnosisPattern[verdict.pattern].suggestion}</p>
              </>
            ) : <p className="control-coach__pattern">{coach.noPattern}</p>}
            <p className="control-coach__move">
              <strong>{coach.nextMove}</strong> {moveText(verdict.move)}
            </p>
            <p className="control-coach__evidence">
              <span>{coach.evidence}</span>
              {coach.evidenceLine(
                percentValue(verdict.analysis.overshootPct.toFixed(0)),
                verdict.analysis.settlingTimeS === null
                  ? unavailable
                  : secondsValue(verdict.analysis.settlingTimeS.toFixed(0)),
                percentValue(verdict.actuator.totalVariationPct.toFixed(0)),
              )}
            </p>
          </li>
        ))}
      </ol>

      <section className="control-coach__experiment">
        <h3>{coach.experiment}</h3>
        <p><strong>{presetCopy.label}</strong> — {presetCopy.guidance}</p>
        {onApplyPreset ? (
          <button
            className="control-coach__preset"
            type="button"
            onClick={() => onApplyPreset(P_ONLY_PID_PRESET.config)}
          >
            {coach.applyPreset(presetCopy.label)}
          </button>
        ) : null}
      </section>

      <p className="control-coach__reminder">{coach.reminder}</p>
    </section>
  );
}
