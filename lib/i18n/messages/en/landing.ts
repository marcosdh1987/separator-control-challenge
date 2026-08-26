/** One numbered card in the three-step challenge briefing. */
export interface BriefingStep {
  title: string;
  description: string;
}

export const landing = {
  /**
   * The landing page skips to its mission section rather than to a generic main
   * landmark, so it needs its own label instead of `common.skipToContent`.
   */
  skipToMission: "Skip to mission",

  header: {
    homeLabel: "Separator Control Challenge home",
    eyebrow: "Process control lab / challenge 01",
    /**
     * A two-line badge, not the full `common.educationalDisclaimer` sentence:
     * the header has room for a title and a single qualifying line.
     */
    disclaimerTitle: "Educational simulator",
    disclaimerDetail: "Not for field operation or equipment sizing",
  },

  hero: {
    eyebrow: "Three-phase separator / operator briefing",
    headline: "Can you keep a three-phase separator stable?",
    description:
      "Tune two PID control loops, survive realistic well-testing disturbances, and keep the process inside its safe operating envelope.",
    /** Accessible name of the still separator render beside the copy. */
    visualLabel: "Static separator presentation",
    /** Instrument-style tag rendered above the render, kept in upper case. */
    visualTag: "SEP-101 / NORMAL OPERATION / IDLE VISUAL",
  },

  cta: {
    startTraining: "Start guided training",
    enterControlRoom: "Enter control room",
  },

  briefing: {
    label: "Challenge briefing",
    /** Ordinals are rendered from the position, so they are not translated. */
    steps: [
      {
        title: "Tune",
        description: "Set the oil and water PID gains before the disturbance arrives.",
      },
      {
        title: "Survive",
        description: "Read the coupled inventories and hold the safety envelope.",
      },
      {
        title: "Score",
        description: "Finish a deterministic attempt and inspect the control response.",
      },
    ] satisfies readonly BriefingStep[],
    controlNote: {
      eyebrow: "Control relationships",
      title: "Two valves, two coupled inventories.",
      oilValve: "Oil outlet valve controls total liquid level.",
      waterValve: "Water outlet valve controls oil/water interface.",
      goal: "Hold the total near 50%, interface near 20%, and protect the operating envelope.",
    },
  },

  /** Placeholder copy for the guided training route, which is not built yet. */
  training: {
    eyebrow: "Guided training",
    headline: "Guided training is being prepared.",
    description: "Learn the separator controls step by step before taking a scored challenge.",
  },
};

export type LandingMessages = typeof landing;
