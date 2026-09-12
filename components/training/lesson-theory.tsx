"use client";

import { BookOpen, ChevronDown, HardHat } from "lucide-react";
import { useId, useState, useSyncExternalStore } from "react";

import type { LessonCopy } from "@/lib/i18n/messages/en/training";
import type { LessonVisualKind } from "@/lib/training/types";

import { LessonVisual } from "./lesson-visual";

interface LessonTheoryProps {
  copy: LessonCopy;
  fieldNoteHeading: string;
  heading: string;
  hideLabel: string;
  presenting: boolean;
  readLabel: string;
  visualKind: LessonVisualKind;
}

const WIDE_VIEWPORT_QUERY = "(min-width: 761px)";

function wideViewportSnapshot(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(WIDE_VIEWPORT_QUERY).matches;
}

function serverWideViewportSnapshot(): boolean {
  return false;
}

function subscribeWideViewport(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(WIDE_VIEWPORT_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

export function LessonTheory({
  copy,
  fieldNoteHeading,
  heading,
  hideLabel,
  presenting,
  readLabel,
  visualKind,
}: LessonTheoryProps) {
  const headingId = useId();
  const contentId = useId();
  const isWideViewport = useSyncExternalStore(
    subscribeWideViewport,
    wideViewportSnapshot,
    serverWideViewportSnapshot,
  );
  const [userOverride, setUserOverride] = useState<boolean | null>(null);
  const expanded = userOverride ?? (presenting || isWideViewport);

  return (
    <section
      aria-labelledby={headingId}
      className="lesson-theory"
      data-expanded={expanded ? "true" : "false"}
    >
      <div className="lesson-theory__heading">
        <h2 id={headingId}><BookOpen aria-hidden="true" /> {heading}</h2>
        <p>{copy.summary}</p>
      </div>

      <div className="lesson-theory__visual">
        <LessonVisual
          alt={copy.visualAlt}
          kind={visualKind}
          variant={expanded ? "detail" : "thumbnail"}
        />
      </div>

      <button
        aria-controls={contentId}
        aria-expanded={expanded}
        className="lesson-theory__toggle"
        onClick={() => setUserOverride(!expanded)}
        type="button"
      >
        {expanded ? hideLabel : readLabel}
        <ChevronDown aria-hidden="true" />
      </button>

      <div className="lesson-theory__body" hidden={!expanded} id={contentId}>
        {copy.theory.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {copy.fieldNote ? (
          <aside className="lesson-field-note">
            <strong><HardHat aria-hidden="true" /> {fieldNoteHeading}</strong>
            <p>{copy.fieldNote}</p>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
