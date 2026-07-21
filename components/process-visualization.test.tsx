import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProcessVisualization } from "./process-visualization";
import { createEquilibriumSample } from "@/hooks/use-simulation";
import type { SimulationSample } from "@/lib/simulation/types";

function sampleWith(safety: SimulationSample["safety"] = createEquilibriumSample().safety) {
  const sample = structuredClone(createEquilibriumSample());
  sample.timeS = 45;
  sample.total.processValuePct = 78;
  sample.total.measuredValuePct = 77.8;
  sample.total.valvePositionPct = 72;
  sample.total.valveCommandPct = 80;
  sample.interface.processValuePct = 20;
  sample.interface.measuredValuePct = 20.4;
  sample.interface.valvePositionPct = 48;
  sample.interface.valveCommandPct = 52;
  sample.flows.totalInletM3H = 70;
  sample.flows.oilOutletM3H = 40;
  sample.flows.waterOutletM3H = 15;
  sample.safety = safety;
  return sample;
}

describe("process visualization fallback", () => {
  it("renders a complete, semantic three-phase engineering view", () => {
    render(<ProcessVisualization sample={sampleWith({ severity: "alarm", source: "total", label: "Total level high alarm", trip: null })} status="running" />);

    const region = screen.getByRole("region", { name: /separator process cutaway/i });
    expect(within(region).getByRole("img", { name: /gas, oil, and water.*true total level 78\.0.*measured interface 20\.4.*total inlet 70\.0.*actual oil valve 72\.0.*total level high alarm/i })).toBeVisible();
    expect(within(region).getByText("GAS SPACE")).toBeVisible();
    expect(within(region).getByText("OIL INVENTORY")).toBeVisible();
    expect(within(region).getByText("WATER INVENTORY")).toBeVisible();
    expect(within(region).getByText(/total inlet · 70\.0 m³\/h/i)).toBeVisible();
    expect(within(region).getByText(/oil outlet · 40\.0 m³\/h/i)).toBeVisible();
    expect(within(region).getByText(/water outlet · 15\.0 m³\/h/i)).toBeVisible();
    expect(within(region).getByText("Oil actual").nextElementSibling).toHaveTextContent("72.0%");
    expect(within(region).getByText("Water actual").nextElementSibling).toHaveTextContent("48.0%");
    expect(within(region).getAllByText("Total level high alarm").length).toBeGreaterThanOrEqual(2);
    expect(within(region).getByText(/2d engineering fallback/i)).toBeVisible();
  });

  it.each([
    ["TOTAL_LL", "total", "Total low-low trip"],
    ["TOTAL_HH", "total", "Total high-high trip"],
    ["INTERFACE_LL", "interface", "Interface low-low trip"],
    ["INTERFACE_HH", "interface", "Interface high-high trip"],
    ["OIL_LAYER_LL", "oil-layer", "Oil layer low-low trip"],
  ] as const)("names the active %s safety source", (trip, source, label) => {
    render(<ProcessVisualization sample={sampleWith({ severity: "trip", source, label, trip })} status="tripped" />);
    expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole("img")).toHaveAccessibleName(new RegExp(`${label}`, "i"));
  });

  it("uses instance-safe SVG definitions", () => {
    const { container } = render(<><ProcessVisualization sample={sampleWith()} status="idle" /><ProcessVisualization sample={sampleWith()} status="idle" /></>);
    const ids = Array.from(container.querySelectorAll("defs [id]"), (node) => node.id);
    expect(ids.length).toBeGreaterThan(8);
    expect(new Set(ids).size).toBe(ids.length);
    for (const reference of container.querySelectorAll("[clip-path], [fill^='url']")) {
      const value = reference.getAttribute("clip-path") ?? reference.getAttribute("fill") ?? "";
      const id = value.match(/#(.+)\)/)?.[1];
      if (id) expect(container.querySelector(`[id="${id}"]`)).not.toBeNull();
    }
  });

  it.each([
    ["inlet", "var(--cyan-bright)"],
    ["oil", "var(--amber)"],
    ["water", "var(--cyan-bright)"],
  ] as const)("gives the %s stream marker an explicit visible phase color", (stream, fill) => {
    render(<ProcessVisualization sample={sampleWith()} status="running" />);
    const markerPath = screen.getByTestId(`${stream}-flow-marker`);
    expect(markerPath).toHaveAttribute("fill", fill);
    expect(markerPath.closest("marker")).toHaveAttribute("orient", "auto-start-reverse");
  });

  it.each([
    ["inlet", "totalInletM3H"],
    ["oil", "oilOutletM3H"],
    ["water", "waterOutletM3H"],
  ] as const)("renders honest positive, negative, and stopped %s flow direction", (stream, field) => {
    const sample = sampleWith();
    sample.flows[field] = 25;
    const { rerender } = render(<ProcessVisualization sample={sample} status="running" />);
    const positive = screen.getByTestId(`${stream}-flow-indicator`);
    expect(positive).toHaveAttribute("data-flow-state", "forward");
    expect(positive).toHaveAttribute("marker-end");
    expect(positive).not.toHaveAttribute("marker-start");

    sample.flows[field] = -25;
    rerender(<ProcessVisualization sample={sample} status="running" />);
    const negative = screen.getByTestId(`${stream}-flow-indicator`);
    expect(negative).toHaveAttribute("data-flow-state", "reverse");
    expect(negative).toHaveAttribute("marker-start");
    expect(negative).not.toHaveAttribute("marker-end");

    sample.flows[field] = 0;
    rerender(<ProcessVisualization sample={sample} status="running" />);
    const stopped = screen.getByTestId(`${stream}-flow-indicator`);
    expect(stopped).toHaveAttribute("data-flow-state", "stopped");
    expect(stopped).not.toHaveAttribute("marker-start");
    expect(stopped).not.toHaveAttribute("marker-end");
    expect(stopped).toHaveStyle({ animationName: "none" });
    expect(screen.getByText(new RegExp(`${stream === "inlet" ? "total inlet" : `${stream} outlet`} · stopped \/ 0\\.0 m³\/h`, "i"))).toBeVisible();
  });

  it("keeps critical operating values in semantic HTML outside the scaled SVG", () => {
    render(<ProcessVisualization sample={sampleWith({ severity: "alarm", source: "total", label: "Total level high alarm", trip: null })} status="running" />);
    const instruments = screen.getByRole("group", { name: "Critical separator instruments" });
    for (const label of ["Total true", "Total measured", "Total SP", "Interface true", "Interface measured", "Interface SP", "Total inlet", "Oil outlet", "Water outlet", "Oil command", "Oil actual", "Water command", "Water actual", "Active safety"]) {
      expect(within(instruments).getByText(label)).toBeVisible();
    }
    expect(within(instruments).getByText("78.0%")).toBeVisible();
    expect(within(instruments).getByText("70.0 m³/h")).toBeVisible();
    expect(within(instruments).getByText("Total level high alarm")).toBeVisible();
  });

  it("renders hostile values as placeholders without leaking NaN or Infinity", () => {
    const sample = sampleWith();
    sample.total.processValuePct = Number.NaN;
    sample.total.measuredValuePct = Number.POSITIVE_INFINITY;
    sample.interface.valveCommandPct = Number.NEGATIVE_INFINITY;
    sample.flows.totalInletM3H = Number.NaN;
    const { container } = render(<ProcessVisualization sample={sample} status="running" />);
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
    expect(screen.getAllByText(/—/).length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole("img")).toHaveAccessibleName(/unavailable/i);
  });
});
