import { DEFAULT_LOCALE, detectLocale, writeStoredLocale, type Locale } from "./locale";

/**
 * The visitor's language lives outside React: it comes from the browser and from
 * storage that another tab can change. Exposing it as an external store lets React
 * render the prerendered default during hydration and swap to the real preference
 * immediately afterwards, without a cascading setState inside an effect.
 */
let current: Locale | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab changing the preference should move this one too.
  const onStorage = () => {
    current = detectLocale();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function getLocaleSnapshot(): Locale {
  current ??= detectLocale();
  return current;
}

/** Hydration must match the prerendered HTML, which is always the default locale. */
export function getServerLocaleSnapshot(): Locale {
  return DEFAULT_LOCALE;
}

export function setStoredLocale(next: Locale): void {
  current = next;
  writeStoredLocale(next);
  emit();
}

/** Test seam: forget the memoised value so the next read re-detects. */
export function resetLocaleStore(): void {
  current = null;
  emit();
}
