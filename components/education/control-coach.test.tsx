import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithLocale } from "@/lib/i18n/test-utils";
import { P_ONLY_PID_PRESET } from "@/lib/onboarding/presets";
import { analyseRun, type LoopAnalysis, type RunAnalysis } from "@/lib/simulation/analysis";
import { runToEnd } from "@/lib/simulation/engine";
import { getScenario } from "@/lib/simulation/scenarios";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_PID,
  DEFAULT_SIMULATION,
  type ActuatorMetrics,
  type DualPidConfig,
  type LoopMetrics,
  type RunMetrics,
} from "@/lib/simulation/types";

import {
  ControlCoach,
  coachRun,
  diagnoseLoop,
  headlineVerdict,
  type CoachLoopInput,
} from "./control-coach";

const CALM_ANALYSIS: LoopAnalysis = {
  iae: 20,
  ise: 10,
  itae: 100,
  peakDeviationPct: 4,
  peakTimeS: 32,
  overshootPct: 3,
  settlingTimeS: 18,
  riseTimeS: 9,
  steadyOffsetPct: 0.1,
  settlingBandPct: 5,
};

const CALM_METRICS: LoopMetrics = {
  alarmTimeS: 0,
  mae: 0.4,
  maximumPct: 54,
  minimumPct: 46,
  targetBandTimeOutsideS: 12,
  stabilityStdDev: 0.3,
  oscillationCrossings: 1,
  oscillationPeakToPeakPct: 1.2,
  recoveryTimeS: 18,
  settled: true,
};

const CALM_ACTUATOR: ActuatorMetrics = {
  travelPct: 60,
  saturationTimeS: 0,
  integralLimitTimeS: 0,
};

function loopInput(overrides: Partial<CoachLoopInput> = {}): CoachLoopInput {
  return {
    loop: "total",
    gains: { ...DEFAULT_PID },
    analysis: { ...CALM_ANALYSIS },
    metrics: { ...CALM_METRICS },
    actuator: { totalVariationPct: 80, variationRatePctS: 0.5, reversals: 12 },
    actuatorMetrics: { ...CALM_ACTUATOR },
    runDurationS: 180,
    noisyMeasurement: false,
    ...overrides,
  };
}

describe("diagnoseLoop", () => {
  it("names a saturated valve before anything else, even on a calm response", () => {
    const verdict = diagnoseLoop(loopInput({
      analysis: { ...CALM_ANALYSIS, overshootPct: 60 },
      actuatorMetrics: { ...CALM_ACTUATOR, saturationTimeS: 90 },
    }));

    expect(verdict.pattern).toBe("valve-saturation");
    // Integral action is what a saturated valve stores, so that is what comes down.
    expect(verdict.move).toMatchObject({ kind: "lower", gain: "ki" });
  });

  it("treats a pegged integrator as saturation too", () => {
    expect(diagnoseLoop(loopInput({
      actuatorMetrics: { ...CALM_ACTUATOR, integralLimitTimeS: 80 },
    })).pattern).toBe("valve-saturation");
  });

  it("calls a chattering command noisy and takes derivative out first", () => {
    const verdict = diagnoseLoop(loopInput({
      gains: { ...DEFAULT_PID, kd: 12 },
      actuator: { totalVariationPct: 900, variationRatePctS: 5, reversals: 400 },
    }));

    expect(verdict.pattern).toBe("noisy-command");
    expect(verdict.move).toMatchObject({ kind: "remove", gain: "kd", toValue: 0 });
  });

  it("does not blame noise when there is no derivative and no noisy measurement", () => {
    expect(diagnoseLoop(loopInput({
      gains: { ...DEFAULT_PID, kd: 0 },
      actuator: { totalVariationPct: 900, variationRatePctS: 5, reversals: 400 },
    })).pattern).not.toBe("noisy-command");
  });

  it("calls an unsettled cycling loop sustained oscillation and cuts Kp", () => {
    const verdict = diagnoseLoop(loopInput({
      metrics: { ...CALM_METRICS, settled: false, oscillationCrossings: 9 },
    }));

    expect(verdict.pattern).toBe("sustained-oscillation");
    expect(verdict.move).toMatchObject({ kind: "lower", gain: "kp" });
    expect(verdict.move.toValue).toBeLessThan(verdict.move.fromValue);
  });

  it("calls a settled but cycling loop hunting and cuts Ki", () => {
    const verdict = diagnoseLoop(loopInput({
      metrics: { ...CALM_METRICS, oscillationCrossings: 5 },
    }));

    expect(verdict.pattern).toBe("hunting");
    expect(verdict.move).toMatchObject({ kind: "lower", gain: "ki" });
  });

  it("cuts Ki for overshoot when integral action is strong, Kp otherwise", () => {
    const overshooting = { ...CALM_ANALYSIS, overshootPct: 45 };

    expect(diagnoseLoop(loopInput({
      analysis: overshooting,
      gains: { ...DEFAULT_PID, ki: 0.2 },
    })).move).toMatchObject({ kind: "lower", gain: "ki" });
    expect(diagnoseLoop(loopInput({
      analysis: overshooting,
      gains: { ...DEFAULT_PID, ki: 0.02 },
    })).move).toMatchObject({ kind: "lower", gain: "kp" });
  });

  it("reads the P-only signature — settled, calm, permanently off target", () => {
    const verdict = diagnoseLoop(loopInput({
      gains: { ...DEFAULT_PID, ki: 0, kd: 0 },
      analysis: { ...CALM_ANALYSIS, steadyOffsetPct: -3.4, settlingBandPct: 5 },
    }));

    expect(verdict.pattern).toBe("offset");
    // With no integral action at all the coach has to seed it, not scale zero.
    expect(verdict.move).toMatchObject({ kind: "raise", gain: "ki", fromValue: 0 });
    expect(verdict.move.toValue).toBeGreaterThan(0);
  });

  it("calls a slow, calm, never-settling loop sluggish and raises Kp", () => {
    const verdict = diagnoseLoop(loopInput({
      analysis: { ...CALM_ANALYSIS, settlingTimeS: null, overshootPct: 1, steadyOffsetPct: 0 },
      metrics: { ...CALM_METRICS, settled: false, oscillationCrossings: 0 },
    }));

    expect(verdict.pattern).toBe("sluggish");
    expect(verdict.move).toMatchObject({ kind: "raise", gain: "kp" });
    expect(verdict.move.toValue).toBeGreaterThan(verdict.move.fromValue);
  });

  it("falls back to the shared gain advisory when the response says nothing", () => {
    const verdict = diagnoseLoop(loopInput({ gains: { ...DEFAULT_PID, kp: 9 } }));

    // `gainAdvisory` owns this vocabulary; the coach must not invent its own.
    expect(verdict.pattern).toBe("sustained-oscillation");
  });

  it("holds when neither the response nor the gains raise a flag", () => {
    const verdict = diagnoseLoop(loopInput({ gains: { ...DEFAULT_PID, kp: 4, ki: 0.08, kd: 0 } }));

    expect(verdict.pattern).toBeNull();
    expect(verdict.move.kind).toBe("hold");
  });

  it("never suggests a gain the engine would clamp away", () => {
    const verdict = diagnoseLoop(loopInput({
      gains: { ...DEFAULT_PID, kp: 9.8 },
      analysis: { ...CALM_ANALYSIS, settlingTimeS: null, overshootPct: 0, steadyOffsetPct: 0 },
      metrics: { ...CALM_METRICS, settled: false, oscillationCrossings: 0 },
    }));

    expect(verdict.move.toValue).toBeLessThanOrEqual(10);
  });
});

describe("coachRun", () => {
  function runFixture(): { analysis: RunAnalysis; metrics: RunMetrics; pid: DualPidConfig } {
    const scenario = getScenario("feed-step");
    const run = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "feed-step", scenario.seed);
    return {
      analysis: analyseRun(run.samples, DEFAULT_SIMULATION, {
        startS: scenario.disturbanceStartS,
      }),
      metrics: run.result.metrics,
      pid: DEFAULT_DUAL_PID,
    };
  }

  it("diagnoses exactly the loops the run had, in dashboard order", () => {
    const verdicts = coachRun(runFixture());

    expect(verdicts.map((verdict) => verdict.loop)).toEqual(["total", "interface"]);
  });

  it("is deterministic for the same run", () => {
    expect(coachRun(runFixture())).toEqual(coachRun(runFixture()));
  });

  it("picks the most severe pattern as the headline", () => {
    const verdicts = [
      { pattern: "sluggish" as const },
      { pattern: "valve-saturation" as const },
      { pattern: "offset" as const },
    ].map((partial, index) => ({
      ...partial,
      loop: (["total", "interface", "pressure"] as const)[index],
      move: { kind: "hold" as const, gain: null, fromValue: 0, toValue: 0 },
      analysis: CALM_ANALYSIS,
      actuator: { totalVariationPct: 0, variationRatePctS: 0, reversals: 0 },
    }));

    expect(headlineVerdict(verdicts)?.pattern).toBe("valve-saturation");
    expect(headlineVerdict([])).toBeNull();
  });
});

describe("ControlCoach", () => {
  function renderCoach(
    extras: Partial<React.ComponentProps<typeof ControlCoach>> = {},
    locale: "en" | "es" = "en",
  ) {
    const scenario = getScenario("water-rich-slug");
    const run = runToEnd(
      DEFAULT_SIMULATION,
      { total: { ...DEFAULT_PID, ki: 0, kd: 0 }, interface: { ...DEFAULT_PID, ki: 0, kd: 0 } },
      "water-rich-slug",
      scenario.seed,
    );
    return renderWithLocale(
      <ControlCoach
        analysis={analyseRun(run.samples, DEFAULT_SIMULATION, {
          startS: scenario.disturbanceStartS,
        })}
        metrics={run.result.metrics}
        pid={{ total: { ...DEFAULT_PID, ki: 0, kd: 0 }, interface: { ...DEFAULT_PID, ki: 0, kd: 0 } }}
        {...extras}
      />,
      { locale },
    );
  }

  it("names a pattern and one concrete next move per loop", () => {
    renderCoach();

    expect(screen.getByRole("region", { name: "Post-run tuning coach" })).toBeVisible();
    expect(screen.getAllByText("Next move")).toHaveLength(2);
    expect(
      screen.getByText(/Change only the gain named above/),
    ).toBeVisible();
  });

  it("describes the P-only experiment without a button until one is wired", () => {
    renderCoach();

    expect(screen.getByText("Untuned P-only")).toBeVisible();
    expect(screen.queryByRole("button", { name: /Load the/ })).toBeNull();
  });

  it("loads the P-only gains when the dashboard supplies a handler", async () => {
    const onApplyPreset = vi.fn();
    const user = userEvent.setup();
    renderCoach({ onApplyPreset });

    await user.click(screen.getByRole("button", { name: "Load the Untuned P-only gains" }));

    expect(onApplyPreset).toHaveBeenCalledWith(P_ONLY_PID_PRESET.config);
  });

  it("coaches in Spanish", () => {
    renderCoach({}, "es");

    expect(
      screen.getByRole("region", { name: "Coach de sintonía posterior a la corrida" }),
    ).toBeVisible();
    expect(screen.getAllByText("Próximo movimiento").length).toBeGreaterThan(0);
    expect(screen.getByText("P solo, sin sintonizar")).toBeVisible();
  });
});
