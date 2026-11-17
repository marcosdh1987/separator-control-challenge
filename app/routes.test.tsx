import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/landing-page", () => ({ LandingPage: () => <div>Landing route</div> }));
vi.mock("@/components/game-dashboard", () => ({ GameDashboard: () => <div>Challenge route</div> }));
vi.mock("@/components/research/research-lab", () => ({ ResearchLab: () => <div>Research route</div> }));
vi.mock("@/components/research/envelope-explorer", () => ({ EnvelopeExplorer: () => <div>Envelope route</div> }));
vi.mock("@/components/research/experiment-view", () => ({ ExperimentView: ({ experimentId }: { experimentId: string }) => <div>Experiment {experimentId}</div> }));

import Home from "./page";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import ChallengePage from "./challenge/page";
import TrainingPage from "./training/page";
import ResearchPage from "./research/page";
import EnvelopePage from "./research/envelope/page";
import ExperimentPage, { generateStaticParams as experimentParams } from "./research/[experimentId]/page";
import { generateStaticParams as replayParams } from "./research/replay/[dataset]/[run]/page";
import { EXPERIMENT_IDS } from "@/lib/research/catalog";
import { LESSON_IDS } from "@/lib/training/types";

describe("onboarding routes", () => {
  it("renders the landing at the root and preserves the dashboard at challenge", () => {
    const { rerender } = renderWithLocale(<Home />);
    expect(screen.getByText("Landing route")).toBeVisible();

    rerender(<ChallengePage />);
    expect(screen.getByText("Challenge route")).toBeVisible();
  });

  it("serves the lesson catalogue at the training route", () => {
    renderWithLocale(<TrainingPage />);
    expect(
      screen.getByRole("heading", { name: /learn separator control by running one/i }),
    ).toBeVisible();
    // Every lesson in the curriculum is offered, in order.
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(LESSON_IDS.length);
    expect(screen.getByRole("heading", { name: /what a three-phase separator does/i })).toBeVisible();
  });
});

describe("research routes", () => {
  it("serves the catalogue and the envelope explorer", () => {
    const { rerender } = renderWithLocale(<ResearchPage />);
    expect(screen.getByText("Research route")).toBeVisible();
    rerender(<EnvelopePage />);
    expect(screen.getByText("Envelope route")).toBeVisible();
  });

  it("prerenders one page per experiment and per published replay", async () => {
    expect(experimentParams().map((p) => p.experimentId)).toEqual(EXPERIMENT_IDS);
    renderWithLocale(await ExperimentPage({ params: Promise.resolve({ experimentId: "c2-lcv102-stiction" }) }));
    expect(screen.getByText("Experiment c2-lcv102-stiction")).toBeVisible();
    const replays = replayParams();
    expect(replays.length).toBeGreaterThanOrEqual(9);
    expect(replays).toContainEqual({ dataset: "nominal-pilot-20261113T234459Z", run: "center__nominal__s7100" });
  });
});
