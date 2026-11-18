"use client";

import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import Link from "next/link";

import { SourceList } from "./research-lab";
import { useLocale, useMessages } from "@/lib/i18n/provider";
import type { Locale } from "@/lib/i18n/locale";
import { CONTROLLER_STYLE, secondHalfP2P, type ControllerKey, type ExperimentDefinition } from "@/lib/research/catalog";
import type { ClaimResult } from "@/lib/research/claims";
import type { LoopId } from "@/lib/research/contract";
import type { Replay } from "@/lib/research/decode";
import { formatNumber, formatWithUnit, shortHash } from "@/lib/research/format";

export interface PanelRun {
  replay: Replay;
  controller: ControllerKey;
  name: string;
}

function gainsText(replay: Replay, locale: Locale, deployed: string): string {
  const params = (replay.header.run.controller.params ?? {}) as {
    gains?: Record<string, { kp?: number; ki?: number }>;
    filter_tau_s?: Record<string, number>;
  };
  const gains = params.gains ?? {};
  const loops = Object.keys(gains);
  if (loops.length === 0) return deployed;
  return loops.map((loop) => {
    const g = gains[loop];
    const filter = params.filter_tau_s?.[loop];
    const tag = replay.header.instrumentation[loop as LoopId]?.controller ?? loop;
    return `${tag}: ${formatNumber(g.kp, locale, 2)}, ${formatNumber(g.ki, locale, 4)}${filter ? `, ${formatNumber(filter, locale, 0)} s` : ""}`;
  }).join(" · ");
}

export function MetricsTable({ runs, experiment }: { runs: PanelRun[]; experiment: Pick<ExperimentDefinition, "focusLoop"> }) {
  const copy = useMessages().research;
  const locale = useLocale();
  const m = copy.metrics;
  const loop = experiment.focusLoop;
  const first = runs[0]?.replay.header;
  const criteria = first?.criteria;
  const fast = (criteria?.controlCriteria?.fast_settling_s as Record<string, number> | undefined)?.[loop];
  const hasSteps = runs.some((run) => (run.replay.header.metrics.control?.steps ?? []).length > 0);
  // Step campaigns carry an empty hold block ({}); only a classified hold counts.
  const holdOf = (run: PanelRun) => {
    const hold = run.replay.header.metrics.control?.hold;
    return hold && typeof hold.class === "string" ? hold : undefined;
  };
  const hasHold = runs.some((run) => holdOf(run) !== undefined);
  const cls = (value: string | undefined) => (value ? m.classes[value] ?? value : m.notApplicable);
  const levelKey = loop === "water" ? "level.interface.truth" : "level.total.truth";

  return (
    <section aria-labelledby="research-metrics-heading" className="research-panel">
      <h2 className="research-section-title" id="research-metrics-heading">{m.heading}</h2>
      <p className="research-note">{m.note}</p>
      <div className="research-table-scroll">
        <table className="research-table">
          <thead>
            <tr>
              <th scope="col">{m.controller}</th>
              <th scope="col">{m.gains}</th>
              {hasHold ? <><th scope="col">{m.holdClass}</th><th scope="col">{m.firstExit}</th><th scope="col">{m.travel}</th><th scope="col">{m.p2pTail}</th><th scope="col">{m.p2pHalf}</th></> : null}
              {hasSteps ? <><th scope="col">{m.stepClass}</th><th scope="col">{m.settling}</th><th scope="col">{m.overshoot}</th><th scope="col">{m.saturated}</th></> : null}
              <th scope="col">{m.outcome}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const header = run.replay.header;
              const hold = holdOf(run);
              const holdLoop = hold?.loops?.[loop];
              const step = (header.metrics.control?.steps ?? []).find((item) => item.loop === loop);
              const half = hasHold ? secondHalfP2P(run.replay, levelKey) : null;
              return (
                <tr key={run.replay.id}>
                  <th scope="row"><span aria-hidden="true" className="research-swatch" style={{ borderColor: CONTROLLER_STYLE[run.controller].color }} />{run.name}</th>
                  <td>{gainsText(run.replay, locale, copy.controllerHelp.deployed)}</td>
                  {hasHold ? (
                    <>
                      <td>{cls(hold?.class)}</td>
                      <td>{hold?.first_exit_s != null ? m.secondsFromPhase(formatNumber(hold.first_exit_s, locale, 0), "hold") : m.none}</td>
                      <td>{formatWithUnit(holdLoop?.output_travel_pct_per_h ?? null, "%/h", locale, 0)}</td>
                      <td>{formatWithUnit(holdLoop?.pv_p2p_tail ?? null, "%", locale, 2)}</td>
                      <td title={m.computedHere}>{formatWithUnit(half, "%", locale, 2)}*</td>
                    </>
                  ) : null}
                  {hasSteps ? (
                    <>
                      <td>{cls(step?.class)}</td>
                      <td>{formatWithUnit(step?.settling_s ?? null, "s", locale, 0)}</td>
                      <td>{formatNumber(step?.overshoot_frac ?? null, locale, 3)}</td>
                      <td>{formatNumber(step?.fraction_saturated ?? null, locale, 3)}</td>
                    </>
                  ) : null}
                  <td>{header.run.outcome ? copy.envelope.outcomes[header.run.outcome] ?? header.run.outcome : m.notApplicable}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="research-criteria">
        <li>{m.criterion}: {copy.charts.band(`${formatNumber(criteria?.thresholds.level_band_pct, locale, 0)} %`)} ({copy.charts.total}, {copy.charts.interface})</li>
        {hasSteps && fast ? <li>{m.criterion}: {m.classes.fast} ≤ {formatNumber(fast, locale, 0)} s; {m.classes.saturated} &gt; {formatNumber(criteria?.thresholds.saturation_fraction, locale, 2)}</li> : null}
        {hasHold ? <li>* {m.computedHere}</li> : null}
      </ul>
    </section>
  );
}

function formatClaimValue(value: readonly number[] | string | null, decimals: number, locale: Locale): string {
  if (value === null) return "—";
  if (typeof value === "string") return value;
  return value.map((v) => formatNumber(v, locale, decimals)).join(", ");
}

export function ClaimsPanel({ results }: { results: ClaimResult[] }) {
  const copy = useMessages().research.claims;
  const locale = useLocale();
  const classes = useMessages().research.metrics.classes;
  return (
    <section aria-labelledby="research-claims-heading" className="research-panel">
      <h2 className="research-section-title" id="research-claims-heading">{copy.heading}</h2>
      <p className="research-note">{copy.note}</p>
      <ul className="research-claims">
        {results.map(({ claim, status, computed }) => {
          const documented = claim.documented;
          const unit = documented.kind === "class" ? "" : copy.units[documented.unit] ?? documented.unit;
          const decimals = documented.kind === "class" ? 0 : documented.decimals;
          const documentedText = documented.kind === "class"
            ? classes[documented.value] ?? documented.value
            : documented.kind === "range"
              ? documented.low === documented.high
                ? `${formatNumber(documented.low, locale, decimals)} ${unit}`
                : `${formatNumber(documented.low, locale, decimals)} … ${formatNumber(documented.high, locale, decimals)} ${unit}`
              : `${documented.values.map((v) => formatNumber(v, locale, decimals)).join(", ")} ${unit}`;
          // One more decimal than the report, so the rounding behind "agrees" is visible.
          const computedText = typeof computed === "string" ? classes[computed] ?? computed : formatClaimValue(computed, decimals === 0 ? 0 : decimals + 1, locale);
          const Icon = status === "consistent" ? CheckCircle2 : status === "inconsistent" ? XCircle : CircleHelp;
          return (
            <li className={`research-claim is-${status}`} data-claim={claim.id} key={claim.id}>
              <p className="research-claim-statement">{copy.statements[claim.id] ?? claim.id}</p>
              <dl>
                <div><dt>{copy.documented} ({copy.section(claim.section)})</dt><dd>{documentedText}</dd></div>
                <div><dt>{copy.computed}</dt><dd>{computedText}</dd></div>
              </dl>
              <span className="research-claim-status"><Icon aria-hidden="true" /> {copy.status[status]}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function LearningPanel({ experiment, uncertainties }: { experiment: ExperimentDefinition; uncertainties: string[] }) {
  const messages = useMessages();
  const copy = messages.research.learning;
  const text = messages.research.experiments[experiment.id];
  return (
    <section aria-labelledby="research-learning-heading" className="research-panel research-learning">
      <h2 className="research-section-title" id="research-learning-heading">{copy.heading}</h2>
      <div className="research-learning-grid">
        <div>
          <h3>{copy.demonstrate}</h3>
          <ul>{text.demonstrate.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>{copy.watch}</h3>
          <ul>{text.watch.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <div>
          <h3>{copy.questions}</h3>
          {text.questions.map((item) => (
            <details className="research-question" key={item.q}>
              <summary>{item.q}</summary>
              <p className="research-question-reveal">{copy.reveal}</p>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
      <h3>{copy.conclusion}</h3>
      {text.conclusion.map((item) => <p key={item}>{item}</p>)}
      <h3>{copy.idealVsReal}</h3>
      <ul>{text.idealVsReal.map((item) => <li key={item}>{item}</li>)}</ul>
      {uncertainties.length > 0 ? (
        <>
          <h3>{copy.limitations}</h3>
          <ul lang="en">{uncertainties.map((item) => <li key={item}>{item}</li>)}</ul>
        </>
      ) : null}
      <h3>{copy.relatedLessons}</h3>
      <ul className="research-lessons">
        {experiment.relatedLessons.map((lessonId) => (
          <li key={lessonId}><Link href={`/training/${lessonId}`}>{messages.training.lesson[lessonId].title}</Link></li>
        ))}
      </ul>
      <h3>{copy.sources}</h3>
      <SourceList sources={experiment.sources} />
      <p className="research-note">{copy.sourceAccess}</p>
    </section>
  );
}

export function ProvenancePanel({ runs }: { runs: PanelRun[] }) {
  const copy = useMessages().research.provenance;
  return (
    <section aria-labelledby="research-provenance-heading" className="research-panel">
      <details>
        <summary><h2 className="research-section-title" id="research-provenance-heading">{copy.heading}</h2></summary>
        <div className="research-table-scroll">
          <table className="research-table research-provenance">
            <tbody>
              {runs.map((run) => {
                const { source, run: info, generatedAt, privacy } = run.replay.header;
                const reproduced = (source.reproductions ?? []).filter((r) => r.identical);
                return (
                  <tr key={run.replay.id}>
                    <th scope="row">{run.name}</th>
                    <td>
                      <dl>
                        <div><dt>{copy.dataset}</dt><dd><code>{source.datasetId}</code></dd></div>
                        <div><dt>{copy.run}</dt><dd><code>{info.runId}</code></dd></div>
                        <div><dt>{copy.scenario} / {copy.seed}</dt><dd>{info.scenarioId} / {info.seed}</dd></div>
                        <div><dt>{copy.code}</dt><dd><code>{shortHash(source.gitSha)}</code> ({copy.dirty(source.gitDirtyFileCount)})</dd></div>
                        <div><dt>{copy.config}</dt><dd><code>{shortHash(source.configSha256Raw, 16)}</code></dd></div>
                        <div><dt>{copy.digest}</dt><dd><code>{shortHash(source.runDigest, 16)}</code></dd></div>
                        <div><dt>{copy.trace}</dt><dd><code>{shortHash(source.traceFileSha256, 16)}</code></dd></div>
                        {reproduced.length > 0 ? <div><dt>{copy.reproduced}</dt><dd>{reproduced.map((r) => copy.reproducedYes(r.at ?? "")).join("; ")}</dd></div> : null}
                        <div><dt>{copy.exported}</dt><dd>{generatedAt}</dd></div>
                        <div><dt>{copy.policy}</dt><dd><code>{privacy.policyId}</code></dd></div>
                      </dl>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {runs[0] ? (
          <>
            <h3>{copy.withheld}</h3>
            <ul className="research-withheld">
              {runs[0].replay.header.privacy.withheld.map((item) => <li key={item.field}><code>{item.field}</code>: {item.reason}</li>)}
            </ul>
          </>
        ) : null}
      </details>
    </section>
  );
}
