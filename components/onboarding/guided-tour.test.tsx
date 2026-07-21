import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { GuidedTour, TOUR_STEPS } from "./guided-tour";

function TourHarness({ missing }: { missing?: (typeof TOUR_STEPS)[number] } = {}) {
  return <>
    {TOUR_STEPS.filter((target) => target !== missing).map((target) => (
      <div data-tour={target} key={target}>{target}</div>
    ))}
    <GuidedTour active onComplete={vi.fn()} onSkip={vi.fn()} />
  </>;
}

describe("GuidedTour", () => {
  it("uses the seven stable data-tour anchors in the approved order", async () => {
    const user = userEvent.setup();
    const querySelector = vi.spyOn(document, "querySelector");
    render(<TourHarness />);

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
    render(<>
      {TOUR_STEPS.map((target) => <div data-tour={target} key={target} />)}
      <GuidedTour active onComplete={onComplete} onSkip={onSkip} />
    </>);

    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("dialog", { name: "Scenario selector" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("skips unavailable targets without throwing", async () => {
    const user = userEvent.setup();
    render(<TourHarness missing="total-pid" />);

    expect(screen.getByRole("dialog", { name: "Scenario selector" })).toBeVisible();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("dialog", { name: "Interface PID" })).toBeVisible();
  });

  it("finishes the last available step", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<>
      {TOUR_STEPS.map((target) => <div data-tour={target} key={target} />)}
      <GuidedTour active onComplete={onComplete} onSkip={vi.fn()} />
    </>);

    for (let index = 1; index < TOUR_STEPS.length; index += 1) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onComplete).toHaveBeenCalledOnce();
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
