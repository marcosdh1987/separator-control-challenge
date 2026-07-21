"use client";

import { Activity, Droplets, Gauge, MoveDown, RadioTower, Waves } from "lucide-react";
import type { ComponentType } from "react";
import { useId } from "react";

import { SCENARIOS } from "@/lib/simulation/scenarios";
import type { ScenarioId } from "@/lib/simulation/types";

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
};

export function ScenarioSelector({ value, disabled, onChange }: ScenarioSelectorProps) {
  const instanceId = useId().replaceAll(":", "");
  const groupName = `${instanceId}-scenario`;
  return (
    <fieldset className="scenario-selector" disabled={disabled}>
      <legend>
        <span className="eyebrow">Challenge deck</span>
        Select disturbance scenario
      </legend>
      <div className="scenario-scroll">
        {SCENARIOS.map((scenario) => {
          const Icon = ICONS[scenario.id];
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
                <strong>{scenario.name}</strong>
                <small>{scenario.difficulty}</small>
                <span>{scenario.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
