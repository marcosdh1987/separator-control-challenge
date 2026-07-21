import { describe, expect, it } from "vitest";

import {
  fullCylinderVolume,
  horizontalLevelFromVolume,
  horizontalVolumeFromLevel,
} from "./geometry";

describe("horizontal vessel geometry", () => {
  it("maps a half-full cylinder to half its total volume", () => {
    const full = fullCylinderVolume(1.2, 3);
    expect(horizontalVolumeFromLevel(50, 1.2, 3)).toBeCloseTo(full / 2, 10);
  });

  it("round-trips level through volume", () => {
    for (const level of [0, 10, 37.5, 50, 82, 100]) {
      const volume = horizontalVolumeFromLevel(level, 1.2, 3);
      expect(horizontalLevelFromVolume(volume, 1.2, 3)).toBeCloseTo(level, 6);
    }
  });
});
