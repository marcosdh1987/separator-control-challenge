"use client";

import { GitCompareArrows } from "lucide-react";

import { GAIN_IDS, type GainId } from "@/lib/education/pid-content";
import { useMessages } from "@/lib/i18n/provider";
import type { ActuatorAnalysis, LoopAnalysis, RunAnalysis } from "@/lib/simulation/analysis";
import type { DualPidConfig, LoopId, PhaseId } from "@/lib/simulation/types";

/**
 * Attempt-against-attempt debrief.
 *
 * The learning panel's golden rule is to change one thing and repeat the scenario.
 * This panel is the other half of that rule: it puts the two runs side by side per
 * metric and says which way each one moved, so "it felt better" becomes "IAE fell
 * 18% and commanded valve travel doubled".
 *
 * Every figure it shows comes from `lib/simulation/analysis.ts`, which is
 * post-process and does not touch the score. The previous attempt arrives as a
 * prop; this component keeps no state and does not know how attempts are stored.
 */

/** One finished attempt, reduced to what a comparison needs. */
export interface TuningAttempt {
  analysis: RunAnalysis;
  pid: DualPidConfig;
}

export interface TuningDebriefProps {
  current: TuningAttempt;
  /** Absent on the first attempt at a scenario; then the panel invites a re-run. */
  previous?: TuningAttempt | null;
}

export type MetricVerdict = "better" | "worse" | "unchanged";

/** Below this relative move, a metric is noise between two attempts, not progress. */
const SIGNIFICANT_CHANGE = 0.01;

/**
 * Compares one figure across two attempts. Every metric here is one where **lower
 * is better**, and a figure that was never reached — an unsettled run has no
 * settling time — is treated as the worst possible value rather than as missing,
 * so a run that stopped settling altogether cannot read as an improvement.
 */
export function compareMetric(
  previous: number | null,
  current: number | null,
): MetricVerdict {
  const before = previous ?? Number.POSITIVE_INFINITY;
  const after = current ?? Number.POSITIVE_INFINITY;
  if (before === after) return "unchanged";
  if (!Number.isFinite(before) && !Number.isFinite(after)) return "unchanged";
  if (!Number.isFinite(before)) return "better";
  if (!Number.isFinite(after)) return "worse";

  const scale = Math.max(Math.abs(before), Math.abs(after));
  if (scale === 0 || Math.abs(after - before) / scale < SIGNIFICANT_CHANGE) return "unchanged";
  return after < before ? "better" : "worse";
}

export interface GainChange {
  loop: LoopId;
  gain: GainId;
  fromValue: number;
  toValue: number;
}

/** Every gain that differs between two attempts, in loop then gain order. */
export function diffGains(
  previous: DualPidConfig,
  current: DualPidConfig,
): GainChange[] {
  const loops: LoopId[] = ["total", "interface", "pressure"];
  const changes: GainChange[] = [];

  for (const loop of loops) {
    const before = previous[loop];
    const after = current[loop];
    if (!before || !after) continue;
    for (const gain of GAIN_IDS) {
      if (before[gain] !== after[gain]) {
        changes.push({ loop, gain, fromValue: before[gain], toValue: after[gain] });
      }
    }
  }

  return changes;
}

type MetricKey =
  | "iae"
  | "ise"
  | "itae"
  | "overshoot"
  | "settlingTime"
  | "riseTime"
  | "steadyOffset"
  | "totalVariation"
  | "reversals";

interface MetricRow {
  key: MetricKey;
  previousValue: number | null;
  currentValue: number | null;
  format: (value: number) => string;
}

const LIQUID_ACTUATOR: Record<"total" | "interface", PhaseId> = {
  total: "oil",
  interface: "water",
};

export function TuningDebrief({ current, previous }: TuningDebriefProps) {
  const messages = useMessages();
  const copy = messages.education.analysis;
  const loopName = messages.simulation.loop;
  const gainName = messages.education.coach.gainName;

  function loopRows(
    unit: string,
    analysis: LoopAnalysis,
    baseline: LoopAnalysis | null,
  ): MetricRow[] {
    const rows: [MetricKey, (item: LoopAnalysis) => number | null, (value: number) => string][] = [
      ["iae", (item) => item.iae, (value) => copy.integralValue(value.toFixed(1), unit)],
      ["ise", (item) => item.ise, (value) => copy.squaredIntegralValue(value.toFixed(1), unit)],
      ["itae", (item) => item.itae, (value) => copy.timeIntegralValue(value.toFixed(0), unit)],
      ["overshoot", (item) => item.overshootPct, (value) => copy.percentValue(value.toFixed(0))],
      ["settlingTime", (item) => item.settlingTimeS, (value) => copy.secondsValue(value.toFixed(0))],
      ["riseTime", (item) => item.riseTimeS, (value) => copy.secondsValue(value.toFixed(1))],
      [
        "steadyOffset",
        // Compared as a magnitude: an offset of −2 is no better than one of +2.
        (item) => Math.abs(item.steadyOffsetPct),
        (value) => copy.deviationValue(value.toFixed(2), unit),
      ],
    ];

    return rows.map(([key, read, format]) => ({
      key,
      previousValue: baseline ? read(baseline) : null,
      currentValue: read(analysis),
      format,
    }));
  }

  function actuatorRows(
    analysis: ActuatorAnalysis,
    baseline: ActuatorAnalysis | null,
  ): MetricRow[] {
    return [
      {
        key: "totalVariation" as const,
        previousValue: baseline?.totalVariationPct ?? null,
        currentValue: analysis.totalVariationPct,
        format: (value: number) => copy.percentValue(value.toFixed(0)),
      },
      {
        key: "reversals" as const,
        previousValue: baseline?.reversals ?? null,
        currentValue: analysis.reversals,
        format: (value: number) => copy.countValue(value.toFixed(0)),
      },
    ];
  }

  const sections: { loop: LoopId; rows: MetricRow[] }[] = [];
  for (const loop of ["total", "interface"] as const) {
    const unit = copy.unit.level;
    sections.push({
      loop,
      rows: [
        ...loopRows(unit, current.analysis.loops[loop], previous?.analysis.loops[loop] ?? null),
        ...actuatorRows(
          current.analysis.actuators[LIQUID_ACTUATOR[loop]],
          previous?.analysis.actuators[LIQUID_ACTUATOR[loop]] ?? null,
        ),
      ],
    });
  }
  if (current.analysis.pressureLoop) {
    sections.push({
      loop: "pressure",
      rows: [
        ...loopRows(
          copy.unit.pressure,
          current.analysis.pressureLoop,
          previous?.analysis.pressureLoop ?? null,
        ),
        ...(current.analysis.gasActuator
          ? actuatorRows(
              current.analysis.gasActuator,
              previous?.analysis.gasActuator ?? null,
            )
          : []),
      ],
    });
  }

  const gainChanges = previous ? diffGains(previous.pid, current.pid) : [];

  return (
    <section aria-label={copy.ariaLabel} className="tuning-debrief">
      <div className="tuning-debrief__heading">
        <GitCompareArrows aria-hidden="true" />
        <div><p>{copy.eyebrow}</p><h2>{copy.title}</h2></div>
      </div>

      {previous ? (
        <section className="tuning-debrief__gains">
          <h3>{copy.gainsChanged}</h3>
          {gainChanges.length === 0 ? <p>{copy.gainsUnchanged}</p> : (
            <ul>
              {gainChanges.map((change) => (
                <li key={`${change.loop}-${change.gain}`}>
                  {copy.gainChange(
                    loopName[change.loop],
                    gainName[change.gain],
                    String(change.fromValue),
                    String(change.toValue),
                  )}
                </li>
              ))}
            </ul>
          )}
          {gainChanges.length > 1 ? (
            <p className="tuning-debrief__warning">{copy.tooManyChanges}</p>
          ) : null}
        </section>
      ) : <p className="tuning-debrief__first">{copy.firstAttempt}</p>}

      {sections.map(({ loop, rows }) => (
        <table className="tuning-debrief__table" key={loop}>
          <caption>{loopName[loop]}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.metricColumn}</th>
              <th scope="col">{copy.baseline}</th>
              <th scope="col">{copy.current}</th>
              <th scope="col">{copy.change}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const verdict = previous
                ? compareMetric(row.previousValue, row.currentValue)
                : "unchanged";
              return (
                <tr data-verdict={previous ? verdict : undefined} key={row.key}>
                  <th scope="row">
                    {copy.metric[row.key]}
                    <small>{copy.metricHint[row.key]}</small>
                  </th>
                  <td>
                    {previous && row.previousValue !== null
                      ? row.format(row.previousValue)
                      : copy.unavailable}
                  </td>
                  <td>
                    {row.currentValue !== null
                      ? row.format(row.currentValue)
                      : copy.unavailable}
                  </td>
                  <td>
                    {previous
                      ? <span aria-label={copy.verdictLabel(copy.metric[row.key], copy.verdict[verdict])}>
                          {copy.verdict[verdict]}
                        </span>
                      : copy.unavailable}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ))}
    </section>
  );
}
