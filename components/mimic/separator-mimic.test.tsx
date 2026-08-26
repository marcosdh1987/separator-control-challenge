import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SeparatorMimic } from "@/components/mimic/separator-mimic";
import { createEquilibriumSample } from "@/hooks/use-simulation";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import {
  DEFAULT_SIMULATION,
  DEFAULT_SIMULATION_WITH_GAS,
  DEFAULT_TRIPLE_PID,
  type SimulationSample,
} from "@/lib/simulation/types";

const liquidSample = () => createEquilibriumSample(DEFAULT_SIMULATION);
const gasSample = () => createEquilibriumSample(DEFAULT_SIMULATION_WITH_GAS, DEFAULT_TRIPLE_PID);

const tagsIn = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("[data-tag]")).map((node) => node.getAttribute("data-tag"));

describe("separator mimic", () => {
  it("draws the liquid loops with the tags the rest of the interface uses", () => {
    const { container } = renderWithLocale(<SeparatorMimic sample={liquidSample()} status="running" />);

    expect(tagsIn(container)).toEqual(
      expect.arrayContaining(["LT-101", "LT-102", "LIC-101", "IIC-101", "LV-101", "WV-101"]),
    );
  });

  it("leaves out the pressure loop and the gas line while the gas cap is disabled", () => {
    const { container } = renderWithLocale(<SeparatorMimic sample={liquidSample()} status="idle" />);

    expect(container.querySelector("[data-testid='pid-mimic']")).toHaveAttribute("data-gas-enabled", "false");
    expect(tagsIn(container)).not.toContain("PT-101");
    expect(tagsIn(container)).not.toContain("PIC-101");
    expect(tagsIn(container)).not.toContain("PCV-101");
    expect(screen.queryByText(/PT-101/)).not.toBeInTheDocument();
  });

  it("adds PT-101, PIC-101 and PCV-101 once the gas cap is enabled", () => {
    const sample = gasSample();
    expect(sample.gas).toBeDefined();
    const { container } = renderWithLocale(<SeparatorMimic sample={sample} status="running" />);

    expect(container.querySelector("[data-testid='pid-mimic']")).toHaveAttribute("data-gas-enabled", "true");
    expect(tagsIn(container)).toEqual(
      expect.arrayContaining(["PT-101", "PIC-101", "PCV-101"]),
    );
    expect(screen.getByText(/PT-101 · Gas cap pressure/)).toBeInTheDocument();
  });

  it("exposes the diagram as an image with the spoken process summary", () => {
    renderWithLocale(<SeparatorMimic sample={liquidSample()} status="running" />);

    const diagram = screen.getByRole("img", { name: /piping and instrumentation diagram/i });
    expect(diagram).toHaveAccessibleName(/SEP-101 horizontal separator with gas, oil, and water/i);
  });

  it("exposes the readings list as a group, which a bare description list is not", () => {
    renderWithLocale(<SeparatorMimic sample={liquidSample()} status="running" />);

    const readings = screen.getByRole("group", { name: "P&ID instrument readings" });
    expect(readings.tagName).toBe("DL");
    expect(readings).toHaveTextContent("LT-101 · Total level");
    expect(readings).toHaveTextContent("LV-101 · Oil valve");
  });

  it("reflects valve travel in both the symbol and its reading", () => {
    const sample: SimulationSample = { ...liquidSample() };
    sample.total = { ...sample.total, valvePositionPct: 100 };
    sample.interface = { ...sample.interface, valvePositionPct: 0 };
    const { container } = renderWithLocale(<SeparatorMimic sample={sample} status="running" />);

    expect(container.querySelector("[data-tag='LV-101']")).toHaveAttribute("data-valve-state", "open");
    expect(container.querySelector("[data-tag='LV-101']")).toHaveAttribute("data-open-fraction", "1.000");
    expect(container.querySelector("[data-tag='WV-101']")).toHaveAttribute("data-valve-state", "shut");
    expect(screen.getByRole("group", { name: "P&ID instrument readings" })).toHaveTextContent("100.0% · Open");
  });

  it("marks an alarm and a trip with different shapes, not colour alone", () => {
    const alarmed: SimulationSample = { ...liquidSample() };
    alarmed.safety = { severity: "alarm", source: "total", condition: "total-high", trip: null };
    const { container, unmount } = renderWithLocale(<SeparatorMimic sample={alarmed} status="running" />);

    expect(container.querySelector("[data-testid='pid-alarm-alarm'] polygon")?.getAttribute("points")?.split(" ")).toHaveLength(3);
    expect(container.querySelector("[data-tag='LT-101']")).toHaveAttribute("data-severity", "alarm");
    expect(container.querySelector("[data-tag='LT-102']")).toHaveAttribute("data-severity", "safe");
    unmount();

    const tripped: SimulationSample = { ...liquidSample() };
    tripped.safety = { severity: "trip", source: "interface", condition: "interface-high-high", trip: "INTERFACE_HH" };
    const trippedRender = renderWithLocale(<SeparatorMimic sample={tripped} status="tripped" />);

    expect(
      trippedRender.container.querySelector("[data-testid='pid-alarm-trip'] polygon")?.getAttribute("points")?.split(" "),
    ).toHaveLength(8);
    expect(trippedRender.container.querySelector("[data-tag='LT-102']")).toHaveAttribute("data-severity", "trip");
  });

  it("keeps the drawing scalable rather than pinned to a pixel size", () => {
    const { container } = renderWithLocale(<SeparatorMimic sample={liquidSample()} status="idle" />);
    const svg = container.querySelector("svg.pid-diagram");

    expect(svg).toHaveAttribute("viewBox", "0 0 840 500");
    expect(svg).not.toHaveAttribute("width");
    expect(svg).not.toHaveAttribute("height");
  });

  it("translates the diagram without renaming its instruments", () => {
    const { container } = renderWithLocale(<SeparatorMimic sample={liquidSample()} status="running" />, { locale: "es" });

    expect(screen.getByRole("group", { name: "Lecturas de instrumentos del P&ID" })).toHaveTextContent("Nivel total");
    expect(tagsIn(container)).toEqual(expect.arrayContaining(["LT-101", "LV-101"]));
  });
});
