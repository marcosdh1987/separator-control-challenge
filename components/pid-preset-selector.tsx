"use client";

import { PID_PRESETS } from "@/lib/onboarding/presets";
import type { DualPidConfig } from "@/lib/simulation/types";

interface PidPresetSelectorProps {
  disabled: boolean;
  onChange: (config: DualPidConfig) => void;
}

export function PidPresetSelector({ disabled, onChange }: PidPresetSelectorProps) {
  return (
    <fieldset className="pid-preset-selector" disabled={disabled}>
      <legend>PID presets</legend>
      <div>
        {PID_PRESETS.map((preset) => (
          <button aria-label={`${preset.name} preset`} className="preset-button" key={preset.id} type="button" onClick={() => onChange(preset.config)}>
            <strong>{preset.label}</strong><span>{preset.guidance}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
