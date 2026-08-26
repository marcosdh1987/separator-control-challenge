import { render, type RenderOptions, type RenderResult } from "@testing-library/react";

import type { Locale } from "./locale";
import { MESSAGES, type Messages } from "./messages";
import { LocaleProvider } from "./provider";

/**
 * Renders inside a locale provider. Tests assert English wording by default so a
 * translation change cannot break unrelated suites; pass a locale only when the
 * translation itself is what is under test.
 */
export function renderWithLocale(
  ui: React.ReactElement,
  { locale = "en" as Locale, ...options }: RenderOptions & { locale?: Locale } = {},
): RenderResult {
  return render(ui, {
    wrapper: ({ children }) => (
      <LocaleProvider detect={false} initialLocale={locale}>{children}</LocaleProvider>
    ),
    ...options,
  });
}

export function messagesFor(locale: Locale): Messages {
  return MESSAGES[locale];
}
