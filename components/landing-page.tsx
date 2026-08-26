"use client";

import Link from "next/link";

import { LanguageSwitcher } from "./language-switcher";
import { ProcessHero } from "./process-hero";
import { useMessages } from "@/lib/i18n/provider";
import { createEquilibriumSnapshot } from "@/lib/simulation/equilibrium";
import { scenarioAt } from "@/lib/simulation/scenarios";
import { DEFAULT_SIMULATION } from "@/lib/simulation/types";
import { sanitizeSimulationConfig } from "@/lib/simulation/validation";

const LANDING_SAMPLE = createEquilibriumSnapshot(
  sanitizeSimulationConfig(DEFAULT_SIMULATION),
  scenarioAt("normal", 0, DEFAULT_SIMULATION.actuatorTauS),
).sample;

/** Renders "1" as "01" so the briefing keeps its instrument-panel numbering. */
function stepNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

export function LandingPage() {
  const messages = useMessages();
  const copy = messages.landing;

  return (
    <main className="landing-shell">
      <a className="skip-link" href="#mission">{copy.skipToMission}</a>
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label={copy.header.homeLabel}>
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>
            <span className="eyebrow">{copy.header.eyebrow}</span>
            <h1>{messages.common.appName}</h1>
          </span>
        </Link>
        <div className="landing-header-aside">
          <p className="landing-disclaimer"><strong>{copy.header.disclaimerTitle}</strong><span>{copy.header.disclaimerDetail}</span></p>
          <LanguageSwitcher />
        </div>
      </header>

      <section id="mission" className="landing-hero" aria-labelledby="landing-headline">
        <div className="landing-copy">
          <p className="eyebrow">{copy.hero.eyebrow}</p>
          <h2 id="landing-headline">{copy.hero.headline}</h2>
          <p className="landing-description">{copy.hero.description}</p>
          <div className="landing-actions">
            <Link className="primary-button landing-action" href="/training">{copy.cta.startTraining}</Link>
            <Link className="secondary-button landing-action" href="/challenge">{copy.cta.enterControlRoom}</Link>
          </div>
        </div>
        <div className="landing-visual" aria-label={copy.hero.visualLabel}>
          <p className="landing-visual-label">{copy.hero.visualTag}</p>
          <ProcessHero mode="presentation" sample={LANDING_SAMPLE} status="idle" />
        </div>
      </section>

      <section className="landing-briefing" aria-label={copy.briefing.label}>
        <ol className="landing-steps">
          {copy.briefing.steps.map((step, index) => (
            <li key={step.title}><span>{stepNumber(index)}</span><div><strong>{step.title}</strong><p>{step.description}</p></div></li>
          ))}
        </ol>
        <aside className="landing-control-note" aria-labelledby="control-note-title">
          <p className="eyebrow">{copy.briefing.controlNote.eyebrow}</p>
          <h2 id="control-note-title">{copy.briefing.controlNote.title}</h2>
          <p>{copy.briefing.controlNote.oilValve}</p>
          <p>{copy.briefing.controlNote.waterValve}</p>
          <p className="landing-goal">{copy.briefing.controlNote.goal}</p>
        </aside>
      </section>
    </main>
  );
}
