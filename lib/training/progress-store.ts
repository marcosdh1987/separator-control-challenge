import {
  EMPTY_PROGRESS,
  readProgress,
  recordAttempt,
  writeProgress,
  type AttemptRecord,
  type TrainingProgress,
} from "./progress";

/**
 * Course progress lives in browser storage, outside React. Exposing it as an
 * external store lets a prerendered page hydrate against an empty course and pick
 * up the real one immediately afterwards, without a cascading setState in an effect.
 */
let current: TrainingProgress | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab finishing a lesson should be reflected here too.
  const onStorage = () => {
    current = readProgress();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getProgressSnapshot(): TrainingProgress {
  current ??= readProgress();
  return current;
}

/** Hydration must match the prerendered HTML, which knows nothing about a trainee. */
export function getServerProgressSnapshot(): TrainingProgress {
  return EMPTY_PROGRESS;
}

export function setProgress(next: TrainingProgress): void {
  current = next;
  writeProgress(next);
  emit();
}

export function recordProgressAttempt(attempt: AttemptRecord): void {
  setProgress(recordAttempt(getProgressSnapshot(), attempt));
}

/** Test seam: forget the memoised value so the next read re-reads storage. */
export function resetProgressStore(): void {
  current = null;
  emit();
}
