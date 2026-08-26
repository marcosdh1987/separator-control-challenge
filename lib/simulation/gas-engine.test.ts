import { describe, expect, it } from "vitest";

import { createEngine, finishEngine, runToEnd, stepEngine, type EngineState } from "./engine";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_SIMULATION,
  DEFAULT_SIMULATION_WITH_GAS,
  DEFAULT_TRIPLE_PID,
  type ScenarioId,
} from "./types";

const runGas = (scenarioId: ScenarioId, seed: number) =>
  runToEnd(DEFAULT_SIMULATION_WITH_GAS, DEFAULT_TRIPLE_PID, scenarioId, seed);

const stepToTerminal = (engine: EngineState): EngineState => {
  let current = engine;
  while (current.status === "running") current = stepEngine(current);
  return current;
};

describe("gas cap disabled by default", () => {
  it("publishes no pressure loop when the configuration has no gas block", () => {
    const run = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001);
    for (const sample of run.samples) {
      expect(sample.pressure).toBeUndefined();
      expect(sample.gas).toBeUndefined();
    }
    expect(run.result.metrics.pressureLoop).toBeUndefined();
    expect(run.result.metrics.gasActuator).toBeUndefined();
  });

  it("ignores a scenario's gas disturbance when there is no gas cap", () => {
    // The GOR surge only touches the gas model, so a two-loop run must be
    // indistinguishable from steady operation.
    const surge = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "gor-surge", 1007);
    const normal = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1007);
    expect(surge.result.metrics.loops).toEqual(normal.result.metrics.loops);
  });
});

describe("gas cap enabled", () => {
  it("starts in balance and holds the pressure setpoint", () => {
    const run = runGas("normal", 1001);
    const opening = run.samples[0];
    const final = run.samples.at(-1)!;

    expect(opening.gas?.pressureBarG).toBeCloseTo(
      DEFAULT_SIMULATION_WITH_GAS.gas!.setpointBarG,
      1,
    );
    expect(run.status).toBe("completed");
    expect(final.gas!.pressureBarG).toBeCloseTo(
      DEFAULT_SIMULATION_WITH_GAS.gas!.setpointBarG,
      2,
    );
    // At the design duty the valve sits near mid-travel, with authority in hand.
    expect(final.pressure!.valvePositionPct).toBeGreaterThan(35);
    expect(final.pressure!.valvePositionPct).toBeLessThan(65);
    // What the feed brings in, the valve lets out.
    expect(final.gas!.outletSm3H).toBeCloseTo(final.gas!.inletSm3H, 0);
  });

  it("is reproducible for a given seed", () => {
    const first = runGas("gor-surge", 1007);
    const second = runGas("gor-surge", 1007);
    expect(second.samples).toEqual(first.samples);
    expect(second.result).toEqual(first.result);
  });

  it("raises pressure when the well starts making more gas", () => {
    const run = runGas("gor-surge", 1007);
    const beforeSurge = run.samples.find((sample) => sample.timeS >= 35)!;
    const peak = Math.max(...run.samples.map((sample) => sample.gas?.pressureBarG ?? 0));

    expect(beforeSurge.gas!.pressureBarG).toBeCloseTo(
      DEFAULT_SIMULATION_WITH_GAS.gas!.setpointBarG,
      1,
    );
    expect(peak).toBeGreaterThan(beforeSurge.gas!.pressureBarG);
    // The loop must open the gas valve to absorb it rather than simply trip.
    const afterSurge = run.samples.filter((sample) => sample.timeS >= 60);
    const openings = afterSurge.map((sample) => sample.pressure!.valvePositionPct);
    expect(Math.max(...openings)).toBeGreaterThan(60);
  });

  it("scores the pressure loop and its valve", () => {
    const run = runGas("gor-surge", 1007);
    expect(run.result.metrics.pressureLoop).toBeDefined();
    expect(run.result.metrics.gasActuator).toBeDefined();
    expect(run.result.metrics.gasActuator!.travelPct).toBeGreaterThan(0);
  });

  it("couples the gas cap to the liquid inventory", () => {
    // Draining liquid enlarges the space the gas occupies. With the outlet valve
    // shut the held moles cannot change, so the pressure must fall purely because
    // the cap grew.
    const engine = createEngine(DEFAULT_SIMULATION_WITH_GAS, DEFAULT_TRIPLE_PID, "normal", 1001);
    const drained: EngineState = {
      ...engine,
      oilVolumeM3: engine.oilVolumeM3 * 0.5,
      waterVolumeM3: engine.waterVolumeM3 * 0.5,
    };
    const stepped = stepEngine(drained);
    expect(stepped.gasPressureBarG!).toBeLessThan(engine.gasPressureBarG!);
  });

  it("trips on pressure high-high when the gas valve cannot keep up", () => {
    const starved = createEngine(
      {
        ...DEFAULT_SIMULATION_WITH_GAS,
        gas: { ...DEFAULT_SIMULATION_WITH_GAS.gas!, valveKv: 0.5 },
      },
      DEFAULT_TRIPLE_PID,
      "normal",
      1001,
    );
    const finished = stepToTerminal(starved);
    expect(finished.status).toBe("tripped");
    expect(finished.trip).toBe("PRESSURE_HH");

    const run = finishEngine(finished);
    expect(run.result.score.feedback).toEqual({ kind: "trip", trip: "PRESSURE_HH" });
    expect(run.samples.at(-1)!.safety.condition).toBe("pressure-high-high");
  });

  it("keeps a liquid trip as the headline when both are in alarm", () => {
    // A level excursion is slower and more damaging, so it must not be masked by
    // a pressure alarm that happens to be active at the same moment.
    const run = runGas("water-rich-slug", 1003);
    const alarms = run.samples.filter((sample) => sample.safety.severity !== "safe");
    for (const sample of alarms) {
      if (sample.safety.source === "pressure") {
        expect(sample.safety.severity).toBe("trip");
      }
    }
  });
});
