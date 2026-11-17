"use client";

import { ArrowRight, BookOpen, Lock } from "lucide-react";
import Link from "next/link";

import { AvailabilityBadge, EvidenceLine } from "./evidence-badges";
import { ResearchDisclaimer, ResearchHeader } from "./research-header";
import { ProjectAttribution } from "@/components/project-attribution";
import { useResearchIndex } from "@/hooks/use-research-data";
import { useLocale, useMessages } from "@/lib/i18n/provider";
import {
  CATALOGUE,
  ENVELOPE_MAP_ID,
  ENVELOPE_SEEDS,
  ENVELOPE_SOURCES,
  EXPERIMENTS,
  experimentReplayIds,
  type Availability,
  type CatalogueEntry,
} from "@/lib/research/catalog";
import type { DocReference, ResearchIndex } from "@/lib/research/contract";
import { formatBytes } from "@/lib/research/format";

interface EntryStatus {
  availability: Availability;
  runs: number;
  bytes: number;
}

/** Availability is computed from the published index, never assumed. */
export function entryStatus(entry: CatalogueEntry, index: ResearchIndex | null): EntryStatus {
  if (entry.kind === "placeholder") return { availability: entry.availability ?? "pending", runs: 0, bytes: 0 };
  if (!index) return { availability: "pending", runs: 0, bytes: 0 };
  const ids = entry.kind === "envelope"
    ? [ENVELOPE_MAP_ID]
    : [...experimentReplayIds(EXPERIMENTS[entry.id as keyof typeof EXPERIMENTS]), EXPERIMENTS[entry.id as keyof typeof EXPERIMENTS].campaignSummaryId];
  const files = index.files.filter((file) => ids.includes(file.id));
  const complete = ids.every((id) => files.some((file) => file.id === id));
  return {
    availability: complete ? "loaded" : "pending",
    runs: files.filter((file) => file.type === "replay").length,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  };
}

export function SourceList({ sources }: { sources: readonly DocReference[] }) {
  const copy = useMessages().research.catalogue;
  return (
    <ul className="research-sources">
      {sources.map((source) => (
        <li key={`${source.path}#${source.section}`}>
          <Lock aria-hidden="true" />
          <code>eng_dacs/{source.path}</code>
          {source.section ? <span> §{source.section}</span> : null}
          <span className="research-sources-access"> ({copy.privateSource})</span>
        </li>
      ))}
    </ul>
  );
}

function CatalogueCard({ entry, index }: { entry: CatalogueEntry; index: ResearchIndex | null }) {
  const messages = useMessages();
  const locale = useLocale();
  const copy = messages.research;
  const text = copy.entries[entry.id];
  const status = entryStatus(entry, index);
  const experiment = entry.kind === "experiment" ? EXPERIMENTS[entry.id as keyof typeof EXPERIMENTS] : null;
  const sources = experiment?.sources ?? (entry.kind === "envelope" ? ENVELOPE_SOURCES : []);
  const seeds = experiment ? experiment.seeds : ENVELOPE_SEEDS;
  const href = entry.kind === "envelope" ? "/research/envelope" : `/research/${entry.id}`;

  return (
    <li className="research-card" data-availability={status.availability} data-entry={entry.id}>
      <div className="research-card-head">
        {experiment ? <span className="research-campaign">{experiment.campaign}</span> : null}
        <AvailabilityBadge availability={status.availability} />
      </div>
      <h2>{text.title}</h2>
      {experiment || entry.kind === "envelope" ? <EvidenceLine seeds={seeds} stage={experiment?.stage ?? "exploratory"} /> : null}
      <dl>
        <dt>{copy.catalogue.question}</dt>
        <dd>{text.question}</dd>
        <dt>{copy.catalogue.comparing}</dt>
        <dd>{text.comparing}</dd>
      </dl>
      {experiment ? <p className="research-card-summary">{copy.experiments[experiment.id].summary}</p> : null}
      {sources.length > 0 ? (
        <details className="research-card-sources">
          <summary>{copy.catalogue.sources}</summary>
          <SourceList sources={sources} />
        </details>
      ) : null}
      <div className="research-card-foot">
        {status.availability === "loaded" ? (
          <>
            {status.runs > 0 ? <span className="research-card-size">{copy.catalogue.runs(status.runs, formatBytes(status.bytes, locale))}</span> : <span />}
            <Link className="primary-button" href={href}>
              {entry.kind === "envelope" ? copy.catalogue.openEnvelope : copy.catalogue.open} <ArrowRight aria-hidden="true" />
            </Link>
          </>
        ) : (
          <span className="research-card-help">{copy.catalogue.availabilityHelp[status.availability]}</span>
        )}
      </div>
    </li>
  );
}

export function ResearchLab() {
  const copy = useMessages().research;
  const [index] = useResearchIndex();
  const data = index.status === "ready" ? index.data : null;

  return (
    <main className="research-shell">
      <ResearchHeader title={copy.page.title} />
      <p className="research-intro">{copy.page.intro}</p>
      <ResearchDisclaimer />
      <section aria-labelledby="research-catalogue" className="research-catalogue">
        <h2 className="research-section-title" id="research-catalogue">{copy.catalogue.heading}</h2>
        {index.status === "loading" ? <p role="status">{copy.catalogue.loadingIndex}</p> : null}
        {index.status === "error" ? <p role="alert">{copy.catalogue.indexFailed}</p> : null}
        <ol className="research-card-grid">
          {CATALOGUE.map((entry) => <CatalogueCard entry={entry} index={data} key={entry.id} />)}
        </ol>
      </section>
      <p className="research-training-link">
        <BookOpen aria-hidden="true" /> <Link href="/training">{copy.page.trainingLink}</Link>
      </p>
      <p className="research-attribution">{copy.page.attribution}</p>
      <ProjectAttribution variant="compact" />
    </main>
  );
}
