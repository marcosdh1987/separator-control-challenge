"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";

import { PidControls } from "./pid-controls";
import { PidPresetSelector } from "./pid-preset-selector";
import type { GainForm } from "@/lib/education/gain-forms";
import { useMessages } from "@/lib/i18n/provider";
import type { DualPidConfig, LiquidLoopId, PidConfig, SimulationSample, SimulationStatus } from "@/lib/simulation/types";

interface DualPidControlsProps {
  hero: ReactNode;
  wellOpen: boolean;
  onWellChange: (open: boolean) => void;
  /** Gains a lesson holds fixed so attention stays on the one it is teaching. */
  lockedGains?: readonly ("kp" | "ki" | "kd")[];
  gainForm?: GainForm;
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
  hero, config, sample, locked, lockedGains, gainForm, ready, status, speed, wellOpen, onWellChange, onChange,
  onStart, onPause, onResume, onReset, onSpeedChange,
}: DualPidControlsProps) {
  const copy = useMessages().challenge.transport;
  const updateLoop = (loop: LiquidLoopId, next: PidConfig) => {
    onChange({ ...config, [loop]: next });
  };

  return (
    <section aria-label={copy.deckLabel} className="control-deck">
      <div className="transport-bar" aria-label={copy.transportLabel}>
        <div className="run-controls">
          {(status === "idle" || status === "completed" || status === "tripped") && (
            <button className="primary-button" data-tour="start-attempt" disabled={!ready} type="button" onClick={onStart}>
              <Play aria-hidden="true" /> {copy.start}
            </button>
          )}
          {status === "running" && (
            <button className="secondary-button" type="button" onClick={onPause}>
              <Pause aria-hidden="true" /> {copy.pause}
            </button>
          )}
          {status === "paused" && (
            <button className="primary-button" type="button" onClick={onResume}>
              <Play aria-hidden="true" /> {copy.resume}
            </button>
          )}
          <button aria-label={copy.reset} className="icon-button" type="button" onClick={onReset}>
            <RotateCcw aria-hidden="true" /> {copy.reset}
          </button>
        </div>
        <fieldset className="well-control" data-tour="well-control">
          <legend>{copy.wellLegend}</legend>
          {/* Only meaningful while the physics is live: an idle run has no well yet. */}
          <button
            aria-pressed={wellOpen}
            className={wellOpen ? "is-active" : ""}
            disabled={status !== "running" && status !== "paused"}
            type="button"
            onClick={() => onWellChange(true)}
          >
            {copy.openWell}
          </button>
          <button
            aria-pressed={!wellOpen}
            className={!wellOpen ? "is-active" : ""}
            disabled={status !== "running" && status !== "paused"}
            type="button"
            onClick={() => onWellChange(false)}
          >
            {copy.shutWell}
          </button>
        </fieldset>
        <fieldset className="speed-control">
          <legend>{copy.speedLegend}</legend>
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

      <div className="tuning-guidance" data-tour="manual-pid-tuning">
        <PidPresetSelector disabled={locked} onChange={onChange} />
        <p>{copy.configureHint}</p>
      </div>

      <div className="process-bay">
        <div className="process-bay__hero" data-tour="process-view">{hero}</div>
        <PidControls accent="oil" config={config.total} locked={locked} gainForm={gainForm} lockedGains={lockedGains} loopId="total" sample={sample.total} tag="LIC-101" onChange={(next) => updateLoop("total", next)} />
        <PidControls accent="water" config={config.interface} locked={locked} gainForm={gainForm} lockedGains={lockedGains} loopId="interface" sample={sample.interface} tag="IIC-101" onChange={(next) => updateLoop("interface", next)} />
        {config.pressure && sample.pressure ? (
          <PidControls
            accent="gas"
            config={config.pressure}
            locked={locked}
            gainForm={gainForm}
            lockedGains={lockedGains}
            loopId="pressure"
            sample={sample.pressure}
            tag="PIC-101"
            onChange={(next) => onChange({ ...config, pressure: next })}
          />
        ) : null}
      </div>
    </section>
  );
}
