// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { gunzipSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { evaluateClaim } from "@/lib/research/claims";
import {
  CATALOGUE,
  ENVELOPE_CLAIMS,
  ENVELOPE_MAP_ID,
  ENVELOPE_SEEDS,
  EXPERIMENTS,
  EXPERIMENT_IDS,
  experimentReplayIds,
} from "@/lib/research/catalog";
import { assertCampaign, assertEnvelope, assertIndex, bytesToJson, decodeReplay, verifyDigests, type Replay } from "@/lib/research/decode";
import { frameAt } from "@/lib/research/timeline";
import { alignRuns, toComparisonTime } from "@/lib/research/alignment";
import { SIGNAL_KEYS } from "@/lib/research/contract";

/**
 * The committed data under public/research/v1, read exactly as a browser
 * would: decompress, validate, decode, verify every signal digest. Then every
 * documented claim of the catalogue is recomputed from it.
 */

const ROOT = resolve(process.cwd(), "public/research/v1");
const index = assertIndex(JSON.parse(readFileSync(resolve(ROOT, "index.json"), "utf8")));
const fileFor = (id: string, type: string) => index.files.find((f) => f.id === id && f.type === type);

function readDoc(path: string): unknown {
  return JSON.parse(gunzipSync(readFileSync(resolve(ROOT, path))).toString("utf8"));
}

const replays = new Map<string, Replay>();
for (const file of index.files.filter((f) => f.type === "replay")) replays.set(file.id, decodeReplay(readDoc(file.path)));

describe("published research data", () => {
  it("matches the SHA-256 the index records for every file", () => {
    for (const file of index.files) {
      expect(createHash("sha256").update(readFileSync(resolve(ROOT, file.path))).digest("hex"), file.path).toBe(file.sha256);
    }
  });

  it("decodes every replay with bit-exact signal digests", async () => {
    expect(replays.size).toBeGreaterThan(0);
    for (const replay of replays.values()) {
      const report = await verifyDigests(replay);
      expect(report, replay.id).toMatchObject({ status: "verified", failures: [] });
    }
  });

  it("decompresses through the browser path as well", async () => {
    const file = index.files.find((f) => f.type === "replay")!;
    const doc = await bytesToJson(new Uint8Array(readFileSync(resolve(ROOT, file.path))));
    expect(decodeReplay(doc).id).toBe(file.id);
  });

  it("keeps timestamps consistent: uniform ticks, ordered phases, events inside the run", () => {
    for (const replay of replays.values()) {
      expect(replay.endS - replay.startS).toBeCloseTo((replay.count - 1) * replay.dtS, 9);
      for (let i = 1; i < replay.phases.length; i += 1) {
        expect(replay.phases[i].startS).toBe(replay.phases[i - 1].endS + replay.dtS);
      }
      for (const event of replay.events) {
        expect(event.tS).toBeGreaterThanOrEqual(replay.startS);
        expect(event.tS).toBeLessThanOrEqual(replay.endS);
      }
      const times = replay.events.map((e) => e.tS);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
  });

  it("validates the campaign summaries and the envelope map", () => {
    for (const file of index.files.filter((f) => f.type === "campaign")) expect(() => assertCampaign(readDoc(file.path))).not.toThrow();
    const envelopeFile = fileFor(ENVELOPE_MAP_ID, "envelope");
    expect(envelopeFile).toBeDefined();
    const envelope = assertEnvelope(readDoc(envelopeFile!.path));
    for (const point of envelope.points) {
      if (point.replayId) expect(replays.has(point.replayId), point.replayId).toBe(true);
    }
  });

  it("publishes every replay the catalogue needs, or lists it as pending", () => {
    const pending = new Set(index.pending.map((p) => p.id));
    for (const id of EXPERIMENT_IDS) {
      for (const replayId of experimentReplayIds(EXPERIMENTS[id])) {
        expect(replays.has(replayId) || pending.has(replayId), replayId).toBe(true);
      }
      const summary = EXPERIMENTS[id].campaignSummaryId;
      expect(Boolean(fileFor(summary, "campaign")) || pending.has(summary), summary).toBe(true);
    }
    expect(CATALOGUE.filter((entry) => entry.kind === "placeholder").every((entry) => entry.availability)).toBe(true);
  });

  it("states the same stage and seed count as the published evidence", () => {
    for (const id of EXPERIMENT_IDS) {
      for (const replayId of experimentReplayIds(EXPERIMENTS[id])) {
        const evidence = replays.get(replayId)!.header.evidence;
        expect(evidence.stage, replayId).toBe(EXPERIMENTS[id].stage);
        expect(evidence.campaignSeeds.length, replayId).toBe(EXPERIMENTS[id].seeds);
      }
    }
    const envelope = assertEnvelope(readDoc(fileFor(ENVELOPE_MAP_ID, "envelope")!.path));
    expect(envelope.evidence.campaignSeeds.length).toBe(ENVELOPE_SEEDS);
  });

  it("pairs every comparison: same scenario and seed in each set", () => {
    for (const id of EXPERIMENT_IDS) {
      for (const set of EXPERIMENTS[id].comparisons) {
        for (const run of set.runs) {
          const replay = replays.get(run.replayId)!;
          expect(replay.header.run.scenarioId, run.replayId).toBe(set.scenarioId);
          expect(replay.header.run.seed, run.replayId).toBe(set.seed);
          expect(replay.phases.some((phase) => phase.name === set.anchor.phase), run.replayId).toBe(true);
        }
      }
    }
  });

  it("reproduces every documented claim from the published data", () => {
    for (const id of EXPERIMENT_IDS) {
      const experiment = EXPERIMENTS[id];
      const campaign = assertCampaign(readDoc(fileFor(experiment.campaignSummaryId, "campaign")!.path));
      for (const claim of experiment.claims) {
        const result = evaluateClaim(claim, { replays, campaign });
        expect(result.status, `${id}/${claim.id}: ${JSON.stringify(result.computed)}`).toBe("consistent");
      }
    }
    const envelope = assertEnvelope(readDoc(fileFor(ENVELOPE_MAP_ID, "envelope")!.path));
    for (const claim of ENVELOPE_CLAIMS) {
      const result = evaluateClaim(claim, { replays, envelope });
      expect(result.status, `envelope/${claim.id}: ${JSON.stringify(result.computed)}`).toBe("consistent");
    }
  });

  it("places phase-relative results at the report's seconds on the comparison axis", () => {
    const set = EXPERIMENTS["c2-lcv102-actuator-lag"].comparisons[0];
    const alignment = alignRuns(set.runs.map((run) => replays.get(run.replayId)!), set.anchor);
    const m6b = alignment.runs[0];
    const exit = m6b.replay.events.find((event) => event.kind === "band_exit")!;
    expect(toComparisonTime(m6b, exit.tS)).toBe(12415);
    // The two runs start the hold 396 s apart in their own clocks; the shift is reported.
    expect(alignment.runs[1].shiftS).toBe(-396);
  });

  it("labels every published run as synthetic and uncalibrated, with the disclaimer", () => {
    for (const replay of replays.values()) {
      expect(replay.header.evidence.calibration).toBe("synthetic_uncalibrated");
      expect(replay.header.disclaimer).toContain("not a validated industrial control system");
      expect(replay.header.source.repositoryAccess).toBe("private");
    }
  });

  it("samples a 4 h run fast enough for 60 frames per second", () => {
    const longest = [...replays.values()].sort((a, b) => b.count - a.count)[0];
    expect(longest.count).toBeGreaterThan(14_000);
    const started = performance.now();
    const frames = 5_000;
    for (let i = 0; i < frames; i += 1) frameAt(longest, longest.startS + (i * 3.7) % (longest.endS - longest.startS), SIGNAL_KEYS);
    // A frame must cost far less than the 16 ms of a 60 Hz display.
    expect((performance.now() - started) / frames).toBeLessThan(0.5);
  });
});
