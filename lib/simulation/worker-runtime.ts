import { createEngine, finishEngine, stepEngine, type EngineState } from "./engine";
import { WORKER_PROTOCOL_VERSION } from "./types";
import type { SimulationStatus, WorkerEvent, WorkerRequest } from "./types";

type Emit = (event: WorkerEvent) => void;

export class SimulationRuntime {
  private engine: EngineState | null = null;
  private runId: string | null = null;
  private emit: Emit;
  private realTimeBudgetS = 0;
  private speed = 1;
  private lastSampleTimeS = -1;
  private initialSeed = 0;

  constructor(emit: Emit) {
    this.emit = emit;
  }

  get status(): SimulationStatus {
    return this.engine?.status ?? "idle";
  }

  get timeS(): number {
    return this.engine?.timeS ?? 0;
  }

  invalidate(runId: string): boolean {
    if (runId !== this.runId) return false;
    this.engine = null;
    this.runId = null;
    this.realTimeBudgetS = 0;
    this.lastSampleTimeS = -1;
    return true;
  }

  private installEngine(engine: EngineState, runId: string): void {
    this.engine = engine.status === "running" ? { ...engine, status: "idle" } : engine;
    this.realTimeBudgetS = 0;
    this.lastSampleTimeS = this.engine.samples[0].timeS;
    this.emit({
      type: "ready",
      runId,
      sample: this.engine.samples[0],
    });
    this.emit({ type: "status", runId, status: this.engine.status });
    if (this.engine.status === "tripped") {
      const finished = finishEngine(this.engine);
      this.emit({
        type: "finished",
        runId,
        status: finished.status,
        result: finished.result,
      });
    }
  }

  handle(request: WorkerRequest): void {
    if (request.type === "initialize") {
      // A client built against a different protocol would be misread rather than
      // rejected, so refuse anything this runtime does not recognise.
      if (
        request.protocolVersion !== undefined &&
        request.protocolVersion !== WORKER_PROTOCOL_VERSION
      ) {
        throw new Error(
          `Unsupported worker protocol ${request.protocolVersion}; this runtime speaks ${WORKER_PROTOCOL_VERSION}`,
        );
      }
      const engine = createEngine(
        request.config,
        request.pid,
        request.scenarioId,
        request.seed,
      );
      this.runId = request.runId;
      this.initialSeed = request.seed;
      this.installEngine(engine, request.runId);
      return;
    }
    if (!this.engine || request.runId !== this.runId) return;
    if (request.type === "set-speed") {
      this.speed = [0.5, 1, 2, 4].includes(request.speed) ? request.speed : 1;
      return;
    }
    if (request.type === "start") {
      if (this.engine.status === "idle" || this.engine.status === "paused") {
        this.engine = { ...this.engine, status: "running" };
        this.emit({ type: "status", runId: request.runId, status: "running" });
      }
      return;
    }
    if (request.type === "pause") {
      if (this.engine.status === "running") {
        this.engine = { ...this.engine, status: "paused" };
        this.emit({ type: "status", runId: request.runId, status: "paused" });
      }
      return;
    }
    if (request.type === "reset") {
      // Playback speed is a user preference, so reset retains it while replay
      // budget and sample publication restart from the deterministic seed.
      this.installEngine(
        createEngine(
          this.engine.config,
          this.engine.pidConfig,
          this.engine.scenarioId,
          this.initialSeed,
        ),
        request.runId,
      );
    }
  }

  tick(realElapsedS: number): void {
    if (!this.engine || !this.runId || this.engine.status !== "running") return;
    this.realTimeBudgetS += Math.max(0, realElapsedS) * this.speed;
    while (
      this.engine.status === "running" &&
      this.realTimeBudgetS + 1e-10 >= this.engine.config.dtS
    ) {
      this.engine = stepEngine(this.engine);
      this.realTimeBudgetS -= this.engine.config.dtS;
    }
    const newSamples = this.engine.samples.filter(
      (sample) => sample.timeS > this.lastSampleTimeS,
    );
    if (newSamples.length > 0) {
      this.lastSampleTimeS = newSamples.at(-1)!.timeS;
      this.emit({ type: "samples", runId: this.runId, samples: newSamples });
    }
    if (this.engine.status === "completed" || this.engine.status === "tripped") {
      const finished = finishEngine(this.engine);
      this.emit({
        type: "status",
        runId: this.runId,
        status: finished.status,
      });
      this.emit({
        type: "finished",
        runId: this.runId,
        status: finished.status,
        result: finished.result,
      });
    }
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

/**
 * Converts runtime exceptions into the public Worker protocol. SimulationRuntime
 * itself deliberately keeps throwing programmer/configuration errors so its
 * direct callers can diagnose invalid state instead of silently losing it.
 */
export class SimulationWorkerAdapter {
  private readonly emit: Emit;
  private readonly runtime: SimulationRuntime;
  private activeRunId: string | null = null;

  constructor(emit: Emit) {
    this.emit = emit;
    this.runtime = new SimulationRuntime(emit);
  }

  handle(request: WorkerRequest): void {
    try {
      this.runtime.handle(request);
      if (request.type === "initialize") this.activeRunId = request.runId;
    } catch (error) {
      this.emit({
        type: "error",
        runId: request.runId,
        message: errorMessage(error, "Simulation worker failed"),
      });
    }
  }

  tick(realElapsedS: number): void {
    if (!this.activeRunId) return;
    try {
      this.runtime.tick(realElapsedS);
    } catch (error) {
      const failedRunId = this.activeRunId;
      this.activeRunId = null;
      this.runtime.invalidate(failedRunId);
      this.emit({
        type: "error",
        runId: failedRunId,
        message: errorMessage(error, "Simulation tick failed"),
      });
    }
  }
}
