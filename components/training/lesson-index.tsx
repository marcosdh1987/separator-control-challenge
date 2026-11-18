"use client";

import { CheckCircle2, Download, FlaskConical, Lock, Upload } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import { LanguageSwitcher } from "../language-switcher";
import { ProjectAttribution } from "@/components/project-attribution";
import { useTrainingProgress } from "@/hooks/use-training-progress";
import { useMessages } from "@/lib/i18n/provider";
import { LESSON_LIST } from "@/lib/training/lessons";
import { completedLessonCount, exportProgress, isLessonUnlocked } from "@/lib/training/progress";

export function LessonIndex() {
  const messages = useMessages();
  const copy = messages.training;
  const { progress, hydrated, importFrom, reset } = useTrainingProgress();
  const [importError, setImportError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportProgress(progress)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "separator-training-progress.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setImportError(!importFrom(await file.text()));
  };

  return (
    <main className="training-shell">
      <header className="training-header">
        <div>
          <p className="eyebrow">{copy.index.eyebrow}</p>
          <h1>{copy.index.title}</h1>
        </div>
        <LanguageSwitcher />
      </header>

      <p className="training-intro">{copy.index.intro}</p>
      <p className="training-progress">
        {copy.index.progress(completedLessonCount(progress), LESSON_LIST.length)}
      </p>

      <ol className="lesson-list">
        {LESSON_LIST.map((lesson) => {
          const lessonCopy = copy.lesson[lesson.id];
          const state = progress.lessons[lesson.id];
          // Before storage is read every lesson would look locked, which would be a
          // lie for a returning trainee; treat the course as open until it is known.
          const unlocked = !hydrated || isLessonUnlocked(progress, lesson.id);

          return (
            <li className="lesson-card" data-passed={state?.passed ? "true" : "false"} key={lesson.id}>
              <div className="lesson-card-head">
                <span className="lesson-level">{copy.level[lesson.level]}</span>
                <span className="lesson-minutes">{copy.index.estimatedMinutes(lesson.estimatedMinutes)}</span>
                {state?.passed ? (
                  <span className="lesson-passed"><CheckCircle2 aria-hidden="true" /> {copy.index.passed}</span>
                ) : null}
              </div>
              <h2>{lessonCopy.title}</h2>
              <p>{lessonCopy.summary}</p>
              {unlocked ? (
                <Link className="primary-button" href={`/training/${lesson.id}`}>
                  {state?.passed ? copy.index.review : copy.index.start}
                </Link>
              ) : (
                <span className="lesson-locked"><Lock aria-hidden="true" /> {copy.index.locked}</span>
              )}
            </li>
          );
        })}
      </ol>

      <section aria-labelledby="training-research-bridge" className="training-research-bridge">
        <p className="eyebrow"><FlaskConical aria-hidden="true" /> {messages.research.bridge.eyebrow}</p>
        <h2 id="training-research-bridge">{messages.research.bridge.title}</h2>
        <p>{messages.research.bridge.body}</p>
        <Link className="secondary-button" href="/research">{messages.research.bridge.link}</Link>
      </section>

      <section aria-labelledby="training-progress-tools" className="training-tools">
        <h2 id="training-progress-tools">{copy.index.exportProgress}</h2>
        <p>{copy.index.exportHint}</p>
        <div className="training-tool-actions">
          <button className="secondary-button" onClick={download} type="button">
            <Download aria-hidden="true" /> {copy.index.exportProgress}
          </button>
          <button className="secondary-button" onClick={() => fileRef.current?.click()} type="button">
            <Upload aria-hidden="true" /> {copy.index.importProgress}
          </button>
          <input
            accept="application/json"
            aria-label={copy.index.importProgress}
            className="sr-only"
            onChange={(event) => void upload(event.target.files?.[0])}
            ref={fileRef}
            type="file"
          />
          <button className="secondary-button" onClick={reset} type="button">
            {copy.index.resetProgress}
          </button>
        </div>
        {importError ? <p role="alert">{copy.index.importFailed}</p> : null}
      </section>
      <ProjectAttribution variant="compact" />
    </main>
  );
}
