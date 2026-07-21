import Link from "next/link";

import { ProcessHero } from "./process-hero";
import { createEquilibriumSnapshot } from "@/lib/simulation/equilibrium";
import { scenarioAt } from "@/lib/simulation/scenarios";
import { DEFAULT_SIMULATION } from "@/lib/simulation/types";
import { sanitizeSimulationConfig } from "@/lib/simulation/validation";

const LANDING_SAMPLE = createEquilibriumSnapshot(
  sanitizeSimulationConfig(DEFAULT_SIMULATION),
  scenarioAt("normal", 0, DEFAULT_SIMULATION.actuatorTauS),
).sample;

const steps = [
  ["01", "Tune", "Set the oil and water PID gains before the disturbance arrives."],
  ["02", "Survive", "Read the coupled inventories and hold the safety envelope."],
  ["03", "Score", "Finish a deterministic attempt and inspect the control response."],
] as const;

export function LandingPage() {
  return (
    <main className="landing-shell">
      <a className="skip-link" href="#mission">Skip to mission</a>
      <header className="landing-header">
        <Link className="landing-brand" href="/" aria-label="Separator Control Challenge home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>
            <span className="eyebrow">Process control lab / challenge 01</span>
            <h1>Separator Control Challenge</h1>
          </span>
        </Link>
        <p className="landing-disclaimer"><strong>Educational simulator</strong><span>Not for field operation or equipment sizing</span></p>
      </header>

      <section id="mission" className="landing-hero" aria-labelledby="landing-headline">
        <div className="landing-copy">
          <p className="eyebrow">Three-phase separator / operator briefing</p>
          <h2 id="landing-headline">Can you keep a three-phase separator stable?</h2>
          <p className="landing-description">Tune two PID control loops, survive realistic well-testing disturbances, and keep the process inside its safe operating envelope.</p>
          <div className="landing-actions">
            <Link className="primary-button landing-action" href="/training">Start guided training</Link>
            <Link className="secondary-button landing-action" href="/challenge">Enter control room</Link>
          </div>
        </div>
        <div className="landing-visual" aria-label="Static separator presentation">
          <p className="landing-visual-label">SEP-101 / NORMAL OPERATION / IDLE VISUAL</p>
          <ProcessHero mode="presentation" sample={LANDING_SAMPLE} status="idle" />
        </div>
      </section>

      <section className="landing-briefing" aria-label="Challenge briefing">
        <ol className="landing-steps">
          {steps.map(([number, title, description]) => (
            <li key={number}><span>{number}</span><div><strong>{title}</strong><p>{description}</p></div></li>
          ))}
        </ol>
        <aside className="landing-control-note" aria-labelledby="control-note-title">
          <p className="eyebrow">Control relationships</p>
          <h2 id="control-note-title">Two valves, two coupled inventories.</h2>
          <p>Oil outlet valve controls total liquid level.</p>
          <p>Water outlet valve controls oil/water interface.</p>
          <p className="landing-goal">Hold the total near 50%, interface near 20%, and protect the operating envelope.</p>
        </aside>
      </section>
    </main>
  );
}
