import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ResultPanel } from "./result-panel";
import { renderWithLocale } from "@/lib/i18n/test-utils";
import type { RunResult } from "@/lib/simulation/types";

const result: RunResult = {
  metrics: {
    alarmTimeS: 0,
    recoveryTimeS: 30,
    settled: true,
    minimumOilLayerPct: 18,
    loops: {
      total: {
        alarmTimeS: 0,
        mae: 2,
        maximumPct: 62,
        minimumPct: 48,
        targetBandTimeOutsideS: 20,
        stabilityStdDev: 2,
        oscillationCrossings: 2,
        oscillationPeakToPeakPct: 6,
        recoveryTimeS: 30,
        settled: true,
      },
      interface: {
        alarmTimeS: 0,
        mae: 1,
        maximumPct: 24,
        minimumPct: 18,
        targetBandTimeOutsideS: 10,
        stabilityStdDev: 1,
        oscillationCrossings: 1,
        oscillationPeakToPeakPct: 3,
        recoveryTimeS: 20,
        settled: true,
      },
    },
    actuators: {
      oil: { travelPct: 120, saturationTimeS: 0, integralLimitTimeS: 0 },
      water: { travelPct: 80, saturationTimeS: 0, integralLimitTimeS: 0 },
    },
    phaseTotals: {
      oilInletM3: 1.75,
      waterInletM3: 0.75,
      oilOutletM3: 1.7,
      waterOutletM3: 0.72,
      finalOilVolumeM3: 1.25,
      finalWaterVolumeM3: 0.51,
    },
    trip: null,
  },
  score: {
    safety: 35,
    tracking: 21,
    stability: 11,
    recovery: 10,
    valveEfficiency: 7,
    modifiers: [],
    total: 84,
    rank: "specialist",
    feedback: { kind: "balanced" },
  },
};

describe("result panel", () => {
  it("presents score, rank, deterministic diagnosis, and retry action", () => {
    renderWithLocale(<ResultPanel result={result} onClose={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByText("84")).toBeVisible();
    expect(screen.getByText("Loop Tuning Specialist")).toBeVisible();
    expect(screen.getByText("Balanced total level and interface response")).toBeVisible();
    expect(screen.getByRole("button", { name: /tune and retry/i })).toBeVisible();
    expect(within(screen.getByRole("heading", { name: "Total level loop" }).parentElement!).getAllByText("2.0%", { selector: "strong" })[0]).toBeVisible();
    expect(within(screen.getByRole("heading", { name: "Oil/water interface loop" }).parentElement!).getAllByText("1.0%", { selector: "strong" })[0]).toBeVisible();
    expect(screen.getByText("120.0%", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("80.0%", { selector: "strong" })).toBeVisible();
    expect(screen.getByText("No trip")).toBeVisible();
    expect(screen.getByText("No modifiers applied")).toBeVisible();
    expect(screen.getByText(/Try a harder scenario/)).toBeVisible();
  });

  it("shows the exact trip and every applied modifier", () => {
    const tripped: RunResult = {
      metrics: { ...result.metrics, trip: "INTERFACE_HH" },
      score: {
        ...result.score,
        feedback: { kind: "recovery", loop: "interface" },
        modifiers: [
          { id: "trip", trip: "INTERFACE_HH", points: 0 },
          { id: "water-saturation", points: -4 },
        ],
      },
    };
    renderWithLocale(<ResultPanel result={tripped} onClose={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText("Interface high-high trip")).toBeVisible();
    expect(screen.getByText(/Interface \/ water valve recovery/)).toBeVisible();
    expect(screen.getByText("Interface high-high trip cap")).toBeVisible();
    expect(screen.getByText("Water valve long saturation")).toBeVisible();
    expect(screen.getByText(/Retune the Interface loop and water valve/)).toBeVisible();
  });

  it("traps focus, closes on Escape, and restores the trigger", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return <>
        <button type="button" onClick={() => setOpen(true)}>Show results</button>
        {open && <ResultPanel result={result} onClose={() => setOpen(false)} onRetry={vi.fn()} />}
      </>;
    }
    renderWithLocale(<Harness />);

    const trigger = screen.getByRole("button", { name: "Show results" });
    await user.click(trigger);
    expect(screen.getByRole("button", { name: "Close results" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Review trends" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
