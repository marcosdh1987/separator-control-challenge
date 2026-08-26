import type { Metadata, Viewport } from "next";

import { DEFAULT_LOCALE } from "@/lib/i18n/locale";
import { LocaleProvider } from "@/lib/i18n/provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Separator Control Challenge",
  description: "Tune a PID controller and survive deterministic separator disturbances.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#071015",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // The static HTML is prerendered in the default locale; the provider swaps the
  // document language once it can read the visitor's preference.
  return (
    <html lang={DEFAULT_LOCALE}>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
