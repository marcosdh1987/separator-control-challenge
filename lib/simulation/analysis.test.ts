import { describe, expect, it } from "vitest";

import {
  analyseCommand,
  analyseResponse,
  analyseRun,
  integralAbsoluteError,
  integralSquaredError,
  integralTimeAbsoluteError,
  type ResponsePoint,
  type SignalPoint,
} from "./analysis";
import { runToEnd } from "./engine";
import { getScenario } from "./scenarios";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_SIMULATION,
  DEFAULT_SIMULATION_WITH_GAS,
  DEFAULT_TRIPLE_PID,
} from "./types";

/** Samples `value(t)` on a uniform grid, against a fixed setpoint. */
function sampleResponse(
  value: (timeS: number) => number,
  setpointPct: number,
  { durationS, stepS }: { durationS: number; stepS: number },
): ResponsePoint[] {
  const points: ResponsePoint[] = [];
  for (let index = 0; index * stepS <= durationS + 1e-9; index += 1) {
    const timeS = index * stepS;
    points.push({ timeS, valuePct: value(timeS), setpointPct });
  }
  return points;
}

/**
 * Unit step response of a second-order system with damping ζ and natural frequency
 * ωn, starting from rest. Its percent overshoot is exactly
 * `exp(−ζπ/√(1 − ζ²)) · 100`, which is what the analysis is pinned against.
 */
function secondOrderStep(damping: number, naturalFrequencyRadS: number) {
  const damped = Math.sqrt(1 - damping * damping);
  const phase = Math.acos(damping);
  return (timeS: number) =>
    1 -
    (Math.exp(-damping * naturalFrequencyRadS * timeS) / damped) *
      Math.sin(naturalFrequencyRadS * damped * timeS + phase);
}

function analyticOvershootPct(damping: number): number {
  return Math.exp((-damping * Math.PI) / Math.sqrt(1 - damping * damping)) * 100;
}

describe("error integrals", () => {
  it("integrates a constant error exactly", () => {
    // e = +2 held for 10 s: IAE = 20, ISE = 40, ITAE = 2 · 10²/2 = 100.
    const series = sampleResponse(() => 52, 50, { durationS: 10, stepS: 0.25 });

    expect(integralAbsoluteError(series)).toBeCloseTo(20, 9);
    expect(integralSquaredError(series)).toBeCloseTo(40, 9);
    expect(integralTimeAbsoluteError(series)).toBeCloseTo(100, 9);
  });

  it("integrates a ramp: exactly for IAE, to trapezoidal accuracy for ITAE", () => {
    // e(t) = t over [0, 6]. IAE = ∫t = 18 is linear, so the trapezoidal rule is
    // exact. ITAE = ∫t² = 72 is quadratic, so it carries the rule's O(h²) error.
    const series = sampleResponse((timeS) => 50 + timeS, 50, { durationS: 6, stepS: 0.01 });

    expect(integralAbsoluteError(series)).toBeCloseTo(18, 9);
    expect(integralTimeAbsoluteError(series)).toBeCloseTo(72, 3);
  });

  it("weights late error more heavily in ITAE than early error of the same size", () => {
    const early = sampleResponse(
      (timeS) => (timeS < 10 ? 55 : 50),
      50,
      { durationS: 40, stepS: 0.01 },
    );
    const late = sampleResponse(
      (timeS) => (timeS >= 30 ? 55 : 50),
      50,
      { durationS: 40, stepS: 0.01 },
    );

    expect(integralAbsoluteError(early)).toBeCloseTo(integralAbsoluteError(late), 0);
    expect(integralTimeAbsoluteError(late)).toBeGreaterThan(
      integralTimeAbsoluteError(early) * 3,
    );
  });

  it("opens the window at startS, ignoring the quiet approach to the disturbance", () => {
    // Nothing happens before t = 20; error is +1 for the 10 s after it.
    const series = sampleResponse(
      (timeS) => (timeS >= 20 ? 51 : 50),
      50,
      { durationS: 30, stepS: 0.1 },
    );

    expect(integralAbsoluteError(series, { startS: 20 })).toBeCloseTo(10, 6);
    // ITAE restarts its clock at the window, so the 10 s of error costs 50, not 250.
    expect(integralTimeAbsoluteError(series, { startS: 20 })).toBeCloseTo(50, 6);
  });

  it("ignores non-finite values and non-increasing timestamps", () => {
    const series: ResponsePoint[] = [
      { timeS: 0, valuePct: 52, setpointPct: 50 },
      { timeS: Number.NaN, valuePct: 99, setpointPct: 50 },
      { timeS: 5, valuePct: Number.POSITIVE_INFINITY, setpointPct: 50 },
      { timeS: 5, valuePct: 52, setpointPct: 50 },
      { timeS: 2, valuePct: 99, setpointPct: 50 },
      { timeS: 10, valuePct: 52, setpointPct: 50 },
    ];

    expect(integralAbsoluteError(series)).toBeCloseTo(20, 9);
  });

  it("returns zero rather than throwing on an empty or single-point series", () => {
    expect(integralAbsoluteError([])).toBe(0);
    expect(integralSquaredError([{ timeS: 0, valuePct: 9, setpointPct: 0 }])).toBe(0);
  });
});

describe("analyseResponse on a known second-order step", () => {
  it.each([0.3, 0.5, 0.7])(
    "recovers the analytic percent overshoot at ζ = %s",
    (damping) => {
      const series = sampleResponse(secondOrderStep(damping, 1), 1, {
        durationS: 60,
        stepS: 0.005,
      });

      const analysis = analyseResponse(series, { bandPct: 0.02 });

      // The step is the excursion: PV starts a full unit below setpoint.
      expect(analysis.peakDeviationPct).toBeCloseTo(-1, 6);
      expect(analysis.peakTimeS).toBeCloseTo(0, 6);
      expect(analysis.overshootPct).toBeCloseTo(analyticOvershootPct(damping), 1);
    },
  );

  it("reports no overshoot for a response that never crosses setpoint", () => {
    const series = sampleResponse(
      (timeS) => 1 - Math.exp(-timeS / 4),
      1,
      { durationS: 60, stepS: 0.01 },
    );

    expect(analyseResponse(series, { bandPct: 0.02 }).overshootPct).toBe(0);
  });

  it("measures 10–90% rise time of a first-order lag as τ·ln 9", () => {
    const tauS = 5;
    const series = sampleResponse(
      (timeS) => 50 - 10 * Math.exp(-timeS / tauS),
      50,
      { durationS: 80, stepS: 0.05 },
    );

    const analysis = analyseResponse(series, { bandPct: 0.2 });

    expect(analysis.riseTimeS).toBeCloseTo(tauS * Math.log(9), 2);
  });

  it("leaves rise time unset when the response never reaches a tenth of its peak", () => {
    // A P-only-style response that stalls at 40% of the original excursion.
    const series = sampleResponse(
      (timeS) => 50 - 10 * (0.4 + 0.6 * Math.exp(-timeS / 3)),
      50,
      { durationS: 60, stepS: 0.05 },
    );

    expect(analyseResponse(series, { bandPct: 1 }).riseTimeS).toBeNull();
  });
});

describe("settling time and steady offset", () => {
  it("reports the first time the error entered the band for good", () => {
    // Outside a ±1 band until t = 12, inside for the rest of the run.
    const series = sampleResponse(
      (timeS) => (timeS < 12 ? 55 : 50.5),
      50,
      { durationS: 40, stepS: 0.5 },
    );

    expect(analyseResponse(series, { bandPct: 1 }).settlingTimeS).toBeCloseTo(12, 6);
  });

  it("ignores an early band entry the response later leaves again", () => {
    const series = sampleResponse(
      (timeS) => (timeS >= 5 && timeS < 10 ? 50.2 : timeS < 25 ? 55 : 50.2),
      50,
      { durationS: 40, stepS: 0.5 },
    );

    expect(analyseResponse(series, { bandPct: 1 }).settlingTimeS).toBeCloseTo(25, 6);
  });

  it("leaves settling time unset when the run ends outside the band", () => {
    const series = sampleResponse(() => 55, 50, { durationS: 40, stepS: 0.5 });

    expect(analyseResponse(series, { bandPct: 1 }).settlingTimeS).toBeNull();
  });

  it("measures settling from the window opening, not from t = 0", () => {
    const series = sampleResponse(
      (timeS) => (timeS < 32 ? 55 : 50.5),
      50,
      { durationS: 60, stepS: 0.5 },
    );

    expect(
      analyseResponse(series, { bandPct: 1, startS: 20 }).settlingTimeS,
    ).toBeCloseTo(12, 6);
  });

  it("exposes the permanent offset a proportional-only controller leaves behind", () => {
    // Settles cleanly, but 1.5% below setpoint forever: the P-only lesson.
    const series = sampleResponse(
      (timeS) => 50 - 1.5 - 8 * Math.exp(-timeS / 4),
      50,
      { durationS: 120, stepS: 0.2 },
    );

    const analysis = analyseResponse(series, { bandPct: 2 });

    expect(analysis.steadyOffsetPct).toBeCloseTo(-1.5, 3);
    // The band is wide enough to call it settled even though the offset never goes.
    expect(analysis.settlingTimeS).not.toBeNull();
  });

  it("measures the true process, not the noisy measurement handed to it", () => {
    // The same settled process read twice: once cleanly, once through a sensor that
    // rings ±1.2% at every sample. Feeding the measurement instead of the process
    // would report a run that never settles, which is why the analysis takes
    // `processValuePct`.
    const clean = sampleResponse(
      (timeS) => (timeS < 10 ? 56 : 50.1),
      50,
      { durationS: 60, stepS: 0.2 },
    );
    const noisy = clean.map((point, index) => ({
      ...point,
      valuePct: point.valuePct + (index % 2 === 0 ? 1.2 : -1.2),
    }));

    expect(analyseResponse(clean, { bandPct: 1 }).settlingTimeS).toBeCloseTo(10, 6);
    expect(analyseResponse(noisy, { bandPct: 1 }).settlingTimeS).toBeNull();
  });
});

describe("analyseCommand", () => {
  it("sums the commanded movement as Σ|Δu| and counts direction changes", () => {
    // Triangle: 50 → 60 → 40 → 55. Total travel 10 + 20 + 15 = 45, two reversals.
    const series: SignalPoint[] = [
      { timeS: 0, valuePct: 50 },
      { timeS: 1, valuePct: 60 },
      { timeS: 2, valuePct: 40 },
      { timeS: 3, valuePct: 55 },
    ];

    const analysis = analyseCommand(series);

    expect(analysis.totalVariationPct).toBeCloseTo(45, 9);
    expect(analysis.reversals).toBe(2);
    expect(analysis.variationRatePctS).toBeCloseTo(15, 9);
  });

  it("separates a smooth correction from chatter of the same total travel", () => {
    const smooth: SignalPoint[] = [];
    const chattering: SignalPoint[] = [];
    for (let index = 0; index <= 100; index += 1) {
      smooth.push({ timeS: index * 0.2, valuePct: 40 + index * 0.2 });
      chattering.push({ timeS: index * 0.2, valuePct: 50 + (index % 2 === 0 ? 10 : -10) });
    }

    expect(analyseCommand(smooth).reversals).toBe(0);
    expect(analyseCommand(chattering).reversals).toBe(99);
    expect(analyseCommand(chattering).totalVariationPct).toBeGreaterThan(
      analyseCommand(smooth).totalVariationPct * 10,
    );
  });

  it("does not count rounding dust as a reversal", () => {
    const series: SignalPoint[] = [
      { timeS: 0, valuePct: 50 },
      { timeS: 1, valuePct: 60 },
      { timeS: 2, valuePct: 59.99 },
      { timeS: 3, valuePct: 70 },
    ];

    expect(analyseCommand(series).reversals).toBe(0);
    expect(analyseCommand(series).totalVariationPct).toBeCloseTo(20.02, 9);
  });

  it("returns a neutral analysis for a series too short to have movement", () => {
    expect(analyseCommand([])).toEqual({
      totalVariationPct: 0,
      variationRatePctS: 0,
      reversals: 0,
    });
  });
});

describe("analyseRun over a real engine trace", () => {
  it("analyses the two liquid loops and leaves the pressure loop absent", () => {
    const scenario = getScenario("feed-step");
    const run = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "feed-step", scenario.seed);

    const analysis = analyseRun(run.samples, DEFAULT_SIMULATION, {
      startS: scenario.disturbanceStartS,
    });

    expect(analysis.pressureLoop).toBeUndefined();
    expect(analysis.gasActuator).toBeUndefined();
    expect(analysis.windowStartS).toBeGreaterThanOrEqual(scenario.disturbanceStartS);
    expect(analysis.windowEndS).toBeGreaterThan(analysis.windowStartS);
    for (const loop of ["total", "interface"] as const) {
      expect(analysis.loops[loop].iae).toBeGreaterThan(0);
      expect(analysis.loops[loop].ise).toBeGreaterThan(0);
      expect(analysis.loops[loop].itae).toBeGreaterThan(0);
      expect(analysis.loops[loop].overshootPct).toBeGreaterThanOrEqual(0);
    }
    for (const actuator of ["oil", "water"] as const) {
      expect(analysis.actuators[actuator].totalVariationPct).toBeGreaterThan(0);
    }
  });

  it("adds the pressure loop and gas actuator when the run had a gas cap", () => {
    const run = runToEnd(
      DEFAULT_SIMULATION_WITH_GAS,
      DEFAULT_TRIPLE_PID,
      "gor-surge",
      getScenario("gor-surge").seed,
    );

    const analysis = analyseRun(run.samples, DEFAULT_SIMULATION_WITH_GAS);

    expect(analysis.pressureLoop).toBeDefined();
    expect(analysis.gasActuator).toBeDefined();
    expect(analysis.pressureLoop!.settlingBandPct).toBeCloseTo(
      DEFAULT_SIMULATION_WITH_GAS.gas!.targetBandBarG,
      9,
    );
  });

  it("is deterministic: the same run analyses to the same figures", () => {
    const first = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001);
    const second = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001);

    expect(analyseRun(first.samples, DEFAULT_SIMULATION)).toEqual(
      analyseRun(second.samples, DEFAULT_SIMULATION),
    );
  });

  it("charges a noise-chasing tuning for its command variation", () => {
    // Derivative on a noisy interface measurement is the canonical way to spend
    // the valve without improving anything; total variation is the figure that
    // shows it. Same scenario, same seed, only Kd differs.
    const scenario = getScenario("noisy-interface");
    const calm = analyseRun(
      runToEnd(
        DEFAULT_SIMULATION,
        {
          total: { ...DEFAULT_DUAL_PID.total, kd: 0 },
          interface: { ...DEFAULT_DUAL_PID.interface, kd: 0 },
        },
        "noisy-interface",
        scenario.seed,
      ).samples,
      DEFAULT_SIMULATION,
    );
    const chasing = analyseRun(
      runToEnd(
        DEFAULT_SIMULATION,
        {
          total: { ...DEFAULT_DUAL_PID.total, kd: 0 },
          interface: { ...DEFAULT_DUAL_PID.interface, kd: 25 },
        },
        "noisy-interface",
        scenario.seed,
      ).samples,
      DEFAULT_SIMULATION,
    );

    expect(chasing.actuators.water.totalVariationPct).toBeGreaterThan(
      calm.actuators.water.totalVariationPct * 2,
    );
    expect(chasing.actuators.water.reversals).toBeGreaterThan(
      calm.actuators.water.reversals,
    );
  });

  it("returns a neutral analysis rather than throwing on an empty trace", () => {
    const analysis = analyseRun([], DEFAULT_SIMULATION);

    expect(analysis.loops.total.iae).toBe(0);
    expect(analysis.loops.total.settlingTimeS).toBeNull();
    expect(analysis.pressureLoop).toBeUndefined();
    expect(analysis.windowStartS).toBe(0);
  });
});
