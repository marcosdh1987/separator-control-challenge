import { getScenarioDifficulty } from "@/lib/onboarding/scenario-guidance";
import type { ScenarioId } from "@/lib/simulation/types";

interface DifficultyBadgeProps {
  scenarioId: ScenarioId;
}

export function DifficultyBadge({ scenarioId }: DifficultyBadgeProps) {
  return <span className="difficulty-badge" data-testid="difficulty-badge">{getScenarioDifficulty(scenarioId)}</span>;
}
