"use client";

import { Award, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";

import type { RunResult } from "@/lib/simulation/types";

const TRIP_LABELS = {
  TOTAL_LL: "Total level low-low trip",
  TOTAL_HH: "Total level high-high trip",
  INTERFACE_LL: "Interface low-low trip",
  INTERFACE_HH: "Interface high-high trip",
  OIL_LAYER_LL: "Oil-layer low-low trip",
} as const;

interface ResultPanelProps {
  result: RunResult;
  onClose: () => void;
  onRetry: () => void;
}

export function ResultPanel({ result, onClose, onRetry }: ResultPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { metrics, score } = result;
  const categories = [
    ["Safety", score.safety, 35],
    ["Tracking", score.tracking, 25],
    ["Stability", score.stability, 15],
    ["Recovery", score.recovery, 15],
    ["Valve care", score.valveEfficiency, 10],
  ] as const;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const siblings = dialog.parentElement
      ? Array.from(dialog.parentElement.children).filter((element) => element !== dialog)
      : [];
    const previousStates = siblings.map((element) => ({
      element: element as HTMLElement,
      inert: (element as HTMLElement).inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    for (const { element } of previousStates) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button:not([disabled])"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      for (const state of previousStates) {
        state.element.inert = state.inert;
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
        else state.element.setAttribute("aria-hidden", state.ariaHidden);
      }
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return (
    <div ref={dialogRef} aria-label="Attempt results" aria-modal="true" className="result-scrim" role="dialog">
      <section className="result-panel">
        <button ref={closeRef} aria-label="Close results" className="result-close" type="button" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
        <div className="result-hero">
          <div className="score-ring" style={{ "--score": `${score.total * 3.6}deg` } as React.CSSProperties}>
            <span>FINAL SCORE</span>
            <strong>{score.total}</strong>
            <small>/ 100</small>
          </div>
          <div>
            <p className="eyebrow">Attempt complete</p>
            <h2><Award aria-hidden="true" /> {score.rank}</h2>
            <p>{score.diagnosis}</p>
          </div>
        </div>

        <div className="score-breakdown">
          {categories.map(([label, value, maximum]) => (
            <div className="score-row" key={label}>
              <span>{label}</span>
              <div><i style={{ width: `${value / maximum * 100}%` }} /></div>
              <strong>{value.toFixed(1)} / {maximum}</strong>
            </div>
          ))}
        </div>

        <div className="result-metrics">
          <article className="result-metric-group"><h3>Total level loop</h3>
            <div><span>MAE</span><strong>{metrics.loops.total.mae.toFixed(1)}%</strong></div>
            <div><span>Stability σ</span><strong>{metrics.loops.total.stabilityStdDev.toFixed(1)}%</strong></div>
            <div><span>Peak / low</span><strong>{metrics.loops.total.maximumPct.toFixed(1)} / {metrics.loops.total.minimumPct.toFixed(1)}%</strong></div>
            <div><span>Outside ±5%</span><strong>{metrics.loops.total.targetBandTimeOutsideS.toFixed(1)} s</strong></div>
            <div><span>SP crossings</span><strong>{metrics.loops.total.oscillationCrossings}</strong></div>
          </article>
          <article className="result-metric-group"><h3>Oil/water interface loop</h3>
            <div><span>MAE</span><strong>{metrics.loops.interface.mae.toFixed(1)}%</strong></div>
            <div><span>Stability σ</span><strong>{metrics.loops.interface.stabilityStdDev.toFixed(1)}%</strong></div>
            <div><span>Peak / low</span><strong>{metrics.loops.interface.maximumPct.toFixed(1)} / {metrics.loops.interface.minimumPct.toFixed(1)}%</strong></div>
            <div><span>Outside ±3%</span><strong>{metrics.loops.interface.targetBandTimeOutsideS.toFixed(1)} s</strong></div>
            <div><span>SP crossings</span><strong>{metrics.loops.interface.oscillationCrossings}</strong></div>
          </article>
          <article className="result-metric-group"><h3>Oil valve LV-101</h3>
            <div><span>Travel</span><strong>{metrics.actuators.oil.travelPct.toFixed(1)}%</strong></div>
            <div><span>Saturation</span><strong>{metrics.actuators.oil.saturationTimeS.toFixed(1)} s</strong></div>
            <div><span>Integral limit</span><strong>{metrics.actuators.oil.integralLimitTimeS.toFixed(1)} s</strong></div>
          </article>
          <article className="result-metric-group"><h3>Water valve WV-101</h3>
            <div><span>Travel</span><strong>{metrics.actuators.water.travelPct.toFixed(1)}%</strong></div>
            <div><span>Saturation</span><strong>{metrics.actuators.water.saturationTimeS.toFixed(1)} s</strong></div>
            <div><span>Integral limit</span><strong>{metrics.actuators.water.integralLimitTimeS.toFixed(1)} s</strong></div>
          </article>
        </div>

        <div className="result-run-status">
          <div><span>Trip outcome</span><strong>{metrics.trip ? TRIP_LABELS[metrics.trip] : "No trip"}</strong></div>
          <div><span>Joint recovery</span><strong>{metrics.settled ? `${metrics.recoveryTimeS.toFixed(1)} s` : "Not settled"}</strong></div>
          <div><span>Minimum oil layer</span><strong>{metrics.minimumOilLayerPct.toFixed(1)}%</strong></div>
        </div>

        <div className="coaching-card">
          <ShieldCheck aria-hidden="true" />
          <div><strong>Next tuning move</strong><p>{score.suggestion}</p></div>
        </div>

        <section className="modifier-section" aria-labelledby="modifier-heading">
          <h3 id="modifier-heading">Applied modifiers</h3>
          {score.modifiers.length > 0 ? <ul className="modifier-list">
            {score.modifiers.map((modifier) => (
              <li key={modifier.id}>{modifier.label} <strong>{modifier.points}</strong></li>
            ))}
          </ul> : <p>No modifiers applied</p>}
        </section>

        <div className="result-actions">
          <button className="primary-button" type="button" onClick={onRetry}>
            <RotateCcw aria-hidden="true" /> Tune and retry
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>Review trends</button>
        </div>
      </section>
    </div>
  );
}
