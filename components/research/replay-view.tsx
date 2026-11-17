"use client";

import { useEffect, useMemo, useState } from "react";

import { EvidenceLine } from "./evidence-badges";
import { AlignedPlayer, type ViewConfig } from "./experiment-view";
import { ResearchDisclaimer, ResearchHeader } from "./research-header";
import { SourceList } from "./research-lab";
import { ProvenancePanel, type PanelRun } from "./research-panels";
import { ProjectAttribution } from "@/components/project-attribution";
import { useExperimentData, useResearchIndex } from "@/hooks/use-research-data";
import { useMessages } from "@/lib/i18n/provider";
import { commonPhases } from "@/lib/research/alignment";
import { verifyDigests, type DigestReport } from "@/lib/research/decode";

const GENERIC_VIEW: ViewConfig = {
  charts: ["pressure", "total", "interface", "valve-oil", "valve-water", "events"],
  focusLoop: "oil",
};

/**
 * Any single published run, opened from the envelope explorer. It uses the same
 * player as the experiments, aligned on the start-up (a phase every run has,
 * including those that trip during it).
 */
export function ReplayView({ replayId }: { replayId: string }) {
  const copy = useMessages().research;
  const [indexState, retryIndex] = useResearchIndex();
  const index = indexState.status === "ready" ? indexState.data : null;
  const ids = useMemo(() => [replayId], [replayId]);
  const [dataState, retryData] = useExperimentData(index, ids, null);
  const replay = dataState.status === "ready" ? dataState.data.replays.get(replayId) ?? null : null;
  const [integrity, setIntegrity] = useState<Record<string, DigestReport>>({});
  const [anchor, setAnchor] = useState("startup");

  useEffect(() => {
    if (!replay) return;
    let active = true;
    verifyDigests(replay).then((report) => { if (active) setIntegrity({ [replay.id]: report }); });
    return () => { active = false; };
  }, [replay]);

  const runs: PanelRun[] = replay
    ? [{ replay, controller: "deployed", name: replay.header.run.variantId === "nominal" ? copy.controllers.deployed : replay.header.run.variantId }]
    : [];
  const failed = indexState.status === "error" || dataState.status === "error";
  const phases = replay ? commonPhases([replay]) : [];

  return (
    <main className="research-shell">
      <ResearchHeader back={{ href: "/research/envelope", label: copy.nav.envelope }} title={replay ? replay.header.run.runId : replayId} />
      {replay ? <EvidenceLine seeds={replay.header.evidence.campaignSeeds.length} stage={replay.header.evidence.stage} /> : null}
      <ResearchDisclaimer compact />
      {!failed && !replay ? <p className="research-loading" role="status">{copy.player.loading}</p> : null}
      {failed ? (
        <div className="research-error" role="alert">
          <p>{copy.player.loadFailed}</p>
          <button className="secondary-button" onClick={() => { retryIndex(); retryData(); }} type="button">{copy.player.retry}</button>
        </div>
      ) : null}
      {replay ? (
        <>
          <p className="research-summary">
            <strong>{copy.metrics.outcome}:</strong> {replay.header.run.outcome ? copy.envelope.outcomes[replay.header.run.outcome] ?? replay.header.run.outcome : "—"}
            {replay.header.run.dominantConstraint ? <> · <strong>{copy.envelope.dominant}:</strong> <code>{replay.header.run.dominantConstraint}</code></> : null}
          </p>
          <AlignedPlayer
            anchorPhase={anchor}
            experiment={GENERIC_VIEW}
            initialZoom="full"
            integrity={integrity}
            key={anchor}
            onAnchorChange={setAnchor}
            phases={phases}
            runs={runs}
          />
          <section className="research-panel">
            <h2 className="research-section-title">{copy.learning.sources}</h2>
            <SourceList sources={replay.header.source.documentation} />
          </section>
          <ProvenancePanel runs={runs} />
        </>
      ) : null}
      <ProjectAttribution variant="compact" />
    </main>
  );
}
