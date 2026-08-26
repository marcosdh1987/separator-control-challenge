"use client";

import { useMessages } from "@/lib/i18n/provider";
import { PID_PRESETS } from "@/lib/onboarding/presets";
import type { DualPidConfig } from "@/lib/simulation/types";

interface PidPresetSelectorProps {
  disabled: boolean;
  onChange: (config: DualPidConfig) => void;
}

export function PidPresetSelector({ disabled, onChange }: PidPresetSelectorProps) {
  const messages = useMessages();
  const copy = messages.onboarding;
  return (
    <fieldset className="pid-preset-selector" disabled={disabled}>
      <legend>{messages.challenge.transport.presetLegend}</legend>
      <div>
        {PID_PRESETS.map((preset) => {
          const presetCopy = copy.preset[preset.id];
          return (
            <button
              aria-label={copy.presetOptionLabel(presetCopy.label)}
              className="preset-button"
              key={preset.id}
              type="button"
              onClick={() => onChange(preset.config)}
            >
              <strong>{presetCopy.label}</strong><span>{presetCopy.guidance}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
