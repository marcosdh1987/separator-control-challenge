"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MANUAL_TUNING_ORDER } from "@/lib/education/pid-content";
import { useMessages } from "@/lib/i18n/provider";
import { TOUR_TARGET_IDS, type TourTargetId } from "@/lib/onboarding/types";

/** Re-exported under the name the dashboard and the tour tests already use. */
export const TOUR_STEPS = TOUR_TARGET_IDS;

type TourTarget = TourTargetId;

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

function getAvailableIndexes(): number[] {
  if (typeof document === "undefined") return [];
  return TOUR_STEPS.flatMap((target, index) => findTarget(target) ? [index] : []);
}

export function GuidedTour({ active, onComplete, onSkip }: GuidedTourProps) {
  const { tour } = useMessages().onboarding;
  const [stepIndex, setStepIndex] = useState(0);
  const [availableIndexes, setAvailableIndexes] = useState(getAvailableIndexes);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const discoveredIndexes = active ? getAvailableIndexes() : availableIndexes;
  const activeIndexes = discoveredIndexes.length > 0 ? discoveredIndexes : availableIndexes;
  const currentIndex = activeIndexes.includes(stepIndex) ? stepIndex : (activeIndexes[0] ?? 0);
  const previousIndex = activeIndexes.filter((index) => index < currentIndex).at(-1) ?? null;
  const nextIndex = activeIndexes.find((index) => index > currentIndex) ?? null;

  const updateSpotlight = useCallback(() => {
    const target = findTarget(TOUR_STEPS[currentIndex]);
    if (!target) {
      setSpotlight(null);
      return;
    }
    const rect = target.getBoundingClientRect();
    setSpotlight({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [currentIndex]);

  const move = useCallback((direction: 1 | -1) => {
    const destination = direction === 1 ? nextIndex : previousIndex;
    if (destination !== null) setStepIndex(destination);
  }, [nextIndex, previousIndex]);

  useEffect(() => {
    if (!active) return;
    const animationFrame = window.requestAnimationFrame(() => {
      const nextAvailableIndexes = getAvailableIndexes();
      setAvailableIndexes((previous) => previous.join(",") === nextAvailableIndexes.join(",") ? previous : nextAvailableIndexes);
      if (nextAvailableIndexes.length === 0) onSkip();
      else if (!nextAvailableIndexes.includes(stepIndex)) setStepIndex(nextAvailableIndexes[0]);
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, [active, onSkip, stepIndex]);

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
  const target = TOUR_STEPS[currentIndex];
  const step = tour.step[target];
  // Only the tuning step carries the gain order, which is notation, not copy.
  const order = target === "manual-pid-tuning" ? MANUAL_TUNING_ORDER : null;
  const position = activeIndexes.indexOf(currentIndex) + 1;

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
        <p className="eyebrow">{tour.eyebrow}</p>
        <p className="sr-only" id="guided-tour-progress">{tour.progress(position, activeIndexes.length)}</p>
        <h2 id="guided-tour-title">{step.title}</h2>
        <p id="guided-tour-description">{step.description}</p>
        {order ? <p className="guided-tour-order">{order}</p> : null}
        <div className="guided-tour-actions">
          <button className="secondary-button" type="button" onClick={onSkip}>{tour.skip}</button>
          <span aria-hidden="true">{position} / {activeIndexes.length}</span>
          <div>
            <button className="secondary-button" disabled={previousIndex === null} type="button" onClick={() => move(-1)}>{tour.back}</button>
            {nextIndex === null
              ? <button className="primary-button" type="button" onClick={onComplete}>{tour.finish}</button>
              : <button className="primary-button" type="button" onClick={() => move(1)}>{tour.next}</button>}
          </div>
        </div>
      </div>
    </div>
  );
}
