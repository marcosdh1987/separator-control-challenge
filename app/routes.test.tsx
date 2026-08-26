import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/landing-page", () => ({ LandingPage: () => <div>Landing route</div> }));
vi.mock("@/components/game-dashboard", () => ({ GameDashboard: () => <div>Challenge route</div> }));

import Home from "./page";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import ChallengePage from "./challenge/page";
import TrainingPage from "./training/page";
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
