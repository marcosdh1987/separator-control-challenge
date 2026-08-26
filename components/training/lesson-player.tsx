"use client";

import { BookOpen, CheckCircle2, ChevronLeft, HardHat, Presentation, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LessonRunner } from "./lesson-runner";
import { LanguageSwitcher } from "../language-switcher";
import { useTrainingProgress } from "@/hooks/use-training-progress";
import { useMessages } from "@/lib/i18n/provider";
import { getLesson, nextLessonId } from "@/lib/training/lessons";
import type { LessonId, LessonOutcome } from "@/lib/training/types";

interface LessonPlayerProps {
  lessonId: LessonId;
}

const formatCheckValue = (value: number) =>
  Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(1);

export function LessonPlayer({ lessonId }: LessonPlayerProps) {
  const messages = useMessages();
  const copy = messages.training;
  const lesson = getLesson(lessonId);
  const lessonCopy = copy.lesson[lessonId];
  const { progress, record } = useTrainingProgress();
  const [outcome, setOutcome] = useState<LessonOutcome | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [taskRevealed, setTaskRevealed] = useState(true);
  // Time-to-first-attempt is measured from opening the lesson, which is when the
  // trainee first has enough information to decide what to change. Reading the
  // clock belongs in an effect: render has to stay pure. The route remounts this
  // component per lesson, so there is nothing to reset when the lesson changes.
  const openedAtRef = useRef(0);

  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);

  const handleOutcome = useCallback((next: LessonOutcome, score: number) => {
    setOutcome(next);
    record({
      lessonId,
      passed: next.passed,
      score,
      elapsedS: (Date.now() - openedAtRef.current) / 1000,
    });
  }, [lessonId, record]);

  const attempts = progress.lessons[lessonId]?.attempts ?? 0;
  const following = nextLessonId(lessonId);

  return (
    <main className={`training-shell ${presenting ? "is-presenting" : ""}`}>
      <header className="training-header">
        <Link className="training-back" href="/training">
          <ChevronLeft aria-hidden="true" /> {copy.index.backToIndex}
        </Link>
        <div>
          <p className="eyebrow">{copy.level[lesson.level]}</p>
          <h1>{lessonCopy.title}</h1>
        </div>
        <div className="training-header-aside">
          <button
            className="secondary-button"
            onClick={() => setPresenting((current) => !current)}
            type="button"
          >
            <Presentation aria-hidden="true" />
            {presenting ? copy.instructor.exit : copy.instructor.enter}
          </button>
          <LanguageSwitcher />
        </div>
      </header>

      {presenting ? <p className="training-present-hint">{copy.instructor.hint}</p> : null}

      <section aria-labelledby="lesson-theory" className="lesson-theory">
        <h2 id="lesson-theory"><BookOpen aria-hidden="true" /> {copy.player.theoryHeading}</h2>
        {lessonCopy.theory.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        {lessonCopy.fieldNote ? (
          <aside className="lesson-field-note">
            <strong><HardHat aria-hidden="true" /> {copy.player.fieldNoteHeading}</strong>
            <p>{lessonCopy.fieldNote}</p>
          </aside>
        ) : null}
      </section>

      <section aria-labelledby="lesson-briefing" className="lesson-briefing">
        <div className="lesson-briefing-head">
          <h2 id="lesson-briefing">{copy.player.briefingHeading}</h2>
          {presenting ? (
            <button
              className="secondary-button"
              onClick={() => setTaskRevealed((current) => !current)}
              type="button"
            >
              {taskRevealed ? copy.instructor.hideTask : copy.instructor.revealTask}
            </button>
          ) : null}
        </div>
        {!presenting || taskRevealed ? (
          <ol>
            {lessonCopy.briefing.map((step) => <li key={step}>{step}</li>)}
          </ol>
        ) : null}
      </section>

      <LessonRunner lesson={lesson} onOutcome={handleOutcome} />

      <section aria-labelledby="lesson-debrief" className="lesson-debrief">
        <h2 id="lesson-debrief">{copy.player.debriefHeading}</h2>
        {outcome === null ? (
          <p className="lesson-debrief-empty">{copy.player.notAttempted}</p>
        ) : (
          <>
            <p className={`lesson-banner ${outcome.passed ? "is-passed" : "is-failed"}`}>
              {outcome.passed ? copy.player.passedBanner : copy.player.failedBanner}
              <small>{copy.player.attempt(attempts)}</small>
            </p>
            {(outcome.passed ? lessonCopy.debriefPassed : lessonCopy.debriefFailed).map(
              (paragraph) => <p key={paragraph}>{paragraph}</p>,
            )}

            <h3>{copy.player.checksHeading}</h3>
            <ul className="lesson-checks">
              {outcome.checks.map((entry) => (
                <li key={entry.id} data-passed={entry.passed ? "true" : "false"}>
                  {entry.passed
                    ? <CheckCircle2 aria-hidden="true" />
                    : <XCircle aria-hidden="true" />}
                  <span>{copy.check[entry.id]}</span>
                  {entry.actual !== undefined && entry.target !== undefined ? (
                    <em>{formatCheckValue(entry.actual)} / {formatCheckValue(entry.target)}</em>
                  ) : null}
                </li>
              ))}
            </ul>

            {outcome.passed && following ? (
              <Link className="primary-button" href={`/training/${following}`}>
                {copy.player.nextLesson}
              </Link>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
