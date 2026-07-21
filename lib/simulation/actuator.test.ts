import { describe, expect, it } from "vitest";

import { stepActuator } from "./actuator";

describe("valve actuator", () => {
  it("applies first-order lag", () => {
    const next = stepActuator(50, 100, 1, 3, 20);
    expect(next).toBeGreaterThan(50);
    expect(next).toBeLessThan(70);
  });

  it("respects the physical stroke-rate limit", () => {
    expect(stepActuator(0, 100, 1, 0, 20)).toBe(20);
  });

  it("stays inside physical bounds", () => {
    expect(stepActuator(99, 200, 1, 0, 20)).toBe(100);
    expect(stepActuator(1, -100, 1, 0, 20)).toBe(0);
  });
});
