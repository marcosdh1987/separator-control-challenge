import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SIGNAL_KEYS, SIGNAL_SPECS, validateEnvelope, validateIndex, validateReplay } from "@/lib/research/contract";
import { makeReplayDoc } from "@/lib/research/test-fixtures";

describe("research contract", () => {
  it("matches the signal table of the Python exporter exactly", () => {
    // Drift guard across languages: the producer and the consumer must agree on
    // every key, its source column and whether it may be interpolated.
    const source = readFileSync(resolve(process.cwd(), "src/separator_control_challenge/research_export/contract.py"), "utf8");
    const pattern = /SignalSpec\(\s*"([^"]+)",\s*"([^"]+)",\s*"(continuous|discrete)"/g;
    const python = [...source.matchAll(pattern)].map(([, key, column, role]) => ({ key, column, role }));
    expect(python.length).toBe(SIGNAL_KEYS.length);
    for (const { key, column, role } of python) {
      expect(SIGNAL_SPECS[key as keyof typeof SIGNAL_SPECS]).toMatchObject({ column, role });
    }
  });

  it("only lets physical states be interpolated", () => {
    const continuous = SIGNAL_KEYS.filter((key) => SIGNAL_SPECS[key].role === "continuous");
    expect(continuous.every((key) => key.endsWith(".truth"))).toBe(true);
    expect(continuous).not.toContain("valve.oil.stem");
    expect(continuous).not.toContain("loop.oil.sp");
  });

  it("accepts a valid replay", () => {
    expect(validateReplay(makeReplayDoc())).toEqual([]);
  });

  const mutations: [string, (doc: ReturnType<typeof makeReplayDoc>) => void, string][] = [
    ["wrong schema", (d) => Object.assign(d, { schema: "other" }), "schema"],
    ["future major version", (d) => Object.assign(d, { schemaVersion: 2 }), "schemaVersion"],
    ["inconsistent end time", (d) => { d.time.endS += 3; }, "endS"],
    ["too few samples", (d) => { d.signals[0].values = [1, 2]; }, "dense values"],
    ["text instead of a number", (d) => { (d.signals[0].values as unknown[])[0] = "50"; }, "numbers"],
    ["interpolated register", (d) => { d.signals[1].interpolation = "linear"; }, "interpolation"],
    ["held physical state", (d) => { d.signals[0].interpolation = "hold"; }, "interpolation"],
    ["invented signal", (d) => { (d.signals[0] as { key: string }).key = "level.made_up"; }, "unknown key"],
    ["renamed source column", (d) => { d.signals[0].originalName = "x"; }, "originalName"],
    ["decreasing change points", (d) => { d.signals[2].changes = [[0, 1], [5, 2], [3, 1]]; }, "increase"],
    ["change list not starting at 0", (d) => { d.signals[2].changes = [[2, 1]]; }, "first change"],
    ["overlapping phases", (d) => { d.phases[1].startS = d.phases[0].endS; }, "overlap"],
    ["event outside the run", (d) => { d.events[0].tS = 9999; }, "outside"],
    ["unknown event kind", (d) => { (d.events[0] as { kind: string }).kind = "guess"; }, "event kind"],
    ["unknown evidence stage", (d) => { (d.evidence as { stage: string }).stage = "certain"; }, "stage"],
    ["malformed hash", (d) => { d.source.configSha256Raw = "123"; }, "SHA-256"],
    ["present and missing", (d) => { d.missingSignals.push({ key: "level.total.truth", originalName: "x", reason: "x" }); }, "both present"],
  ];

  it.each(mutations)("rejects a replay with %s", (_name, mutate, message) => {
    const doc = makeReplayDoc();
    mutate(doc);
    const errors = validateReplay(doc);
    expect(errors.some((error) => error.includes(message))).toBe(true);
  });

  it("rejects index paths that leave the data folder", () => {
    const index = { schema: "scc.research-index", schemaVersion: 1, files: [{ id: "x", path: "../secret.json" }], pending: [] };
    expect(validateIndex(index)).toContain("file x: path must stay inside the data folder");
  });

  it("rejects envelope points on undeclared axes", () => {
    const doc = {
      schema: "scc.research-envelope-map", schemaVersion: 1, contractVersion: "1.0.0", generatedAt: "x", disclaimer: "x",
      source: { simulator: "s", datasetId: "d", campaignId: "c", gitSha: "g" },
      evidence: { stage: "exploratory", calibration: "synthetic_uncalibrated", campaignSeeds: [1] },
      axes: [{ key: "a" }, { key: "b" }],
      points: [{ runId: "r", outcome: "marginal", values: { a: 1, zz: 2 } }],
    };
    expect(validateEnvelope(doc).some((e) => e.includes("unknown axis"))).toBe(true);
  });
});
