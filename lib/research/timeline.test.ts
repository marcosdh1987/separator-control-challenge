import { describe, expect, it } from "vitest";

import { decodeReplay } from "@/lib/research/decode";
import { makeReplayDoc } from "@/lib/research/test-fixtures";
import { frameAt, locate, peakToPeak, phaseAt, phaseOriginS, sampleSignal, windowValues } from "@/lib/research/timeline";

const replay = decodeReplay(makeReplayDoc());

describe("reading a recording at any instant", () => {
  it("returns the recorded value, marked observed, on a tick", () => {
    expect(sampleSignal(replay, "level.total.truth", 3)).toEqual({ value: 52, provenance: "observed" });
  });

  it("interpolates a continuous physical state linearly between ticks", () => {
    const sample = sampleSignal(replay, "level.total.truth", 3.25);
    expect(sample.provenance).toBe("interpolated");
    expect(sample.value).toBeCloseTo(52.25, 12);
  });

  it("holds a register value between ticks instead of interpolating it", () => {
    expect(sampleSignal(replay, "valve.oil.command", 2.9)).toEqual({ value: 10, provenance: "held" });
  });

  it("holds a setpoint step until the next tick (no ramp across a step)", () => {
    // The step happens at index 5 (t = 6 s); just before it the old value holds.
    expect(sampleSignal(replay, "loop.oil.sp", 5.99)).toEqual({ value: 50, provenance: "held" });
    expect(sampleSignal(replay, "loop.oil.sp", 6)).toEqual({ value: 55, provenance: "observed" });
  });

  it("never bridges a gap: a missing neighbour makes the value missing", () => {
    // valve.oil.command is null at index 3 (t = 4 s).
    expect(sampleSignal(replay, "valve.oil.command", 4).provenance).toBe("missing");
    expect(sampleSignal(replay, "valve.oil.command", 4.5).provenance).toBe("missing");
  });

  it("returns missing outside the recording, never an extrapolation", () => {
    expect(sampleSignal(replay, "level.total.truth", 0).provenance).toBe("missing");
    expect(sampleSignal(replay, "level.total.truth", 12).provenance).toBe("missing");
    expect(locate(replay, Number.NaN).inRange).toBe(false);
  });

  it("labels a whole frame by where it falls", () => {
    expect(frameAt(replay, 5, ["level.total.truth"]).provenance).toBe("observed");
    expect(frameAt(replay, 5.5, ["level.total.truth"]).provenance).toBe("interpolated");
    expect(frameAt(replay, 50, ["level.total.truth"]).provenance).toBe("missing");
  });

  it("reports the phase of the tick at or before the instant", () => {
    expect(phaseAt(replay.phases, 4.9)).toBe("steady");
    expect(phaseAt(replay.phases, 5)).toBe("hold");
    expect(frameAt(replay, 5.5, []).phase).toBe("hold");
  });

  it("uses eng_dacs' phase origin: the tick before the phase's first tick", () => {
    expect(phaseOriginS(replay, "hold")).toBe(4);
    expect(phaseOriginS(replay, "absent")).toBeNull();
  });

  it("reads closed windows of recorded values and their peak to peak", () => {
    const values = windowValues(replay, "level.total.truth", 2, 4);
    expect(Array.from(values)).toEqual([51, 52, 53]);
    expect(peakToPeak(values)).toBe(2);
    // [20, NaN, 40]: the gap is skipped, not treated as zero.
    expect(peakToPeak(windowValues(replay, "valve.oil.command", 3, 5))).toBe(20);
  });

  it("does not modify the stored data when sampled", () => {
    const before = Array.from(replay.signals.get("level.total.truth")!.data);
    for (let t = 0; t < 12; t += 0.37) sampleSignal(replay, "level.total.truth", t);
    expect(Array.from(replay.signals.get("level.total.truth")!.data)).toEqual(before);
  });
});
