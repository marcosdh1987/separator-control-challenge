"use client";

import { useMessages } from "@/lib/i18n/provider";
import type { Availability } from "@/lib/research/catalog";
import type { Stage } from "@/lib/research/contract";

export function StageBadge({ stage }: { stage: Stage }) {
  const copy = useMessages().research.evidence;
  return (
    <span className={`research-badge is-${stage}`} title={copy.stageHelp[stage]}>
      {copy.stage[stage].toLocaleUpperCase()}
    </span>
  );
}

export function SyntheticBadge() {
  const copy = useMessages().research.evidence;
  return <span className="research-badge is-synthetic" title={copy.syntheticHelp}>{copy.synthetic}</span>;
}

export function SeedBadge({ count }: { count: number }) {
  const copy = useMessages().research.evidence;
  return <span className="research-badge is-neutral">{copy.seeds(count)}</span>;
}

export function AvailabilityBadge({ availability }: { availability: Availability }) {
  const copy = useMessages().research.catalogue;
  return (
    <span className={`research-availability is-${availability}`} title={copy.availabilityHelp[availability]}>
      {copy.availability[availability]}
    </span>
  );
}

export function EvidenceLine({ stage, seeds }: { stage: Stage; seeds: number }) {
  return (
    <div className="research-evidence-line">
      <StageBadge stage={stage} />
      <SeedBadge count={seeds} />
      <SyntheticBadge />
    </div>
  );
}
