"use client";

import { useMessages } from "@/lib/i18n/provider";
import { getScenarioDifficulty } from "@/lib/onboarding/scenario-guidance";
import type { ScenarioId } from "@/lib/simulation/types";

interface DifficultyBadgeProps {
  scenarioId: ScenarioId;
}

export function DifficultyBadge({ scenarioId }: DifficultyBadgeProps) {
  const messages = useMessages();
  return (
    <span className="difficulty-badge" data-testid="difficulty-badge">
      {messages.challenge.difficulty[getScenarioDifficulty(scenarioId)]}
    </span>
  );
}
