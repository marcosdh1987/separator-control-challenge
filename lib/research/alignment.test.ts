import { describe, expect, it } from "vitest";

import { alignRuns, commonPhases, compatibility, toRunTime } from "@/lib/research/alignment";
import { decodeReplay } from "@/lib/research/decode";
import { decimateMinMax, toSteps } from "@/lib/research/decimate";
import { makeReplayDoc } from "@/lib/research/test-fixtures";

const early = decodeReplay(makeReplayDoc({ count: 21, holdStartS: 6 }));
const lateDoc = makeReplayDoc({ count: 31, holdStartS: 13 });
lateDoc.replayId = "test-dataset/late-run";
lateDoc.run.variantId = "tuned";
const late = decodeReplay(lateDoc);

describe("aligning runs", () => {
  it("aligns on a phase and reports every shift explicitly", () => {
    const alignment = alignRuns([early, late], { kind: "phase", phase: "hold" });
    expect(alignment.runs.map((run) => run.anchorS)).toEqual([6, 13]);
    expect(alignment.runs.map((run) => run.shiftS)).toEqual([0, -7]);
    // Comparison time counts from eng_dacs' phase origin (the tick before the
    // phase): the first hold tick of each run sits at 1 s on the axis.
    expect(toRunTime(alignment.runs[0], 1)).toBe(6);
    expect(toRunTime(alignment.runs[1], 1)).toBe(13);
    expect(alignment.minS).toBe(1 - 12);
    expect(alignment.maxS).toBe(Math.max(21 - 5, 31 - 12));
    expect(alignment.missingAnchor).toEqual([]);
  });

  it("leaves a run without the anchor unaligned and names it", () => {
    const alignment = alignRuns([early, late], { kind: "phase", phase: "step_water" });
    expect(alignment.missingAnchor).toEqual([early.id, late.id]);
    expect(alignment.runs.every((run) => run.shiftS === 0)).toBe(true);
  });

  it("offers only phases every run contains", () => {
    expect(commonPhases([early, late])).toEqual(["steady", "hold"]);
  });

  it("calls runs paired only when scenario and seed match", () => {
    expect(compatibility([early, late]).paired).toBe(true);
    const otherDoc = makeReplayDoc();
    otherDoc.run.seed = 7201;
    expect(compatibility([early, decodeReplay(otherDoc)])).toMatchObject({ paired: false, sameSeed: false, sameScenario: true });
  });
});

describe("chart decimation", () => {
  const n = 16_000;
  const times = Float64Array.from({ length: n }, (_, i) => i);
  const values = Float64Array.from({ length: n }, (_, i) => Math.sin(i / 50));
  values[8_000] = 7; // a one-sample spike must survive

  it("keeps every extreme of a long run", () => {
    const series = decimateMinMax(times, values, 0, n, 300);
    const drawn = series.filter((p): p is { t: number; v: number } => p !== null);
    expect(drawn.length).toBeLessThanOrEqual(4 * 300);
    expect(Math.max(...drawn.map((p) => p.v))).toBe(7);
    expect(Math.min(...drawn.map((p) => p.v))).toBeCloseTo(-1, 3);
  });

  it("breaks the line at gaps instead of bridging them", () => {
    const gappy = Float64Array.from([1, 2, Number.NaN, 4, 5]);
    const series = decimateMinMax(Float64Array.from([0, 1, 2, 3, 4]), gappy, 0, 4, 5);
    expect(series).toContain(null);
  });

  it("draws held signals as steps", () => {
    expect(toSteps([{ t: 0, v: 1 }, { t: 1, v: 2 }])).toEqual([{ t: 0, v: 1 }, { t: 1, v: 1 }, { t: 1, v: 2 }]);
  });

  it("decimates a 4 h run quickly", () => {
    const started = performance.now();
    for (let i = 0; i < 20; i += 1) decimateMinMax(times, values, 0, n, 600);
    expect((performance.now() - started) / 20).toBeLessThan(25);
  });
});
