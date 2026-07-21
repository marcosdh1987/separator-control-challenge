import type { DualPidConfig } from "@/lib/simulation/types";

export interface OnboardingFlags {
  quickStartDismissed: boolean;
  guidedTourDismissed: boolean;
  trainingCompleted: boolean;
}

export type OnboardingFlag = keyof OnboardingFlags;

export interface PidPreset {
  id: "balanced" | "conservative" | "aggressive";
  name: "Balanced" | "Conservative" | "Aggressive";
  label: string;
  guidance: string;
  config: DualPidConfig;
}

export const DEFAULT_ONBOARDING_FLAGS: Readonly<OnboardingFlags> = Object.freeze({
  quickStartDismissed: false,
  guidedTourDismissed: false,
  trainingCompleted: false,
});
