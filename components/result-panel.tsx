"use client";

import { Award, RotateCcw, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef } from "react";

import { feedbackCopy, modifierLabel } from "@/lib/i18n/messages/en/simulation";
import { useMessages } from "@/lib/i18n/provider";
import { TRIP_CONDITIONS } from "@/lib/simulation/equilibrium";
import type { RunResult } from "@/lib/simulation/types";

interface ResultPanelProps {
  result: RunResult;
  onClose: () => void;
  onRetry: () => void;
}

export function ResultPanel({ result, onClose, onRetry }: ResultPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const messages = useMessages();
  const copy = messages.challenge.result;
  const { metrics, score } = result;
  const feedback = feedbackCopy(messages.simulation, score.feedback);
  const categories = [
    [copy.categories.safety, score.safety, 35],
    [copy.categories.tracking, score.tracking, 25],
    [copy.categories.stability, score.stability, 15],
    [copy.categories.recovery, score.recovery, 15],
    [copy.categories.valve, score.valveEfficiency, 10],
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
    <div ref={dialogRef} aria-label={copy.dialogLabel} aria-modal="true" className="result-scrim" role="dialog">
      <section className="result-panel">
        <button ref={closeRef} aria-label={copy.close} className="result-close" type="button" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
        <div className="result-hero">
          <div className="score-ring" style={{ "--score": `${score.total * 3.6}deg` } as React.CSSProperties}>
            <span>{copy.finalScore}</span>
            <strong>{score.total}</strong>
            <small>{copy.outOf}</small>
          </div>
          <div>
            <p className="eyebrow">{copy.complete}</p>
            <h2><Award aria-hidden="true" /> {messages.simulation.rank[score.rank]}</h2>
            <p>{feedback.diagnosis}</p>
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
          <article className="result-metric-group"><h3>{copy.totalLoopGroup}</h3>
            <div><span>{copy.mae}</span><strong>{metrics.loops.total.mae.toFixed(1)}%</strong></div>
            <div><span>{copy.stabilitySigma}</span><strong>{metrics.loops.total.stabilityStdDev.toFixed(1)}%</strong></div>
            <div><span>{copy.peakLow}</span><strong>{metrics.loops.total.maximumPct.toFixed(1)} / {metrics.loops.total.minimumPct.toFixed(1)}%</strong></div>
            <div><span>{copy.outsideTotalBand}</span><strong>{metrics.loops.total.targetBandTimeOutsideS.toFixed(1)} s</strong></div>
            <div><span>{copy.setpointCrossings}</span><strong>{metrics.loops.total.oscillationCrossings}</strong></div>
          </article>
          <article className="result-metric-group"><h3>{copy.interfaceLoopGroup}</h3>
            <div><span>{copy.mae}</span><strong>{metrics.loops.interface.mae.toFixed(1)}%</strong></div>
            <div><span>{copy.stabilitySigma}</span><strong>{metrics.loops.interface.stabilityStdDev.toFixed(1)}%</strong></div>
            <div><span>{copy.peakLow}</span><strong>{metrics.loops.interface.maximumPct.toFixed(1)} / {metrics.loops.interface.minimumPct.toFixed(1)}%</strong></div>
            <div><span>{copy.outsideInterfaceBand}</span><strong>{metrics.loops.interface.targetBandTimeOutsideS.toFixed(1)} s</strong></div>
            <div><span>{copy.setpointCrossings}</span><strong>{metrics.loops.interface.oscillationCrossings}</strong></div>
          </article>
          <article className="result-metric-group"><h3>{copy.oilValveGroup}</h3>
            <div><span>{copy.travel}</span><strong>{metrics.actuators.oil.travelPct.toFixed(1)}%</strong></div>
            <div><span>{copy.saturation}</span><strong>{metrics.actuators.oil.saturationTimeS.toFixed(1)} s</strong></div>
            <div><span>{copy.integralLimit}</span><strong>{metrics.actuators.oil.integralLimitTimeS.toFixed(1)} s</strong></div>
          </article>
          <article className="result-metric-group"><h3>{copy.waterValveGroup}</h3>
            <div><span>{copy.travel}</span><strong>{metrics.actuators.water.travelPct.toFixed(1)}%</strong></div>
            <div><span>{copy.saturation}</span><strong>{metrics.actuators.water.saturationTimeS.toFixed(1)} s</strong></div>
            <div><span>{copy.integralLimit}</span><strong>{metrics.actuators.water.integralLimitTimeS.toFixed(1)} s</strong></div>
          </article>
        </div>

        <div className="result-run-status">
          <div><span>{copy.tripOutcome}</span><strong>{metrics.trip ? messages.simulation.safetyCondition[TRIP_CONDITIONS[metrics.trip]] : copy.noTrip}</strong></div>
          <div><span>{copy.jointRecovery}</span><strong>{metrics.settled ? `${metrics.recoveryTimeS.toFixed(1)} s` : copy.notSettled}</strong></div>
          <div><span>{copy.minimumOilLayer}</span><strong>{metrics.minimumOilLayerPct.toFixed(1)}%</strong></div>
        </div>

        <div className="coaching-card">
          <ShieldCheck aria-hidden="true" />
          <div><strong>{copy.nextMove}</strong><p>{feedback.suggestion}</p></div>
        </div>

        <section className="modifier-section" aria-labelledby="modifier-heading">
          <h3 id="modifier-heading">{copy.modifiersHeading}</h3>
          {score.modifiers.length > 0 ? <ul className="modifier-list">
            {score.modifiers.map((modifier) => (
              <li key={modifier.id}>{modifierLabel(messages.simulation, modifier)} <strong>{modifier.points}</strong></li>
            ))}
          </ul> : <p>{copy.noModifiers}</p>}
        </section>

        <div className="result-actions">
          <button className="primary-button" type="button" onClick={onRetry}>
            <RotateCcw aria-hidden="true" /> {copy.retry}
          </button>
          <button className="secondary-button" type="button" onClick={onClose}>{copy.reviewTrends}</button>
        </div>
      </section>
    </div>
  );
}
