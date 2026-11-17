import {
  ContractError,
  type Phase,
  type ReplayEvent,
  type ReplaySignalJson,
  type ResearchCampaignSummaryV1,
  type ResearchEnvelopeMapV1,
  type ResearchIndex,
  type ResearchReplayV1,
  type SignalKey,
  validateCampaign,
  validateEnvelope,
  validateIndex,
  validateReplay,
} from "@/lib/research/contract";

/**
 * Decoding never changes a value: `f32` columns are restored with
 * `Math.fround`, which yields exactly the float64 eng_dacs stored, and the
 * per-signal SHA-256 digest proves it (see `verifyDigests`).
 */

export interface DecodedSignal {
  key: SignalKey;
  meta: Omit<ReplaySignalJson, "values" | "changes">;
  data: Float64Array;
}

export type ReplayHeader = Omit<ResearchReplayV1, "signals">;

export interface Replay {
  id: string;
  header: ReplayHeader;
  startS: number;
  endS: number;
  dtS: number;
  count: number;
  phases: Phase[];
  events: ReplayEvent[];
  signals: Map<SignalKey, DecodedSignal>;
}

const GZIP_MAGIC = [0x1f, 0x8b] as const;

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === GZIP_MAGIC[0] && bytes[1] === GZIP_MAGIC[1];
}

/**
 * Files are stored gzip-compressed. A host may also serve them already
 * decompressed (Content-Encoding), so the magic bytes decide, not the name.
 */
export async function bytesToJson(bytes: Uint8Array): Promise<unknown> {
  let text: string;
  if (isGzip(bytes)) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot decompress research data (DecompressionStream is missing).");
    }
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return JSON.parse(text) as unknown;
}

function decodeValues(signal: ReplaySignalJson, count: number): Float64Array {
  const out = new Float64Array(count);
  const toNumber = signal.numberFormat === "f32"
    ? (raw: number | null) => (raw === null ? Number.NaN : Math.fround(raw))
    : (raw: number | null) => (raw === null ? Number.NaN : raw);
  if (signal.encoding === "dense") {
    const values = signal.values ?? [];
    for (let i = 0; i < count; i += 1) out[i] = toNumber(values[i] ?? null);
    return out;
  }
  const changes = signal.changes ?? [];
  for (let c = 0; c < changes.length; c += 1) {
    const [start, raw] = changes[c];
    const end = c + 1 < changes.length ? changes[c + 1][0] : count;
    out.fill(toNumber(raw), start, end);
  }
  return out;
}

export function decodeReplay(doc: unknown): Replay {
  const errors = validateReplay(doc);
  if (errors.length > 0) throw new ContractError("replay", errors);
  const replay = doc as ResearchReplayV1;
  const { signals: rawSignals, ...header } = replay;
  const count = replay.time.count;
  const signals = new Map<SignalKey, DecodedSignal>();
  for (const signal of rawSignals) {
    // Keep the metadata, drop the raw arrays: the decoded Float64Array replaces them.
    const meta: DecodedSignal["meta"] = { ...signal };
    delete (meta as Partial<ReplaySignalJson>).values;
    delete (meta as Partial<ReplaySignalJson>).changes;
    signals.set(signal.key, { key: signal.key, meta, data: decodeValues(signal, count) });
  }
  return {
    id: replay.replayId,
    header,
    startS: replay.time.startS,
    endS: replay.time.endS,
    dtS: replay.time.sampleIntervalS,
    count,
    phases: replay.phases,
    events: replay.events,
    signals,
  };
}

/** Little-endian float64 bytes with NaN canonicalised, as the exporter hashes them. */
export function float64Bytes(data: Float64Array): Uint8Array {
  const bytes = new Uint8Array(data.length * 8);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < data.length; i += 1) {
    if (Number.isNaN(data[i])) {
      view.setUint32(i * 8, 0, true);
      view.setUint32(i * 8 + 4, 0x7ff80000, true);
    } else {
      view.setFloat64(i * 8, data[i], true);
    }
  }
  return bytes;
}

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");

export interface DigestReport {
  status: "verified" | "mismatch" | "unavailable";
  checked: number;
  failures: SignalKey[];
}

/**
 * Recompute every signal digest with Web Crypto. Unavailable outside a secure
 * context (plain http on a LAN address), in which case the page says so rather
 * than claiming a verification it did not do.
 */
export async function verifyDigests(replay: Replay): Promise<DigestReport> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { status: "unavailable", checked: 0, failures: [] };
  const failures: SignalKey[] = [];
  for (const signal of replay.signals.values()) {
    const digest = await subtle.digest("SHA-256", float64Bytes(signal.data) as BufferSource);
    if (`sha256:${toHex(digest)}` !== signal.meta.digest) failures.push(signal.key);
  }
  return { status: failures.length === 0 ? "verified" : "mismatch", checked: replay.signals.size, failures };
}

export function assertCampaign(doc: unknown): ResearchCampaignSummaryV1 {
  const errors = validateCampaign(doc);
  if (errors.length > 0) throw new ContractError("campaign summary", errors);
  return doc as ResearchCampaignSummaryV1;
}

export function assertEnvelope(doc: unknown): ResearchEnvelopeMapV1 {
  const errors = validateEnvelope(doc);
  if (errors.length > 0) throw new ContractError("envelope map", errors);
  return doc as ResearchEnvelopeMapV1;
}

export function assertIndex(doc: unknown): ResearchIndex {
  const errors = validateIndex(doc);
  if (errors.length > 0) throw new ContractError("research index", errors);
  return doc as ResearchIndex;
}
