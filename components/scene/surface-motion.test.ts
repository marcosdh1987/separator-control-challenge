import { describe, expect, it } from "vitest";

import { decaySurfaceAmplitude, surfaceImpulse } from "./surface-motion";

describe("phase surface motion", () => {
  it("creates a bounded impulse from level rate and feed disturbance", () => {
    expect(surfaceImpulse({ levelRatePctS: 0, totalFeedM3H: 50 })).toBe(0);
    expect(surfaceImpulse({ levelRatePctS: 4, totalFeedM3H: 110 })).toBeGreaterThan(0);
    expect(surfaceImpulse({ levelRatePctS: 1e9, totalFeedM3H: 1e9 })).toBeLessThanOrEqual(1);
  });

  it("rejects non-finite process inputs", () => {
    expect(surfaceImpulse({ levelRatePctS: Number.NaN, totalFeedM3H: Number.POSITIVE_INFINITY })).toBe(0);
  });

  it("decays exponentially and stays finite", () => {
    expect(decaySurfaceAmplitude(0.8, 0)).toBeCloseTo(0.8);
    expect(decaySurfaceAmplitude(0.8, 1)).toBeLessThan(0.8);
    expect(decaySurfaceAmplitude(0.8, 10)).toBeGreaterThanOrEqual(0);
    expect(decaySurfaceAmplitude(Number.NaN, 1)).toBe(0);
  });
});
