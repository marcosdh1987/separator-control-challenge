import { describe, expect, it } from "vitest";

import {
  FRONT_SHELL_THETA,
  REAR_SHELL_THETA,
  shellSectorMidpoint,
} from "./vessel-geometry";

describe("separator cutaway geometry", () => {
  it("places the transparent inspection half on camera-facing world +Z", () => {
    expect(FRONT_SHELL_THETA).toEqual({ start: -Math.PI / 2, length: Math.PI });
    expect(shellSectorMidpoint(FRONT_SHELL_THETA, 0.63)).toEqual(
      expect.objectContaining({ z: expect.any(Number) }),
    );
    expect(shellSectorMidpoint(FRONT_SHELL_THETA, 0.63).z).toBeCloseTo(0.63, 12);
    expect(shellSectorMidpoint(FRONT_SHELL_THETA, 0.63).normalZ).toBeCloseTo(1, 12);
  });

  it("places the opaque structural half on world -Z after the X-axis rotation", () => {
    expect(REAR_SHELL_THETA).toEqual({ start: Math.PI / 2, length: Math.PI });
    expect(shellSectorMidpoint(REAR_SHELL_THETA, 0.63).z).toBeCloseTo(-0.63, 12);
    expect(shellSectorMidpoint(REAR_SHELL_THETA, 0.63).normalZ).toBeCloseTo(-1, 12);
  });
});
