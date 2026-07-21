import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GuidedTour, TOUR_STEPS } from "./guided-tour";

function renderTour(targets: readonly (typeof TOUR_STEPS)[number][], onComplete = vi.fn(), onSkip = vi.fn()) {
  for (const target of targets) {
    const fixture = document.createElement("div");
    fixture.dataset.testTourFixture = "true";
    fixture.dataset.tour = target;
    document.body.append(fixture);
  }
  return { onComplete, onSkip, ...render(<GuidedTour active onComplete={onComplete} onSkip={onSkip} />) };
}

describe("GuidedTour", () => {
  afterEach(() => {
    document.querySelectorAll("[data-test-tour-fixture]").forEach((fixture) => fixture.remove());
  });

  it("uses the seven stable data-tour anchors in the approved order", async () => {
    const user = userEvent.setup();
    const querySelector = vi.spyOn(document, "querySelector");
    renderTour(TOUR_STEPS);

    expect(screen.getByRole("dialog", { name: "Scenario selector" })).toBeVisible();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Total-level PID" })).toBeVisible();
    expect(querySelector).toHaveBeenCalledWith('[data-tour="scenario-selector"]');
    expect(querySelector).toHaveBeenCalledWith('[data-tour="total-pid"]');
    querySelector.mockRestore();
  });

  it("supports keyboard navigation, Escape skipping, and completion", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    renderTour(TOUR_STEPS, onComplete, onSkip);

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("dialog", { name: "Scenario selector" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("adds Manual PID tuning after controller discovery without changing existing anchors", async () => {
    const user = userEvent.setup();
    renderTour(TOUR_STEPS);

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Manual PID tuning" })).toBeVisible();
    expect(screen.getByText("Kp → Ki → Kd")).toBeVisible();
    expect(screen.getByText(/same deterministic scenario and seed/i)).toBeVisible();
  });

  it("skips unavailable targets without throwing", async () => {
    const user = userEvent.setup();
    renderTour(TOUR_STEPS.filter((target) => target !== "total-pid"));

    expect(screen.getByRole("dialog", { name: "Scenario selector" })).toBeVisible();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Interface PID" })).toBeVisible();
  });

  it("finishes the last available step", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderTour(TOUR_STEPS, onComplete);

    for (let index = 1; index < TOUR_STEPS.length; index += 1) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onComplete).toHaveBeenCalledOnce();
  });

  it("renders Finish when the final available anchor is reached", async () => {
    const user = userEvent.setup();
    renderTour(["scenario-selector", "total-pid"]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Total-level PID" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  });

  it("starts at the only available anchor without a Back action", () => {
    renderTour(["score-safety"]);

    expect(screen.getByRole("dialog", { name: "Score and safety" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Finish" })).toBeVisible();
  });

  it("jumps across middle gaps in both directions", async () => {
    const user = userEvent.setup();
    renderTour(["scenario-selector", "interface-pid"]);

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Interface PID" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Finish" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Scenario selector" })).toBeVisible();
  });

  it("traps focus and restores the trigger focus when skipped", async () => {
    const user = userEvent.setup();
    render(<FocusHarness />);

    const trigger = screen.getByRole("button", { name: "Open guide" });
    await user.click(trigger);
    const skip = screen.getByRole("button", { name: "Skip" });
    const next = screen.getByRole("button", { name: "Next" });
    expect(skip).toHaveFocus();
    next.focus();
    await user.tab();
    expect(skip).toHaveFocus();

    await user.click(skip);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

function FocusHarness() {
  const [active, setActive] = useState(false);
  return <>
    <button type="button" onClick={() => setActive(true)}>Open guide</button>
    {TOUR_STEPS.map((target) => <div data-tour={target} key={target} />)}
    <GuidedTour active={active} onComplete={() => setActive(false)} onSkip={() => setActive(false)} />
  </>;
}
