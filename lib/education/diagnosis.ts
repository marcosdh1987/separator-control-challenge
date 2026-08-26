/**
 * Response patterns a trainee can recognise while tuning. These identifiers are the
 * language-free contract between the simulator and the teaching copy: the wording
 * for each one lives in the `education` message namespace of each locale.
 */
export type DiagnosisPatternId =
  | "sluggish"
  | "offset"
  | "overshoot"
  | "sustained-oscillation"
  | "hunting"
  | "valve-saturation"
  | "noisy-command";

/** Presentation order in the learning panel: mildest symptom first. */
export const DIAGNOSIS_PATTERN_IDS = [
  "sluggish",
  "offset",
  "overshoot",
  "sustained-oscillation",
  "hunting",
  "valve-saturation",
  "noisy-command",
] as const satisfies readonly DiagnosisPatternId[];

export interface GainSet {
  kp: number;
  ki: number;
  kd: number;
}

/**
 * The risk the current gains court, named with the same vocabulary the learning
 * panel uses so the dashboard note and the panel cannot give conflicting advice.
 * Returns null when no single pattern dominates.
 */
export function gainAdvisory(
  gains: GainSet,
  context: { noisyMeasurement: boolean },
): DiagnosisPatternId | null {
  if (gains.kp >= 7) return "sustained-oscillation";
  if (gains.ki >= 0.18) return "overshoot";
  if (gains.kd >= 15 && context.noisyMeasurement) return "noisy-command";
  if (gains.kp <= 1) return "sluggish";
  return null;
}
