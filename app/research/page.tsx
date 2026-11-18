import type { Metadata } from "next";

import { ResearchLab } from "@/components/research/research-lab";

export const metadata: Metadata = {
  title: "Research Lab · Separator Control Challenge",
  description: "Replay published, verified research runs from the eng_dacs simulator: read-only, in the browser.",
};

export default function ResearchPage() {
  return <ResearchLab />;
}
