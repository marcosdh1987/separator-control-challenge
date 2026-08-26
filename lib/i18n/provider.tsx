"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { DEFAULT_LOCALE, type Locale } from "./locale";
import { MESSAGES, type Messages } from "./messages";
import {
  getLocaleSnapshot,
  getServerLocaleSnapshot,
  setStoredLocale,
  subscribeLocale,
} from "./store";

interface LocaleContextValue {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  detect = true,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  /**
   * Whether to follow the visitor's stored or browser language. Tests and previews
   * pin a locale instead, so they turn detection off and drive it through props.
   */
  detect?: boolean;
}) {
  const detected = useSyncExternalStore(
    subscribeLocale,
    getLocaleSnapshot,
    getServerLocaleSnapshot,
  );
  const [pinned, setPinned] = useState<Locale>(initialLocale);
  const locale = detect ? detected : pinned;

  // Keeping the document language in step is a genuine external-system sync.
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    if (detect) setStoredLocale(next);
    else setPinned(next);
  }, [detect]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, messages: MESSAGES[locale], setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocaleContext(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocaleContext must be used inside a LocaleProvider");
  return context;
}

export function useMessages(): Messages {
  return useLocaleContext().messages;
}

export function useLocale(): Locale {
  return useLocaleContext().locale;
}
