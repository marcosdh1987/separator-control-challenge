import { describe, expect, it, vi } from "vitest";

import { SimulationRuntime, SimulationWorkerAdapter } from "./worker-runtime";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_SIMULATION,
  type WorkerEvent,
  type WorkerRequest,
} from "./types";

const initialize = {
  type: "initialize" as const,
  runId: "run-1",
  config: DEFAULT_SIMULATION,
  pid: DEFAULT_DUAL_PID,
  scenarioId: "normal" as const,
  seed: 1001,
};

const invalidInitialize = {
  ...initialize,
  runId: "run-bad",
  pid: DEFAULT_DUAL_PID.total,
} as unknown as WorkerRequest;

function terminalObservation(ticks: number[], speed = 1) {
  const events: WorkerEvent[] = [];
  const runtime = new SimulationRuntime((event) => events.push(event));
  runtime.handle({
    ...initialize,
    config: { ...DEFAULT_SIMULATION, durationS: 5 },
    pid: DEFAULT_DUAL_PID,
    scenarioId: "noisy-interface",
    seed: 1006,
  });
  runtime.handle({ type: "set-speed", runId: "run-1", speed });
  runtime.handle({ type: "start", runId: "run-1" });
  for (const elapsedS of ticks) runtime.tick(elapsedS);

  const visibleSamples = events.flatMap((event) => {
    if (event.type === "ready") return [event.sample];
    if (event.type === "samples") return event.samples;
    return [];
  });
  const finished = events.find((event) => event.type === "finished");
  if (!finished || finished.type !== "finished") {
    throw new Error("Expected the bounded runtime test to finish");
  }

  return {
    runtimeStatus: runtime.status,
    runtimeTimeS: runtime.timeS,
    finalVisibleSample: visibleSamples.at(-1),
    finishedStatus: finished.status,
    result: finished.result,
  };
}

describe("simulation worker runtime", () => {
  it("publishes the complete dual-loop equilibrium when ready", () => {
    const events: WorkerEvent[] = [];
    const runtime = new SimulationRuntime((event) => events.push(event));

    runtime.handle(initialize);

    const ready = events.find((event) => event.type === "ready");
    expect(ready).toMatchObject({ type: "ready", runId: "run-1" });
    if (!ready || ready.type !== "ready") throw new Error("Expected ready event");
    expect(ready.sample.total.processValuePct).toBe(50);
    expect(ready.sample.interface.processValuePct).toBe(20);
    expect(ready.sample.oilLayerPct).toBe(30);
    expect(ready.sample.flows).toEqual({
      totalInletM3H: 50,
      waterCutFraction: 0.3,
      oilInletM3H: 35,
      waterInletM3H: 15,
      oilOutletM3H: 35,
      waterOutletM3H: 15,
    });
    expect(events).toContainEqual({
      type: "status",
      runId: "run-1",
      status: "idle",
    });
  });

  it("moves through initialize, start, pause, resume, and reset", () => {
    const events: WorkerEvent[] = [];
    const runtime = new SimulationRuntime((event) => events.push(event));

    runtime.handle(initialize);
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(0.05);
    runtime.handle({ type: "pause", runId: "run-1" });
    const pausedAt = runtime.timeS;
    runtime.tick(1);
    expect(runtime.timeS).toBe(pausedAt);
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(0.05);
    expect(runtime.timeS).toBeGreaterThan(pausedAt);
    runtime.handle({ type: "reset", runId: "run-1" });

    expect(runtime.status).toBe("idle");
    expect(runtime.timeS).toBe(0);
    expect(events.slice(-2).map((event) => event.type)).toEqual(["ready", "status"]);
    expect(events.at(-1)).toEqual({
      type: "status",
      runId: "run-1",
      status: "idle",
    });
  });

  it("ignores stale run identifiers", () => {
    const runtime = new SimulationRuntime(() => undefined);
    runtime.handle(initialize);
    runtime.handle({ type: "start", runId: "stale-run" });
    runtime.tick(1);
    expect(runtime.timeS).toBe(0);
  });

  it("changes playback speed without changing the fixed physics step", () => {
    const runtime = new SimulationRuntime(() => undefined);
    runtime.handle(initialize);
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.handle({ type: "set-speed", runId: "run-1", speed: 4 });
    runtime.tick(0.05);
    expect(runtime.timeS).toBeCloseTo(0.2, 8);
  });

  it("retains valid playback speed across reset and rejects unsupported values", () => {
    const runtime = new SimulationRuntime(() => undefined);
    runtime.handle(initialize);
    runtime.handle({ type: "set-speed", runId: "run-1", speed: 4 });
    runtime.handle({ type: "reset", runId: "run-1" });
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(0.05);
    expect(runtime.timeS).toBeCloseTo(0.2, 8);

    runtime.handle({ type: "reset", runId: "run-1" });
    runtime.handle({ type: "set-speed", runId: "run-1", speed: 3 });
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(0.05);
    expect(runtime.timeS).toBeCloseTo(0.05, 8);
  });

  it("produces the same result across speed and pause schedules", () => {
    const run = (speed: number, pause: boolean) => {
      const events: WorkerEvent[] = [];
      const runtime = new SimulationRuntime((event) => events.push(event));
      runtime.handle({
        ...initialize,
        config: { ...DEFAULT_SIMULATION, durationS: 2 },
        scenarioId: "noisy-interface",
        seed: 1006,
      });
      runtime.handle({ type: "set-speed", runId: "run-1", speed });
      runtime.handle({ type: "start", runId: "run-1" });
      if (pause) {
        runtime.tick(0.5 / speed);
        runtime.handle({ type: "pause", runId: "run-1" });
        runtime.tick(20);
        runtime.handle({ type: "start", runId: "run-1" });
        runtime.tick(1.5 / speed);
      } else {
        runtime.tick(2 / speed);
      }
      return events.find((event) => event.type === "finished");
    };

    expect(run(4, true)).toEqual(run(1, false));
  });

  it("completes with an identical final sample and result at every replay speed", () => {
    const observations = [0.5, 1, 2, 4].map((speed) =>
      terminalObservation([5 / speed], speed)
    );

    for (const observation of observations.slice(1)) {
      expect(observation).toEqual(observations[0]);
    }
  });

  it("produces the same terminal state after one catch-up tick or 100 fixed ticks", () => {
    const catchUp = terminalObservation([5]);
    const granular = terminalObservation(Array.from({ length: 100 }, () => 0.05));

    expect(catchUp).toEqual(granular);
  });

  it("never emits the private scoring history", () => {
    const events: WorkerEvent[] = [];
    const runtime = new SimulationRuntime((event) => events.push(event));
    runtime.handle({
      ...initialize,
      config: { ...DEFAULT_SIMULATION, durationS: 46, chartSampleS: 0.05 },
    });
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(46);

    expect(JSON.stringify(events)).not.toContain("metricSamples");
    const sampleEvents = events.filter((event) => event.type === "samples");
    expect(sampleEvents.flatMap((event) => event.samples)).toHaveLength(901);
  });

  it("publishes an initially unsafe run as one immediate terminal result", () => {
    const events: WorkerEvent[] = [];
    const runtime = new SimulationRuntime((event) => events.push(event));

    runtime.handle({
      ...initialize,
      config: { ...DEFAULT_SIMULATION, totalSetpointPct: 95 },
    });

    expect(runtime.status).toBe("tripped");
    expect(runtime.timeS).toBe(0);
    expect(events.map((event) => event.type)).toEqual(["ready", "status", "finished"]);
    expect(events[0]).toMatchObject({
      type: "ready",
      sample: { timeS: 0, safety: { severity: "trip", trip: "TOTAL_HH" } },
    });
    expect(events[1]).toEqual({
      type: "status",
      runId: "run-1",
      status: "tripped",
    });
    expect(events[2]).toMatchObject({
      type: "finished",
      runId: "run-1",
      status: "tripped",
      result: { metrics: { trip: "TOTAL_HH" } },
    });

    runtime.handle({ type: "start", runId: "run-1" });
    runtime.handle({ type: "pause", runId: "run-1" });
    runtime.tick(30);
    expect(events).toHaveLength(3);
  });

  it("replays one terminal publication when an unsafe run is reset", () => {
    const events: WorkerEvent[] = [];
    const runtime = new SimulationRuntime((event) => events.push(event));
    runtime.handle({
      ...initialize,
      config: { ...DEFAULT_SIMULATION, interfaceSetpointPct: 50 },
    });

    runtime.handle({ type: "reset", runId: "run-1" });
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(1);

    expect(events.map((event) => event.type)).toEqual([
      "ready",
      "status",
      "finished",
      "ready",
      "status",
      "finished",
    ]);
    expect(events.filter((event) => event.type === "finished")).toHaveLength(2);
    expect(events.filter((event) => event.type === "status")).toEqual([
      { type: "status", runId: "run-1", status: "tripped" },
      { type: "status", runId: "run-1", status: "tripped" },
    ]);
  });

  it("does not duplicate terminal events after a normal completion", () => {
    const events: WorkerEvent[] = [];
    const runtime = new SimulationRuntime((event) => events.push(event));
    runtime.handle({
      ...initialize,
      config: { ...DEFAULT_SIMULATION, durationS: 0.05 },
    });
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(0.05);
    runtime.tick(30);
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.handle({ type: "pause", runId: "run-1" });

    expect(events.filter((event) => event.type === "finished")).toHaveLength(1);
    expect(events.filter(
      (event) => event.type === "status" && event.status === "completed",
    )).toHaveLength(1);
  });

  it("replaces the active run and ignores controls for the previous identifier", () => {
    const events: WorkerEvent[] = [];
    const runtime = new SimulationRuntime((event) => events.push(event));
    runtime.handle(initialize);
    runtime.handle({ ...initialize, runId: "run-2", seed: 2002 });
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(1);
    expect(runtime.timeS).toBe(0);

    runtime.handle({ type: "start", runId: "run-2" });
    runtime.tick(0.05);
    expect(runtime.timeS).toBeCloseTo(0.05, 8);
    expect(events.at(-1)).toMatchObject({ runId: "run-2" });
  });

  it("keeps the old runtime transaction intact when replacement construction throws", () => {
    const events: WorkerEvent[] = [];
    const runtime = new SimulationRuntime((event) => events.push(event));
    runtime.handle(initialize);
    runtime.handle({ type: "start", runId: "run-1" });
    runtime.tick(0.025);
    expect(runtime.timeS).toBe(0);
    const beforeFailure = events.length;

    expect(() => runtime.handle(invalidInitialize)).toThrow();
    expect(events).toHaveLength(beforeFailure);
    expect(runtime.status).toBe("running");
    expect(runtime.timeS).toBe(0);

    runtime.tick(0.025);
    expect(runtime.timeS).toBeCloseTo(0.05, 8);

    runtime.handle({ type: "pause", runId: "run-1" });
    expect(runtime.status).toBe("paused");
    expect(events.at(-1)).toEqual({
      type: "status",
      runId: "run-1",
      status: "paused",
    });
  });
});

describe("simulation Worker adapter", () => {
  it("labels a failed replacement with the requested id and preserves the old run", () => {
    const events: WorkerEvent[] = [];
    const adapter = new SimulationWorkerAdapter((event) => events.push(event));
    adapter.handle(initialize);
    adapter.handle({ type: "start", runId: "run-1" });
    adapter.tick(0.05);

    adapter.handle(invalidInitialize);
    expect(events.at(-1)).toMatchObject({ type: "error", runId: "run-bad" });

    adapter.handle({ type: "pause", runId: "run-1" });
    expect(events.at(-1)).toEqual({
      type: "status",
      runId: "run-1",
      status: "paused",
    });
  });

  it("invalidates a run after one tick exception and permits explicit recovery", () => {
    const events: WorkerEvent[] = [];
    const adapter = new SimulationWorkerAdapter((event) => events.push(event));
    adapter.handle(initialize);
    adapter.handle({ type: "start", runId: "run-1" });
    const tick = vi.spyOn(SimulationRuntime.prototype, "tick")
      .mockImplementationOnce(() => {
        throw new Error("Tick failed");
      });

    adapter.tick(0.05);
    adapter.tick(0.05);

    expect(events.filter((event) => event.type === "error")).toEqual([
      { type: "error", runId: "run-1", message: "Tick failed" },
    ]);
    const countAfterFailure = events.length;
    adapter.handle({ type: "start", runId: "run-1" });
    adapter.tick(0.05);
    expect(events).toHaveLength(countAfterFailure);

    adapter.handle({ ...initialize, runId: "run-2" });
    adapter.handle({ type: "start", runId: "run-2" });
    adapter.tick(0.05);
    expect(events.at(-1)).toMatchObject({ runId: "run-2" });
    tick.mockRestore();
  });
});
