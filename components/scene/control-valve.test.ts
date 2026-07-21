import { describe, expect, it } from "vitest";

import { createValveOrientation, createValvePose } from "./control-valve";

describe("control valve pose", () => {
  it("clamps actual opening and maps it to a clear quarter-turn disk", () => {
    expect(createValvePose(-1)).toEqual({ openFraction: 0, diskAngleRad: 0, stemLiftM: 0 });
    expect(createValvePose(0.5)).toEqual({ openFraction: 0.5, diskAngleRad: Math.PI / 4, stemLiftM: 0.045 });
    expect(createValvePose(2)).toEqual({ openFraction: 1, diskAngleRad: Math.PI / 2, stemLiftM: 0.09 });
    expect(createValvePose(Number.NaN)).toEqual({ openFraction: 0, diskAngleRad: 0, stemLiftM: 0 });
  });

  it("aligns the body with an X-axis pipe while the disk turns around the vertical stem", () => {
    expect(createValveOrientation(createValvePose(0))).toEqual({
      bodyRotation: [0, 0, -Math.PI / 2],
      diskRotation: [0, 0, -Math.PI / 2],
    });
    expect(createValveOrientation(createValvePose(1))).toEqual({
      bodyRotation: [0, 0, -Math.PI / 2],
      diskRotation: [0, Math.PI / 2, -Math.PI / 2],
    });
  });
});
