"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createEngine } from "@/lib/simulation/engine";
import { createEquilibriumSnapshot } from "@/lib/simulation/equilibrium";
import { getScenario, scenarioAt } from "@/lib/simulation/scenarios";
import { sanitizeDualPidConfig, sanitizeSimulationConfig } from "@/lib/simulation/validation";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_SIMULATION,
  WORKER_PROTOCOL_VERSION,
  type DualPidConfig,
  type RunResult,
  type ScenarioId,
  type SimulationSample,
  type SimulationConfig,
  type SimulationStatus,
  type WorkerEvent,
  type WorkerRequest,
} from "@/lib/simulation/types";

/**
 * The state the dashboard shows before a run starts. With a gas cap the opening
 * sample has to come from the engine, because seeding the cap at its operating
 * pressure is part of building a run.
 */
export function createEquilibriumSample(
  config: SimulationConfig = DEFAULT_SIMULATION,
  pid: DualPidConfig = DEFAULT_DUAL_PID,
): SimulationSample {
  const sanitized = sanitizeSimulationConfig(config);
  if (sanitized.gas) {
    return createEngine(sanitized, pid, "normal", 1001).samples[0];
  }
  return createEquilibriumSnapshot(
    sanitized,
    scenarioAt("normal", 0, sanitized.actuatorTauS),
  ).sample;
}

export interface SimulationController {
  ready: boolean;
  status: SimulationStatus;
  samples: SimulationSample[];
  currentSample: SimulationSample;
  result: RunResult | null;
  error: string | null;
  speed: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  retryWorker: () => void;
  setSpeed: (speed: number) => void;
  dismissResult: () => void;
}

export function useSimulation(
  pid: DualPidConfig,
  scenarioId: ScenarioId,
  config: SimulationConfig = DEFAULT_SIMULATION,
): SimulationController {
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef("run-0");
  const sequenceRef = useRef(0);
  const initialConfigRef = useRef(config);
  const initialPidRef = useRef(pid);
  const initialScenarioRef = useRef(scenarioId);
  const pendingStartRunIdRef = useRef<string | null>(null);
  const failedRunIdRef = useRef<string | null>(null);
  const speedRef = useRef(1);
  const skipInitialSettingsEffectRef = useRef(true);
  const initializedPidRef = useRef(pid);
  const initializedScenarioRef = useRef(scenarioId);
  const initializedConfigRef = useRef(config);
  const [status, setStatus] = useState<SimulationStatus>("idle");
  const [ready, setReady] = useState(false);
  const idleSample = useMemo(() => createEquilibriumSample(config, pid), [config, pid]);
  const [samples, setSamples] = useState<SimulationSample[]>([idleSample]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeedState] = useState(1);
  const [workerGeneration, setWorkerGeneration] = useState(0);

  const post = useCallback((request: WorkerRequest) => {
    workerRef.current?.postMessage(request);
  }, []);

  const initialize = useCallback((runId: string, nextPid = pid, nextScenario = scenarioId, nextConfig = config) => {
    if (!workerRef.current) return;
    const scenario = getScenario(nextScenario);
    failedRunIdRef.current = null;
    post({
      type: "initialize",
      runId,
      config: sanitizeSimulationConfig(nextConfig),
      protocolVersion: WORKER_PROTOCOL_VERSION,
      pid: sanitizeDualPidConfig(nextPid),
      scenarioId: nextScenario,
      seed: scenario.seed,
    });
  }, [config, pid, post, scenarioId]);

  useEffect(() => {
    if (typeof Worker === "undefined") {
      const timer = window.setTimeout(() => {
        setStatus("error");
        setError("This browser does not support Web Workers.");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let worker: Worker;
    try {
      worker = new Worker(new URL("../workers/simulation.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      const timer = window.setTimeout(() => {
        setReady(false);
        setStatus("error");
        setResult(null);
        setError("The simulation worker could not be created.");
      }, 0);
      return () => window.clearTimeout(timer);
    }
    let active = true;
    let terminated = false;
    const detachAndTerminate = () => {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      if (workerRef.current === worker) workerRef.current = null;
      if (!terminated) {
        terminated = true;
        worker.terminate();
      }
    };
    const failGeneration = (message: string) => {
      if (!active) return;
      active = false;
      pendingStartRunIdRef.current = null;
      failedRunIdRef.current = runIdRef.current;
      detachAndTerminate();
      setReady(false);
      setStatus("error");
      setResult(null);
      setError(message);
    };
    workerRef.current = worker;
    worker.onmessage = (message: MessageEvent<WorkerEvent>) => {
      if (!active) return;
      const event = message.data;
      if (event.runId !== runIdRef.current) return;
      if (failedRunIdRef.current === event.runId) return;
      if (event.type === "error") {
        failedRunIdRef.current = event.runId;
        pendingStartRunIdRef.current = null;
        setReady(false);
        setStatus("error");
        setResult(null);
        setError(event.message);
        return;
      }
      if (event.type === "ready") {
        setSamples([event.sample]);
        setReady(true);
        if (pendingStartRunIdRef.current === event.runId) {
          pendingStartRunIdRef.current = null;
          worker.postMessage({
            type: "set-speed",
            runId: event.runId,
            speed: speedRef.current,
          } satisfies WorkerRequest);
          worker.postMessage({
            type: "start",
            runId: event.runId,
          } satisfies WorkerRequest);
        }
      }
      if (event.type === "samples") {
        setSamples((current) => [...current, ...event.samples].slice(-900));
      }
      if (event.type === "status") setStatus(event.status);
      if (event.type === "finished") {
        setError(null);
        setResult(event.result);
      }
    };
    worker.onerror = () => {
      failGeneration("The simulation worker could not be loaded.");
    };
    worker.onmessageerror = () => {
      failGeneration("The simulation worker returned an unreadable message.");
    };
    const initialScenario = initialScenarioRef.current;
    worker.postMessage({
      type: "initialize",
      runId: runIdRef.current,
      config: sanitizeSimulationConfig(initialConfigRef.current),
      protocolVersion: WORKER_PROTOCOL_VERSION,
      pid: sanitizeDualPidConfig(initialPidRef.current),
      scenarioId: initialScenario,
      seed: getScenario(initialScenario).seed,
    } satisfies WorkerRequest);
    return () => {
      active = false;
      detachAndTerminate();
    };
  }, [workerGeneration]);

  useEffect(() => {
    if (skipInitialSettingsEffectRef.current) {
      skipInitialSettingsEffectRef.current = false;
      return;
    }
    if (
      !workerRef.current ||
      status !== "idle" ||
      (initializedPidRef.current === pid &&
        initializedScenarioRef.current === scenarioId &&
        initializedConfigRef.current === config)
    ) return;
    sequenceRef.current += 1;
    const runId = `run-${sequenceRef.current}`;
    runIdRef.current = runId;
    initializedPidRef.current = pid;
    initializedScenarioRef.current = scenarioId;
    initializedConfigRef.current = config;
    initialPidRef.current = pid;
    initialScenarioRef.current = scenarioId;
    initialConfigRef.current = config;
    pendingStartRunIdRef.current = null;
    setReady(false);
    setSamples([idleSample]);
    setResult(null);
    setError(null);
    initialize(runId, pid, scenarioId, config);
  }, [config, idleSample, initialize, pid, scenarioId, status]);

  const start = useCallback(() => {
    if (!ready || status === "running" || status === "paused") return;
    sequenceRef.current += 1;
    const runId = `run-${sequenceRef.current}`;
    runIdRef.current = runId;
    initializedPidRef.current = pid;
    initializedScenarioRef.current = scenarioId;
    pendingStartRunIdRef.current = runId;
    setReady(false);
    setSamples([idleSample]);
    setResult(null);
    setError(null);
    initialize(runId);
  }, [idleSample, initialize, pid, ready, scenarioId, status]);

  const pause = useCallback(() => {
    post({ type: "pause", runId: runIdRef.current });
  }, [post]);

  const resume = useCallback(() => {
    post({ type: "start", runId: runIdRef.current });
  }, [post]);

  const reset = useCallback(() => {
    if (!workerRef.current) return;
    sequenceRef.current += 1;
    const runId = `run-${sequenceRef.current}`;
    runIdRef.current = runId;
    initializedPidRef.current = pid;
    initializedScenarioRef.current = scenarioId;
    pendingStartRunIdRef.current = null;
    setReady(false);
    setSamples([idleSample]);
    setResult(null);
    setError(null);
    initialize(runId);
  }, [idleSample, initialize, pid, scenarioId]);

  const setSpeed = useCallback((nextSpeed: number) => {
    const validSpeed = [0.5, 1, 2, 4].includes(nextSpeed) ? nextSpeed : 1;
    speedRef.current = validSpeed;
    setSpeedState(validSpeed);
    post({ type: "set-speed", runId: runIdRef.current, speed: validSpeed });
  }, [post]);

  const retryWorker = useCallback(() => {
    sequenceRef.current += 1;
    const runId = `run-${sequenceRef.current}`;
    runIdRef.current = runId;
    initializedPidRef.current = pid;
    initializedScenarioRef.current = scenarioId;
    initializedConfigRef.current = config;
    initialPidRef.current = pid;
    initialScenarioRef.current = scenarioId;
    initialConfigRef.current = config;
    pendingStartRunIdRef.current = null;
    failedRunIdRef.current = null;
    setReady(false);
    setStatus("idle");
    setSamples([idleSample]);
    setResult(null);
    setError(null);
    setWorkerGeneration((generation) => generation + 1);
  }, [config, idleSample, pid, scenarioId]);

  return useMemo(() => ({
    ready,
    status,
    samples,
    currentSample: samples.at(-1) ?? idleSample,
    result,
    error,
    speed,
    start,
    pause,
    resume,
    reset,
    retryWorker,
    setSpeed,
    dismissResult: () => setResult(null),
  }), [error, idleSample, pause, ready, reset, result, resume, retryWorker, samples, setSpeed, speed, start, status]);
}
