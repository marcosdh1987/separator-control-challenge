import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { createEquilibriumSample, useSimulation } from "./use-simulation";
import { createEngine, finishEngine } from "@/lib/simulation/engine";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_SIMULATION,
  type DualPidConfig,
  type WorkerEvent,
  type WorkerRequest,
} from "@/lib/simulation/types";

class ManualWorker {
  static instances: ManualWorker[] = [];

  messages: WorkerRequest[] = [];
  terminateCount = 0;
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;

  constructor() {
    ManualWorker.instances.push(this);
  }

  postMessage(message: WorkerRequest) {
    this.messages.push(message);
  }

  emit(event: WorkerEvent) {
    this.onmessage?.({ data: event } as MessageEvent<WorkerEvent>);
  }

  terminate() {
    this.terminateCount += 1;
  }
}

class ThrowingWorker {
  constructor() {
    throw new Error("Worker construction failed");
  }
}

class RecoverableWorker {
  static attempts = 0;
  constructor() {
    RecoverableWorker.attempts += 1;
    if (RecoverableWorker.attempts === 1) throw new Error("first construction fails");
    return new ManualWorker();
  }
}

const equilibriumSample = createEngine(
  DEFAULT_SIMULATION,
  DEFAULT_DUAL_PID,
  "normal",
  1001,
).samples[0];

const completedResult = finishEngine(createEngine(
  { ...DEFAULT_SIMULATION, totalSetpointPct: 95 },
  DEFAULT_DUAL_PID,
  "normal",
  1001,
)).result;

function latestInitialize(worker: ManualWorker) {
  const request = worker.messages.filter(
    (message): message is Extract<WorkerRequest, { type: "initialize" }> =>
      message.type === "initialize",
  ).at(-1);
  if (!request) throw new Error("Expected initialize request");
  return request;
}

describe("useSimulation", () => {
  beforeEach(() => {
    ManualWorker.instances = [];
    RecoverableWorker.attempts = 0;
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: ManualWorker,
    });
  });

  it("matches the domain engine's approved normal equilibrium exactly", () => {
    expect(createEquilibriumSample()).toEqual(equilibriumSample);
  });

  it("turns a synchronous Worker constructor failure into an actionable error", async () => {
    Object.defineProperty(globalThis, "Worker", {
      configurable: true,
      value: ThrowingWorker,
    });

    const { result } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.ready).toBe(false);
    expect(result.current.error).toBe("The simulation worker could not be created.");
    expect(ManualWorker.instances).toHaveLength(0);
  });

  it("retries a constructor failure with a fresh initialized Worker generation", async () => {
    Object.defineProperty(globalThis, "Worker", { configurable: true, value: RecoverableWorker });
    const { result } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));
    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retryWorker());
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const replacement = ManualWorker.instances[0];
    const initialize = latestInitialize(replacement);
    expect(result.current).toMatchObject({ ready: false, status: "idle", error: null });
    act(() => replacement.emit({ type: "ready", runId: initialize.runId, sample: equilibriumSample }));
    expect(result.current.ready).toBe(true);
  });

  it("terminates and replaces a native-failed Worker without accepting stale callbacks", async () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const failed = ManualWorker.instances[0];
    const staleHandler = failed.onmessage;
    act(() => failed.onerror?.());
    act(() => result.current.retryWorker());
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(2));
    const replacement = ManualWorker.instances[1];
    const initialize = latestInitialize(replacement);
    expect(failed.terminateCount).toBe(1);
    act(() => staleHandler?.({ data: { type: "ready", runId: initialize.runId, sample: equilibriumSample } } as MessageEvent<WorkerEvent>));
    expect(result.current.ready).toBe(false);
    act(() => replacement.emit({ type: "ready", runId: initialize.runId, sample: equilibriumSample }));
    expect(result.current.ready).toBe(true);
  });

  it("repeated retries replace one generation at a time without leaking Workers", async () => {
    const { result, unmount } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const first = ManualWorker.instances[0];
    act(() => result.current.retryWorker());
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(2));
    const second = ManualWorker.instances[1];
    expect(first.terminateCount).toBe(1);
    act(() => result.current.retryWorker());
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(3));
    const third = ManualWorker.instances[2];
    expect(second.terminateCount).toBe(1);
    expect(third.terminateCount).toBe(0);
    unmount();
    expect(third.terminateCount).toBe(1);
  });

  it("posts a fully sanitized dual-loop initialization", async () => {
    const pid: DualPidConfig = {
      total: { ...DEFAULT_DUAL_PID.total, kp: 99, ki: -1 },
      interface: { ...DEFAULT_DUAL_PID.interface, kd: 99, integralLimit: 999 },
    };

    renderHook(() => useSimulation(pid, "normal"));

    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const request = latestInitialize(ManualWorker.instances[0]);
    expect(request.pid).toEqual({
      total: { ...DEFAULT_DUAL_PID.total, kp: 10, ki: 0 },
      interface: { ...DEFAULT_DUAL_PID.interface, kd: 30, integralLimit: 40 },
    });
    expect(request.pid.total).not.toBe(request.pid.interface);
  });

  it("waits for the matching ready event before posting speed and start", async () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const worker = ManualWorker.instances[0];
    const initial = latestInitialize(worker);

    expect(result.current.ready).toBe(false);
    act(() => worker.emit({
      type: "ready",
      runId: initial.runId,
      sample: equilibriumSample,
    }));
    expect(result.current.ready).toBe(true);

    act(() => result.current.start());
    const attempt = latestInitialize(worker);
    expect(attempt.runId).not.toBe(initial.runId);
    expect(result.current.ready).toBe(false);
    expect(worker.messages.slice(-1).map((message) => message.type)).toEqual([
      "initialize",
    ]);

    act(() => worker.emit({
      type: "ready",
      runId: initial.runId,
      sample: { ...equilibriumSample, timeS: 99 },
    }));
    expect(worker.messages.filter((message) => message.type === "start")).toHaveLength(0);

    act(() => worker.emit({
      type: "ready",
      runId: attempt.runId,
      sample: equilibriumSample,
    }));
    expect(worker.messages.slice(-3)).toEqual([
      attempt,
      { type: "set-speed", runId: attempt.runId, speed: 1 },
      { type: "start", runId: attempt.runId },
    ]);
  });

  it("ignores stale samples and results while retaining only 900 current samples", async () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const worker = ManualWorker.instances[0];
    const current = latestInitialize(worker);
    act(() => worker.emit({ type: "ready", runId: current.runId, sample: equilibriumSample }));

    act(() => {
      worker.emit({
        type: "samples",
        runId: "stale-run",
        samples: [{ ...equilibriumSample, timeS: 777 }],
      });
      worker.emit({
        type: "finished",
        runId: "stale-run",
        status: "completed",
        result: completedResult,
      });
    });
    expect(result.current.samples).toEqual([equilibriumSample]);
    expect(result.current.result).toBeNull();

    const incoming = Array.from({ length: 950 }, (_, index) => ({
      ...equilibriumSample,
      timeS: index + 1,
    }));
    act(() => worker.emit({ type: "samples", runId: current.runId, samples: incoming }));
    expect(result.current.samples).toHaveLength(900);
    expect(result.current.samples[0].timeS).toBe(51);
    expect(result.current.currentSample.timeS).toBe(950);

    act(() => worker.emit({
      type: "finished",
      runId: current.runId,
      status: "completed",
      result: completedResult,
    }));
    expect(result.current.result).toBe(completedResult);
  });

  it("resets to a fresh gated run without carrying errors or results", async () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const worker = ManualWorker.instances[0];
    const first = latestInitialize(worker);
    act(() => {
      worker.emit({ type: "ready", runId: first.runId, sample: equilibriumSample });
      worker.emit({
        type: "finished",
        runId: first.runId,
        status: "completed",
        result: completedResult,
      });
      worker.emit({ type: "error", runId: first.runId, message: "old error" });
    });
    expect(result.current.error).toBe("old error");

    act(() => result.current.reset());
    const reset = latestInitialize(worker);
    expect(reset.runId).not.toBe(first.runId);
    expect(result.current.ready).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.samples).toHaveLength(1);
    expect(worker.messages.at(-1)?.type).toBe("initialize");

    act(() => worker.emit({ type: "ready", runId: reset.runId, sample: equilibriumSample }));
    expect(result.current.ready).toBe(true);
    expect(worker.messages.filter((message) => message.type === "start")).toHaveLength(0);
  });

  it("fences every queued event after a typed error until a fresh run initializes", async () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const worker = ManualWorker.instances[0];
    const failed = latestInitialize(worker);
    act(() => {
      worker.emit({ type: "ready", runId: failed.runId, sample: equilibriumSample });
      worker.emit({ type: "error", runId: failed.runId, message: "Runtime failed" });
      worker.emit({ type: "status", runId: failed.runId, status: "running" });
      worker.emit({
        type: "samples",
        runId: failed.runId,
        samples: [{ ...equilibriumSample, timeS: 12 }],
      });
      worker.emit({
        type: "finished",
        runId: failed.runId,
        status: "completed",
        result: completedResult,
      });
    });

    expect(result.current).toMatchObject({
      ready: false,
      status: "error",
      result: null,
      error: "Runtime failed",
    });
    expect(result.current.samples).toEqual([equilibriumSample]);

    act(() => result.current.reset());
    const recovery = latestInitialize(worker);
    expect(recovery.runId).not.toBe(failed.runId);
    expect(result.current.error).toBeNull();
    act(() => worker.emit({
      type: "ready",
      runId: recovery.runId,
      sample: equilibriumSample,
    }));
    expect(result.current.ready).toBe(true);
  });

  it("invalidates and terminates a Worker generation after native onerror", async () => {
    const { result, unmount } = renderHook(() =>
      useSimulation(DEFAULT_DUAL_PID, "normal"),
    );
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const worker = ManualWorker.instances[0];
    const current = latestInitialize(worker);
    const queuedMessage = worker.onmessage;
    const messageCount = worker.messages.length;

    act(() => worker.onerror?.());

    expect(result.current).toMatchObject({
      ready: false,
      status: "error",
      result: null,
      error: "The simulation worker could not be loaded.",
    });
    expect(worker.terminateCount).toBe(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();

    act(() => {
      for (const event of [
        { type: "ready", runId: current.runId, sample: equilibriumSample },
        { type: "status", runId: current.runId, status: "running" },
        {
          type: "samples",
          runId: current.runId,
          samples: [{ ...equilibriumSample, timeS: 15 }],
        },
        {
          type: "finished",
          runId: current.runId,
          status: "completed",
          result: completedResult,
        },
      ] satisfies WorkerEvent[]) {
        queuedMessage?.({ data: event } as MessageEvent<WorkerEvent>);
      }
    });
    expect(result.current).toMatchObject({
      ready: false,
      status: "error",
      result: null,
      error: "The simulation worker could not be loaded.",
    });
    act(() => result.current.reset());
    expect(worker.messages).toHaveLength(messageCount);
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("The simulation worker could not be loaded.");

    unmount();
    expect(worker.terminateCount).toBe(1);
  });

  it("invalidates a Worker generation after an unreadable native message", async () => {
    const { result } = renderHook(() => useSimulation(DEFAULT_DUAL_PID, "normal"));
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const worker = ManualWorker.instances[0];

    act(() => worker.onmessageerror?.());

    expect(result.current).toMatchObject({
      ready: false,
      status: "error",
      error: "The simulation worker returned an unreadable message.",
    });
    expect(worker.terminateCount).toBe(1);
    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();
  });

  it("detaches handlers and terminates exactly once on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useSimulation(DEFAULT_DUAL_PID, "normal"),
    );
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const worker = ManualWorker.instances[0];
    const initial = latestInitialize(worker);
    act(() => worker.emit({ type: "ready", runId: initial.runId, sample: equilibriumSample }));
    act(() => result.current.start());
    const pending = latestInitialize(worker);
    const queuedMessage = worker.onmessage;

    unmount();

    expect(worker.onmessage).toBeNull();
    expect(worker.onerror).toBeNull();
    expect(worker.onmessageerror).toBeNull();
    expect(worker.terminateCount).toBe(1);
    const countAfterUnmount = worker.messages.length;
    queuedMessage?.({
      data: { type: "ready", runId: pending.runId, sample: equilibriumSample },
    } as MessageEvent<WorkerEvent>);
    expect(worker.messages).toHaveLength(countAfterUnmount);
  });

  it("reinitializes once for idle props and ignores changes while running", async () => {
    type Props = { pid: DualPidConfig; scenarioId: "normal" | "feed-step" };
    const initialProps: Props = { pid: DEFAULT_DUAL_PID, scenarioId: "normal" };
    const { rerender } = renderHook(
      ({ pid, scenarioId }: Props) => useSimulation(pid, scenarioId),
      { initialProps },
    );
    await waitFor(() => expect(ManualWorker.instances).toHaveLength(1));
    const worker = ManualWorker.instances[0];
    expect(worker.messages.filter((message) => message.type === "initialize")).toHaveLength(1);

    const idlePid: DualPidConfig = {
      total: { ...DEFAULT_DUAL_PID.total, kp: 5 },
      interface: DEFAULT_DUAL_PID.interface,
    };
    rerender({ pid: idlePid, scenarioId: "feed-step" });
    await waitFor(() => {
      expect(worker.messages.filter((message) => message.type === "initialize")).toHaveLength(2);
    });
    rerender({ pid: idlePid, scenarioId: "feed-step" });
    expect(worker.messages.filter((message) => message.type === "initialize")).toHaveLength(2);

    const current = latestInitialize(worker);
    act(() => worker.emit({ type: "status", runId: current.runId, status: "running" }));
    rerender({
      pid: {
        total: idlePid.total,
        interface: { ...DEFAULT_DUAL_PID.interface, kp: 6 },
      },
      scenarioId: "normal",
    });
    expect(worker.messages.filter((message) => message.type === "initialize")).toHaveLength(2);
  });
});
