import type { Metadata } from "next";

import { EnvelopeExplorer } from "@/components/research/envelope-explorer";

export const metadata: Metadata = {
  title: "Operating envelope · Research Lab",
  description: "Explore the evaluated scenarios of the eng_dacs nominal-plant pilot, point by point, without interpolated frontiers.",
};

export default function EnvelopePage() {
  return <EnvelopeExplorer />;
}
