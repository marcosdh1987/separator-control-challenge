"use client";

import { useCallback, useSyncExternalStore } from "react";

import { EMPTY_PROGRESS, parseProgress, type AttemptRecord, type TrainingProgress } from "@/lib/training/progress";
import {
  getProgressSnapshot,
  getServerProgressSnapshot,
  recordProgressAttempt,
  setProgress,
  subscribeProgress,
} from "@/lib/training/progress-store";

export interface TrainingProgressController {
  progress: TrainingProgress;
  /** False during hydration, when the trainee's own progress is not readable yet. */
  hydrated: boolean;
  record: (attempt: AttemptRecord) => void;
  reset: () => void;
  /** Returns false when the text is not a progress export from this course. */
  importFrom: (raw: string) => boolean;
}

export function useTrainingProgress(): TrainingProgressController {
  const progress = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getServerProgressSnapshot,
  );

  const record = useCallback((attempt: AttemptRecord) => recordProgressAttempt(attempt), []);
  const reset = useCallback(() => setProgress(EMPTY_PROGRESS), []);

  const importFrom = useCallback((raw: string) => {
    const parsed = parseProgress(raw);
    // An unreadable file parses to an empty course; refuse it rather than silently
    // wiping whatever the trainee already had.
    if (Object.keys(parsed.lessons).length === 0) return false;
    setProgress(parsed);
    return true;
  }, []);

  return { progress, hydrated: progress !== EMPTY_PROGRESS, record, reset, importFrom };
}
