import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createEngine,
  finishEngine,
  runToEnd,
  setWellOpen,
  stepEngine,
  type EngineState,
} from "./engine";
import {
  fullCylinderVolume,
  horizontalVolumeFromLevel,
} from "./geometry";
import { nextRandom } from "./prng";
import { DUAL_SCENARIOS } from "./scenarios";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_PID,
  DEFAULT_SIMULATION,
  type PhaseRunTotals,
  type ScenarioDefinition,
  type TripKind,
} from "./types";

const GOLDEN_FIXTURE_PATH = resolve(
  process.cwd(),
  "lib/simulation/__fixtures__/golden-runs.json",
);

interface GoldenRunSummary {
  scenarioId: string;
  seed: number;
  finalTimeS: number;
  status: "completed" | "tripped";
  trip: TripKind;
  finalTotalLevelPct: number;
  finalInterfaceLevelPct: number;
  finalOilValvePct: number;
  finalWaterValvePct: number;
  finalOilVolumeM3: number;
  finalWaterVolumeM3: number;
  totalMae: number;
  interfaceMae: number;
  oilValveTravelPct: number;
  waterValveTravelPct: number;
  phaseTotals: PhaseRunTotals;
  score: number;
}

type GoldenRuns = Record<string, GoldenRunSummary>;

const GOLDEN_SUMMARY_KEYS = [
  "scenarioId",
  "seed",
  "finalTimeS",
  "status",
  "trip",
  "finalTotalLevelPct",
  "finalInterfaceLevelPct",
  "finalOilValvePct",
  "finalWaterValvePct",
  "finalOilVolumeM3",
  "finalWaterVolumeM3",
  "totalMae",
  "interfaceMae",
  "oilValveTravelPct",
  "waterValveTravelPct",
  "phaseTotals",
  "score",
] as const;

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function roundedPhaseTotals(totals: PhaseRunTotals): PhaseRunTotals {
  return {
    oilInletM3: round6(totals.oilInletM3),
    waterInletM3: round6(totals.waterInletM3),
    oilOutletM3: round6(totals.oilOutletM3),
    waterOutletM3: round6(totals.waterOutletM3),
    finalOilVolumeM3: round6(totals.finalOilVolumeM3),
    finalWaterVolumeM3: round6(totals.finalWaterVolumeM3),
  };
}

function goldenSummary(scenario: ScenarioDefinition): GoldenRunSummary {
  const run = runToEnd(
    DEFAULT_SIMULATION,
    DEFAULT_DUAL_PID,
    scenario.id,
    scenario.seed,
  );
  const finalSample = run.samples.at(-1)!;
  const { metrics } = run.result;

  expect(run.samples).toHaveLength(1501);
  expect(finalSample.timeS).toBe(DEFAULT_SIMULATION.durationS);
  expect(finalSample.oilVolumeM3).toBe(metrics.phaseTotals.finalOilVolumeM3);
  expect(finalSample.waterVolumeM3).toBe(metrics.phaseTotals.finalWaterVolumeM3);

  return {
    scenarioId: scenario.id,
    seed: scenario.seed,
    finalTimeS: round6(finalSample.timeS),
    status: run.status,
    trip: metrics.trip,
    finalTotalLevelPct: round6(finalSample.total.processValuePct),
    finalInterfaceLevelPct: round6(finalSample.interface.processValuePct),
    finalOilValvePct: round6(finalSample.total.valvePositionPct),
    finalWaterValvePct: round6(finalSample.interface.valvePositionPct),
    finalOilVolumeM3: round6(finalSample.oilVolumeM3),
    finalWaterVolumeM3: round6(finalSample.waterVolumeM3),
    totalMae: round6(metrics.loops.total.mae),
    interfaceMae: round6(metrics.loops.interface.mae),
    oilValveTravelPct: round6(metrics.actuators.oil.travelPct),
    waterValveTravelPct: round6(metrics.actuators.water.travelPct),
    phaseTotals: roundedPhaseTotals(metrics.phaseTotals),
    score: run.result.score.total,
  };
}

let generatedGoldenRuns: GoldenRuns | undefined;

function generateGoldenRuns(): GoldenRuns {
  generatedGoldenRuns ??= Object.fromEntries(
    DUAL_SCENARIOS.map((scenario) => [scenario.id, goldenSummary(scenario)]),
  );
  return generatedGoldenRuns;
}

function readGoldenRuns(): GoldenRuns {
  return JSON.parse(readFileSync(GOLDEN_FIXTURE_PATH, "utf8")) as GoldenRuns;
}

function serializeGoldenRuns(runs: GoldenRuns): string {
  const floatingPointMarker = "__GOLDEN_FLOAT__";
  const json = JSON.stringify(
    runs,
    (key, value: unknown) =>
      typeof value === "number" && key !== "seed" && key !== "score"
        ? `${floatingPointMarker}${value.toFixed(6)}`
        : value,
    2,
  );

  return `${json.replace(
    new RegExp(`"${floatingPointMarker}(-?\\d+\\.\\d{6})"`, "g"),
    "$1",
  )}\n`;
}

function stepTimes(engine: EngineState, count: number): EngineState {
  let current = engine;
  for (let index = 0; index < count; index += 1) current = stepEngine(current);
  return current;
}

function stepToTerminal(engine: EngineState): EngineState {
  let current = engine;
  while (current.status === "running") current = stepEngine(current);
  return current;
}

/**
 * The engine at its operating point: levels on their setpoints, valves at
 * mid-travel, well fully open, every protection armed. Physics tests start here,
 * because what they exercise is the behaviour of the established process; the
 * fill that precedes it has its own tests.
 */
function establishedEngine(
  config = DEFAULT_SIMULATION,
  pid = DEFAULT_DUAL_PID,
  scenarioId: Parameters<typeof createEngine>[2] = "normal",
  seed = 1001,
): EngineState {
  const engine = createEngine(config, pid, scenarioId, seed);
  const placed = withPhaseLevels(
    engine,
    engine.config.interfaceSetpointPct,
    engine.config.totalSetpointPct,
  );
  return {
    ...placed,
    wellFactor: 1,
    armedLow: { total: true, interface: true, oilLayer: true, pressure: true },
    controllers: {
      total: {
        ...placed.controllers.total,
        measuredValuePct: placed.totalLevelPct,
        commandPct: 50,
        valvePositionPct: 50,
      },
      interface: {
        ...placed.controllers.interface,
        measuredValuePct: placed.interfaceLevelPct,
        commandPct: 50,
        valvePositionPct: 50,
      },
      ...(placed.controllers.pressure ? { pressure: placed.controllers.pressure } : {}),
    },
  };
}

function withPhaseLevels(
  engine: EngineState,
  interfaceLevelPct: number,
  totalLevelPct: number,
): EngineState {
  const waterVolumeM3 = horizontalVolumeFromLevel(
    interfaceLevelPct,
    engine.config.diameterM,
    engine.config.lengthM,
  );
  const totalVolumeM3 = horizontalVolumeFromLevel(
    totalLevelPct,
    engine.config.diameterM,
    engine.config.lengthM,
  );

  return {
    ...engine,
    waterVolumeM3,
    oilVolumeM3: Math.max(0, totalVolumeM3 - waterVolumeM3),
    totalLevelPct,
    interfaceLevelPct,
    oilLayerPct: Math.max(0, totalLevelPct - interfaceLevelPct),
  };
}

describe("fixed-step dual-inventory separator engine", () => {
  it("initializes empty and shut in, the way a real test begins", () => {
    const engine = createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );
    const sample = engine.samples[0];

    expect(engine.oilVolumeM3).toBe(0);
    expect(engine.waterVolumeM3).toBe(0);
    expect(engine.totalLevelPct).toBe(0);
    expect(engine.interfaceLevelPct).toBe(0);
    expect(engine.wellOpen).toBe(true);
    expect(engine.wellFactor).toBe(0);
    expect(engine.armedLow).toEqual({
      total: false,
      interface: false,
      oilLayer: false,
      pressure: false,
    });
    // Valves on their seats: nothing has told them to move yet.
    expect(engine.controllers.total.valvePositionPct).toBe(0);
    expect(engine.controllers.interface.valvePositionPct).toBe(0);
    expect(sample.flows.totalInletM3H).toBe(0);
    expect(sample.disturbance).toBe("well-opening");
    // Empty is below every low limit, but that is start-up, not an upset.
    expect(sample.safety).toMatchObject({ severity: "safe", condition: "startup" });
    expect(engine.status).toBe("running");
    expect(engine.trip).toBeNull();
  });

  it("fills from empty, opens the valves near the setpoint, and establishes", () => {
    let engine = createEngine(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001);
    let valveStillShutAtPct = 0;
    while (engine.status === "running") {
      const next = stepEngine(engine);
      if (engine.controllers.total.valvePositionPct < 0.5 && next.controllers.total.valvePositionPct >= 0.5) {
        valveStillShutAtPct = next.totalLevelPct;
      }
      engine = next;
    }

    // The oil valve stays on its seat through most of the fill and only starts to
    // open close to the setpoint — the behaviour the start-up lesson is about.
    expect(valveStillShutAtPct).toBeGreaterThan(35);
    expect(valveStillShutAtPct).toBeLessThan(50);
    expect(engine.status).toBe("completed");
    expect(engine.trip).toBeNull();
    expect(engine.totalLevelPct).toBeGreaterThan(45);
    expect(engine.totalLevelPct).toBeLessThan(58);
    expect(engine.armedLow.total).toBe(true);
    expect(engine.armedLow.interface).toBe(true);
  });

  it("drains toward the low protection when the well is shut in mid-run", () => {
    let engine = createEngine(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001);
    while (engine.status === "running" && engine.timeS < 200) engine = stepEngine(engine);
    const levelAtShutIn = engine.totalLevelPct;

    engine = setWellOpen(engine, false);
    while (engine.status === "running" && engine.timeS < 300) engine = stepEngine(engine);

    // The default tuning closes the valves in time: the level falls but the armed
    // low-low protection does not fire.
    expect(engine.totalLevelPct).toBeLessThan(levelAtShutIn);
    expect(engine.trip).toBeNull();
    expect(engine.controllers.total.valvePositionPct).toBeLessThan(5);
    expect(engine.samples.at(-1)?.disturbance).toBe("well-shut-in");
  });

  it("holds the operating point once established", () => {
    const initial = establishedEngine();
    const engine = stepTimes(initial, 2_000);

    expect(engine.totalLevelPct).toBeCloseTo(50, 8);
    expect(engine.interfaceLevelPct).toBeCloseTo(20, 8);
    expect(engine.controllers.total.valvePositionPct).toBeCloseTo(50, 8);
    expect(engine.controllers.interface.valvePositionPct).toBeCloseTo(50, 8);
  });

  it("couples water discharge into both interface and total level", () => {
    const engine = establishedEngine();
    const disturbed: EngineState = {
      ...engine,
      controllers: {
        ...engine.controllers,
        interface: {
          ...engine.controllers.interface,
          commandPct: 100,
          valvePositionPct: 100,
        },
      },
    };

    const next = stepEngine(disturbed);

    expect(next.interfaceLevelPct).toBeLessThan(engine.interfaceLevelPct);
    expect(next.totalLevelPct).toBeLessThan(engine.totalLevelPct);
    expect(next.oilVolumeM3).toBeCloseTo(engine.oilVolumeM3, 12);
    expect(next.waterVolumeM3).toBeLessThan(engine.waterVolumeM3);
  });

  it("keeps oil and water material balances independent", () => {
    const engine = createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );
    const disturbed: EngineState = {
      ...engine,
      controllers: {
        total: {
          ...engine.controllers.total,
          commandPct: 0,
          valvePositionPct: 0,
        },
        interface: {
          ...engine.controllers.interface,
          commandPct: 100,
          valvePositionPct: 100,
        },
      },
    };

    const next = stepEngine(disturbed);
    const stepHours = DEFAULT_SIMULATION.dtS / 3600;

    expect(next.oilVolumeM3).toBeCloseTo(
      engine.oilVolumeM3 +
        (next.flows.oilInletM3H - next.flows.oilOutletM3H) * stepHours,
      12,
    );
    expect(next.waterVolumeM3).toBeCloseTo(
      engine.waterVolumeM3 +
        (next.flows.waterInletM3H - next.flows.waterOutletM3H) * stepHours,
      12,
    );
  });

  it("samples both sensors independently with a deterministic total-then-interface PRNG order", () => {
    const seed = 1006;
    // Levels move while the vessel fills, so capture the state the tenth step's
    // sensor pass will read: sampling uses the level at the start of the step.
    const nine = stepTimes(
      createEngine(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "noisy-interface", seed),
      9,
    );
    const engine = stepEngine(nine);
    const firstTotalDraw = nextRandom(seed);
    const secondTotalDraw = nextRandom(firstTotalDraw.state);
    const interfaceDraw = nextRandom(secondTotalDraw.state);
    const expectedInterfaceMeasurement = Math.max(
      0,
      Math.min(100, nine.interfaceLevelPct + (interfaceDraw.value * 2 - 1) * 1.5),
    );

    expect(engine.timeS).toBe(0.5);
    expect(engine.rngState).toBe(interfaceDraw.state);
    expect(engine.controllers.interface.measuredValuePct).toBeCloseTo(
      expectedInterfaceMeasurement,
      12,
    );
    expect(engine.controllers.interface.measuredValuePct).not.toBe(
      engine.interfaceLevelPct,
    );
    expect(engine.controllers.total.sensorElapsedS).toBeCloseTo(0.1, 12);
    expect(engine.controllers.interface.sensorElapsedS).toBe(0);
  });

  it("consumes every expired sensor period in total-then-interface order", () => {
    const seed = 1001;
    const engine = stepEngine(createEngine(
      { ...DEFAULT_SIMULATION, dtS: 0.5 },
      DEFAULT_DUAL_PID,
      "normal",
      seed,
    ));
    const totalFirst = nextRandom(seed);
    const totalSecond = nextRandom(totalFirst.state);
    const interfaceFirst = nextRandom(totalSecond.state);
    const interfaceSecond = nextRandom(interfaceFirst.state);

    expect(engine.rngState).toBe(interfaceSecond.state);
    expect(engine.controllers.total.sensorElapsedS).toBeCloseTo(0.1, 12);
    expect(engine.controllers.interface.sensorElapsedS).toBeCloseTo(0.1, 12);
  });

  it("executes every expired PID period with the held latest measurement", () => {
    const pid = {
      total: { ...DEFAULT_PID, kp: 0, ki: 0.3, kd: 0 },
      interface: { ...DEFAULT_PID },
    };
    const engine = withPhaseLevels(
      createEngine(
        { ...DEFAULT_SIMULATION, dtS: 0.5 },
        pid,
        "normal",
        1001,
      ),
      20,
      60,
    );

    const next = stepEngine(engine);

    expect(next.controllers.total.measuredValuePct).toBe(60);
    expect(next.controllers.total.pidState.integralTerm).toBeCloseTo(1.2, 12);
    expect(next.controllers.total.commandPct).toBeCloseTo(51.2, 12);
    expect(next.controllers.total.controllerElapsedS).toBeCloseTo(0.1, 12);
  });

  it("retains non-integral chart-clock residual across samples", () => {
    let engine = createEngine(
      { ...DEFAULT_SIMULATION, dtS: 0.13 },
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );

    engine = stepEngine(engine);
    expect(engine.samples).toHaveLength(1);
    expect(engine.sampleElapsedS).toBeCloseTo(0.13, 12);

    engine = stepEngine(engine);
    expect(engine.samples).toHaveLength(2);
    expect(engine.sampleElapsedS).toBeCloseTo(0.06, 12);

    engine = stepEngine(engine);
    expect(engine.samples).toHaveLength(2);
    expect(engine.sampleElapsedS).toBeCloseTo(0.19, 12);
  });

  it("retains chart-clock modulo when one physics step spans multiple periods", () => {
    const engine = stepEngine(createEngine(
      { ...DEFAULT_SIMULATION, dtS: 0.5 },
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    ));

    expect(engine.samples).toHaveLength(2);
    expect(engine.samples.at(-1)?.timeS).toBe(0.5);
    expect(engine.sampleElapsedS).toBeCloseTo(0.1, 12);
  });

  it("replays bit-identical dual trajectories for the same seed", () => {
    const config = { ...DEFAULT_SIMULATION, durationS: 10 };
    const first = runToEnd(config, DEFAULT_DUAL_PID, "noisy-interface", 1006);
    const second = runToEnd(config, DEFAULT_DUAL_PID, "noisy-interface", 1006);

    expect(second.samples).toEqual(first.samples);
    expect(second.result).toEqual(first.result);
  });

  it.each([
    { name: "total high-high", interfacePct: 50, totalPct: 95, trip: "TOTAL_HH" },
    { name: "total low-low", interfacePct: 2, totalPct: 5, trip: "TOTAL_LL" },
    { name: "interface high-high", interfacePct: 50, totalPct: 70, trip: "INTERFACE_HH" },
    { name: "interface low-low", interfacePct: 0, totalPct: 50, trip: "INTERFACE_LL" },
    { name: "oil-layer low-low", interfacePct: 20, totalPct: 24, trip: "OIL_LAYER_LL" },
  ] satisfies Array<{
    name: string;
    interfacePct: number;
    totalPct: number;
    trip: Exclude<TripKind, null>;
  }>)
    ("emits the exact $name trip identifier", ({ interfacePct, totalPct, trip }) => {
      // Once armed, every protection fires exactly as before start-up existed.
      const engine = withPhaseLevels(establishedEngine(), interfacePct, totalPct);

      const next = stepEngine(engine);

      expect(next.status).toBe("tripped");
      expect(next.trip).toBe(trip);
      expect(next.samples.at(-1)?.safety).toMatchObject({
        severity: "trip",
        trip,
      });
    });

  it.each([
    {
      name: "total high-high",
      config: { totalSetpointPct: 95, interfaceSetpointPct: 20 },
      trip: "TOTAL_HH",
    },
    {
      name: "total low-low",
      config: { totalSetpointPct: 5, interfaceSetpointPct: 1 },
      trip: "TOTAL_LL",
    },
    {
      name: "interface high-high",
      config: { totalSetpointPct: 70, interfaceSetpointPct: 50 },
      trip: "INTERFACE_HH",
    },
    {
      name: "interface low-low",
      config: { totalSetpointPct: 50, interfaceSetpointPct: 1 },
      trip: "INTERFACE_LL",
    },
    {
      name: "oil-layer low-low",
      config: { totalSetpointPct: 24, interfaceSetpointPct: 20 },
      trip: "OIL_LAYER_LL",
    },
  ] satisfies Array<{
    name: string;
    config: Partial<typeof DEFAULT_SIMULATION>;
    trip: Exclude<TripKind, null>;
  }>)
    ("starts running, empty and untripped even for the hostile $name setpoints", ({ config }) => {
      // These configurations used to place the pre-balanced start inside a trip.
      // A run now begins empty with the low side bypassed, so however unsafe the
      // requested operating point is, the start itself is a safe shut-in vessel.
      const engine = createEngine(
        { ...DEFAULT_SIMULATION, ...config },
        DEFAULT_DUAL_PID,
        "normal",
        1001,
      );

      expect(engine.status).toBe("running");
      expect(engine.trip).toBeNull();
      expect(engine.totalLevelPct).toBe(0);
      expect(engine.samples[0].safety.severity).toBe("safe");
    });

  it("trips on high-high during the fill: the high side is never bypassed", () => {
    // A hostile high-high below the fill path must end the run mid-fill. Zero
    // ramp makes the fill fast enough to keep the test quick.
    const run = runToEnd(
      {
        ...DEFAULT_SIMULATION,
        feedRampS: 0,
        totalLowLowPct: 1,
        totalLowAlarmPct: 2,
        totalHighAlarmPct: 8,
        totalHighHighPct: 10,
      },
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );

    expect(run.status).toBe("tripped");
    expect(run.result.metrics.trip).toBe("TOTAL_HH");
    // It tripped early in the fill, long before the configured duration.
    expect(run.samples.at(-1)!.timeS).toBeLessThan(60);
  });

  it("does not fire a low trip during the fill, and does fire it once armed", () => {
    const config = { ...DEFAULT_SIMULATION, feedRampS: 0 };
    let engine = createEngine(config, DEFAULT_DUAL_PID, "normal", 1001);
    // The whole fill happens below the low-low limit without tripping.
    while (engine.status === "running" && engine.totalLevelPct < config.totalLowAlarmPct) {
      expect(engine.trip).toBeNull();
      engine = stepEngine(engine);
    }
    expect(engine.armedLow.total).toBe(true);

    // From an armed vessel, the same low level is now a real event.
    const drained = stepEngine(withPhaseLevels(engine, 2, 5));
    expect(drained.trip).toBe("TOTAL_LL");
  });

  it("evaluates simultaneous trips in the documented order", () => {
    const totalFirst = stepEngine(withPhaseLevels(establishedEngine(), 50, 95));
    const interfaceBeforeOilLayer = stepEngine(withPhaseLevels(
      establishedEngine({
        ...DEFAULT_SIMULATION,
        totalLowLowPct: 0,
        totalLowAlarmPct: 1,
      }),
      2,
      6,
    ));

    expect(totalFirst.trip).toBe("TOTAL_HH");
    expect(interfaceBeforeOilLayer.trip).toBe("INTERFACE_LL");
  });

  it("reports alarm state from process truth rather than sensor measurement", () => {
    const engine = withPhaseLevels(
      establishedEngine({ ...DEFAULT_SIMULATION, chartSampleS: 0.05 }),
      20,
      80,
    );
    const next = stepEngine(engine);
    const sample = next.samples.at(-1)!;

    expect(sample.total.processValuePct).toBeGreaterThan(75);
    expect(sample.total.measuredValuePct).toBe(50);
    expect(sample.total.measuredValuePct).toBeGreaterThan(25);
    expect(sample.total.measuredValuePct).toBeLessThan(75);
    expect(sample.safety).toMatchObject({
      severity: "alarm",
      source: "total",
      trip: null,
    });
  });

  it("retains a complete default run including its opening and terminal samples", () => {
    const engine = stepToTerminal(createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "water-rich-slug",
      1003,
    ));
    const run = finishEngine(engine);

    expect(run.samples).toHaveLength(1501);
    expect(engine.metricSamples).toHaveLength(1501);
    expect(run.samples[0].timeS).toBe(0);
    expect(run.samples.at(-1)?.timeS).toBe(300);
    expect(Math.max(...run.samples.map((sample) => sample.flows.totalInletM3H))).toBe(110);
  });

  it("scores the complete private history when presentation retention drops disturbances", () => {
    const runEngine = () => stepToTerminal(createEngine(
      { ...DEFAULT_SIMULATION, chartSampleS: 0.05 },
      DEFAULT_DUAL_PID,
      "feed-step",
      1002,
    ));
    const firstEngine = runEngine();
    const secondEngine = runEngine();
    const first = finishEngine(firstEngine);
    const second = finishEngine(secondEngine);

    expect(firstEngine.metricSamples).toHaveLength(6_001);
    // The feed ramps in from the shut-in start, then steps to 70 late in the run.
    expect(firstEngine.metricSamples[1].flows.totalInletM3H).toBeGreaterThan(0);
    expect(firstEngine.metricSamples[1].flows.totalInletM3H).toBeLessThan(1);
    expect(firstEngine.metricSamples.at(-1)?.flows.totalInletM3H).toBe(70);
    expect(first.samples).toHaveLength(1_501);
    // With an empty start the run totals are a closed mass balance: whatever came
    // in either left through a valve or is still in the vessel.
    const totals = first.result.metrics.phaseTotals;
    expect(totals.oilInletM3 - totals.oilOutletM3).toBeCloseTo(totals.finalOilVolumeM3, 6);
    expect(totals.waterInletM3 - totals.waterOutletM3).toBeCloseTo(totals.finalWaterVolumeM3, 6);
    expect(second.result).toEqual(first.result);
    expect(second.samples).toEqual(first.samples);
    expect(first).not.toHaveProperty("metricSamples");
  });

  it("keeps extreme finite inventories and every emitted field finite", () => {
    const engine = createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );
    const extreme: EngineState = {
      ...engine,
      oilVolumeM3: Number.MAX_VALUE,
      waterVolumeM3: Number.MAX_VALUE,
      totalLevelPct: 20,
      interfaceLevelPct: 80,
      oilLayerPct: 0,
    };

    const next = stepEngine(extreme);
    const sample = next.samples.at(-1)!;

    for (const value of [
      next.oilVolumeM3,
      next.waterVolumeM3,
      next.totalLevelPct,
      next.interfaceLevelPct,
      next.oilLayerPct,
      ...Object.values(next.flows),
      sample.total.processValuePct,
      sample.interface.processValuePct,
    ]) expect(Number.isFinite(value)).toBe(true);
    expect(next.interfaceLevelPct).toBeLessThanOrEqual(next.totalLevelPct);
  });

  it("bounds outlet flow at empty inventory and exposes the true low-low trip", () => {
    // An armed vessel forced empty: outlets bound at zero and the protection fires.
    const engine: EngineState = {
      ...establishedEngine(),
      oilVolumeM3: 0,
      waterVolumeM3: 0,
      totalLevelPct: 0,
      interfaceLevelPct: 0,
      oilLayerPct: 0,
    };

    const next = stepEngine(engine);

    expect(next.flows.oilOutletM3H).toBe(0);
    expect(next.flows.waterOutletM3H).toBe(0);
    expect(next.oilVolumeM3).toBeGreaterThan(0);
    expect(next.waterVolumeM3).toBeGreaterThan(0);
    expect(next.trip).toBe("TOTAL_LL");
    expect(Number.isFinite(next.totalLevelPct)).toBe(true);
    expect(Number.isFinite(next.interfaceLevelPct)).toBe(true);
  });

  it("keeps a full inventory finite and exposes the true high-high trip", () => {
    const engine = createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );
    const fullVolumeM3 = fullCylinderVolume(
      DEFAULT_SIMULATION.diameterM,
      DEFAULT_SIMULATION.lengthM,
    );
    const waterVolumeM3 = horizontalVolumeFromLevel(
      20,
      DEFAULT_SIMULATION.diameterM,
      DEFAULT_SIMULATION.lengthM,
    );
    const full: EngineState = {
      ...engine,
      oilVolumeM3: fullVolumeM3 - waterVolumeM3,
      waterVolumeM3,
      totalLevelPct: 100,
      interfaceLevelPct: 20,
      oilLayerPct: 80,
    };

    const next = stepEngine(full);

    expect(next.trip).toBe("TOTAL_HH");
    expect(next.totalLevelPct).toBeGreaterThan(90);
    expect(next.totalLevelPct).toBeLessThanOrEqual(100);
    expect(next.interfaceLevelPct).toBeLessThanOrEqual(next.totalLevelPct);
    expect(Number.isFinite(next.oilVolumeM3)).toBe(true);
    expect(Number.isFinite(next.waterVolumeM3)).toBe(true);
  });

  it("never reports defensive normalization discard as valve outlet flow", () => {
    const engine = establishedEngine();
    const fullVolumeM3 = fullCylinderVolume(
      DEFAULT_SIMULATION.diameterM,
      DEFAULT_SIMULATION.lengthM,
    );
    const overfilled: EngineState = {
      ...engine,
      oilVolumeM3: fullVolumeM3 * 0.75,
      waterVolumeM3: fullVolumeM3 * 0.75,
    };

    const next = stepEngine(overfilled);

    expect(next.flows.oilOutletM3H).toBeCloseTo(35, 12);
    expect(next.flows.waterOutletM3H).toBeCloseTo(15, 12);
    expect(next.flows.oilOutletM3H + next.flows.waterOutletM3H).toBe(50);
    expect((next.samples.at(-1)?.flows.oilOutletM3H ?? 0) +
      (next.samples.at(-1)?.flows.waterOutletM3H ?? 0)).toBe(50);
  });
});

describe("canonical deterministic golden runs", () => {
  it("keeps the checked-in fixture synchronized behind an explicit update gate", () => {
    const generated = generateGoldenRuns();
    if (process.env.UPDATE_GOLDEN === "1") {
      writeFileSync(
        GOLDEN_FIXTURE_PATH,
        serializeGoldenRuns(generated),
        "utf8",
      );
    }

    expect(readGoldenRuns()).toEqual(generated);
  });

  it("uses the stable documented summary schema", () => {
    for (const summary of Object.values(generateGoldenRuns())) {
      expect(Object.keys(summary)).toEqual(GOLDEN_SUMMARY_KEYS);
      expect(Object.keys(summary.phaseTotals)).toEqual([
        "oilInletM3",
        "waterInletM3",
        "oilOutletM3",
        "waterOutletM3",
        "finalOilVolumeM3",
        "finalWaterVolumeM3",
      ]);
      expect(Number.isInteger(summary.score)).toBe(true);
    }
  });

  it("stores every floating-point summary value with exactly six decimals", () => {
    const numericProperties = readFileSync(GOLDEN_FIXTURE_PATH, "utf8")
      .split("\n")
      .flatMap((line) => {
        const match = line.match(/^\s+"([^"]+)": (-?\d+(?:\.\d+)?),?$/);
        return match && match[1] !== "seed" && match[1] !== "score"
          ? [match[2]]
          : [];
      });

    expect(numericProperties).toHaveLength(DUAL_SCENARIOS.length * 17);
    for (const value of numericProperties) {
      expect(value).toMatch(/^-?\d+\.\d{6}$/);
    }
  });

  it.each(DUAL_SCENARIOS)(
    "matches the $id public-seed golden summary",
    (scenario) => {
      expect(goldenSummary(scenario)).toEqual(readGoldenRuns()[scenario.id]);
    },
  );
});
