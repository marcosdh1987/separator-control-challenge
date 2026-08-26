"use client";

import { LOCALES, type Locale } from "@/lib/i18n/locale";
import { useLocaleContext } from "@/lib/i18n/provider";

const NATIVE_NAME: Record<Locale, string> = { en: "English", es: "Español" };
const SHORT_NAME: Record<Locale, string> = { en: "EN", es: "ES" };

export function LanguageSwitcher() {
  const { locale, messages, setLocale } = useLocaleContext();

  return (
    <div aria-label={messages.common.language.label} className="language-switcher" role="group">
      {LOCALES.map((candidate) => (
        <button
          aria-label={NATIVE_NAME[candidate]}
          aria-pressed={candidate === locale}
          className="language-switcher-option"
          key={candidate}
          lang={candidate}
          onClick={() => setLocale(candidate)}
          type="button"
        >
          {SHORT_NAME[candidate]}
        </button>
      ))}
    </div>
  );
}
