/**
 * Which process view the operator prefers, held outside React.
 *
 * The page is prerendered, so the stored choice can only be applied on the client.
 * Exposing it as an external store lets React render the prerendered default during
 * hydration and swap to the real preference immediately afterwards, without a
 * cascading setState inside an effect — the same shape `lib/i18n/store.ts` uses.
 */

export type ProcessView = "scene" | "diagram";

export const PROCESS_VIEW_STORAGE_KEY = "scc.process-view";

/** The 3D scene stays the default; the diagram is a deliberate choice. */
export const DEFAULT_PROCESS_VIEW: ProcessView = "scene";

let current: ProcessView | null = null;
const listeners = new Set<() => void>();

function isProcessView(value: string | null | undefined): value is ProcessView {
  return value === "scene" || value === "diagram";
}

function readStoredProcessView(): ProcessView | null {
  try {
    const stored = window.localStorage.getItem(PROCESS_VIEW_STORAGE_KEY);
    return isProcessView(stored) ? stored : null;
  } catch {
    // Storage is unavailable in private modes and sandboxed frames; a view that
    // cannot be remembered must still be selectable for this session.
    return null;
  }
}

function writeStoredProcessView(view: ProcessView): void {
  try {
    window.localStorage.setItem(PROCESS_VIEW_STORAGE_KEY, view);
  } catch {
    // Persistence is a convenience, never a precondition for rendering.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeProcessView(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the preference should move this one too.
  const onStorage = () => {
    current = readStoredProcessView() ?? DEFAULT_PROCESS_VIEW;
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getProcessViewSnapshot(): ProcessView {
  current ??= readStoredProcessView() ?? DEFAULT_PROCESS_VIEW;
  return current;
}

/** Hydration must match the prerendered HTML, which always shows the default view. */
export function getServerProcessViewSnapshot(): ProcessView {
  return DEFAULT_PROCESS_VIEW;
}

/**
 * Whether the visitor has actually picked a view, as opposed to being shown the
 * default. The hero needs the difference: a device without WebGL should fall back to
 * the diagram, but not over a choice someone made deliberately.
 */
export function hasStoredProcessView(): boolean {
  if (typeof window === "undefined") return false;
  return readStoredProcessView() !== null;
}

export function setStoredProcessView(next: ProcessView): void {
  current = next;
  writeStoredProcessView(next);
  emit();
}

/** Test seam: forget the memoised value so the next read re-reads storage. */
export function resetProcessViewStore(): void {
  current = null;
  emit();
}
