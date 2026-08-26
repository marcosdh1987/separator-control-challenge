"use client";

import { Activity, Droplets, Flame, Gauge, MoveDown, RadioTower, Waves } from "lucide-react";
import type { ComponentType } from "react";
import { useId } from "react";

import { DifficultyBadge } from "./difficulty-badge";
import { useMessages } from "@/lib/i18n/provider";
import { SCENARIOS } from "@/lib/simulation/scenarios";
import type { ScenarioId } from "@/lib/simulation/types";
import { FIRST_SCORED_SCENARIO, SCENARIO_DIFFICULTY_GROUPS } from "@/lib/onboarding/scenario-guidance";

interface ScenarioSelectorProps {
  value: ScenarioId;
  disabled: boolean;
  onChange: (scenario: ScenarioId) => void;
}

const ICONS: Record<ScenarioId, ComponentType<{ "aria-hidden"?: boolean }>> = {
  normal: Activity,
  "feed-step": MoveDown,
  "water-rich-slug": Waves,
  "oil-outlet-restriction": Gauge,
  "slow-water-dump": Droplets,
  "noisy-interface": RadioTower,
  "gor-surge": Flame,
};

export function ScenarioSelector({ value, disabled, onChange }: ScenarioSelectorProps) {
  const messages = useMessages();
  const copy = messages.challenge.scenarioSelector;
  const instanceId = useId().replaceAll(":", "");
  const groupName = `${instanceId}-scenario`;
  return (
    <fieldset className="scenario-selector" data-tour="scenario-selector" disabled={disabled}>
      <legend>
        <span className="eyebrow">{copy.eyebrow}</span>
        {copy.legend}
      </legend>
      <div className="scenario-scroll">
        {SCENARIO_DIFFICULTY_GROUPS.map((group) => {
          const scenarios = group.scenarioIds.map((id) => SCENARIOS.find((scenario) => scenario.id === id)!);
          const difficultyLabel = messages.challenge.difficulty[group.id];
          return <section aria-label={copy.groupLabel(difficultyLabel)} className="scenario-group" key={group.id}>
            <h2>{difficultyLabel}</h2><div className="scenario-group__cards">{scenarios.map((scenario) => {
          const Icon = ICONS[scenario.id];
          const scenarioCopy = messages.simulation.scenario[scenario.id];
          return (
            <label
              htmlFor={`${instanceId}-scenario-${scenario.id}`}
              className={`scenario-card ${value === scenario.id ? "is-selected" : ""}`}
              key={scenario.id}
            >
              <input
                checked={value === scenario.id}
                id={`${instanceId}-scenario-${scenario.id}`}
                name={groupName}
                type="radio"
                value={scenario.id}
                onChange={() => onChange(scenario.id)}
              />
              <span className="scenario-icon"><Icon aria-hidden /></span>
              <span className="scenario-copy">
                <strong>{scenarioCopy.name}</strong>
                <DifficultyBadge scenarioId={scenario.id} />
                {scenario.id === FIRST_SCORED_SCENARIO ? <b>{copy.startHere}</b> : null}
                <span>{scenarioCopy.description}</span>
              </span>
            </label>
          );
            })}</div>
          </section>;
        })}
      </div>
    </fieldset>
  );
}
