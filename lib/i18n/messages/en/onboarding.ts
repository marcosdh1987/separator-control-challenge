import type { PidPresetId, TourTargetId } from "@/lib/onboarding/types";
import type { PhaseId } from "@/lib/simulation/types";

export interface TourStepCopy {
  title: string;
  description: string;
}

export interface PresetCopy {
  label: string;
  guidance: string;
}

export interface MissionValveCopy {
  term: string;
  definition: string;
}

export const onboarding = {
  quickStart: {
    eyebrow: "First control-room visit",
    title: "Your mission",
    startGuidedTour: "Start guided tour",
    skipAndPlay: "Skip and play",
    dontShowAgain: "Don't show again",
  },

  mission: {
    objective:
      "Keep the total level near 50% and the oil/water interface near 20% while the process is disturbed.",
    valve: {
      oil: {
        term: "Oil valve LV-101",
        definition: "Moves oil out to correct total liquid level.",
      },
      water: {
        term: "Water valve WV-101",
        definition: "Moves water out to correct the interface.",
      },
    } satisfies Record<PhaseId, MissionValveCopy>,
    gainsLockNote: "Gains lock when an attempt starts, so tune before you run.",
    howToPlayLabel: "How to play",
    howToPlaySteps: [
      "Choose a scenario.",
      "Adjust the PID gains.",
      "Start the attempt.",
      "Monitor levels, valves, and safety.",
      "Retry with what you learned.",
    ],
  },

  tour: {
    eyebrow: "Control-room guide",
    skip: "Skip",
    back: "Back",
    next: "Next",
    finish: "Finish",
    /** A function so a translation can order the numbers as its grammar requires. */
    progress: (current: number, total: number) => `Step ${current} of ${total}`,
    step: {
      "scenario-selector": {
        title: "Scenario selector",
        description:
          "Choose a disturbance. The oil/water feed step is a good first scored challenge.",
      },
      "total-pid": {
        title: "Total-level PID",
        description:
          "This controller moves the oil valve. More opening sends more oil out and lowers total level.",
      },
      "interface-pid": {
        title: "Interface PID",
        description:
          "This controller moves the water valve. More opening sends more water out and lowers the interface.",
      },
      "manual-pid-tuning": {
        title: "Manual PID tuning",
        description:
          "Repeat the same deterministic scenario and seed. Set Ki = 0 and Kd = 0. Begin by tuning proportional action only. Run the complete recovery before comparing a change.",
      },
      "start-attempt": {
        title: "Start attempt",
        description:
          "Start only when your tuning is ready. PID gains lock for the duration of an attempt.",
      },
      "process-view": {
        title: "Process view",
        description:
          "Watch total level, the oil/water interface, valve positions, and the safety envelope together.",
      },
      "live-trends": {
        title: "Live trends",
        description:
          "Use the trends to distinguish a fast recovery from oscillation, saturation, or drift.",
      },
      "score-safety": {
        title: "Score and safety",
        description: "Safety comes first. Your deterministic score is final only when the attempt ends.",
      },
    } satisfies Record<TourTargetId, TourStepCopy>,
  },

  presetLegend: "PID presets",

  preset: {
    balanced: {
      label: "Balanced",
      guidance: "A reliable starting point for both level loops.",
    },
    conservative: {
      label: "Conservative",
      guidance: "Gentler corrections with less valve movement.",
    },
    aggressive: {
      label: "Aggressive",
      guidance: "Faster corrections, with more risk of oscillation.",
    },
  } satisfies Record<PidPresetId, PresetCopy>,

  /** Accessible name of a preset button, where the visible label is only the name. */
  presetOptionLabel: (label: string) => `${label} preset`,
};

export type OnboardingMessages = typeof onboarding;
