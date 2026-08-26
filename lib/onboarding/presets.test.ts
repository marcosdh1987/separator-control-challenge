import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AGGRESSIVE_PID_PRESET,
  BALANCED_PID_PRESET,
  CONSERVATIVE_PID_PRESET,
  PID_PRESETS,
  P_ONLY_PID_PRESET,
  TEACHING_PID_PRESETS,
  teachingPreset,
} from "@/lib/onboarding/presets";
import { messagesFor } from "@/lib/i18n/test-utils";
import { DEFAULT_DUAL_PID } from "@/lib/simulation/types";
import { sanitizeDualPidConfig } from "@/lib/simulation/validation";

describe("onboarding PID presets", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/simulation/types");
    vi.resetModules();
  });

  it("exports the deterministic presets in UI order, identified without copy", () => {
    expect(PID_PRESETS.map((preset) => preset.id)).toEqual([
      "balanced",
      "conservative",
      "aggressive",
    ]);
    expect(Object.keys(BALANCED_PID_PRESET)).toEqual(["id", "config"]);
  });

  it.each(["en", "es"] as const)("labels every preset in %s", (locale) => {
    const { preset } = messagesFor(locale).onboarding;

    for (const { id } of PID_PRESETS) {
      expect(preset[id].label).toEqual(expect.any(String));
      expect(preset[id].guidance).toEqual(expect.any(String));
    }
  });

  it("keeps the Balanced preset semantically identical to the approved defaults", () => {
    expect(BALANCED_PID_PRESET.config).toEqual(DEFAULT_DUAL_PID);
    expect(BALANCED_PID_PRESET.config.interface).toEqual(DEFAULT_DUAL_PID.interface);
    expect(BALANCED_PID_PRESET.config.interface).not.toBe(DEFAULT_DUAL_PID.interface);
  });

  it.each(PID_PRESETS)("provides a fully valid $id configuration", ({ config }) => {
    expect(sanitizeDualPidConfig(config)).toEqual(config);
  });

  it("makes Conservative less responsive and Aggressive more responsive than Balanced", () => {
    for (const loop of ["total", "interface"] as const) {
      expect(CONSERVATIVE_PID_PRESET.config[loop].kp).toBeLessThan(
        BALANCED_PID_PRESET.config[loop].kp,
      );
      expect(CONSERVATIVE_PID_PRESET.config[loop].ki).toBeLessThan(
        BALANCED_PID_PRESET.config[loop].ki,
      );
      expect(AGGRESSIVE_PID_PRESET.config[loop].kp).toBeGreaterThan(
        BALANCED_PID_PRESET.config[loop].kp,
      );
      expect(AGGRESSIVE_PID_PRESET.config[loop].ki).toBeGreaterThan(
        BALANCED_PID_PRESET.config[loop].ki,
      );
    }
  });

  it("does not share mutable PID configuration references", () => {
    expect(BALANCED_PID_PRESET.config).not.toBe(DEFAULT_DUAL_PID);
    expect(BALANCED_PID_PRESET.config.total).not.toBe(DEFAULT_DUAL_PID.total);
    expect(BALANCED_PID_PRESET.config.interface).not.toBe(DEFAULT_DUAL_PID.interface);
    expect(BALANCED_PID_PRESET.config.total).not.toBe(BALANCED_PID_PRESET.config.interface);
    expect(CONSERVATIVE_PID_PRESET.config.total).not.toBe(AGGRESSIVE_PID_PRESET.config.total);
  });

  it("keeps the untuned P-only preset out of the onboarding selector", () => {
    expect(PID_PRESETS.map((preset) => preset.id)).not.toContain("p-only");
    expect(TEACHING_PID_PRESETS.map((preset) => preset.id)).toEqual(["p-only"]);
    expect(teachingPreset("p-only")).toBe(P_ONLY_PID_PRESET);
  });

  it("gives P-only proportional action alone, at the Balanced Kp", () => {
    for (const loop of ["total", "interface"] as const) {
      expect(P_ONLY_PID_PRESET.config[loop].ki).toBe(0);
      expect(P_ONLY_PID_PRESET.config[loop].kd).toBe(0);
      // A one-variable experiment against Balanced: only the terms change.
      expect(P_ONLY_PID_PRESET.config[loop].kp).toBe(BALANCED_PID_PRESET.config[loop].kp);
    }
  });

  it("keeps the P-only preset a valid configuration the engine will accept", () => {
    expect(sanitizeDualPidConfig(P_ONLY_PID_PRESET.config)).toEqual(
      P_ONLY_PID_PRESET.config,
    );
  });

  it("builds each Balanced loop from its corresponding dual-loop default", async () => {
    vi.resetModules();
    vi.doMock("@/lib/simulation/types", async () => {
      const actual = await vi.importActual<typeof import("@/lib/simulation/types")>(
        "@/lib/simulation/types",
      );

      return {
        ...actual,
        DEFAULT_DUAL_PID: {
          total: { ...actual.DEFAULT_DUAL_PID.total, kp: 1.25, ki: 0.02 },
          interface: { ...actual.DEFAULT_DUAL_PID.interface, kp: 8.75, ki: 0.22 },
        },
      };
    });

    const { BALANCED_PID_PRESET: divergentBalancedPreset } = await import(
      "@/lib/onboarding/presets"
    );

    expect(divergentBalancedPreset.config.total).toMatchObject({ kp: 1.25, ki: 0.02 });
    expect(divergentBalancedPreset.config.interface).toMatchObject({ kp: 8.75, ki: 0.22 });
  });
});
