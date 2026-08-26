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
    // indistinguishable from steady operation, sample by sample.
    const surge = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "gor-surge", 1007);
    const normal = runToEnd(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1007);
    expect(surge.samples.map((sample) => ({ ...sample, disturbance: "steady" })))
      .toEqual(normal.samples.map((sample) => ({ ...sample, disturbance: "steady" })));
    // Tracking figures match exactly; recovery is measured from each scenario's
    // own disturbance timestamp, so it is the one legitimately different field.
    expect(surge.result.metrics.loops.total.mae).toBe(normal.result.metrics.loops.total.mae);
    expect(surge.result.metrics.loops.interface.mae).toBe(normal.result.metrics.loops.interface.mae);
  });
});

describe("gas cap enabled", () => {
  it("starts blanketed at header pressure and builds to the setpoint", () => {
    const run = runGas("normal", 1001);
    const opening = run.samples[0];
    const final = run.samples.at(-1)!;

    // A shut-in empty vessel sits at the downstream header pressure it was left
    // blanketed at; working pressure is something the run has to build.
    expect(opening.gas?.pressureBarG).toBeCloseTo(
      DEFAULT_SIMULATION_WITH_GAS.gas!.downstreamPressureBarA - 1.01325,
      2,
    );
    expect(run.status).toBe("completed");
    expect(final.gas!.pressureBarG).toBeCloseTo(
      DEFAULT_SIMULATION_WITH_GAS.gas!.setpointBarG,
      1,
    );
    // At the design duty the valve sits near mid-travel, with authority in hand.
    expect(final.pressure!.valvePositionPct).toBeGreaterThan(35);
    expect(final.pressure!.valvePositionPct).toBeLessThan(65);
    // What the feed brings in, the valve lets out, within the settling that a
    // 300-second run still carries.
    expect(Math.abs(final.gas!.outletSm3H - final.gas!.inletSm3H))
      .toBeLessThan(final.gas!.inletSm3H * 0.05);
  });

  it("is reproducible for a given seed", () => {
    const first = runGas("gor-surge", 1007);
    const second = runGas("gor-surge", 1007);
    expect(second.samples).toEqual(first.samples);
    expect(second.result).toEqual(first.result);
  });

  it("raises pressure when the well starts making more gas", () => {
    const run = runGas("gor-surge", 1007);
    const beforeSurge = run.samples.find((sample) => sample.timeS >= 185)!;
    const afterSurgeSamples = run.samples.filter((sample) => sample.timeS >= 190);
    const peak = Math.max(...afterSurgeSamples.map((sample) => sample.gas?.pressureBarG ?? 0));

    // Established before the surge, within the working band of the setpoint.
    expect(Math.abs(beforeSurge.gas!.pressureBarG - DEFAULT_SIMULATION_WITH_GAS.gas!.setpointBarG))
      .toBeLessThan(0.5);
    expect(peak).toBeGreaterThan(beforeSurge.gas!.pressureBarG);
    // The loop must open the gas valve to absorb it rather than simply trip.
    const openings = afterSurgeSamples.map((sample) => sample.pressure!.valvePositionPct);
    expect(Math.max(...openings)).toBeGreaterThan(60);
  });

  it("scores the pressure loop and its valve", () => {
    const run = runGas("gor-surge", 1007);
    expect(run.result.metrics.pressureLoop).toBeDefined();
    expect(run.result.metrics.gasActuator).toBeDefined();
    expect(run.result.metrics.gasActuator!.travelPct).toBeGreaterThan(0);
  });

  it("couples the gas cap to the liquid inventory", () => {
    // Run until established, then drain half the liquid in place. The cap grows,
    // so the same moles of gas must read a lower pressure.
    let engine = createEngine(DEFAULT_SIMULATION_WITH_GAS, DEFAULT_TRIPLE_PID, "normal", 1001);
    while (engine.status === "running" && engine.timeS < 200) engine = stepEngine(engine);
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

  it("lets a pressure alarm surface only when the liquid side is calm", () => {
    // A level excursion is slower and more damaging, so a pressure *alarm* never
    // outranks a liquid alarm or trip; only a pressure trip may end the run.
    const run = runGas("water-rich-slug", 1003);
    for (const sample of run.samples) {
      if (sample.safety.source === "pressure" && sample.safety.severity === "alarm") {
        // A visible pressure alarm means no liquid *high* alarm was active. The
        // low side can be legitimately quiet during the fill, before it arms.
        expect(sample.total.processValuePct).toBeLessThan(DEFAULT_SIMULATION_WITH_GAS.totalHighAlarmPct);
        expect(sample.interface.processValuePct).toBeLessThan(DEFAULT_SIMULATION_WITH_GAS.interfaceHighAlarmPct);
      }
    }
  });
});
