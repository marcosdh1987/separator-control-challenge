import type { ScenarioId } from "@/lib/simulation/types";

/**
 * The single source of scenario difficulty. It also fixes the order scenarios are
 * offered in, so the deck always reads from gentlest to hardest. Labels live in the
 * message catalogue; this module only knows identifiers.
 */
export type DifficultyId = "beginner" | "intermediate" | "advanced";

export interface ScenarioDifficultyGroup {
  id: DifficultyId;
  scenarioIds: readonly ScenarioId[];
}

export const SCENARIO_DIFFICULTY_GROUPS: readonly ScenarioDifficultyGroup[] = [
  { id: "beginner", scenarioIds: ["normal", "feed-step"] },
  { id: "intermediate", scenarioIds: ["slow-water-dump", "oil-outlet-restriction"] },
  { id: "advanced", scenarioIds: ["water-rich-slug", "noisy-interface", "gor-surge"] },
] as const;

export const FIRST_SCORED_SCENARIO: ScenarioId = "feed-step";

export function getScenarioDifficulty(scenarioId: ScenarioId): DifficultyId {
  const group = SCENARIO_DIFFICULTY_GROUPS.find((candidate) =>
    candidate.scenarioIds.includes(scenarioId)
  );
  if (!group) throw new Error(`No difficulty guidance configured for scenario: ${scenarioId}`);
  return group.id;
}
