import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PidControls } from "./pid-controls";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import { createEquilibriumSample } from "@/hooks/use-simulation";
import { DEFAULT_PID } from "@/lib/simulation/types";

describe("PID instrument dock", () => {
  it.each([
    ["total", "oil", "Total level", "Oil", "LIC-101"],
    ["interface", "water", "Interface", "Water", "IIC-101"],
  ] as const)("separates true, measured, command, and position readouts for %s", (loopId, accent, loopName, phaseName, tag) => {
    const base = createEquilibriumSample()[loopId];
    renderWithLocale(
      <PidControls
        accent={accent}
        config={DEFAULT_PID}
        locked={false}
        loopId={loopId}
        sample={{ ...base, processValuePct: 47.2, measuredValuePct: 48.4, valveCommandPct: 62.5, valvePositionPct: 58.1 }}
        tag={tag}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(`${loopName} process value`).parentElement).toHaveTextContent("47.2%");
    expect(screen.getByText(`${loopName} measured value`).parentElement).toHaveTextContent("48.4%");
    expect(screen.getByText(`${phaseName} valve command`).parentElement).toHaveTextContent("62.5%");
    expect(screen.getByText(`${phaseName} valve actual position`).parentElement).toHaveTextContent("58.1%");
  });

  it("keeps process and measured values distinct when their values are equal", () => {
    renderWithLocale(
      <PidControls accent="oil" config={DEFAULT_PID} locked={false} loopId="total" sample={createEquilibriumSample().total} tag="LIC-101" onChange={vi.fn()} />,
    );
    expect(screen.getByText("Total level process value")).toBeVisible();
    expect(screen.getByText("Total level measured value")).toBeVisible();
    // The idle sample is the shut-in vessel, so both readings show 0.0%.
    expect(screen.getAllByText("0.0%").length).toBeGreaterThanOrEqual(2);
  });

  it("creates unique control and helper ids across multiple dock instances", () => {
    const sample = createEquilibriumSample().total;
    renderWithLocale(<><PidControls accent="oil" config={DEFAULT_PID} locked={false} loopId="total" sample={sample} tag="LIC-101A" onChange={vi.fn()} /><PidControls accent="oil" config={DEFAULT_PID} locked={false} loopId="total" sample={sample} tag="LIC-101B" onChange={vi.fn()} /></>);
    const controls = screen.getAllByLabelText("Total level proportional gain");
    expect(controls[0].id).not.toBe(controls[1].id);
    expect(controls[0].getAttribute("aria-describedby")).not.toBe(controls[1].getAttribute("aria-describedby"));
    expect(document.querySelectorAll(`#${controls[0].id}`)).toHaveLength(1);
  });

  it("exposes loop-specific labels, units, ranges, values, and PID terms", () => {
    renderWithLocale(
      <PidControls
        accent="oil"
        config={DEFAULT_PID}
        locked={false}
        loopId="total"
        sample={createEquilibriumSample().total}
        tag="LIC-101"
        onChange={vi.fn()}
      />,
    );

    const kp = screen.getByLabelText("Total level proportional gain");
    expect(kp).toHaveAttribute("min", "0");
    expect(kp).toHaveAttribute("max", "10");
    expect(screen.getByText("LIC-101")).toBeVisible();
    expect(screen.getByText("Total level / oil valve")).toBeVisible();
    expect(screen.getAllByText(/dimensionless/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText((text) => text.includes("s⁻¹")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("s").length).toBeGreaterThan(0);
    expect(screen.getByText(/total level process value/i)).toBeVisible();
    expect(screen.getByText(/total level setpoint/i)).toBeVisible();
    expect(screen.getByText(/oil valve command/i)).toBeVisible();
    expect(screen.getByText(/oil valve actual position/i)).toBeVisible();
    expect(screen.getByText("P / I / D")).toBeVisible();
    expect(screen.getByRole("button", { name: "Help with Response strength" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Help with Offset removal" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Help with Damping and anticipation" })).toBeVisible();
  });

  it("sanitizes numeric edits without mutating the input configuration", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const original = { ...DEFAULT_PID };
    renderWithLocale(
      <PidControls
        accent="water"
        config={original}
        locked={false}
        loopId="interface"
        sample={createEquilibriumSample().interface}
        tag="IIC-101"
        onChange={onChange}
      />,
    );

    const gain = screen.getByLabelText("Interface proportional gain");
    await user.clear(gain);
    await user.type(gain, "99");
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ kp: 10 }));
    expect(original).toEqual(DEFAULT_PID);
  });

  it("locks primary and advanced settings with an explicit state message", async () => {
    const user = userEvent.setup();
    renderWithLocale(
      <PidControls
        accent="oil"
        config={DEFAULT_PID}
        locked
        loopId="total"
        sample={createEquilibriumSample().total}
        tag="LIC-101"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/locked for this attempt/i)).toBeVisible();
    expect(screen.getByText(/range 0–10 dimensionless/i)).toBeVisible();
    expect(screen.getByText("4.0")).toBeVisible();
    for (const control of screen.getAllByRole("spinbutton").slice(0, 3)) {
      expect(control).toBeDisabled();
    }
    await user.click(screen.getByText("Advanced settings", { selector: "summary" }));
    expect(screen.getByLabelText("Total level sample time")).toBeDisabled();
    expect(screen.getByLabelText("Total level integral limit")).toBeDisabled();
    expect(screen.getByLabelText("Total level derivative filter")).toBeDisabled();
  });
});
