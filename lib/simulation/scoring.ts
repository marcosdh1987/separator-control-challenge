import type {
  FeedbackCode,
  LiquidLoopId,
  PhaseId,
  RankId,
  RunMetrics,
  ScoreBreakdown,
  ScoreModifier,
} from "./types";

interface LossCandidate {
  id: "safety" | "tracking" | "stability" | "recovery" | "valve" | "pressure";
  value: number;
}

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

export function rankForScore(score: number): RankId {
  if (score >= 90) return "master";
  if (score >= 75) return "specialist";
  if (score >= 60) return "engineer";
  if (score >= 40) return "technician";
  return "trainee";
}

function isOscillating(metrics: RunMetrics, loop: LiquidLoopId): boolean {
  const threshold = loop === "total" ? 8 : 6;
  const loopMetrics = metrics.loops[loop];
  return loopMetrics.oscillationCrossings >= 6 &&
    loopMetrics.oscillationPeakToPeakPct >= threshold;
}

function collectModifiers(metrics: RunMetrics): ScoreModifier[] {
  const modifiers: ScoreModifier[] = [];

  if (metrics.trip) {
    modifiers.push({ id: "trip", trip: metrics.trip, points: 0 });
  }
  if (isOscillating(metrics, "total")) {
    modifiers.push({ id: "total-oscillation", points: -5 });
  }
  if (isOscillating(metrics, "interface")) {
    modifiers.push({ id: "interface-oscillation", points: -5 });
  }
  if (metrics.actuators.oil.saturationTimeS > 30) {
    modifiers.push({ id: "oil-saturation", points: -4 });
  }
  if (metrics.actuators.water.saturationTimeS > 30) {
    modifiers.push({ id: "water-saturation", points: -4 });
  }
  if (metrics.actuators.oil.travelPct > 300) {
    modifiers.push({ id: "oil-travel", points: -2.5 });
  }
  if (metrics.actuators.water.travelPct > 300) {
    modifiers.push({ id: "water-travel", points: -2.5 });
  }
  if (metrics.actuators.oil.integralLimitTimeS > 10) {
    modifiers.push({ id: "total-windup", points: -2.5 });
  }
  if (metrics.actuators.water.integralLimitTimeS > 10) {
    modifiers.push({ id: "interface-windup", points: -2.5 });
  }

  // The pressure loop only earns or loses points when the gas cap is in play.
  const pressure = metrics.pressureLoop;
  const gas = metrics.gasActuator;
  if (pressure && pressure.oscillationCrossings >= 6 && pressure.oscillationPeakToPeakPct >= 4) {
    modifiers.push({ id: "pressure-oscillation", points: -5 });
  }
  if (gas && gas.saturationTimeS > 30) modifiers.push({ id: "gas-saturation", points: -4 });
  if (gas && gas.travelPct > 300) modifiers.push({ id: "gas-travel", points: -2.5 });
  if (gas && gas.integralLimitTimeS > 10) modifiers.push({ id: "pressure-windup", points: -2.5 });

  return modifiers;
}

function responsibleLoop(
  totalLoss: number,
  interfaceLoss: number,
): LiquidLoopId {
  return interfaceLoss > totalLoss ? "interface" : "total";
}

function responsibleRecoveryLoop(metrics: RunMetrics): LiquidLoopId {
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

function baseFeedback(metrics: RunMetrics, losses: LossCandidate[]): FeedbackCode {
  const largest = losses.reduce((current, candidate) =>
    candidate.value > current.value ? candidate : current
  );
  if (largest.value === 0) return { kind: "balanced" };

  if (largest.id === "safety") {
    return {
      kind: "safety",
      loop: responsibleLoop(
        metrics.loops.total.alarmTimeS,
        metrics.loops.interface.alarmTimeS,
      ),
    };
  }
  if (largest.id === "tracking") {
    return {
      kind: "tracking",
      loop: responsibleLoop(
        normalized(metrics.loops.total.mae, 15),
        normalized(metrics.loops.interface.mae, 10),
      ),
    };
  }
  if (largest.id === "stability") {
    return {
      kind: "stability",
      loop: responsibleLoop(
        normalized(metrics.loops.total.stabilityStdDev, 8),
        normalized(metrics.loops.interface.stabilityStdDev, 5),
      ),
    };
  }
  if (largest.id === "recovery") {
    return { kind: "recovery", loop: responsibleRecoveryLoop(metrics) };
  }

  if (largest.id === "pressure") return { kind: "pressure" };

  const responsible = responsibleValve(metrics);
  return { kind: "valve", phase: responsible.phase, effort: responsible.effort };
}

function feedback(
  metrics: RunMetrics,
  modifiers: ScoreModifier[],
  losses: LossCandidate[],
): FeedbackCode {
  if (metrics.trip) return { kind: "trip", trip: metrics.trip };
  const firstModifier = modifiers[0];
  if (firstModifier && firstModifier.id !== "trip") {
    return { kind: "modifier", modifier: firstModifier.id };
  }
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
  // With a gas cap the pressure loop shares the tracking and stability budget:
  // holding level while pressure swings is not control, it is luck.
  const pressureLoop = metrics.pressureLoop;
  const pressureTrackingLoss = pressureLoop ? normalized(pressureLoop.mae, 1.5) : 0;
  const pressureStabilityLoss = pressureLoop ? normalized(pressureLoop.stabilityStdDev, 1) : 0;
  const alarmLoss = normalized(metrics.alarmTimeS, 45);
  const recoveryLoss = normalized(metrics.recoveryTimeS, 90);
  const safety = metrics.trip ? 0 : points(35, alarmLoss);
  const tracking = points(25, pressureLoop
    ? (2 * trackingLoss + pressureTrackingLoss) / 3
    : trackingLoss);
  const stability = points(15, pressureLoop
    ? (2 * stabilityLoss + pressureStabilityLoss) / 3
    : stabilityLoss);
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
    { id: "pressure", value: 0.6 * pressureTrackingLoss + 0.4 * pressureStabilityLoss },
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
    feedback: feedback(metrics, modifiers, losses),
  };
}
