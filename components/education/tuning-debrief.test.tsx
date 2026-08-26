import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithLocale } from "@/lib/i18n/test-utils";
import { analyseRun, type RunAnalysis } from "@/lib/simulation/analysis";
import { runToEnd } from "@/lib/simulation/engine";
import { getScenario } from "@/lib/simulation/scenarios";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_PID,
  DEFAULT_SIMULATION,
  DEFAULT_SIMULATION_WITH_GAS,
  DEFAULT_TRIPLE_PID,
  type DualPidConfig,
} from "@/lib/simulation/types";

import {
  TuningDebrief,
  compareMetric,
  diffGains,
  type TuningAttempt,
} from "./tuning-debrief";

function attempt(
  pid: DualPidConfig,
  config = DEFAULT_SIMULATION,
  scenarioId: "feed-step" | "gor-surge" = "feed-step",
): TuningAttempt {
  const scenario = getScenario(scenarioId);
  const run = runToEnd(config, pid, scenarioId, scenario.seed);
  return {
    analysis: analyseRun(run.samples, config, { startS: scenario.disturbanceStartS }),
    pid,
  };
}

function withLoopAnalysis(
  base: RunAnalysis,
  overrides: Partial<RunAnalysis["loops"]["total"]>,
): RunAnalysis {
  return {
    ...base,
    loops: { ...base.loops, total: { ...base.loops.total, ...overrides } },
  };
}

describe("compareMetric", () => {
  it("calls a fall better and a rise worse, because every figure here is a cost", () => {
    expect(compareMetric(100, 60)).toBe("better");
    expect(compareMetric(60, 100)).toBe("worse");
  });

  it("ignores movement too small to be a result", () => {
    expect(compareMetric(100, 100.4)).toBe("unchanged");
    expect(compareMetric(100, 100)).toBe("unchanged");
  });

  it("treats a figure that was never reached as the worst possible value", () => {
    // An unsettled run has no settling time. It must not read as an improvement.
    expect(compareMetric(40, null)).toBe("worse");
    expect(compareMetric(null, 40)).toBe("better");
    expect(compareMetric(null, null)).toBe("unchanged");
  });

  it("does not divide by zero when both attempts were perfect", () => {
    expect(compareMetric(0, 0)).toBe("unchanged");
  });
});

describe("diffGains", () => {
  it("lists every gain that moved, in loop then gain order", () => {
    const changes = diffGains(DEFAULT_DUAL_PID, {
      total: { ...DEFAULT_PID, kp: 6 },
      interface: { ...DEFAULT_PID, ki: 0.15 },
    });

    expect(changes).toEqual([
      { loop: "total", gain: "kp", fromValue: DEFAULT_PID.kp, toValue: 6 },
      { loop: "interface", gain: "ki", fromValue: DEFAULT_PID.ki, toValue: 0.15 },
    ]);
  });

  it("reports nothing when the two attempts used identical gains", () => {
    expect(diffGains(DEFAULT_DUAL_PID, { ...DEFAULT_DUAL_PID })).toEqual([]);
  });

  it("skips the pressure loop when only one of the attempts had one", () => {
    expect(diffGains(DEFAULT_TRIPLE_PID, DEFAULT_DUAL_PID)).toEqual([]);
  });

  it("compares the pressure loop when both attempts had one", () => {
    const changes = diffGains(DEFAULT_TRIPLE_PID, {
      ...DEFAULT_TRIPLE_PID,
      pressure: { ...DEFAULT_TRIPLE_PID.pressure!, kp: 1.5 },
    });

    expect(changes).toEqual([
      { loop: "pressure", gain: "kp", fromValue: DEFAULT_TRIPLE_PID.pressure!.kp, toValue: 1.5 },
    ]);
  });
});

describe("TuningDebrief", () => {
  it("invites a second run when there is nothing to compare against yet", () => {
    renderWithLocale(<TuningDebrief current={attempt(DEFAULT_DUAL_PID)} />);

    expect(screen.getByRole("region", { name: "Tuning debrief" })).toBeVisible();
    expect(screen.getByText(/First attempt on this scenario/)).toBeVisible();
    expect(screen.queryByText("What you changed")).toBeNull();
  });

  it("says which gain changed between the two attempts", () => {
    const previous = attempt(DEFAULT_DUAL_PID);
    const current = attempt({
      total: { ...DEFAULT_PID, kp: 6 },
      interface: { ...DEFAULT_PID },
    });

    renderWithLocale(<TuningDebrief current={current} previous={previous} />);

    expect(screen.getByText("Total level: Kp 4 → 6")).toBeVisible();
    expect(screen.queryByText(/More than one gain changed/)).toBeNull();
  });

  it("warns when the run broke the one-change-at-a-time rule", () => {
    const previous = attempt(DEFAULT_DUAL_PID);
    const current = attempt({
      total: { ...DEFAULT_PID, kp: 6 },
      interface: { ...DEFAULT_PID, ki: 0.2 },
    });

    renderWithLocale(<TuningDebrief current={current} previous={previous} />);

    expect(screen.getByText(/More than one gain changed/)).toBeVisible();
  });

  it("marks a metric that fell as better and one that rose as worse", () => {
    const base = attempt(DEFAULT_DUAL_PID);
    const previous: TuningAttempt = {
      pid: DEFAULT_DUAL_PID,
      analysis: withLoopAnalysis(base.analysis, { iae: 400, overshootPct: 5 }),
    };
    const current: TuningAttempt = {
      pid: { total: { ...DEFAULT_PID, kp: 6 }, interface: { ...DEFAULT_PID } },
      analysis: withLoopAnalysis(base.analysis, { iae: 100, overshootPct: 40 }),
    };

    renderWithLocale(<TuningDebrief current={current} previous={previous} />);

    const totalTable = screen.getByRole("table", { name: "Total level" });
    const iaeRow = within(totalTable).getByRole("rowheader", { name: /^IAE/ }).closest("tr");
    const overshootRow = within(totalTable)
      .getByRole("rowheader", { name: /^Overshoot/ })
      .closest("tr");

    expect(iaeRow).toHaveAttribute("data-verdict", "better");
    expect(overshootRow).toHaveAttribute("data-verdict", "worse");
  });

  it("compares the absolute offset, so swapping its sign is not an improvement", () => {
    const base = attempt(DEFAULT_DUAL_PID);
    const previous: TuningAttempt = {
      pid: DEFAULT_DUAL_PID,
      analysis: withLoopAnalysis(base.analysis, { steadyOffsetPct: 2 }),
    };
    const current: TuningAttempt = {
      pid: DEFAULT_DUAL_PID,
      analysis: withLoopAnalysis(base.analysis, { steadyOffsetPct: -2 }),
    };

    renderWithLocale(<TuningDebrief current={current} previous={previous} />);

    const row = within(screen.getByRole("table", { name: "Total level" }))
      .getByRole("rowheader", { name: /^Steady-state offset/ })
      .closest("tr");

    expect(row).toHaveAttribute("data-verdict", "unchanged");
  });

  it("shows a table per liquid loop and none for pressure without a gas cap", () => {
    renderWithLocale(<TuningDebrief current={attempt(DEFAULT_DUAL_PID)} />);

    expect(screen.getByRole("table", { name: "Total level" })).toBeVisible();
    expect(screen.getByRole("table", { name: "Interface" })).toBeVisible();
    expect(screen.queryByRole("table", { name: "Pressure" })).toBeNull();
  });

  it("adds the pressure table when the run carried a gas cap", () => {
    renderWithLocale(
      <TuningDebrief
        current={attempt(DEFAULT_TRIPLE_PID, DEFAULT_SIMULATION_WITH_GAS, "gor-surge")}
      />,
    );

    expect(screen.getByRole("table", { name: "Pressure" })).toBeVisible();
  });

  it("debriefs in Spanish", () => {
    renderWithLocale(
      <TuningDebrief current={attempt(DEFAULT_DUAL_PID)} />,
      { locale: "es" },
    );

    expect(screen.getByRole("region", { name: "Balance de sintonía" })).toBeVisible();
    expect(screen.getByText(/Primer intento en este escenario/)).toBeVisible();
    expect(screen.getByRole("table", { name: "Nivel total" })).toBeVisible();
  });
});
