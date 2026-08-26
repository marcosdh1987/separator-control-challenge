import type { DualPidConfig, PidConfig } from "@/lib/simulation/types";
import { DEFAULT_DUAL_PID } from "@/lib/simulation/types";

import type {
  AnyPresetId,
  PidPreset,
  TeachingPreset,
  TeachingPresetId,
} from "@/lib/onboarding/types";

function createPidConfig(source: PidConfig, overrides: Partial<PidConfig> = {}): PidConfig {
  return Object.freeze({ ...source, ...overrides });
}

function createPreset<Id extends AnyPresetId>(
  id: Id,
  config: { total: Partial<PidConfig>; interface: Partial<PidConfig> },
): { id: Id; config: DualPidConfig } {
  return Object.freeze({
    id,
    config: Object.freeze({
      total: createPidConfig(DEFAULT_DUAL_PID.total, config.total),
      interface: createPidConfig(DEFAULT_DUAL_PID.interface, config.interface),
    }),
  });
}

export const BALANCED_PID_PRESET: PidPreset = createPreset("balanced", {
  total: {},
  interface: {},
});

export const CONSERVATIVE_PID_PRESET: PidPreset = createPreset("conservative", {
  total: { kp: 2.8, ki: 0.04 },
  interface: { kp: 2.8, ki: 0.04 },
});

export const AGGRESSIVE_PID_PRESET: PidPreset = createPreset("aggressive", {
  total: { kp: 5.6, ki: 0.12 },
  interface: { kp: 5.6, ki: 0.12 },
});

/**
 * Proportional action alone: the demonstration of permanent offset.
 *
 * Kp is left at the Balanced value on purpose. A trainee who compares this run
 * against Balanced is then looking at a **one-variable experiment** — the golden
 * rule the learning panel teaches — so the difference they see cannot be blamed on
 * a different response speed. The loop still corrects, still moves at the same
 * pace, and still stops short of setpoint, because with Ki = 0 the only term that
 * can hold the valve away from its bias is the error itself: the valve needs a
 * standing error to hold a standing correction, and the offset is exactly that
 * error. Kd = 0 as well, so nothing damps the response and confuses the lesson —
 * and because derivative on a noisy level measurement teaches a different lesson
 * altogether.
 *
 * Deliberately not part of `PID_PRESETS`: it is a teaching device the coach hands
 * out, not a starting point the onboarding selector should recommend.
 */
export const P_ONLY_PID_PRESET: TeachingPreset = createPreset("p-only", {
  total: { ki: 0, kd: 0 },
  interface: { ki: 0, kd: 0 },
});

/** UI order: the safe default first, then the two deliberate departures from it. */
export const PID_PRESETS: readonly PidPreset[] = Object.freeze([
  BALANCED_PID_PRESET,
  CONSERVATIVE_PID_PRESET,
  AGGRESSIVE_PID_PRESET,
]);

/** Presets the control coach can propose to demonstrate a failure mode. */
export const TEACHING_PID_PRESETS: readonly TeachingPreset[] = Object.freeze([
  P_ONLY_PID_PRESET,
]);

export function teachingPreset(id: TeachingPresetId): TeachingPreset {
  const preset = TEACHING_PID_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Unknown teaching preset: ${id}`);
  return preset;
}
