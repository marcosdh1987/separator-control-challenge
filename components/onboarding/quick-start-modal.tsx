"use client";

import { useCallback, useEffect, useRef } from "react";

import { MissionSummary } from "./mission-summary";

interface QuickStartModalProps {
  onDismiss: (persist: boolean) => void;
  onStartGuidedTour: () => void;
}

export function QuickStartModal({ onDismiss, onStartGuidedTour }: QuickStartModalProps) {
  const scrimRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onDismissRef = useRef(onDismiss);
  const onStartGuidedTourRef = useRef(onStartGuidedTour);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    onStartGuidedTourRef.current = onStartGuidedTour;
  }, [onDismiss, onStartGuidedTour]);

  const close = useCallback((persist: boolean) => {
    onDismissRef.current(persist);
  }, []);

  const startGuidedTour = useCallback(() => {
    onStartGuidedTourRef.current();
  }, []);

  useEffect(() => {
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
    const initialButton = dialogRef.current?.querySelector<HTMLButtonElement>("button");
    initialButton?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
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
  }, [close]);

  return (
    <div className="quick-start-scrim" ref={scrimRef}>
      <div
        aria-describedby="quick-start-description"
        aria-labelledby="quick-start-title"
        aria-modal="true"
        className="quick-start-modal"
        ref={dialogRef}
        role="dialog"
      >
        <p className="eyebrow">First control-room visit</p>
        <h2 id="quick-start-title">Your mission</h2>
        <MissionSummary />
        <div className="quick-start-actions">
          <button className="primary-button" type="button" onClick={startGuidedTour}>Start guided tour</button>
          <button className="secondary-button" type="button" onClick={() => close(false)}>Skip and play</button>
          <button className="secondary-button" type="button" onClick={() => close(true)}>Don&apos;t show again</button>
        </div>
      </div>
    </div>
  );
}
