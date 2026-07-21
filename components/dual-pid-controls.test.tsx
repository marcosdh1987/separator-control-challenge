import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DualPidControls } from "./dual-pid-controls";
import { createEquilibriumSample } from "@/hooks/use-simulation";
import { DEFAULT_DUAL_PID, type SimulationStatus } from "@/lib/simulation/types";

function renderDeck(status: SimulationStatus = "idle", ready = true) {
  const props = {
    config: DEFAULT_DUAL_PID,
    hero: <div>Separator hero</div>,
    locked: status !== "idle",
    onChange: vi.fn(),
    onPause: vi.fn(),
    onReset: vi.fn(),
    onResume: vi.fn(),
    onSpeedChange: vi.fn(),
    onStart: vi.fn(),
    ready,
    sample: createEquilibriumSample(),
    speed: 1,
    status,
  };
  render(<DualPidControls {...props} />);
  return props;
}

describe("dual PID control deck", () => {
  it("keeps focus while entering a multi-character decimal in a controlled deck", async () => {
    const user = userEvent.setup();
    function ControlledDeck() {
      const [config, setConfig] = useState(DEFAULT_DUAL_PID);
      return <DualPidControls config={config} hero={<div>Separator hero</div>} locked={false} ready sample={createEquilibriumSample()} speed={1} status="idle" onChange={setConfig} onPause={vi.fn()} onReset={vi.fn()} onResume={vi.fn()} onSpeedChange={vi.fn()} onStart={vi.fn()} />;
    }
    render(<ControlledDeck />);
    const integral = screen.getByLabelText("Total level integral gain");
    await user.clear(integral);
    await user.type(integral, "0.12");
    expect(integral).toHaveFocus();
    expect(integral).toHaveValue(0.12);
  });

  it("updates total Kp without replacing or changing the interface loop", async () => {
    const user = userEvent.setup();
    const { onChange } = renderDeck();

    await user.clear(screen.getByLabelText("Total level proportional gain"));
    await user.type(screen.getByLabelText("Total level proportional gain"), "6");

    expect(onChange).toHaveBeenLastCalledWith({
      total: expect.objectContaining({ kp: 6 }),
      interface: DEFAULT_DUAL_PID.interface,
    });
  });

  it("updates interface Kp without replacing or changing the total loop", async () => {
    const user = userEvent.setup();
    const { onChange } = renderDeck();

    await user.clear(screen.getByLabelText("Interface proportional gain"));
    await user.type(screen.getByLabelText("Interface proportional gain"), "5");

    expect(onChange).toHaveBeenLastCalledWith({
      total: DEFAULT_DUAL_PID.total,
      interface: expect.objectContaining({ kp: 5 }),
    });
  });

  it.each(["running", "paused"] as const)("locks all six gains while %s", (status) => {
    renderDeck(status);
    const gains = [
      "Total level proportional gain", "Total level integral gain", "Total level derivative gain",
      "Interface proportional gain", "Interface integral gain", "Interface derivative gain",
    ];
    for (const name of gains) expect(screen.getByLabelText(name)).toBeDisabled();
  });

  it("uses one shared transport row with ready gate, reset, and pressed speed", async () => {
    const user = userEvent.setup();
    const { onReset, onSpeedChange } = renderDeck("idle", false);
    expect(screen.getByRole("button", { name: "Start attempt" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Reset attempt" }));
    await user.click(screen.getByRole("button", { name: "2× speed" }));
    expect(onReset).toHaveBeenCalledOnce();
    expect(onSpeedChange).toHaveBeenCalledWith(2);
    expect(screen.getByRole("button", { name: "1× speed" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByText("Separator hero")).toHaveLength(1);
  });

  it("places the future-safe hero first in DOM order, followed by total and interface docks", () => {
    const { container } = render(<DualPidControls config={DEFAULT_DUAL_PID} hero={<div data-testid="separator-hero">Separator hero</div>} locked={false} ready sample={createEquilibriumSample()} speed={1} status="idle" onChange={vi.fn()} onPause={vi.fn()} onReset={vi.fn()} onResume={vi.fn()} onSpeedChange={vi.fn()} onStart={vi.fn()} />);
    const bay = container.querySelector(".process-bay");
    expect(Array.from(bay?.children ?? []).map((child) => child.className)).toEqual([
      "process-bay__hero",
      "instrument-dock instrument-dock--oil",
      "instrument-dock instrument-dock--water",
    ]);
  });

  it.each([
    ["running", "Pause attempt"],
    ["paused", "Resume attempt"],
  ] as const)("shows the correct action while %s", (status, action) => {
    renderDeck(status);
    expect(screen.getByRole("button", { name: action })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Start attempt" })).not.toBeInTheDocument();
  });
});
