"use client";

import { useMessages } from "@/lib/i18n/provider";
import type { PhaseId } from "@/lib/simulation/types";

/** Oil first, matching the order the two loops appear in on the dashboard. */
const MISSION_VALVES = ["oil", "water"] as const satisfies readonly PhaseId[];

export function MissionSummary() {
  const { mission } = useMessages().onboarding;

  return (
    <div className="mission-summary">
      <p id="quick-start-description">{mission.objective}</p>
      <dl>
        {MISSION_VALVES.map((phase) => (
          <div key={phase}>
            <dt>{mission.valve[phase].term}</dt>
            <dd>{mission.valve[phase].definition}</dd>
          </div>
        ))}
      </dl>
      <p>{mission.gainsLockNote}</p>
      <ol aria-label={mission.howToPlayLabel}>
        {mission.howToPlaySteps.map((step) => <li key={step}>{step}</li>)}
      </ol>
    </div>
  );
}
