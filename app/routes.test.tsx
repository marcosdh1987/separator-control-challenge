import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/landing-page", () => ({ LandingPage: () => <div>Landing route</div> }));
vi.mock("@/components/game-dashboard", () => ({ GameDashboard: () => <div>Challenge route</div> }));

import Home from "./page";
import ChallengePage from "./challenge/page";
import TrainingPage from "./training/page";

describe("onboarding routes", () => {
  it("renders the landing at the root and preserves the dashboard at challenge", () => {
    const { rerender } = render(<Home />);
    expect(screen.getByText("Landing route")).toBeVisible();

    rerender(<ChallengePage />);
    expect(screen.getByText("Challenge route")).toBeVisible();
  });

  it("reserves a training route for the interactive experience", () => {
    render(<TrainingPage />);
    expect(screen.getByRole("heading", { name: /guided training/i })).toBeVisible();
  });
});
