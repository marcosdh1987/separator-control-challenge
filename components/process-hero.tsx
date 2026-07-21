"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProcessVisualization } from "./process-visualization";
import { SceneErrorBoundary } from "./scene/scene-error-boundary";
import type { ScenePresentationMode } from "./scene/scene-presentation";
import type { SimulationSample, SimulationStatus } from "@/lib/simulation/types";
import { createProcessSummary } from "@/lib/visualization/scene-model";

const SeparatorScene = dynamic(
  () => import("./scene/separator-scene").then((module) => module.SeparatorScene),
  {
    ssr: false,
    loading: () => null,
  },
);

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
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneFailed, setSceneFailed] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const sceneContainerRef = useRef<HTMLDivElement>(null);
  const failedAtStatus = useRef<SimulationStatus | null>(null);
  const summary = createProcessSummary(sample);
  const fallback = <ProcessVisualization announceSafety={false} sample={sample} status={status} />;

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setWebglAvailable(supportsWebGL());
    });
    return () => { active = false; };
  }, []);
  const markSceneReady = useCallback(() => setSceneReady(true), []);
  const markSceneError = useCallback(() => {
    failedAtStatus.current = status;
    setSceneReady(false);
    setSceneFailed(true);
  }, [status]);

  useEffect(() => {
    if (sceneFailed && failedAtStatus.current !== status) {
      failedAtStatus.current = null;
      setSceneFailed(false);
      setSceneReady(false);
      setSceneKey((key) => key + 1);
    }
  }, [sceneFailed, status]);

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
      {!webglAvailable || !sceneReady || sceneFailed ? fallback : null}
      {webglAvailable && !sceneFailed ? (
        <div ref={sceneContainerRef} className={sceneReady ? "scene-boundary is-ready" : "scene-boundary is-loading"} aria-hidden={sceneReady ? undefined : true}>
          <SceneErrorBoundary fallback={fallback} onError={markSceneError} resetKey={status}>
            <SeparatorScene key={sceneKey} mode={mode} onReady={markSceneReady} onSceneError={markSceneError} resetToken={resetToken} sample={sample} status={status} />
          </SceneErrorBoundary>
        </div>
      ) : null}
      {mode === "dashboard" && sceneReady && !sceneFailed ? (
        <button
          aria-label="Reset 3D view"
          className="scene-reset-button"
          onClick={() => setResetToken((token) => token + 1)}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M4 8v-4m0 0h4M4 4l3.2 3.2A7 7 0 1 1 5 14" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
          </svg>
          Reset 3D view
        </button>
      ) : null}
    </div>
  );
}
