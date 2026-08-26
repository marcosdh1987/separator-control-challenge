"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { ProcessVisualization } from "./process-visualization";
import { SceneErrorBoundary } from "./scene/scene-error-boundary";
import type { ScenePresentationMode } from "./scene/scene-presentation";
import {
  getProcessViewSnapshot,
  getServerProcessViewSnapshot,
  hasStoredProcessView,
  setStoredProcessView,
  subscribeProcessView,
  type ProcessView,
} from "@/components/mimic/process-view-store";
import { SeparatorMimic } from "@/components/mimic/separator-mimic";
import type { SimulationSample, SimulationStatus } from "@/lib/simulation/types";
import { useMessages } from "@/lib/i18n/provider";
import { createProcessSummary } from "@/lib/visualization/scene-model";

const SeparatorScene = dynamic(
  () => import("./scene/separator-scene").then((module) => module.SeparatorScene),
  {
    ssr: false,
    loading: () => null,
  },
);

const MAX_SCENE_RETRIES = 2;
const SCENE_RETRY_DELAY_MS = 1500;

interface ProcessHeroProps {
  sample: SimulationSample;
  status: SimulationStatus;
  /** A non-interactive, static process presentation that never owns simulation state. */
  mode?: ScenePresentationMode;
}

function supportsWebGL(): boolean {
  let context: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  try {
    if (typeof WebGLRenderingContext === "undefined" && typeof WebGL2RenderingContext === "undefined") return false;
    const canvas = document.createElement("canvas");
    context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return Boolean(context);
  } catch {
    return false;
  } finally {
    if (context) {
      try {
        context.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        // Context release is a best-effort cleanup for the temporary capability probe.
      }
    }
  }
}

export function ProcessHero({ sample, status, mode = "dashboard" }: ProcessHeroProps) {
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [webglProbed, setWebglProbed] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const failedAtStatus = useRef<SimulationStatus | null>(null);
  const retriesRef = useRef(0);
  const messages = useMessages();
  const summary = createProcessSummary(
    sample,
    messages.challenge.processSummary,
    messages.simulation.safetyCondition[sample.safety.condition],
  );
  const fallback = <ProcessVisualization announceSafety={false} sample={sample} status={status} />;
  const preferredView = useSyncExternalStore(
    subscribeProcessView,
    getProcessViewSnapshot,
    getServerProcessViewSnapshot,
  );
  // The presentation hero is a static showcase, so it keeps the scene-only path.
  const switchable = mode === "dashboard";
  // On a device without WebGL the 3D view has nothing to show, so the diagram
  // becomes the default rather than something the visitor has to go and find. An
  // explicit choice still wins: someone who picked the scene keeps it, and sees the
  // semantic cutaway in its place.
  const sceneUnavailable = webglProbed && !webglAvailable;
  const chosenView = hasStoredProcessView();
  const view: ProcessView = !switchable
    ? "scene"
    : sceneUnavailable && preferredView === "scene" && !chosenView
      ? "diagram"
      : preferredView;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setWebglAvailable(supportsWebGL());
      setWebglProbed(true);
    });
    return () => { active = false; };
  }, []);

  const selectView = useCallback((next: ProcessView) => {
    setStoredProcessView(next);
    // Leaving the scene unmounts it, so the next return must earn its frame again
    // instead of showing an empty canvas while the renderer warms up.
    if (next === "diagram") setSceneReady(false);
  }, []);
  const markSceneReady = useCallback(() => {
    retriesRef.current = 0;
    setSceneReady(true);
  }, []);
  const markSceneError = useCallback(() => {
    failedAtStatus.current = status;
    setSceneReady(false);
    setSceneFailed(true);
  }, [status]);

  const remountScene = useCallback(() => {
    failedAtStatus.current = null;
    setSceneFailed(false);
    setSceneReady(false);
    setSceneKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!sceneFailed) return;
    if (failedAtStatus.current !== status) {
      remountScene();
      return;
    }
    // Without this timer a scene that failed while idle would stay on the fallback
    // until the next status change, which for a first-time visitor means until they
    // press Start. Retry a bounded number of times, then leave the fallback in place.
    if (retriesRef.current >= MAX_SCENE_RETRIES) return;
    const timer = window.setTimeout(() => {
      retriesRef.current += 1;
      remountScene();
    }, SCENE_RETRY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [remountScene, sceneFailed, status]);

  useEffect(() => {
    if (!sceneReady || sceneFailed) return;
    const canvas = sceneContainerRef.current?.querySelector("canvas");
    if (!canvas) return;
    const handleContextLoss = (event: Event) => {
      event.preventDefault();
      markSceneError();
    };
    canvas.addEventListener("webglcontextlost", handleContextLoss);
    return () => canvas.removeEventListener("webglcontextlost", handleContextLoss);
  }, [markSceneError, sceneFailed, sceneReady]);

  return (
    <div className={`process-hero ${mode === "presentation" ? "process-hero-presentation" : ""}`} data-presentation-mode={mode === "presentation" ? "true" : undefined}>
      <p
        aria-live="off"
        className="visually-hidden"
      >
        {summary}
      </p>
      {view === "diagram" ? <SeparatorMimic sample={sample} status={status} /> : null}
      {view === "scene" && (!webglAvailable || !sceneReady || sceneFailed) ? fallback : null}
      {view === "scene" && webglAvailable && !sceneFailed ? (
        <div ref={sceneContainerRef} className={sceneReady ? "scene-boundary is-ready" : "scene-boundary is-loading"} aria-hidden={sceneReady ? undefined : true}>
          <SceneErrorBoundary fallback={fallback} onError={markSceneError} resetKey={status}>
            <SeparatorScene key={sceneKey} mode={mode} onReady={markSceneReady} onSceneError={markSceneError} resetToken={resetToken} sample={sample} status={status} />
          </SceneErrorBoundary>
        </div>
      ) : null}
      {switchable ? (
        <div aria-label={messages.challenge.pid.viewSwitchLabel} className="process-view-switch" role="group">
          <button
            aria-label={messages.challenge.pid.view3dDescription}
            aria-pressed={view === "scene"}
            className="process-view-option"
            onClick={() => selectView("scene")}
            type="button"
          >
            {messages.challenge.pid.view3d}
          </button>
          <button
            aria-label={messages.challenge.pid.viewDiagramDescription}
            aria-pressed={view === "diagram"}
            className="process-view-option"
            onClick={() => selectView("diagram")}
            type="button"
          >
            {messages.challenge.pid.viewDiagram}
          </button>
        </div>
      ) : null}
      {switchable && view === "scene" && webglProbed && !webglAvailable ? (
        <p className="process-view-hint">{messages.challenge.pid.sceneUnavailable}</p>
      ) : null}
      {mode === "dashboard" && view === "scene" && sceneReady && !sceneFailed ? (
        <button
          aria-label={messages.challenge.mimic.resetView}
          className="scene-reset-button"
          onClick={() => setResetToken((token) => token + 1)}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 8v-4m0 0h4M4 4l3.2 3.2A7 7 0 1 1 5 14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
          {messages.challenge.mimic.resetView}
        </button>
      ) : null}
    </div>
  );
}
