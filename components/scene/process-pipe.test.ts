import { describe, expect, it } from "vitest";

import {
  advanceFlowPhase,
  flowInstanceDistance,
  PIPE_DIAGNOSTIC_DIRTY,
  PIPE_MATRICES_DIRTY,
  pipeFrameUpdateFlags,
  visiblePulseCount,
} from "./process-pipe";

describe("process pipe motion", () => {
  it("moves canonical positive and negative flow in opposite semantic directions", () => {
    expect(flowInstanceDistance(0.2, 0.1, 1)).toBeCloseTo(0.3);
    expect(flowInstanceDistance(0.2, 0.1, -1)).toBeCloseTo(0.7);
    expect(flowInstanceDistance(0.2, 0.1, 0)).toBeCloseTo(0.3);
  });

  it("advances only while motion is permitted and resumes without a clock jump", () => {
    const running = advanceFlowPhase(0.2, 0.5, 0.4, true);
    expect(running).toBeCloseTo(0.4);
    expect(advanceFlowPhase(running, 30, 0.4, false)).toBeCloseTo(running);
    expect(advanceFlowPhase(running, 0.5, 0.4, true)).toBeCloseTo(0.6);
  });

  it("uses no markers for zero flow and scales a bounded pool with visible flow", () => {
    expect(visiblePulseCount(0, 10)).toBe(0);
    expect(visiblePulseCount(0.21, 10)).toBe(3);
    expect(visiblePulseCount(1, 10)).toBe(10);
    expect(visiblePulseCount(Number.NaN, 10)).toBe(0);
  });

  it("skips frozen repeated frames and performs one truthful update when motion resumes", () => {
    expect(pipeFrameUpdateFlags(true, 0.42, 5, 1, false, 0.42, 5, 1, false)).toBe(0);
    expect(pipeFrameUpdateFlags(true, 0.42, 5, 1, false, 0.43, 5, 1, true)).toBe(
      PIPE_MATRICES_DIRTY | PIPE_DIAGNOSTIC_DIRTY,
    );
    expect(pipeFrameUpdateFlags(true, 0.42, 5, 1, false, 0.42, 0, 1, false)).toBe(PIPE_MATRICES_DIRTY);
    expect(pipeFrameUpdateFlags(true, 0.42, 5, 1, false, 0.42, 5, 1, true)).toBe(PIPE_DIAGNOSTIC_DIRTY);
    expect(pipeFrameUpdateFlags(false, 0, 0, 0, false, 0.42, 5, 1, true)).toBe(
      PIPE_MATRICES_DIRTY | PIPE_DIAGNOSTIC_DIRTY,
    );
  });
});
