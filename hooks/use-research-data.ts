"use client";

import { useCallback, useEffect, useState } from "react";

import type { ResearchCampaignSummaryV1, ResearchEnvelopeMapV1, ResearchIndex } from "@/lib/research/contract";
import type { Replay } from "@/lib/research/decode";
import { loadCampaign, loadEnvelope, loadIndex, loadReplay } from "@/lib/research/loaders";

/**
 * Loading state for the static research files. Fetching is the external
 * system here, so the effect only subscribes to a promise and stores what it
 * resolves to; it never computes anything the render could compute.
 */

export type LoadState<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: T };

function useAsync<T>(load: (() => Promise<T>) | null, deps: readonly unknown[]): [LoadState<T>, () => void] {
  const [state, setState] = useState<LoadState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!load) return;
    let active = true;
    load().then(
      (data) => { if (active) setState({ status: "ready", data }); },
      (error: unknown) => { if (active) setState({ status: "error", error: error instanceof Error ? error.message : String(error) }); },
    );
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps are supplied by the caller
  }, [...deps, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }, []);
  return [state, retry];
}

export function useResearchIndex(): [LoadState<ResearchIndex>, () => void] {
  return useAsync(loadIndex, []);
}

export interface ExperimentData {
  replays: Map<string, Replay>;
  campaign: ResearchCampaignSummaryV1 | null;
}

export function useExperimentData(index: ResearchIndex | null, replayIds: readonly string[], campaignId: string | null) {
  const key = replayIds.join("|");
  return useAsync<ExperimentData>(
    index
      ? async () => {
        const loaded = await Promise.all(replayIds.map((id) => loadReplay(index, id)));
        const campaign = campaignId ? await loadCampaign(index, campaignId).catch(() => null) : null;
        return { replays: new Map(loaded.map((replay) => [replay.id, replay])), campaign };
      }
      : null,
    [index, key, campaignId],
  );
}

export function useEnvelopeData(index: ResearchIndex | null, mapId: string) {
  return useAsync<ResearchEnvelopeMapV1>(index ? () => loadEnvelope(index, mapId) : null, [index, mapId]);
}
