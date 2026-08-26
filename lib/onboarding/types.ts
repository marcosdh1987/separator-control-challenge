import type { DualPidConfig } from "@/lib/simulation/types";

export interface OnboardingFlags {
  quickStartDismissed: boolean;
  guidedTourDismissed: boolean;
  trainingCompleted: boolean;
}

export type OnboardingFlag = keyof OnboardingFlags;

/**
 * Presets the onboarding selector offers. Their label and guidance live in the
 * `onboarding` message namespace, keyed by this id.
 */
export type PidPresetId = "balanced" | "conservative" | "aggressive";

/**
 * Presets the control coach offers instead of the onboarding selector: gains
 * chosen to *demonstrate a failure mode* rather than to control the vessel well.
 * They are a separate id space because their copy belongs with the teaching
 * material, in the `education` namespace, not with the onboarding guidance — and
 * because a trainee picking a starting point should not be handed a controller
 * that is deliberately incomplete.
 */
export type TeachingPresetId = "p-only";

export type AnyPresetId = PidPresetId | TeachingPresetId;

/**
 * A preset is gains plus an identifier. Its label and guidance are copy, so they
 * live in `lib/i18n/messages/*\/onboarding.ts` keyed by this id.
 */
export interface PidPreset {
  id: PidPresetId;
  config: DualPidConfig;
}

/** The same shape for a teaching preset; its copy lives under `education.coach`. */
export interface TeachingPreset {
  id: TeachingPresetId;
  config: DualPidConfig;
}

/**
 * Anchors the guided tour attaches to, via `data-tour` attributes on the
 * dashboard. Declared here rather than in the tour component so the message
 * files can key their copy by anchor without importing a client component.
 */
export type TourTargetId =
  | "scenario-selector"
  | "total-pid"
  | "interface-pid"
  | "manual-pid-tuning"
  | "start-attempt"
  | "process-view"
  | "live-trends"
  | "score-safety";

/** Tour order: set up the attempt, run it, then read the result. */
export const TOUR_TARGET_IDS = [
  "scenario-selector",
  "total-pid",
  "interface-pid",
  "manual-pid-tuning",
  "start-attempt",
  "process-view",
  "live-trends",
  "score-safety",
] as const satisfies readonly TourTargetId[];

export const DEFAULT_ONBOARDING_FLAGS: Readonly<OnboardingFlags> = Object.freeze({
  quickStartDismissed: false,
  guidedTourDismissed: false,
  trainingCompleted: false,
});
