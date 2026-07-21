import type { ScenarioDefinition, ScenarioId, ScenarioState } from "./types";

export const SCENARIOS = [
  {
    id: "normal", name: "Normal operation", shortName: "Normal",
    description: "Steady oil and water feed with nominal sensors and dump valves.",
    difficulty: "Foundations", seed: 1001, disturbanceStartS: 0, disturbanceEndS: 0,
  },
  {
    id: "feed-step", name: "Oil/water feed step", shortName: "Feed step",
    description: "Total oil/water feed rises from 50 to 70 m³/h at 30 seconds.",
    difficulty: "Intermediate", seed: 1002, disturbanceStartS: 30, disturbanceEndS: 30,
  },
  {
    id: "water-rich-slug", name: "Water-rich liquid slug", shortName: "Water-rich slug",
    description: "A liquid slug raises both total feed and the inlet water fraction.",
    difficulty: "Advanced", seed: 1003, disturbanceStartS: 35, disturbanceEndS: 55,
  },
  {
    id: "oil-outlet-restriction", name: "Oil outlet restriction", shortName: "Oil restriction",
    description: "Available oil dump-valve capacity falls to 60% at 45 seconds.",
    difficulty: "Advanced", seed: 1004, disturbanceStartS: 45, disturbanceEndS: 45,
  },
  {
    id: "slow-water-dump", name: "Slow water-dump actuator", shortName: "Slow water dump",
    description: "A slow water valve must control a higher inlet water fraction.",
    difficulty: "Intermediate", seed: 1005, disturbanceStartS: 30, disturbanceEndS: 30,
  },
  {
    id: "noisy-interface", name: "Noisy interface sensor", shortName: "Noisy interface",
    description: "The interface sensor sees ±1.5% noise with a 0.5 s sample hold.",
    difficulty: "Advanced", seed: 1006, disturbanceStartS: 0, disturbanceEndS: 0,
  },
] satisfies ScenarioDefinition[];

/** One canonical catalogue; retained export name supports existing golden-run tooling. */
export const DUAL_SCENARIOS = SCENARIOS;

export function getScenario(id: ScenarioId): ScenarioDefinition {
  const scenario = SCENARIOS.find((candidate) => candidate.id === id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}

export function scenarioAt(id: ScenarioId, timeS: number, nominalActuatorTauS = 3): ScenarioState {
  const base: ScenarioState = {
    totalInletM3H: 50,
    waterCutFraction: 0.3,
    oilCapacityFactor: 1,
    waterCapacityFactor: 1,
    oilActuatorTauS: nominalActuatorTauS,
    waterActuatorTauS: nominalActuatorTauS,
    totalSensorNoisePct: 0,
    interfaceSensorNoisePct: 0,
    totalSensorSampleS: 0.2,
    interfaceSensorSampleS: 0.2,
    disturbance: "Steady oil/water feed",
  };

  if (id === "feed-step" && timeS >= 30) {
    return { ...base, totalInletM3H: 70, disturbance: "Oil/water feed step active" };
  }
  if (id === "water-rich-slug" && timeS >= 35 && timeS < 55) {
    const phase = (Math.PI * (timeS - 35)) / 20;
    const intensity = Math.sin(phase) ** 2;
    return {
      ...base,
      totalInletM3H: 50 + 60 * intensity,
      waterCutFraction: 0.3 + 0.35 * intensity,
      disturbance: "Water-rich liquid slug active",
    };
  }
  if (id === "water-rich-slug" && timeS >= 55) {
    return { ...base, disturbance: "Water-rich liquid slug ended" };
  }
  if (id === "oil-outlet-restriction" && timeS >= 45) {
    return { ...base, oilCapacityFactor: 0.6, disturbance: "Oil outlet restriction active" };
  }
  if (id === "slow-water-dump") {
    return {
      ...base,
      waterActuatorTauS: 12,
      waterCutFraction: timeS >= 30 ? 0.5 : 0.3,
      disturbance: timeS >= 30
        ? "Higher water cut with slow water-dump actuator"
        : "Slow water-dump actuator",
    };
  }
  if (id === "noisy-interface") {
    return {
      ...base,
      interfaceSensorNoisePct: 1.5,
      interfaceSensorSampleS: 0.5,
      disturbance: "Noisy interface sensor",
    };
  }
  return base;
}
