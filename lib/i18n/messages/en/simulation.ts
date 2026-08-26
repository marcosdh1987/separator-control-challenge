import type {
  DisturbanceId,
  FeedbackCode,
  LoopId,
  PhaseId,
  RankId,
  SafetyConditionId,
  ScenarioId,
  ScoreModifierId,
  TripKind,
} from "@/lib/simulation/types";

export interface ScenarioCopy {
  name: string;
  shortName: string;
  description: string;
}

export interface FeedbackCopy {
  diagnosis: string;
  suggestion: string;
}

export const simulation = {
  loop: {
    total: "Total level",
    interface: "Interface",
    pressure: "Pressure",
  } satisfies Record<LoopId, string>,

  /** Lower-case forms exist because Spanish and English capitalise mid-sentence differently. */
  loopInSentence: {
    total: "total level",
    interface: "interface",
    pressure: "pressure",
  } satisfies Record<LoopId, string>,

  phase: {
    oil: "Oil",
    water: "Water",
  } satisfies Record<PhaseId, string>,

  phaseInSentence: {
    oil: "oil",
    water: "water",
  } satisfies Record<PhaseId, string>,

  valve: {
    oil: "oil valve",
    water: "water valve",
  } satisfies Record<PhaseId, string>,

  /** The valve each loop manipulates. */
  loopValve: {
    total: "oil valve",
    interface: "water valve",
    pressure: "gas valve",
  } satisfies Record<LoopId, string>,

  effort: {
    travel: "travel",
    saturation: "saturation",
  } satisfies Record<"travel" | "saturation", string>,

  scenario: {
    "normal": {
      name: "Normal operation",
      shortName: "Normal",
      description: "Steady oil and water feed with nominal sensors and dump valves.",
    },
    "feed-step": {
      name: "Oil/water feed step",
      shortName: "Feed step",
      description: "Once the vessel is established, total feed rises from 50 to 70 m³/h at 3 minutes.",
    },
    "water-rich-slug": {
      name: "Water-rich liquid slug",
      shortName: "Water-rich slug",
      description: "At about 3 minutes a liquid slug raises both total feed and the inlet water fraction.",
    },
    "oil-outlet-restriction": {
      name: "Oil outlet restriction",
      shortName: "Oil restriction",
      description: "Available oil dump-valve capacity falls to 60% once the vessel is established.",
    },
    "slow-water-dump": {
      name: "Slow water-dump actuator",
      shortName: "Slow water dump",
      description: "A slow water valve must control a higher inlet water fraction.",
    },
    "noisy-interface": {
      name: "Noisy interface sensor",
      shortName: "Noisy interface",
      description: "The interface sensor sees ±1.5% noise with a 0.5 s sample hold.",
    },
    "gor-surge": {
      name: "Gas-oil ratio surge",
      shortName: "GOR surge",
      description: "Once pressure is established, the well starts making far more gas per cubic metre of oil. Needs the gas cap enabled.",
    },
  } satisfies Record<ScenarioId, ScenarioCopy>,

  disturbance: {
    "well-opening": "Opening the well",
    "well-shut-in": "Well shut in",
    "steady": "Steady oil/water feed",
    "feed-step-active": "Oil/water feed step active",
    "slug-active": "Water-rich liquid slug active",
    "slug-ended": "Water-rich liquid slug ended",
    "oil-restriction-active": "Oil outlet restriction active",
    "slow-water-dump": "Slow water-dump actuator",
    "slow-water-dump-high-cut": "Higher water cut with slow water-dump actuator",
    "noisy-interface": "Noisy interface sensor",
    "gor-surge-active": "Gas-oil ratio surge active",
  } satisfies Record<DisturbanceId, string>,

  safetyCondition: {
    "normal": "Normal operating envelope",
    "startup": "Filling — low-level protection bypassed",
    "pressure-low-low": "Pressure low-low trip",
    "pressure-low": "Pressure low alarm",
    "pressure-high": "Pressure high alarm",
    "pressure-high-high": "Pressure high-high trip",
    "total-low-low": "Total level low-low trip",
    "total-low": "Total level low alarm",
    "total-high": "Total level high alarm",
    "total-high-high": "Total level high-high trip",
    "interface-low-low": "Interface low-low trip",
    "interface-low": "Interface low alarm",
    "interface-high": "Interface high alarm",
    "interface-high-high": "Interface high-high trip",
    "oil-layer-low-low": "Oil layer low-low trip",
  } satisfies Record<SafetyConditionId, string>,

  rank: {
    master: "Separator Control Master",
    specialist: "Loop Tuning Specialist",
    engineer: "Process Engineer",
    technician: "Control Technician",
    trainee: "Trainee Operator",
  } satisfies Record<RankId, string>,

  tripModifierLabel: {
    TOTAL_LL: "Total level low-low trip cap",
    TOTAL_HH: "Total level high-high trip cap",
    INTERFACE_LL: "Interface low-low trip cap",
    INTERFACE_HH: "Interface high-high trip cap",
    OIL_LAYER_LL: "Oil-layer low-low trip cap",
    PRESSURE_LL: "Pressure low-low trip cap",
    PRESSURE_HH: "Pressure high-high trip cap",
  } satisfies Record<Exclude<TripKind, null>, string>,

  modifierLabel: {
    "total-oscillation": "Total level sustained oscillation",
    "interface-oscillation": "Interface sustained oscillation",
    "oil-saturation": "Oil valve long saturation",
    "water-saturation": "Water valve long saturation",
    "oil-travel": "Excessive oil valve travel",
    "water-travel": "Excessive water valve travel",
    "total-windup": "Total level integral limit",
    "interface-windup": "Interface integral limit",
    "pressure-oscillation": "Pressure sustained oscillation",
    "gas-saturation": "Gas valve long saturation",
    "gas-travel": "Excessive gas valve travel",
    "pressure-windup": "Pressure integral limit",
  } satisfies Record<Exclude<ScoreModifierId, "trip">, string>,

  tripFeedback: {
    TOTAL_LL: {
      diagnosis: "Total level low-low trip",
      suggestion: "Retune the total level loop so the oil valve closes sooner without oscillating.",
    },
    TOTAL_HH: {
      diagnosis: "Total level high-high trip",
      suggestion: "Retune the total level loop so the oil valve opens sooner and preserves margin.",
    },
    INTERFACE_LL: {
      diagnosis: "Interface low-low trip",
      suggestion: "Retune the interface loop so the water valve closes sooner without windup.",
    },
    INTERFACE_HH: {
      diagnosis: "Interface high-high trip",
      suggestion: "Retune the interface loop so the water valve opens sooner and restores margin.",
    },
    OIL_LAYER_LL: {
      diagnosis: "Oil-layer low-low trip",
      suggestion: "Use the interface loop and water valve to lower the interface before the oil layer collapses.",
    },
    PRESSURE_LL: {
      diagnosis: "Pressure low-low trip",
      suggestion: "Slow the pressure loop so the gas valve stops venting the cap faster than the feed refills it.",
    },
    PRESSURE_HH: {
      diagnosis: "Pressure high-high trip",
      suggestion: "Retune the pressure loop so the gas valve opens sooner; pressure moves far faster than level.",
    },
  } satisfies Record<Exclude<TripKind, null>, FeedbackCopy>,

  modifierFeedback: {
    "total-oscillation": {
      diagnosis: "Total level sustained oscillation",
      suggestion: "Reduce Kp or Ki in the total level loop before adding filtered derivative action.",
    },
    "interface-oscillation": {
      diagnosis: "Interface sustained oscillation",
      suggestion: "Reduce Kp or Ki in the interface loop and keep the water valve response smooth.",
    },
    "oil-saturation": {
      diagnosis: "Oil valve prolonged saturation",
      suggestion: "Retune the total level loop so the oil valve stays within usable authority.",
    },
    "water-saturation": {
      diagnosis: "Water valve prolonged saturation",
      suggestion: "Retune the interface loop so the water valve stays within usable authority.",
    },
    "oil-travel": {
      diagnosis: "Oil valve excessive travel",
      suggestion: "Reduce total level loop aggression to lower oil valve wear without losing safety.",
    },
    "water-travel": {
      diagnosis: "Water valve excessive travel",
      suggestion: "Reduce interface loop aggression to lower water valve wear without losing safety.",
    },
    "total-windup": {
      diagnosis: "Total level integral action is pinned",
      suggestion: "Reduce Ki in the total level loop and confirm the oil valve has enough authority.",
    },
    "interface-windup": {
      diagnosis: "Interface integral action is pinned",
      suggestion: "Reduce Ki in the interface loop and confirm the water valve has enough authority.",
    },
    "pressure-oscillation": {
      diagnosis: "Pressure sustained oscillation",
      suggestion: "Reduce Kp in the pressure loop: the gas cap responds in seconds, so gains that suit a level loop are far too strong here.",
    },
    "gas-saturation": {
      diagnosis: "Gas valve prolonged saturation",
      suggestion: "The gas valve ran out of authority. Check whether the feed GOR exceeds what this valve can pass.",
    },
    "gas-travel": {
      diagnosis: "Gas valve excessive travel",
      suggestion: "Soften the pressure loop; constant gas-valve movement wears the trim without improving control.",
    },
    "pressure-windup": {
      diagnosis: "Pressure integral action is pinned",
      suggestion: "Reduce Ki in the pressure loop and confirm the gas valve can pass the incoming gas.",
    },
  } satisfies Record<Exclude<ScoreModifierId, "trip">, FeedbackCopy>,

  balancedFeedback: {
    diagnosis: "Balanced total level and interface response",
    suggestion: "Try a harder scenario or trim oil and water valve travel without sacrificing safety.",
  } satisfies FeedbackCopy,

  /**
   * Written as functions rather than templates with placeholders so a translation
   * can inflect and reorder freely instead of gluing fragments together.
   */
  pressureFeedback: {
    diagnosis: "Pressure control dominates the score",
    suggestion: "Steady the pressure loop first: it is the fastest loop, and its swings move the liquid levels through the gas cap.",
  } satisfies FeedbackCopy,

  lossFeedback: {
    safety: (loop: string, valve: string): FeedbackCopy => ({
      diagnosis: `${loop} / ${valve} alarm exposure dominates the score`,
      suggestion: `Retune the ${loop} loop and ${valve} to restore safety margin first.`,
    }),
    tracking: (loop: string, loopInSentence: string): FeedbackCopy => ({
      diagnosis: `${loop} tracking error dominates the score`,
      suggestion: `Increase Kp gradually in the ${loopInSentence} loop, then add modest Ki for offset.`,
    }),
    stability: (loop: string, loopInSentence: string): FeedbackCopy => ({
      diagnosis: `${loop} variability dominates the score`,
      suggestion: `Reduce Kp or Ki in the ${loopInSentence} loop and add derivative only with clean measurement.`,
    }),
    recovery: (loop: string, valve: string): FeedbackCopy => ({
      diagnosis: `${loop} / ${valve} recovery limits the joint response`,
      suggestion: `Retune the ${loop} loop and ${valve} to recover sooner without losing stability.`,
    }),
    valve: (phase: string, effort: string, loopInSentence: string, phaseInSentence: string): FeedbackCopy => ({
      diagnosis: `${phase} valve ${effort} dominates the score`,
      suggestion: `Retune the ${loopInSentence} loop to reduce ${phaseInSentence} valve ${effort}.`,
    }),
  },
};

export type SimulationMessages = typeof simulation;

/** Resolves a score's structured feedback into the reader's language. */
export function feedbackCopy(messages: SimulationMessages, code: FeedbackCode): FeedbackCopy {
  switch (code.kind) {
    case "trip":
      return messages.tripFeedback[code.trip];
    case "modifier":
      return messages.modifierFeedback[code.modifier];
    case "balanced":
      return messages.balancedFeedback;
    case "pressure":
      return messages.pressureFeedback;
    case "safety":
      return messages.lossFeedback.safety(
        messages.loop[code.loop],
        messages.loopValve[code.loop],
      );
    case "tracking":
      return messages.lossFeedback.tracking(
        messages.loop[code.loop],
        messages.loopInSentence[code.loop],
      );
    case "stability":
      return messages.lossFeedback.stability(
        messages.loop[code.loop],
        messages.loopInSentence[code.loop],
      );
    case "recovery":
      return messages.lossFeedback.recovery(
        messages.loop[code.loop],
        messages.loopValve[code.loop],
      );
    case "valve":
      return messages.lossFeedback.valve(
        messages.phase[code.phase],
        messages.effort[code.effort],
        code.phase === "oil" ? messages.loopInSentence.total : messages.loopInSentence.interface,
        messages.phaseInSentence[code.phase],
      );
  }
}

export function modifierLabel(
  messages: SimulationMessages,
  modifier: { id: ScoreModifierId; trip?: Exclude<TripKind, null> },
): string {
  if (modifier.id === "trip") {
    return modifier.trip ? messages.tripModifierLabel[modifier.trip] : "";
  }
  return messages.modifierLabel[modifier.id];
}
