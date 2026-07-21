import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AGGRESSIVE_PID_PRESET,
  BALANCED_PID_PRESET,
  CONSERVATIVE_PID_PRESET,
  PID_PRESETS,
} from "@/lib/onboarding/presets";
import { DEFAULT_DUAL_PID } from "@/lib/simulation/types";
import { sanitizeDualPidConfig } from "@/lib/simulation/validation";

describe("onboarding PID presets", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/simulation/types");
    vi.resetModules();
  });

  it("exports the named deterministic presets in UI order", () => {
    expect(PID_PRESETS.map((preset) => preset.name)).toEqual([
      "Balanced",
      "Conservative",
      "Aggressive",
    ]);
    expect(BALANCED_PID_PRESET).toMatchObject({
      id: "balanced",
      label: "Balanced",
      guidance: expect.any(String),
    });
  });

  it("keeps the Balanced preset semantically identical to the approved defaults", () => {
    expect(BALANCED_PID_PRESET.config).toEqual(DEFAULT_DUAL_PID);
    expect(BALANCED_PID_PRESET.config.interface).toEqual(DEFAULT_DUAL_PID.interface);
    expect(BALANCED_PID_PRESET.config.interface).not.toBe(DEFAULT_DUAL_PID.interface);
  });

  it.each(PID_PRESETS)("provides a fully valid $name configuration", ({ config }) => {
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
