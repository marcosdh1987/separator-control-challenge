import type { ScenarioDefinition, ScenarioId, ScenarioState } from "./types";

export const SCENARIOS = [
  { id: "normal", seed: 1001, disturbanceStartS: 0, disturbanceEndS: 0 },
  { id: "feed-step", seed: 1002, disturbanceStartS: 180, disturbanceEndS: 180 },
  { id: "water-rich-slug", seed: 1003, disturbanceStartS: 185, disturbanceEndS: 205 },
  { id: "oil-outlet-restriction", seed: 1004, disturbanceStartS: 195, disturbanceEndS: 195 },
  { id: "slow-water-dump", seed: 1005, disturbanceStartS: 180, disturbanceEndS: 180 },
  { id: "noisy-interface", seed: 1006, disturbanceStartS: 0, disturbanceEndS: 0 },
  { id: "gor-surge", seed: 1007, disturbanceStartS: 190, disturbanceEndS: 190 },
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
    gorFactor: 1,
    disturbance: "steady",
  };

  if (id === "feed-step" && timeS >= 180) {
    return { ...base, totalInletM3H: 70, disturbance: "feed-step-active" };
  }
  if (id === "water-rich-slug" && timeS >= 185 && timeS < 205) {
    const phase = (Math.PI * (timeS - 185)) / 20;
    const intensity = Math.sin(phase) ** 2;
    return {
      ...base,
      totalInletM3H: 50 + 60 * intensity,
      waterCutFraction: 0.3 + 0.35 * intensity,
      disturbance: "slug-active",
    };
  }
  if (id === "water-rich-slug" && timeS >= 205) {
    return { ...base, disturbance: "slug-ended" };
  }
  if (id === "oil-outlet-restriction" && timeS >= 195) {
    return { ...base, oilCapacityFactor: 0.6, disturbance: "oil-restriction-active" };
  }
  if (id === "slow-water-dump") {
    return {
      ...base,
      waterActuatorTauS: 12,
      waterCutFraction: timeS >= 180 ? 0.5 : 0.3,
      disturbance: timeS >= 180
        ? "slow-water-dump-high-cut"
        : "slow-water-dump",
    };
  }
  if (id === "gor-surge" && timeS >= 190) {
    // The well starts making far more gas per barrel of oil. Levels barely move,
    // so the only loop that feels it is pressure — which is the lesson.
    return { ...base, gorFactor: 1.6, disturbance: "gor-surge-active" };
  }
  if (id === "noisy-interface") {
    return {
      ...base,
      interfaceSensorNoisePct: 1.5,
      interfaceSensorSampleS: 0.5,
      disturbance: "noisy-interface",
    };
  }
  return base;
}
