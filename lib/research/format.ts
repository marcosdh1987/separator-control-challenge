import type { Locale } from "@/lib/i18n/locale";

const LOCALE_TAG: Record<Locale, string> = { en: "en-US", es: "es-AR" };

const cache = new Map<string, Intl.NumberFormat>();

function formatter(locale: Locale, digits: number): Intl.NumberFormat {
  const key = `${locale}:${digits}`;
  let format = cache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(LOCALE_TAG[locale], {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    cache.set(key, format);
  }
  return format;
}

/** A number with fixed decimals in the reader's locale; a dash when absent. */
export function formatNumber(value: number | null | undefined, locale: Locale, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return formatter(locale, digits).format(value);
}

export function formatWithUnit(value: number | null | undefined, unit: string, locale: Locale, digits = 1): string {
  const text = formatNumber(value, locale, digits);
  return text === "—" || !unit ? text : `${text} ${unit}`;
}

/** Seconds as h:mm:ss (or m:ss), signed, for a time axis that can be negative. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.round(Math.abs(seconds));
  const sign = seconds < 0 && total > 0 ? "−" : "";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(h > 0 ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${sign}${h}:${mm}:${ss}` : `${sign}${mm}:${ss}`;
}

export function formatBytes(bytes: number, locale: Locale): string {
  return bytes >= 1e6 ? `${formatNumber(bytes / 1e6, locale, 1)} MB` : `${formatNumber(bytes / 1e3, locale, 0)} kB`;
}

/** Short git hash for display. */
export const shortHash = (value: string | null | undefined, length = 12) => (value ? value.slice(0, length) : "—");
