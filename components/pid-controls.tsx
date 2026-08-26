"use client";

import { Gauge, LockKeyhole, SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";

import { formatStandardValue, toStandardForm, type GainForm } from "@/lib/education/gain-forms";
import { useMessages } from "@/lib/i18n/provider";
import type { LoopId, LoopSample, PidConfig } from "@/lib/simulation/types";
import { sanitizePidConfig } from "@/lib/simulation/validation";
import { PidHelp } from "./education/pid-help";

export interface PidControlsProps {
  loopId: LoopId;
  tag: string;
  accent: "oil" | "water" | "gas";
  config: PidConfig;
  sample: LoopSample;
  locked: boolean;
  /** Gains held fixed for this exercise, on top of the run-wide lock. */
  lockedGains?: readonly ("kp" | "ki" | "kd")[];
  /** Which notation to show the gains in. The engine always runs the parallel form. */
  gainForm?: GainForm;
  onChange: (config: PidConfig) => void;
}

/** Numeric ranges and symbols are the same in every language; only the names differ. */
const GAIN_FIELDS = [
  { key: "kp", copyKey: "proportional", symbol: "Kp", max: 10, step: 0.1 },
  { key: "ki", copyKey: "integral", symbol: "Ki", max: 0.3, step: 0.01 },
  { key: "kd", copyKey: "derivative", symbol: "Kd", max: 30, step: 0.5 },
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
  tag,
  accent,
  config,
  sample,
  locked,
  lockedGains,
  gainForm = "parallel",
  onChange,
}: PidControlsProps) {
  const messages = useMessages();
  const copy = messages.challenge.controller;
  const loopName = messages.simulation.loop[loopId];
  const phaseName = messages.simulation.phase[accent === "gas" ? "oil" : accent];
  const title = loopId === "total"
    ? copy.totalTitle
    : loopId === "interface"
      ? copy.interfaceTitle
      : messages.challenge.transport.pressureTitle;
  // Level loops read in percent of vessel height; the pressure loop reads in
  // bar gauge, which is what the field gauge shows.
  const readoutUnit = loopId === "pressure" ? " barg" : "%";
  const readoutDecimals = loopId === "pressure" ? 2 : 1;
  const standard = toStandardForm(config);
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
      data-tour={loopId === "total" ? "total-pid" : loopId === "interface" ? "interface-pid" : "pressure-pid"}
    >
      <header className="instrument-header">
        <div>
          <span className="instrument-tag">{tag}</span>
          <h2 id={headingId}><Gauge aria-hidden="true" /> {title}</h2>
        </div>
        <span className={`lock-state ${locked ? "is-locked" : ""}`}>
          {locked ? <LockKeyhole aria-hidden="true" /> : null}
          {locked ? copy.locked : copy.ready}
        </span>
      </header>
      <p className="pid-causal-label">{copy.causal[loopId]}</p>

      {/* A definition list maps to `list`, not `group`; the explicit role keeps these
          labelled readouts addressable as one named unit. */}
      <dl className="loop-readout" aria-label={copy.liveValues(loopName)} role="group">
        <div><dt>{copy.processValue(loopName)}</dt><dd>{sample.processValuePct.toFixed(readoutDecimals)}{readoutUnit}</dd></div>
        <div><dt>{copy.measuredValue(loopName)}</dt><dd>{sample.measuredValuePct.toFixed(readoutDecimals)}{readoutUnit}</dd></div>
        <div><dt>{copy.setpoint(loopName)}</dt><dd>{sample.setpointPct.toFixed(readoutDecimals)}{readoutUnit}</dd></div>
        <div><dt>{copy.valveCommand(phaseName)}</dt><dd>{sample.valveCommandPct.toFixed(1)}%</dd></div>
        <div><dt>{copy.valvePosition(phaseName)}</dt><dd>{sample.valvePositionPct.toFixed(1)}%</dd></div>
        <div className="pid-term-readout">
          <dt>{copy.termReadout}</dt>
          <dd>{sample.proportionalTerm.toFixed(1)} / {sample.integralTerm.toFixed(1)} / {sample.derivativeTerm.toFixed(1)}</dd>
        </div>
      </dl>

      <fieldset className="gain-stack">
        <legend>{copy.gainsLegend(loopName)}</legend>
        {gainForm === "standard" ? (
          // The same controller, read the way a field panel presents it. Editing
          // still happens in the parallel form below, so one notation stays the
          // source of truth and the two can never disagree.
          <dl className="standard-form-readout" aria-label={copy.gainFormStandard} role="group">
            <div>
              <dt>{copy.standardBand(loopName)}</dt>
              <dd>{formatStandardValue(standard.proportionalBandPct)} {copy.unitPercentBand}</dd>
            </div>
            <div>
              <dt>{copy.standardIntegralTime(loopName)}</dt>
              <dd>{formatStandardValue(standard.integralTimeS)} {copy.unitSecondsPerRepeat}</dd>
            </div>
            <div>
              <dt>{copy.standardDerivativeTime(loopName)}</dt>
              <dd>{formatStandardValue(standard.derivativeTimeS)} {copy.unitSeconds}</dd>
            </div>
          </dl>
        ) : null}
        {GAIN_FIELDS.map((field) => {
          const numberId = `${instanceId}-${loopId}-${field.key}`;
          const sliderId = `${instanceId}-${loopId}-${field.key}-slider`;
          const helpId = `${numberId}-help`;
          const label = copy.gainLabel(loopName, copy.gain[field.copyKey]);
          const unit = copy.gainUnit[field.copyKey];
          const fieldLocked = locked || (lockedGains?.includes(field.key) ?? false);
          return (
            <div className="gain-control" key={field.key}>
              <div className="gain-label">
                <label htmlFor={numberId}>{label}</label>
                <div><PidHelp gain={field.key} /><output htmlFor={numberId}>{config[field.key].toFixed(field.step < 0.1 ? 2 : 1)}</output></div>
              </div>
              <div className="gain-entry">
                <GainNumber
                  describedBy={helpId}
                  disabled={fieldLocked}
                  id={numberId}
                  maximum={field.max}
                  step={field.step}
                  value={config[field.key]}
                  onValue={(raw) => update(field.key, raw)}
                />
                <span aria-hidden="true" className="gain-unit">{field.symbol} · {unit}</span>
              </div>
              <label className="sr-only" htmlFor={sliderId}>{copy.gainSlider(label)}</label>
              <input
                aria-describedby={helpId}
                className="gain-slider"
                disabled={fieldLocked}
                id={sliderId}
                max={field.max}
                min={0}
                step={field.step}
                type="range"
                value={config[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
              />
              <p className="gain-hint" id={helpId}>{copy.gainHint(copy.gainPurpose[field.copyKey], field.max, unit)}</p>
            </div>
          );
        })}
      </fieldset>

      <details className="advanced-controls">
        <summary><SlidersHorizontal aria-hidden="true" /> {copy.advancedSummary}</summary>
        <fieldset className="advanced-grid">
          <legend>{copy.advancedLegend(loopName)}</legend>
          <label htmlFor={`${instanceId}-${loopId}-sample-time`}>{copy.sampleTime(loopName)} <span>{copy.unitSeconds}</span></label>
          <input aria-label={copy.sampleTime(loopName)} disabled={locked} id={`${instanceId}-${loopId}-sample-time`} max={1} min={0.1} step={0.1} type="number" value={config.sampleTimeS} onChange={(event) => update("sampleTimeS", event.target.value)} />
          <label htmlFor={`${instanceId}-${loopId}-integral-limit`}>{copy.integralLimit(loopName)} <span>{copy.unitPercentOutput}</span></label>
          <input aria-label={copy.integralLimit(loopName)} disabled={locked} id={`${instanceId}-${loopId}-integral-limit`} max={40} min={0} step={1} type="number" value={config.integralLimit} onChange={(event) => update("integralLimit", event.target.value)} />
          <label htmlFor={`${instanceId}-${loopId}-derivative-filter`}>{copy.derivativeFilter(loopName)} <span>{copy.unitSeconds}</span></label>
          <input aria-label={copy.derivativeFilter(loopName)} disabled={locked} id={`${instanceId}-${loopId}-derivative-filter`} max={5} min={0} step={0.1} type="number" value={config.derivativeFilterTauS} onChange={(event) => update("derivativeFilterTauS", event.target.value)} />
        </fieldset>
      </details>
    </section>
  );
}
