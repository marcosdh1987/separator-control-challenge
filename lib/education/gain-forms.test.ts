import { describe, expect, it } from "vitest";

import { DEFAULT_PID } from "@/lib/simulation/types";
import {
  formatStandardValue,
  OFF_SYMBOL,
  toParallelForm,
  toStandardForm,
} from "./gain-forms";

describe("gain form conversion", () => {
  it("converts the default tuning to the form a panel shows", () => {
    const standard = toStandardForm(DEFAULT_PID);
    // Kp 4 is a 25% band; Ki 0.08 with Kp 4 is a 50-second reset; Kd 8 is 2 seconds.
    expect(standard.proportionalBandPct).toBeCloseTo(25, 10);
    expect(standard.integralTimeS).toBeCloseTo(50, 10);
    expect(standard.derivativeTimeS).toBeCloseTo(2, 10);
  });

  it("round-trips a tuning without drift", () => {
    for (const gains of [
      { kp: 4, ki: 0.08, kd: 8 },
      { kp: 0.5, ki: 0.01, kd: 0 },
      { kp: 9.7, ki: 0.29, kd: 27.3 },
    ]) {
      const back = toParallelForm(toStandardForm(gains));
      expect(back.kp).toBeCloseTo(gains.kp, 10);
      expect(back.ki).toBeCloseTo(gains.ki, 10);
      expect(back.kd).toBeCloseTo(gains.kd, 10);
    }
  });

  it("shows a switched-off term as an infinite time, the way a panel does", () => {
    const standard = toStandardForm({ kp: 4, ki: 0, kd: 0 });
    expect(standard.integralTimeS).toBe(Number.POSITIVE_INFINITY);
    expect(standard.derivativeTimeS).toBe(0);
    expect(formatStandardValue(standard.integralTimeS)).toBe(OFF_SYMBOL);

    // And converting back must leave integral action off, not produce a tiny Ki.
    expect(toParallelForm(standard).ki).toBe(0);
  });

  it("treats a zero proportional gain as an infinitely wide band", () => {
    const standard = toStandardForm({ kp: 0, ki: 0.1, kd: 5 });
    expect(standard.proportionalBandPct).toBe(Number.POSITIVE_INFINITY);
    // With no proportional gain there is no reset time to speak of either.
    expect(standard.integralTimeS).toBe(Number.POSITIVE_INFINITY);

    const parallel = toParallelForm(standard);
    expect(parallel.kp).toBe(0);
    expect(parallel.ki).toBe(0);
    expect(parallel.kd).toBe(0);
  });

  it("survives non-finite input rather than producing NaN gains", () => {
    const standard = toStandardForm({
      kp: Number.NaN,
      ki: Number.POSITIVE_INFINITY,
      kd: Number.NaN,
    });
    expect(Number.isNaN(standard.proportionalBandPct)).toBe(false);
    const parallel = toParallelForm(standard);
    for (const value of Object.values(parallel)) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it("makes a narrower band a stronger controller", () => {
    // The direction confuses newcomers: a smaller band is more gain, not less.
    const strong = toParallelForm({ proportionalBandPct: 10, integralTimeS: 60, derivativeTimeS: 0 });
    const weak = toParallelForm({ proportionalBandPct: 200, integralTimeS: 60, derivativeTimeS: 0 });
    expect(strong.kp).toBeGreaterThan(weak.kp);
  });
});
