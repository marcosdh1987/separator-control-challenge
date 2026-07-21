import type { ScenarioId } from "@/lib/simulation/types";

export interface ScenarioDifficultyGroup {
  label: "Beginner" | "Intermediate" | "Advanced";
  scenarioIds: readonly ScenarioId[];
}

export const SCENARIO_DIFFICULTY_GROUPS: readonly ScenarioDifficultyGroup[] = [
  { label: "Beginner", scenarioIds: ["normal", "feed-step"] },
  { label: "Intermediate", scenarioIds: ["slow-water-dump", "oil-outlet-restriction"] },
  { label: "Advanced", scenarioIds: ["water-rich-slug", "noisy-interface"] },
] as const;

export const FIRST_SCORED_SCENARIO: ScenarioId = "feed-step";

export function getScenarioDifficulty(scenarioId: ScenarioId): ScenarioDifficultyGroup["label"] {
  const group = SCENARIO_DIFFICULTY_GROUPS.find((candidate) => candidate.scenarioIds.includes(scenarioId));
  if (!group) throw new Error(`No difficulty guidance configured for scenario: ${scenarioId}`);
  return group.label;
}
