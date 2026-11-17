// @vitest-environment node
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { ContractError } from "@/lib/research/contract";
import { bytesToJson, decodeReplay, float64Bytes, isGzip, verifyDigests } from "@/lib/research/decode";
import { makeReplayDoc } from "@/lib/research/test-fixtures";

const digestOf = (values: number[]) => `sha256:${createHash("sha256").update(float64Bytes(Float64Array.from(values))).digest("hex")}`;

describe("decoding research files", () => {
  it("restores float32 register values exactly with Math.fround", () => {
    const original = [Math.fround(49.854446), Math.fround(0.1), Math.fround(1e-7)];
    const doc = makeReplayDoc({ count: 3, holdStartS: 2 });
    doc.signals = [{ ...doc.signals[1], values: [49.854446, 0.1, 1e-7], numberFormat: "f32", digest: digestOf(original), nullCount: 0 }];
    const replay = decodeReplay(doc);
    expect(Array.from(replay.signals.get("valve.oil.command")!.data)).toEqual(original);
  });

  it("expands change points into one value per tick", () => {
    const replay = decodeReplay(makeReplayDoc());
    expect(Array.from(replay.signals.get("loop.oil.sp")!.data)).toEqual([50, 50, 50, 50, 50, 55, 55, 55, 55, 55, 55]);
  });

  it("decodes null as NaN, never as zero", () => {
    const replay = decodeReplay(makeReplayDoc());
    expect(Number.isNaN(replay.signals.get("valve.oil.command")!.data[3])).toBe(true);
  });

  it("refuses an invalid document", () => {
    expect(() => decodeReplay({ schema: "scc.research-replay" })).toThrow(ContractError);
  });

  it("reads gzip and plain JSON alike, deciding by the magic bytes", async () => {
    const text = JSON.stringify({ a: 1 });
    const gz = new Uint8Array(gzipSync(text));
    expect(isGzip(gz)).toBe(true);
    expect(await bytesToJson(gz)).toEqual({ a: 1 });
    expect(await bytesToJson(new TextEncoder().encode(text))).toEqual({ a: 1 });
  });

  it("hashes NaN canonically and verifies digests", async () => {
    expect(Array.from(float64Bytes(Float64Array.from([Number.NaN])).slice(4))).toEqual([0, 0, 0xf8, 0x7f]);
    const doc = makeReplayDoc({ count: 3, holdStartS: 2 });
    doc.signals = [{ ...doc.signals[0], values: [1, 2, 3], digest: digestOf([1, 2, 3]) }];
    expect(await verifyDigests(decodeReplay(doc))).toMatchObject({ status: "verified", checked: 1 });
    doc.signals[0].values = [1, 2, 3.0000001];
    expect(await verifyDigests(decodeReplay(doc))).toMatchObject({ status: "mismatch", failures: ["level.total.truth"] });
  });
});
