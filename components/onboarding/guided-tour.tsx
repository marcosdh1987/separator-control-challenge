"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const TOUR_STEPS = [
  "scenario-selector",
  "total-pid",
  "interface-pid",
  "start-attempt",
  "process-view",
  "live-trends",
  "score-safety",
] as const;

type TourTarget = (typeof TOUR_STEPS)[number];

interface TourStep {
  target: TourTarget;
  title: string;
  description: string;
}

const STEP_DETAILS: Record<TourTarget, TourStep> = {
  "scenario-selector": {
    target: "scenario-selector",
    title: "Scenario selector",
    description: "Choose a disturbance. The oil/water feed step is a good first scored challenge.",
  },
  "total-pid": {
    target: "total-pid",
    title: "Total-level PID",
    description: "This controller moves the oil valve. More opening sends more oil out and lowers total level.",
  },
  "interface-pid": {
    target: "interface-pid",
    title: "Interface PID",
    description: "This controller moves the water valve. More opening sends more water out and lowers the interface.",
  },
  "start-attempt": {
    target: "start-attempt",
    title: "Start attempt",
    description: "Start only when your tuning is ready. PID gains lock for the duration of an attempt.",
  },
  "process-view": {
    target: "process-view",
    title: "Process view",
    description: "Watch total level, the oil/water interface, valve positions, and the safety envelope together.",
  },
  "live-trends": {
    target: "live-trends",
    title: "Live trends",
    description: "Use the trends to distinguish a fast recovery from oscillation, saturation, or drift.",
  },
  "score-safety": {
    target: "score-safety",
    title: "Score and safety",
    description: "Safety comes first. Your deterministic score is final only when the attempt ends.",
  },
};

interface GuidedTourProps {
  active: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const FOCUSABLE_SELECTOR = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

function findTarget(target: TourTarget): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
}

export function GuidedTour({ active, onComplete, onSkip }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const findAvailableIndex = useCallback((from: number, direction: 1 | -1): number | null => {
    for (let index = from; index >= 0 && index < TOUR_STEPS.length; index += direction) {
      if (findTarget(TOUR_STEPS[index])) return index;
    }
    return null;
  }, []);

  const updateSpotlight = useCallback(() => {
    const targetIndex = findAvailableIndex(stepIndex, 1) ?? findAvailableIndex(stepIndex, -1);
    const target = targetIndex === null ? null : findTarget(TOUR_STEPS[targetIndex]);
    if (!target) {
      setSpotlight(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setSpotlight({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [findAvailableIndex, stepIndex]);

  const move = useCallback((direction: 1 | -1) => {
    const next = findAvailableIndex(stepIndex + direction, direction);
    if (next !== null) setStepIndex(next);
  }, [findAvailableIndex, stepIndex]);

  useEffect(() => {
    if (!active) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const available = findAvailableIndex(stepIndex, 1) ?? findAvailableIndex(stepIndex, -1);
      if (available === null) onSkip();
      else if (available !== stepIndex) setStepIndex(available);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [active, findAvailableIndex, onSkip, stepIndex]);

  useEffect(() => {
    if (!active) return;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backgroundSiblings = scrimRef.current?.parentElement
      ? Array.from(scrimRef.current.parentElement.children).filter((element) => element !== scrimRef.current)
      : [];
    const previousBackgroundStates = backgroundSiblings.map((element) => ({
      element: element as HTMLElement,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: (element as HTMLElement).inert,
    }));
    for (const { element } of previousBackgroundStates) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkip();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      for (const state of previousBackgroundStates) {
        state.element.inert = state.inert;
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
        else state.element.setAttribute("aria-hidden", state.ariaHidden);
      }
      if (openerRef.current?.isConnected) openerRef.current.focus();
    };
  }, [active, move, onSkip]);

  useEffect(() => {
    if (!active) return;
    const animationFrame = window.requestAnimationFrame(updateSpotlight);
    window.addEventListener("resize", updateSpotlight);
    window.addEventListener("scroll", updateSpotlight, true);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateSpotlight);
      window.removeEventListener("scroll", updateSpotlight, true);
    };
  }, [active, updateSpotlight]);

  if (!active) return null;
  const step = STEP_DETAILS[TOUR_STEPS[stepIndex]];
  const previousIndex = stepIndex > 0 ? stepIndex - 1 : null;
  const nextIndex = stepIndex < TOUR_STEPS.length - 1 ? stepIndex + 1 : null;

  return (
    <div className="guided-tour-scrim" ref={scrimRef}>
      {spotlight ? <div aria-hidden="true" className="guided-tour-spotlight" style={spotlight} /> : null}
      <div
        aria-describedby="guided-tour-description guided-tour-progress"
        aria-labelledby="guided-tour-title"
        aria-modal="true"
        className="guided-tour-dialog"
        ref={dialogRef}
        role="dialog"
      >
        <p className="eyebrow">Control-room guide</p>
        <p className="sr-only" id="guided-tour-progress">Step {stepIndex + 1} of {TOUR_STEPS.length}</p>
        <h2 id="guided-tour-title">{step.title}</h2>
        <p id="guided-tour-description">{step.description}</p>
        <div className="guided-tour-actions">
          <button className="secondary-button" type="button" onClick={onSkip}>Skip</button>
          <span aria-hidden="true">{stepIndex + 1} / {TOUR_STEPS.length}</span>
          <div>
            <button className="secondary-button" disabled={previousIndex === null} type="button" onClick={() => move(-1)}>Back</button>
            {nextIndex === null
              ? <button className="primary-button" type="button" onClick={onComplete}>Finish</button>
              : <button className="primary-button" type="button" onClick={() => move(1)}>Next</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
