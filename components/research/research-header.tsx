"use client";

import { ChevronLeft, FlaskConical } from "lucide-react";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/language-switcher";
import { useMessages } from "@/lib/i18n/provider";

interface ResearchHeaderProps {
  title: string;
  eyebrow?: string;
  back?: { href: string; label: string };
}

export function ResearchHeader({ title, eyebrow, back }: ResearchHeaderProps) {
  const copy = useMessages().research;
  return (
    <header className="research-header">
      <div className="research-header-main">
        {back ? (
          <Link className="research-back" href={back.href}>
            <ChevronLeft aria-hidden="true" /> {back.label}
          </Link>
        ) : null}
        <p className="eyebrow"><FlaskConical aria-hidden="true" /> {eyebrow ?? copy.page.eyebrow}</p>
        <h1>{title}</h1>
      </div>
      <nav aria-label={copy.nav.lab} className="research-nav">
        <Link href="/research">{copy.nav.lab}</Link>
        <Link href="/research/envelope">{copy.nav.envelope}</Link>
        <Link href="/training">{copy.nav.training}</Link>
        <Link href="/">{copy.nav.home}</Link>
        <LanguageSwitcher />
      </nav>
    </header>
  );
}

/** The two statements every Research Lab page carries. */
export function ResearchDisclaimer({ compact = false }: { compact?: boolean }) {
  const copy = useMessages().research.page;
  return (
    <aside aria-label={copy.disclaimerTitle} className={`research-disclaimer ${compact ? "is-compact" : ""}`}>
      <p><strong>{copy.disclaimerTitle}.</strong> {copy.disclaimer}</p>
      {!compact ? <p><strong>{copy.independenceTitle}.</strong> {copy.independence}</p> : null}
    </aside>
  );
}
