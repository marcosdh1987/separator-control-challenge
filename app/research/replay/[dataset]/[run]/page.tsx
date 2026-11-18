import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReplayView } from "@/components/research/replay-view";

interface IndexEntry {
  type: string;
  datasetId: string;
  runId?: string;
}

/**
 * One page per published replay, listed from the committed index at build
 * time. Nothing else can be opened: the route is static and read-only.
 */
function publishedReplays(): { dataset: string; run: string }[] {
  const index = JSON.parse(readFileSync(join(process.cwd(), "public/research/v1/index.json"), "utf8")) as { files: IndexEntry[] };
  return index.files
    .filter((file) => file.type === "replay" && file.runId)
    .map((file) => ({ dataset: file.datasetId, run: file.runId as string }));
}

export function generateStaticParams() {
  return publishedReplays();
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ dataset: string; run: string }> }): Promise<Metadata> {
  const { run } = await params;
  return { title: `${run} · Research Lab`, description: "Read-only replay of a published eng_dacs research run." };
}

export default async function ReplayPage({ params }: { params: Promise<{ dataset: string; run: string }> }) {
  const { dataset, run } = await params;
  const known = publishedReplays().some((entry) => entry.dataset === dataset && entry.run === run);
  if (!known) notFound();
  return <ReplayView key={`${dataset}/${run}`} replayId={`${dataset}/${run}`} />;
}
