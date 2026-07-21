import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createEngine,
  finishEngine,
  runToEnd,
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

  expect(run.samples).toHaveLength(900);
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
  it("initializes the approved phase equilibrium through the public sample shape", () => {
    const engine = createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );
    const sample = engine.samples[0];
    const expectedWaterVolumeM3 = horizontalVolumeFromLevel(
      20,
      DEFAULT_SIMULATION.diameterM,
      DEFAULT_SIMULATION.lengthM,
    );
    const expectedTotalVolumeM3 = horizontalVolumeFromLevel(
      50,
      DEFAULT_SIMULATION.diameterM,
      DEFAULT_SIMULATION.lengthM,
    );

    expect(engine.waterVolumeM3).toBeCloseTo(expectedWaterVolumeM3, 14);
    expect(engine.oilVolumeM3).toBeCloseTo(
      expectedTotalVolumeM3 - expectedWaterVolumeM3,
      14,
    );
    expect(engine.totalLevelPct).toBe(50);
    expect(engine.interfaceLevelPct).toBe(20);
    expect(engine.oilLayerPct).toBe(30);
    expect(engine.controllers.total.measuredValuePct).toBe(50);
    expect(engine.controllers.interface.measuredValuePct).toBe(20);
    expect(engine.controllers.total.commandPct).toBe(50);
    expect(engine.controllers.interface.commandPct).toBe(50);
    expect(engine.controllers.total.valvePositionPct).toBe(50);
    expect(engine.controllers.interface.valvePositionPct).toBe(50);
    expect(engine.flows).toEqual({
      totalInletM3H: 50,
      waterCutFraction: 0.3,
      oilInletM3H: 35,
      waterInletM3H: 15,
      oilOutletM3H: 35,
      waterOutletM3H: 15,
    });
    expect(sample.total.processValuePct).toBe(50);
    expect(sample.interface.processValuePct).toBe(20);
    expect(sample.oilVolumeM3).toBe(engine.oilVolumeM3);
    expect(sample.waterVolumeM3).toBe(engine.waterVolumeM3);
    expect(sample.oilLayerPct).toBe(30);
    expect(sample.flows).toEqual(engine.flows);
    expect(sample.safety).toEqual({
      severity: "safe",
      source: null,
      label: "Normal operating envelope",
      trip: null,
    });
  });

  it("holds the approved dual-inventory equilibrium", () => {
    const initial = createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );
    const engine = stepTimes(initial, 2_000);

    expect(engine.totalLevelPct).toBeCloseTo(50, 8);
    expect(engine.interfaceLevelPct).toBeCloseTo(20, 8);
    expect(engine.controllers.total.valvePositionPct).toBeCloseTo(50, 8);
    expect(engine.controllers.interface.valvePositionPct).toBeCloseTo(50, 8);
  });

  it("couples water discharge into both interface and total level", () => {
    const engine = createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );
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
    const engine = stepTimes(
      createEngine(
        DEFAULT_SIMULATION,
        DEFAULT_DUAL_PID,
        "noisy-interface",
        seed,
      ),
      10,
    );
    const firstTotalDraw = nextRandom(seed);
    const secondTotalDraw = nextRandom(firstTotalDraw.state);
    const interfaceDraw = nextRandom(secondTotalDraw.state);
    const expectedInterfaceMeasurement = Math.max(
      0,
      Math.min(100, 20 + (interfaceDraw.value * 2 - 1) * 1.5),
    );

    expect(engine.timeS).toBe(0.5);
    expect(engine.rngState).toBe(interfaceDraw.state);
    expect(engine.controllers.total.measuredValuePct).toBeCloseTo(
      engine.totalLevelPct,
      12,
    );
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
      const engine = withPhaseLevels(
        createEngine(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001),
        interfacePct,
        totalPct,
      );

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
    ("starts tripped for an unsafe sanitized $name equilibrium", ({ config, trip }) => {
      const engine = createEngine(
        { ...DEFAULT_SIMULATION, ...config },
        DEFAULT_DUAL_PID,
        "normal",
        1001,
      );

      expect(engine.status).toBe("tripped");
      expect(engine.trip).toBe(trip);
      expect(engine.samples).toHaveLength(1);
      expect(engine.samples[0].timeS).toBe(0);
      expect(engine.samples[0].safety).toMatchObject({ severity: "trip", trip });
    });

  it("applies trip priority to simultaneous unsafe initial conditions", () => {
    const totalBeforeInterface = createEngine(
      {
        ...DEFAULT_SIMULATION,
        totalSetpointPct: 95,
        interfaceSetpointPct: 50,
      },
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );
    const interfaceBeforeOilLayer = createEngine(
      {
        ...DEFAULT_SIMULATION,
        totalSetpointPct: 6,
        interfaceSetpointPct: 2,
        totalLowLowPct: 0,
        totalLowAlarmPct: 1,
      },
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );

    expect(totalBeforeInterface.trip).toBe("TOTAL_HH");
    expect(interfaceBeforeOilLayer.trip).toBe("INTERFACE_LL");
  });

  it("runToEnd returns immediately when the sanitized initial state is tripped", () => {
    const run = runToEnd(
      { ...DEFAULT_SIMULATION, totalSetpointPct: 95 },
      DEFAULT_DUAL_PID,
      "normal",
      1001,
    );

    expect(run.status).toBe("tripped");
    expect(run.samples).toHaveLength(1);
    expect(run.samples[0].timeS).toBe(0);
    expect(run.result.metrics.trip).toBe("TOTAL_HH");
  });

  it("evaluates simultaneous trips in the documented order", () => {
    const totalFirst = stepEngine(withPhaseLevels(
      createEngine(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001),
      50,
      95,
    ));
    const interfaceBeforeOilLayer = stepEngine(withPhaseLevels(
      createEngine(
        {
          ...DEFAULT_SIMULATION,
          totalLowLowPct: 0,
          totalLowAlarmPct: 1,
        },
        DEFAULT_DUAL_PID,
        "normal",
        1001,
      ),
      2,
      6,
    ));

    expect(totalFirst.trip).toBe("TOTAL_HH");
    expect(interfaceBeforeOilLayer.trip).toBe("INTERFACE_LL");
  });

  it("reports alarm state from process truth rather than sensor measurement", () => {
    const engine = withPhaseLevels(
      createEngine(
        { ...DEFAULT_SIMULATION, chartSampleS: 0.05 },
        DEFAULT_DUAL_PID,
        "normal",
        1001,
      ),
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

  it("retains at most 900 samples and preserves the terminal duration sample", () => {
    const engine = stepToTerminal(createEngine(
      DEFAULT_SIMULATION,
      DEFAULT_DUAL_PID,
      "water-rich-slug",
      1003,
    ));
    const run = finishEngine(engine);

    expect(run.samples).toHaveLength(900);
    expect(engine.metricSamples).toHaveLength(901);
    expect(run.samples[0].timeS).toBeGreaterThan(0);
    expect(run.samples.at(-1)?.timeS).toBe(180);
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
    const expectedTotalInletM3 = (
      599 * 0.05 * 50 +
      3_001 * 0.05 * 70
    ) / 3600;

    expect(firstEngine.metricSamples).toHaveLength(3_601);
    expect(firstEngine.metricSamples[1].flows.totalInletM3H).toBe(50);
    expect(firstEngine.metricSamples.at(-1)?.flows.totalInletM3H).toBe(70);
    expect(first.samples).toHaveLength(900);
    expect(first.samples[0].flows.totalInletM3H).toBe(70);
    expect(first.result.metrics.phaseTotals.oilInletM3 +
      first.result.metrics.phaseTotals.waterInletM3).toBeCloseTo(expectedTotalInletM3, 10);
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
    const engine: EngineState = {
      ...createEngine(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001),
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
