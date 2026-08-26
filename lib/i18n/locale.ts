export const LOCALES = ["en", "es"] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * English is the fallback and the language the static HTML is prerendered in.
 * A Spanish visitor is switched over once the app mounts and can read storage.
 */
export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_STORAGE_KEY = "scc.locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Matches a BCP 47 tag against the languages we ship. Only the primary subtag
 * matters: `es-AR`, `es-419` and `es` are all Spanish to this app.
 */
export function localeFromLanguageTag(tag: string | undefined | null): Locale | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(primary) ? primary : null;
}

/** The first supported language in the visitor's ordered browser preferences. */
export function preferredLocale(languages: readonly string[]): Locale {
  for (const tag of languages) {
    const locale = localeFromLanguageTag(tag);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}

/**
 * An explicit choice always wins over the browser preference, so a Spanish
 * speaker who switches to English stays in English on the next visit.
 */
export function resolveLocale(
  stored: string | null | undefined,
  languages: readonly string[],
): Locale {
  if (isLocale(stored)) return stored;
  return preferredLocale(languages);
}

export function readStoredLocale(): Locale | null {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    // Storage is unavailable in private modes and sandboxed frames; the browser
    // preference is a good enough answer and the app must still run.
    return null;
  }
}

export function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // A locale that cannot be persisted is still applied for this session.
  }
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const languages = window.navigator?.languages?.length
    ? window.navigator.languages
    : [window.navigator?.language].filter((tag): tag is string => Boolean(tag));
  return resolveLocale(readStoredLocale(), languages);
}
