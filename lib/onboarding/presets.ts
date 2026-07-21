import type { PidConfig } from "@/lib/simulation/types";
import { DEFAULT_DUAL_PID } from "@/lib/simulation/types";

import type { PidPreset } from "@/lib/onboarding/types";

function createPidConfig(source: PidConfig, overrides: Partial<PidConfig> = {}): PidConfig {
  return Object.freeze({ ...source, ...overrides });
}

function createPreset(
  preset: Omit<PidPreset, "config"> & {
    config: { total: Partial<PidConfig>; interface: Partial<PidConfig> };
  },
): PidPreset {
  return Object.freeze({
    ...preset,
    config: Object.freeze({
      total: createPidConfig(DEFAULT_DUAL_PID.total, preset.config.total),
      interface: createPidConfig(DEFAULT_DUAL_PID.interface, preset.config.interface),
    }),
  });
}

export const BALANCED_PID_PRESET = createPreset({
  id: "balanced",
  name: "Balanced",
  label: "Balanced",
  guidance: "A reliable starting point for both level loops.",
  config: { total: {}, interface: {} },
});

export const CONSERVATIVE_PID_PRESET = createPreset({
  id: "conservative",
  name: "Conservative",
  label: "Conservative",
  guidance: "Gentler corrections with less valve movement.",
  config: {
    total: { kp: 2.8, ki: 0.04 },
    interface: { kp: 2.8, ki: 0.04 },
  },
});

export const AGGRESSIVE_PID_PRESET = createPreset({
  id: "aggressive",
  name: "Aggressive",
  label: "Aggressive",
  guidance: "Faster corrections, with more risk of oscillation.",
  config: {
    total: { kp: 5.6, ki: 0.12 },
    interface: { kp: 5.6, ki: 0.12 },
  },
});

export const PID_PRESETS: readonly PidPreset[] = Object.freeze([
  BALANCED_PID_PRESET,
  CONSERVATIVE_PID_PRESET,
  AGGRESSIVE_PID_PRESET,
]);
