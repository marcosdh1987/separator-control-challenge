import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PidLearningPanel } from "./pid-learning-panel";

describe("PidLearningPanel", () => {
  it("reveals PID theory, diagnosis, and the repeatable-experiment rule through compact disclosures", async () => {
    const user = userEvent.setup();
    render(<PidLearningPanel />);

    await user.click(screen.getByRole("button", { name: "PID theory" }));
    expect(screen.getByText("u(t) = bias + Kp · (PV − SP) + Ki · ∫(PV − SP)dt + Kd · filtered(dPV/dt)")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "How do I diagnose the response?" }));
    expect(screen.getByText("Sustained oscillation")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Manual tuning golden rule" }));
    expect(screen.getByText(/Change one parameter at a time and repeat the same deterministic scenario/)).toBeVisible();
  });

  it("uses safe external links in Learn more", async () => {
    const user = userEvent.setup();
    render(<PidLearningPanel />);

    await user.click(screen.getByRole("button", { name: "Learn more" }));
    const link = screen.getByRole("link", { name: /Feedback Systems/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });
});
