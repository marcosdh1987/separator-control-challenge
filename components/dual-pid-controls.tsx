"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { PidControls } from "./pid-controls";
import type { DualPidConfig, LoopId, SimulationSample, SimulationStatus } from "@/lib/simulation/types";

interface DualPidControlsProps {
  hero: ReactNode;
  config: DualPidConfig;
  sample: SimulationSample;
  locked: boolean;
  ready: boolean;
  status: SimulationStatus;
  speed: number;
  onChange: (config: DualPidConfig) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

export function DualPidControls({
  hero, config, sample, locked, ready, status, speed, onChange,
  onStart, onPause, onResume, onReset, onSpeedChange,
}: DualPidControlsProps) {
  const updateLoop = (loop: LoopId, next: DualPidConfig[LoopId]) => {
    onChange({ ...config, [loop]: next });
  };

  return (
    <section aria-label="Separator control deck" className="control-deck">
      <div className="transport-bar" aria-label="Attempt transport controls">
        <div className="run-controls">
          {(status === "idle" || status === "completed" || status === "tripped") && (
            <button className="primary-button" disabled={!ready} type="button" onClick={onStart}>
              <Play aria-hidden="true" /> Start attempt
            </button>
          )}
          {status === "running" && (
            <button className="secondary-button" type="button" onClick={onPause}>
              <Pause aria-hidden="true" /> Pause attempt
            </button>
          )}
          {status === "paused" && (
            <button className="primary-button" type="button" onClick={onResume}>
              <Play aria-hidden="true" /> Resume attempt
            </button>
          )}
          <button aria-label="Reset attempt" className="icon-button" type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" /> Reset
          </button>
        </div>
        <fieldset className="speed-control">
          <legend>Playback speed</legend>
          {[0.5, 1, 2, 4].map((option) => (
            <button
              aria-label={`${option}× speed`}
              aria-pressed={speed === option}
              className={speed === option ? "is-active" : ""}
              key={option}
              type="button"
              onClick={() => onSpeedChange(option)}
            >
              {option}×
            </button>
          ))}
        </fieldset>
      </div>

      <div className="process-bay">
        <div className="process-bay__hero">{hero}</div>
        <PidControls accent="oil" config={config.total} locked={locked} loopId="total" sample={sample.total} tag="LIC-101" title="Total level / oil valve" onChange={(next) => updateLoop("total", next)} />
        <PidControls accent="water" config={config.interface} locked={locked} loopId="interface" sample={sample.interface} tag="IIC-101" title="Interface / water valve" onChange={(next) => updateLoop("interface", next)} />
      </div>
    </section>
  );
}
