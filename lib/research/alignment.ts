import type { Replay } from "@/lib/research/decode";

/**
 * Putting two or three runs on one time axis.
 *
 * Paired eng_dacs runs share scenario, seed and protocol, but not their clock:
 * the start-up takes longer under some controllers, so the same protocol phase
 * begins at different ticks (the hold starts at 1 621 s under M6 B and at
 * 2 017 s under c2simc in the LCV-102 lag follow-up). Curves are therefore
 * aligned on a named anchor, and every shift is returned so the page can state
 * it. Nothing is shifted silently, and no run is resampled.
 *
 * Comparison time 0 is the eng_dacs phase origin (the tick before the
 * phase's first tick), so phase-relative results quoted by the report land on
 * the same number of seconds on the axis.
 */

export interface PhaseAnchor {
  kind: "phase";
  phase: string;
}

export type Anchor = PhaseAnchor;

export interface AlignedRun {
  replay: Replay;
  /** Run time of the anchor phase's first tick (seconds since boot), as displayed. */
  anchorS: number | null;
  /** Comparison time = run time - offset. */
  offsetS: number;
  /** Shift relative to the first run, as shown to the reader. */
  shiftS: number;
  /** Comparison-axis span this run covers. */
  fromS: number;
  toS: number;
}

export interface Alignment {
  anchor: Anchor;
  runs: AlignedRun[];
  /** Union of every run's span on the comparison axis. */
  minS: number;
  maxS: number;
  /** Runs that do not contain the anchor (left unaligned at their own clock). */
  missingAnchor: string[];
}

export function anchorTime(replay: Replay, anchor: Anchor): number | null {
  const phase = replay.phases.find((candidate) => candidate.name === anchor.phase);
  return phase ? phase.startS : null;
}

export function alignRuns(replays: readonly Replay[], anchor: Anchor): Alignment {
  const anchors = replays.map((replay) => anchorTime(replay, anchor));
  const reference = anchors.find((value): value is number => value !== null) ?? 0;
  const runs = replays.map((replay, index) => {
    const anchorS = anchors[index];
    // The comparison axis counts seconds as eng_dacs does (first_exit_s,
    // settling_s): from the tick before the phase's first tick. A reported
    // "12 415 s into the hold" then sits at 12 415 on the axis.
    const offsetS = (anchorS ?? reference) - replay.dtS;
    return {
      replay,
      anchorS,
      offsetS,
      shiftS: anchorS === null ? 0 : (anchors[0] ?? reference) - anchorS,
      fromS: replay.startS - offsetS,
      toS: replay.endS - offsetS,
    };
  });
  return {
    anchor,
    runs,
    minS: Math.min(...runs.map((run) => run.fromS)),
    maxS: Math.max(...runs.map((run) => run.toS)),
    missingAnchor: runs.filter((run) => run.anchorS === null).map((run) => run.replay.id),
  };
}

/** Phases every run contains, in the first run's order: the anchors offered. */
export function commonPhases(replays: readonly Replay[]): string[] {
  if (replays.length === 0) return [];
  return replays[0].phases
    .map((phase) => phase.name)
    .filter((name, index, names) => names.indexOf(name) === index)
    .filter((name) => replays.every((replay) => replay.phases.some((phase) => phase.name === name)));
}

export interface Compatibility {
  sameScenario: boolean;
  sameSeed: boolean;
  sameCampaign: boolean;
  /** Same scenario and seed: the runs differ only by the controller. */
  paired: boolean;
  scenarios: string[];
  seeds: number[];
}

export function compatibility(replays: readonly Replay[]): Compatibility {
  const scenarios = [...new Set(replays.map((r) => r.header.run.scenarioId))];
  const seeds = [...new Set(replays.map((r) => r.header.run.seed))];
  const campaigns = new Set(replays.map((r) => r.header.source.campaignId));
  return {
    sameScenario: scenarios.length === 1,
    sameSeed: seeds.length === 1,
    sameCampaign: campaigns.size === 1,
    paired: scenarios.length === 1 && seeds.length === 1,
    scenarios,
    seeds,
  };
}

export const toRunTime = (run: AlignedRun, comparisonS: number) => comparisonS + run.offsetS;
export const toComparisonTime = (run: AlignedRun, runS: number) => runS - run.offsetS;
