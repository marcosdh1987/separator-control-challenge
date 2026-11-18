import type { ResearchCampaignSummaryV1, ResearchEnvelopeMapV1, ResearchIndex } from "@/lib/research/contract";
import { assertCampaign, assertEnvelope, assertIndex, bytesToJson, decodeReplay, type Replay } from "@/lib/research/decode";

/**
 * Loading the static research files. They live under `public/research/v1/`
 * and are fetched on demand: nothing is bundled into the page JavaScript, and a
 * replay is downloaded only when a reader opens its experiment.
 */

export const RESEARCH_DATA_VERSION = "v1";

/** Respects a Next.js base path, so the static export works from a subfolder. */
export function researchDataUrl(relative: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return `${base}/research/${RESEARCH_DATA_VERSION}/${relative}`;
}

async function fetchBytes(url: string, signal?: AbortSignal): Promise<Uint8Array> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = cache.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, promise);
  return promise;
}

export function loadIndex(): Promise<ResearchIndex> {
  return cached("index", async () => assertIndex(await bytesToJson(await fetchBytes(researchDataUrl("index.json")))));
}

export function filePathFor(index: ResearchIndex, id: string, type: "replay" | "campaign" | "envelope"): string | null {
  return index.files.find((file) => file.id === id && file.type === type)?.path ?? null;
}

export function loadReplay(index: ResearchIndex, replayId: string): Promise<Replay> {
  const path = filePathFor(index, replayId, "replay");
  if (!path) return Promise.reject(new Error(`replay ${replayId} is not published`));
  return cached(`replay:${replayId}`, async () => decodeReplay(await bytesToJson(await fetchBytes(researchDataUrl(path)))));
}

export function loadCampaign(index: ResearchIndex, datasetId: string): Promise<ResearchCampaignSummaryV1> {
  const path = filePathFor(index, datasetId, "campaign");
  if (!path) return Promise.reject(new Error(`campaign ${datasetId} is not published`));
  return cached(`campaign:${datasetId}`, async () => assertCampaign(await bytesToJson(await fetchBytes(researchDataUrl(path)))));
}

export function loadEnvelope(index: ResearchIndex, mapId: string): Promise<ResearchEnvelopeMapV1> {
  const path = filePathFor(index, mapId, "envelope");
  if (!path) return Promise.reject(new Error(`envelope ${mapId} is not published`));
  return cached(`envelope:${mapId}`, async () => assertEnvelope(await bytesToJson(await fetchBytes(researchDataUrl(path)))));
}

/** Test seam. */
export function clearResearchCache(): void {
  cache.clear();
}
