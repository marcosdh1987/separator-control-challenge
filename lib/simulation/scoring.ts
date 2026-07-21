import type {
  LoopId,
  PhaseId,
  RunMetrics,
  ScoreBreakdown,
  ScoreModifier,
  ScoreModifierId,
  TripKind,
} from "./types";

interface LossCandidate {
  id: "safety" | "tracking" | "stability" | "recovery" | "valve";
  value: number;
}

interface Feedback {
  diagnosis: string;
  suggestion: string;
}

const TRIP_FEEDBACK: Record<Exclude<TripKind, null>, Feedback & { label: string }> = {
  TOTAL_LL: {
    label: "Total level low-low trip cap",
    diagnosis: "Total level low-low trip",
    suggestion: "Retune the total level loop so the oil valve closes sooner without oscillating.",
  },
  TOTAL_HH: {
    label: "Total level high-high trip cap",
    diagnosis: "Total level high-high trip",
    suggestion: "Retune the total level loop so the oil valve opens sooner and preserves margin.",
  },
  INTERFACE_LL: {
    label: "Interface low-low trip cap",
    diagnosis: "Interface low-low trip",
    suggestion: "Retune the interface loop so the water valve closes sooner without windup.",
  },
  INTERFACE_HH: {
    label: "Interface high-high trip cap",
    diagnosis: "Interface high-high trip",
    suggestion: "Retune the interface loop so the water valve opens sooner and restores margin.",
  },
  OIL_LAYER_LL: {
    label: "Oil-layer low-low trip cap",
    diagnosis: "Oil-layer low-low trip",
    suggestion: "Use the interface loop and water valve to lower the interface before the oil layer collapses.",
  },
};

function finiteNonnegative(value: number): number {
  if (Number.isNaN(value) || value <= 0) return 0;
  if (!Number.isFinite(value)) return Number.MAX_VALUE;
  return value;
}

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, finiteNonnegative(value)));

const normalized = (value: number, threshold: number): number =>
  clamp01(finiteNonnegative(value) / threshold);

const points = (maximum: number, lossRatio: number): number =>
  maximum * (1 - clamp01(lossRatio));

export function rankForScore(score: number): string {
  if (score >= 90) return "Separator Control Master";
  if (score >= 75) return "Loop Tuning Specialist";
  if (score >= 60) return "Process Engineer";
  if (score >= 40) return "Control Technician";
  return "Trainee Operator";
}

function isOscillating(metrics: RunMetrics, loop: LoopId): boolean {
  const threshold = loop === "total" ? 8 : 6;
  const loopMetrics = metrics.loops[loop];
  return loopMetrics.oscillationCrossings >= 6 &&
    loopMetrics.oscillationPeakToPeakPct >= threshold;
}

function collectModifiers(metrics: RunMetrics): ScoreModifier[] {
  const modifiers: ScoreModifier[] = [];

  if (metrics.trip) {
    modifiers.push({ id: "trip", label: TRIP_FEEDBACK[metrics.trip].label, points: 0 });
  }
  if (isOscillating(metrics, "total")) {
    modifiers.push({
      id: "total-oscillation",
      label: "Total level sustained oscillation",
      points: -5,
    });
  }
  if (isOscillating(metrics, "interface")) {
    modifiers.push({
      id: "interface-oscillation",
      label: "Interface sustained oscillation",
      points: -5,
    });
  }
  if (metrics.actuators.oil.saturationTimeS > 30) {
    modifiers.push({ id: "oil-saturation", label: "Oil valve long saturation", points: -4 });
  }
  if (metrics.actuators.water.saturationTimeS > 30) {
    modifiers.push({ id: "water-saturation", label: "Water valve long saturation", points: -4 });
  }
  if (metrics.actuators.oil.travelPct > 300) {
    modifiers.push({ id: "oil-travel", label: "Excessive oil valve travel", points: -2.5 });
  }
  if (metrics.actuators.water.travelPct > 300) {
    modifiers.push({ id: "water-travel", label: "Excessive water valve travel", points: -2.5 });
  }
  if (metrics.actuators.oil.integralLimitTimeS > 10) {
    modifiers.push({ id: "total-windup", label: "Total level integral limit", points: -2.5 });
  }
  if (metrics.actuators.water.integralLimitTimeS > 10) {
    modifiers.push({ id: "interface-windup", label: "Interface integral limit", points: -2.5 });
  }

  return modifiers;
}

function modifierFeedback(id: Exclude<ScoreModifierId, "trip">): Feedback {
  const feedback: Record<Exclude<ScoreModifierId, "trip">, Feedback> = {
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
  };
  return feedback[id];
}

function responsibleLoop(
  totalLoss: number,
  interfaceLoss: number,
): LoopId {
  return interfaceLoss > totalLoss ? "interface" : "total";
}

function loopName(loop: LoopId): string {
  return loop === "total" ? "Total level" : "Interface";
}

function loopNameLower(loop: LoopId): string {
  return loop === "total" ? "total level" : "interface";
}

function actuatorName(loop: LoopId): "oil valve" | "water valve" {
  return loop === "total" ? "oil valve" : "water valve";
}

function responsibleRecoveryLoop(metrics: RunMetrics): LoopId {
  const total = metrics.loops.total;
  const interfaceLoop = metrics.loops.interface;
  if (total.settled !== interfaceLoop.settled) {
    return total.settled ? "interface" : "total";
  }
  return responsibleLoop(total.recoveryTimeS, interfaceLoop.recoveryTimeS);
}

function responsibleValve(metrics: RunMetrics): { phase: PhaseId; effort: "travel" | "saturation" } {
  const candidates: Array<{ phase: PhaseId; effort: "travel" | "saturation"; value: number }> = [
    { phase: "oil", effort: "travel", value: normalized(metrics.actuators.oil.travelPct, 300) },
    { phase: "water", effort: "travel", value: normalized(metrics.actuators.water.travelPct, 300) },
    {
      phase: "oil",
      effort: "saturation",
      value: normalized(metrics.actuators.oil.saturationTimeS, 45),
    },
    {
      phase: "water",
      effort: "saturation",
      value: normalized(metrics.actuators.water.saturationTimeS, 45),
    },
  ];
  return candidates.reduce((current, candidate) =>
    candidate.value > current.value ? candidate : current
  );
}

function baseFeedback(metrics: RunMetrics, losses: LossCandidate[]): Feedback {
  const largest = losses.reduce((current, candidate) =>
    candidate.value > current.value ? candidate : current
  );
  if (largest.value === 0) return {
    diagnosis: "Balanced total level and interface response",
    suggestion: "Try a harder scenario or trim oil and water valve travel without sacrificing safety.",
  };

  if (largest.id === "safety") {
    const loop = responsibleLoop(
      metrics.loops.total.alarmTimeS,
      metrics.loops.interface.alarmTimeS,
    );
    const actuator = actuatorName(loop);
    return {
      diagnosis: `${loopName(loop)} / ${actuator} alarm exposure dominates the score`,
      suggestion: `Retune the ${loopName(loop)} loop and ${actuator} to restore safety margin first.`,
    };
  }
  if (largest.id === "tracking") {
    const loop = responsibleLoop(
      normalized(metrics.loops.total.mae, 15),
      normalized(metrics.loops.interface.mae, 10),
    );
    return {
      diagnosis: `${loopName(loop)} tracking error dominates the score`,
      suggestion: `Increase Kp gradually in the ${loopNameLower(loop)} loop, then add modest Ki for offset.`,
    };
  }
  if (largest.id === "stability") {
    const loop = responsibleLoop(
      normalized(metrics.loops.total.stabilityStdDev, 8),
      normalized(metrics.loops.interface.stabilityStdDev, 5),
    );
    return {
      diagnosis: `${loopName(loop)} variability dominates the score`,
      suggestion: `Reduce Kp or Ki in the ${loopNameLower(loop)} loop and add derivative only with clean measurement.`,
    };
  }
  if (largest.id === "recovery") {
    const loop = responsibleRecoveryLoop(metrics);
    const actuator = actuatorName(loop);
    return {
      diagnosis: `${loopName(loop)} / ${actuator} recovery limits the joint response`,
      suggestion: `Retune the ${loopName(loop)} loop and ${actuator} to recover sooner without losing stability.`,
    };
  }

  const responsible = responsibleValve(metrics);
  const phaseName = responsible.phase === "oil" ? "Oil" : "Water";
  const loop = responsible.phase === "oil" ? "total level" : "interface";
  return {
    diagnosis: `${phaseName} valve ${responsible.effort} dominates the score`,
    suggestion: `Retune the ${loop} loop to reduce ${responsible.phase} valve ${responsible.effort}.`,
  };
}

function feedback(
  metrics: RunMetrics,
  modifiers: ScoreModifier[],
  losses: LossCandidate[],
): Feedback {
  if (metrics.trip) return TRIP_FEEDBACK[metrics.trip];
  const firstModifier = modifiers[0];
  if (firstModifier && firstModifier.id !== "trip") return modifierFeedback(firstModifier.id);
  return baseFeedback(metrics, losses);
}

export function calculateScore(metrics: RunMetrics): ScoreBreakdown {
  const totalTrackingLoss = normalized(metrics.loops.total.mae, 15);
  const interfaceTrackingLoss = normalized(metrics.loops.interface.mae, 10);
  const trackingLoss = 0.5 * totalTrackingLoss + 0.5 * interfaceTrackingLoss;
  const totalStabilityLoss = normalized(metrics.loops.total.stabilityStdDev, 8);
  const interfaceStabilityLoss = normalized(metrics.loops.interface.stabilityStdDev, 5);
  const stabilityLoss = 0.5 * totalStabilityLoss + 0.5 * interfaceStabilityLoss;
  const travelLoss = 0.5 * (
    normalized(metrics.actuators.oil.travelPct, 300) +
    normalized(metrics.actuators.water.travelPct, 300)
  );
  const saturationLoss = 0.5 * (
    normalized(metrics.actuators.oil.saturationTimeS, 45) +
    normalized(metrics.actuators.water.saturationTimeS, 45)
  );
  const alarmLoss = normalized(metrics.alarmTimeS, 45);
  const recoveryLoss = normalized(metrics.recoveryTimeS, 90);
  const safety = metrics.trip ? 0 : points(35, alarmLoss);
  const tracking = points(25, trackingLoss);
  const stability = points(15, stabilityLoss);
  const recovery = points(15, recoveryLoss);
  const valveEfficiency = points(6, travelLoss) + points(4, saturationLoss);
  const modifiers = collectModifiers(metrics);
  const modifierTotal = modifiers.reduce((total, modifier) => total + modifier.points, 0);
  const uncapped = safety + tracking + stability + recovery + valveEfficiency + modifierTotal;
  const maximum = metrics.trip ? 35 : 100;
  const total = Math.round(Math.max(0, Math.min(maximum, finiteNonnegative(uncapped))));
  const losses: LossCandidate[] = [
    { id: "safety", value: alarmLoss },
    { id: "tracking", value: trackingLoss },
    { id: "stability", value: stabilityLoss },
    { id: "recovery", value: recoveryLoss },
    { id: "valve", value: 0.6 * travelLoss + 0.4 * saturationLoss },
  ];

  return {
    safety,
    tracking,
    stability,
    recovery,
    valveEfficiency,
    modifiers,
    total,
    rank: rankForScore(total),
    ...feedback(metrics, modifiers, losses),
  };
}
