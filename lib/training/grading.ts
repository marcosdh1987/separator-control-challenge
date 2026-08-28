import { analyseRun, type RunAnalysis } from "@/lib/simulation/analysis";
import type { RunResult, SimulationConfig, SimulationSample } from "@/lib/simulation/types";
import type { Lesson, LessonCheck, LessonOutcome } from "./types";

/**
 * A steady-state gap smaller than this is indistinguishable from sensor noise, so
 * a lesson that asks the trainee to *observe* an offset needs at least this much
 * for the observation to be honest.
 */
const OBSERVABLE_OFFSET_PCT = 0.6;

export interface AttemptEvidence {
  samples: readonly SimulationSample[];
  result: RunResult;
  config: SimulationConfig;
  analysis: RunAnalysis;
}

/** Bundles a finished run with its post-run analysis, which grading reads. */
export function buildAttemptEvidence(
  samples: readonly SimulationSample[],
  result: RunResult,
  config: SimulationConfig,
  disturbanceStartS?: number,
): AttemptEvidence {
  // Judge the control, not the fill. The window opens at the scenario's
  // disturbance when it has one, and otherwise at the moment the vessel first
  // established; before either, every attempt looks identical.
  const startS = disturbanceStartS && disturbanceStartS > 0
    ? disturbanceStartS
    : result.metrics.establishedAtS || undefined;
  return {
    samples,
    result,
    config,
    analysis: analyseRun(samples, config, { startS }),
  };
}

const check = (
  id: LessonCheck["id"],
  passed: boolean,
  actual?: number,
  target?: number,
): LessonCheck => ({ id, passed, actual, target });

/**
 * Judges one attempt against a lesson.
 *
 * Two rules make the course honest rather than merely strict. A lesson may require
 * a *failure*: reaching the trip it is about is the pass. And a lesson may require
 * an offset to remain, because proportional-only control cannot remove one and
 * pretending otherwise would teach the wrong thing.
 */
export function gradeAttempt(lesson: Lesson, evidence: AttemptEvidence): LessonOutcome {
  const { result, analysis } = evidence;
  const { metrics, score } = result;
  const criteria = lesson.successCriteria;
  const checks: LessonCheck[] = [];

  if (criteria.expectedTrip) {
    checks.push(check("expected-trip", metrics.trip === criteria.expectedTrip));
  } else if (criteria.forbiddenTrips) {
    // An empty list means no trip of any kind is acceptable.
    const forbidden = criteria.forbiddenTrips;
    const tripped = metrics.trip !== null &&
      (forbidden.length === 0 || forbidden.includes(metrics.trip));
    checks.push(check("no-trip", !tripped));
  }

  if (criteria.maximumTotalIae !== undefined) {
    const actual = analysis.loops.total.iae;
    checks.push(check("total-iae", actual <= criteria.maximumTotalIae, actual, criteria.maximumTotalIae));
  }

  if (criteria.maximumInterfaceIae !== undefined) {
    const actual = analysis.loops.interface.iae;
    checks.push(check("interface-iae", actual <= criteria.maximumInterfaceIae, actual, criteria.maximumInterfaceIae));
  }

  if (criteria.maximumPressureIae !== undefined) {
    // A lesson that asks for pressure performance but ran without a gas cap has
    // not been satisfied; it has been misconfigured.
    const pressure = analysis.pressureLoop;
    checks.push(check(
      "pressure-iae",
      pressure !== undefined && pressure.iae <= criteria.maximumPressureIae,
      pressure?.iae,
      criteria.maximumPressureIae,
    ));
  }

  if (criteria.maximumOvershootPct !== undefined) {
    const actual = Math.max(
      analysis.loops.total.overshootPct,
      analysis.loops.interface.overshootPct,
    );
    checks.push(check("overshoot", actual <= criteria.maximumOvershootPct, actual, criteria.maximumOvershootPct));
  }

  if (criteria.maximumSettlingTimeS !== undefined) {
    const settling = analysis.loops.total.settlingTimeS;
    // Never settling is a failure, not a missing measurement.
    checks.push(check(
      "settling-time",
      settling !== null && settling <= criteria.maximumSettlingTimeS,
      settling ?? undefined,
      criteria.maximumSettlingTimeS,
    ));
  }

  if (criteria.maximumValveTravelPct !== undefined) {
    const actual = metrics.actuators.oil.travelPct + metrics.actuators.water.travelPct +
      (metrics.gasActuator?.travelPct ?? 0);
    checks.push(check("valve-travel", actual <= criteria.maximumValveTravelPct, actual, criteria.maximumValveTravelPct));
  }

  if (criteria.minimumScore !== undefined) {
    checks.push(check("score", score.total >= criteria.minimumScore, score.total, criteria.minimumScore));
  }

  if (criteria.maximumSteadyOffsetPct !== undefined) {
    const offset = Math.abs(analysis.loops.total.steadyOffsetPct);
    checks.push(check("offset-removed", offset <= criteria.maximumSteadyOffsetPct, offset, criteria.maximumSteadyOffsetPct));
  }

  if (criteria.requiresSteadyStateOffset) {
    const offset = Math.abs(analysis.loops.total.steadyOffsetPct);
    checks.push(check("steady-state-offset", offset >= OBSERVABLE_OFFSET_PCT, offset, OBSERVABLE_OFFSET_PCT));
  }

  return {
    lessonId: lesson.id,
    passed: checks.every((entry) => entry.passed),
    checks,
  };
}
