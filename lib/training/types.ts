import type { DiagnosisPatternId } from "@/lib/education/diagnosis";
import type {
  DualPidConfig,
  ScenarioId,
  TripKind,
} from "@/lib/simulation/types";

export type LessonId =
  | "what-is-a-separator"
  | "level-and-proportional-action"
  | "integral-action-and-windup"
  | "interface-noise-and-derivative"
  | "slugs-and-the-limits-of-feedback"
  | "the-third-loop-pressure"
  | "systematic-tuning";

/** Presentation order. A lesson may assume everything before it, nothing after. */
export const LESSON_IDS = [
  "what-is-a-separator",
  "level-and-proportional-action",
  "integral-action-and-windup",
  "interface-noise-and-derivative",
  "slugs-and-the-limits-of-feedback",
  "the-third-loop-pressure",
  "systematic-tuning",
] as const satisfies readonly LessonId[];

export type LessonLevel = "foundation" | "practice" | "advanced";

/**
 * What the trainee has to achieve. Every field is optional so a lesson can be
 * pure reading, or can be scored on whichever evidence actually matters for it.
 */
export interface LessonSuccessCriteria {
  /** The run must end without any of these trips. Empty means no trip at all. */
  forbiddenTrips?: readonly Exclude<TripKind, null>[];
  /**
   * Trips or alarms the lesson *expects* to see, because failing in a specific
   * way is the point. Borrowed from the DACS scenario presets, where the expected
   * alarm is the answer key rather than a defect.
   */
  expectedTrip?: Exclude<TripKind, null>;
  maximumTotalIae?: number;
  maximumInterfaceIae?: number;
  maximumPressureIae?: number;
  maximumOvershootPct?: number;
  maximumSettlingTimeS?: number;
  /** Cap on total valve travel, which is what wear actually costs. */
  maximumValveTravelPct?: number;
  minimumScore?: number;
  /**
   * A steady-state offset the trainee is meant to *observe*, not eliminate.
   * Lesson two teaches that proportional-only control always leaves one.
   */
  requiresSteadyStateOffset?: boolean;
}

/** How the simulator is set up for the exercise. */
export interface LessonExercise {
  scenarioId: ScenarioId;
  gasEnabled: boolean;
  /** Gains the trainee starts from. */
  initialPid: DualPidConfig;
  /**
   * Gains the lesson does not let the trainee change, so attention stays on the
   * one idea being taught. Omitted means everything is adjustable.
   */
  lockedGains?: readonly ("kp" | "ki" | "kd")[];
  /** Diagnosis patterns this exercise is designed to provoke. */
  expectedPatterns?: readonly DiagnosisPatternId[];
}

export interface Lesson {
  id: LessonId;
  level: LessonLevel;
  /** Minutes a first-time reader should expect to spend. */
  estimatedMinutes: number;
  exercise: LessonExercise;
  successCriteria: LessonSuccessCriteria;
}

/** Why an attempt did or did not meet a lesson's criteria. */
export type LessonCheckId =
  | "no-trip"
  | "expected-trip"
  | "total-iae"
  | "interface-iae"
  | "pressure-iae"
  | "overshoot"
  | "settling-time"
  | "valve-travel"
  | "score"
  | "steady-state-offset";

export interface LessonCheck {
  id: LessonCheckId;
  passed: boolean;
  /** The measured value and the bound it was judged against, for the debrief. */
  actual?: number;
  target?: number;
}

export interface LessonOutcome {
  lessonId: LessonId;
  passed: boolean;
  checks: readonly LessonCheck[];
}
