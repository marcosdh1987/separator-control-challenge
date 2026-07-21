"use client";

import { Gauge, LockKeyhole, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";

import type { LoopId, LoopSample, PidConfig } from "@/lib/simulation/types";
import { sanitizePidConfig } from "@/lib/simulation/validation";
import { PidHelp } from "./education/pid-help";

export interface PidControlsProps {
  loopId: LoopId;
  title: string;
  tag: string;
  accent: "oil" | "water";
  config: PidConfig;
  sample: LoopSample;
  locked: boolean;
  onChange: (config: PidConfig) => void;
}

const LOOP_NAMES: Record<LoopId, string> = {
  total: "Total level",
  interface: "Interface",
};

const GAIN_FIELDS = [
  { key: "kp", name: "proportional", symbol: "Kp", unit: "dimensionless", max: 10, step: 0.1, purpose: "Response strength" },
  { key: "ki", name: "integral", symbol: "Ki", unit: "s⁻¹", max: 0.3, step: 0.01, purpose: "Offset removal" },
  { key: "kd", name: "derivative", symbol: "Kd", unit: "s", max: 30, step: 0.5, purpose: "Damping and anticipation" },
] as const;

function finiteNumber(raw: string, fallback = 0): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

interface GainNumberProps {
  describedBy: string;
  disabled: boolean;
  id: string;
  maximum: number;
  step: number;
  value: number;
  onValue: (raw: string) => void;
}

function GainNumber({ describedBy, disabled, id, maximum, step, value, onValue }: GainNumberProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));
  return (
    <input
      aria-describedby={describedBy}
      className="gain-number"
      disabled={disabled}
      id={id}
      max={maximum}
      min={0}
      step={step}
      type="number"
      value={focused ? draft : String(value)}
      onBlur={() => {
        setFocused(false);
        setDraft(String(value));
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        onValue(event.target.value);
      }}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
    />
  );
}

export function PidControls({
  loopId,
  title,
  tag,
  accent,
  config,
  sample,
  locked,
  onChange,
}: PidControlsProps) {
  const loopName = LOOP_NAMES[loopId];
  const phaseName = accent === "oil" ? "Oil" : "Water";
  const instanceId = useId().replaceAll(":", "");
  const headingId = `${instanceId}-${loopId}-controller-heading`;
  const update = (key: keyof PidConfig, raw: string) => {
    if (raw.trim() === "") return;
    onChange(sanitizePidConfig({ ...config, [key]: finiteNumber(raw) }));
  };

  return (
    <section
      aria-labelledby={headingId}
      className={`instrument-dock instrument-dock--${accent}`}
      data-tour={loopId === "total" ? "total-pid" : "interface-pid"}
    >
      <header className="instrument-header">
        <div>
          <span className="instrument-tag">{tag}</span>
          <h2 id={headingId}><Gauge aria-hidden="true" /> {title}</h2>
        </div>
        <span className={`lock-state ${locked ? "is-locked" : ""}`}>
          {locked ? <LockKeyhole aria-hidden="true" /> : null}
          {locked ? "Locked for this attempt" : "Ready to tune"}
        </span>
      </header>
      <p className="pid-causal-label">{loopId === "total" ? "More valve opening → more oil out → lower total level" : "More valve opening → more water out → lower interface"}</p>

      <dl className="loop-readout" aria-label={`${loopName} live values`}>
        <div><dt>{loopName} process value</dt><dd>{sample.processValuePct.toFixed(1)}%</dd></div>
        <div><dt>{loopName} measured value</dt><dd>{sample.measuredValuePct.toFixed(1)}%</dd></div>
        <div><dt>{loopName} setpoint</dt><dd>{sample.setpointPct.toFixed(1)}%</dd></div>
        <div><dt>{phaseName} valve command</dt><dd>{sample.valveCommandPct.toFixed(1)}%</dd></div>
        <div><dt>{phaseName} valve actual position</dt><dd>{sample.valvePositionPct.toFixed(1)}%</dd></div>
        <div className="pid-term-readout">
          <dt>P / I / D</dt>
          <dd>{sample.proportionalTerm.toFixed(1)} / {sample.integralTerm.toFixed(1)} / {sample.derivativeTerm.toFixed(1)}</dd>
        </div>
      </dl>

      <fieldset className="gain-stack">
        <legend>{loopName} primary gains</legend>
        {GAIN_FIELDS.map((field) => {
          const numberId = `${instanceId}-${loopId}-${field.key}`;
          const sliderId = `${instanceId}-${loopId}-${field.key}-slider`;
          const helpId = `${numberId}-help`;
          const label = `${loopName} ${field.name} gain`;
          return (
            <div className="gain-control" key={field.key}>
              <div className="gain-label">
                <label htmlFor={numberId}>{label}</label>
                <div><PidHelp gain={field.key} /><output htmlFor={numberId}>{config[field.key].toFixed(field.step < 0.1 ? 2 : 1)}</output></div>
              </div>
              <div className="gain-entry">
                <GainNumber
                  describedBy={helpId}
                  disabled={locked}
                  id={numberId}
                  maximum={field.max}
                  step={field.step}
                  value={config[field.key]}
                  onValue={(raw) => update(field.key, raw)}
                />
                <span aria-hidden="true" className="gain-unit">{field.symbol} · {field.unit}</span>
              </div>
              <label className="sr-only" htmlFor={sliderId}>{label} slider</label>
              <input
                aria-describedby={helpId}
                className="gain-slider"
                disabled={locked}
                id={sliderId}
                max={field.max}
                min={0}
                step={field.step}
                type="range"
                value={config[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
              />
              <p className="gain-hint" id={helpId}>{field.purpose}. Range 0–{field.max} {field.unit}.</p>
            </div>
          );
        })}
      </fieldset>

      <details className="advanced-controls">
        <summary><SlidersHorizontal aria-hidden="true" /> Advanced settings</summary>
        <fieldset className="advanced-grid">
          <legend>{loopName} advanced settings</legend>
          <label htmlFor={`${instanceId}-${loopId}-sample-time`}>{loopName} sample time <span>s</span></label>
          <input aria-label={`${loopName} sample time`} disabled={locked} id={`${instanceId}-${loopId}-sample-time`} max={1} min={0.1} step={0.1} type="number" value={config.sampleTimeS} onChange={(event) => update("sampleTimeS", event.target.value)} />
          <label htmlFor={`${instanceId}-${loopId}-integral-limit`}>{loopName} integral limit <span>% output</span></label>
          <input aria-label={`${loopName} integral limit`} disabled={locked} id={`${instanceId}-${loopId}-integral-limit`} max={40} min={0} step={1} type="number" value={config.integralLimit} onChange={(event) => update("integralLimit", event.target.value)} />
          <label htmlFor={`${instanceId}-${loopId}-derivative-filter`}>{loopName} derivative filter <span>s</span></label>
          <input aria-label={`${loopName} derivative filter`} disabled={locked} id={`${instanceId}-${loopId}-derivative-filter`} max={5} min={0} step={0.1} type="number" value={config.derivativeFilterTauS} onChange={(event) => update("derivativeFilterTauS", event.target.value)} />
        </fieldset>
      </details>
    </section>
  );
}
