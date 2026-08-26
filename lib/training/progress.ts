import { LESSON_IDS, type LessonId } from "./types";

export const PROGRESS_STORAGE_KEY = "scc.training.v1";

/**
 * What a trainee did on one lesson. Kept deliberately small and local: the app
 * has no backend and sends nothing anywhere, so an instructor collects results by
 * asking the trainee to export this file.
 */
export interface LessonProgress {
  attempts: number;
  passed: boolean;
  /** Best score seen on this lesson, for a trainee's own sense of progress. */
  bestScore: number | null;
  /** Seconds from opening the lesson to the first passing attempt. */
  timeToPassS: number | null;
  /**
   * Seconds from opening the lesson to the first attempt that was actually run.
   * An instructor reads this as time-to-first-diagnosis: how long it took to
   * decide what to change.
   */
  timeToFirstAttemptS: number | null;
}

export interface TrainingProgress {
  version: 1;
  lessons: Partial<Record<LessonId, LessonProgress>>;
}

export const EMPTY_PROGRESS: TrainingProgress = { version: 1, lessons: {} };

const emptyLesson = (): LessonProgress => ({
  attempts: 0,
  passed: false,
  bestScore: null,
  timeToPassS: null,
  timeToFirstAttemptS: null,
});

function isLessonProgress(value: unknown): value is LessonProgress {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.attempts === "number" &&
    typeof candidate.passed === "boolean" &&
    (candidate.bestScore === null || typeof candidate.bestScore === "number") &&
    (candidate.timeToPassS === null || typeof candidate.timeToPassS === "number") &&
    (candidate.timeToFirstAttemptS === null || typeof candidate.timeToFirstAttemptS === "number")
  );
}

/**
 * Accepts only what it recognises. Stored progress can be hand-edited or come
 * from an older version, and a malformed entry must not take the course down.
 */
export function parseProgress(raw: string | null): TrainingProgress {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EMPTY_PROGRESS;
    const candidate = parsed as { version?: unknown; lessons?: unknown };
    if (candidate.version !== 1) return EMPTY_PROGRESS;
    if (typeof candidate.lessons !== "object" || candidate.lessons === null) return EMPTY_PROGRESS;

    const source = candidate.lessons as Record<string, unknown>;
    const lessons: TrainingProgress["lessons"] = {};
    for (const id of LESSON_IDS) {
      const entry = source[id];
      if (isLessonProgress(entry)) lessons[id] = entry;
    }
    return { version: 1, lessons };
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function readProgress(): TrainingProgress {
  if (typeof window === "undefined") return EMPTY_PROGRESS;
  try {
    return parseProgress(window.localStorage.getItem(PROGRESS_STORAGE_KEY));
  } catch {
    // Private browsing and blocked site data both land here; the course still runs,
    // it simply will not remember anything.
    return EMPTY_PROGRESS;
  }
}

export function writeProgress(progress: TrainingProgress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Nothing to do: progress is a convenience, not part of the simulation.
  }
}

export interface AttemptRecord {
  lessonId: LessonId;
  passed: boolean;
  score: number;
  /** Seconds since the lesson was opened. */
  elapsedS: number;
}

/** Folds one attempt into the stored progress. Pure, so it can be tested directly. */
export function recordAttempt(
  progress: TrainingProgress,
  attempt: AttemptRecord,
): TrainingProgress {
  const previous = progress.lessons[attempt.lessonId] ?? emptyLesson();
  const elapsedS = Number.isFinite(attempt.elapsedS) ? Math.max(0, attempt.elapsedS) : 0;
  const score = Number.isFinite(attempt.score) ? attempt.score : 0;

  return {
    version: 1,
    lessons: {
      ...progress.lessons,
      [attempt.lessonId]: {
        attempts: previous.attempts + 1,
        // Once passed, always passed: a later failed experiment is not a regression.
        passed: previous.passed || attempt.passed,
        bestScore: previous.bestScore === null ? score : Math.max(previous.bestScore, score),
        timeToPassS: previous.timeToPassS ?? (attempt.passed ? elapsedS : null),
        timeToFirstAttemptS: previous.timeToFirstAttemptS ?? elapsedS,
      },
    },
  };
}

export function completedLessonCount(progress: TrainingProgress): number {
  return LESSON_IDS.filter((id) => progress.lessons[id]?.passed).length;
}

/** True once every lesson before this one has been passed. */
export function isLessonUnlocked(progress: TrainingProgress, lessonId: LessonId): boolean {
  const index = LESSON_IDS.indexOf(lessonId);
  if (index <= 0) return true;
  return LESSON_IDS.slice(0, index).every((id) => progress.lessons[id]?.passed);
}

export function exportProgress(progress: TrainingProgress): string {
  return `${JSON.stringify(progress, null, 2)}\n`;
}
