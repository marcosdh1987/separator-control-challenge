import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ExperimentView } from "@/components/research/experiment-view";
import { EXPERIMENT_IDS, isExperimentId } from "@/lib/research/catalog";
import { research } from "@/lib/i18n/messages/en/research";

/** The catalogue is fixed, so every experiment page is prerendered. */
export function generateStaticParams() {
  return EXPERIMENT_IDS.map((experimentId) => ({ experimentId }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ experimentId: string }> }): Promise<Metadata> {
  const { experimentId } = await params;
  if (!isExperimentId(experimentId)) return {};
  const copy = research.experiments[experimentId];
  return { title: `${copy.title} · Research Lab`, description: copy.question };
}

export default async function ExperimentPage({ params }: { params: Promise<{ experimentId: string }> }) {
  const { experimentId } = await params;
  if (!isExperimentId(experimentId)) notFound();
  return <ExperimentView experimentId={experimentId} key={experimentId} />;
}
