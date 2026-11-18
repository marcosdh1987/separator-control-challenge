import type { ClaimContext, ClaimDefinition } from "@/lib/research/claims";
import { numbersOf, tableRows } from "@/lib/research/claims";
import type { Anchor } from "@/lib/research/alignment";
import type { DocReference, HoldMetrics, LoopId, StepMetrics } from "@/lib/research/contract";
import type { Replay } from "@/lib/research/decode";
import { peakToPeak, phaseByName, phaseOriginS, windowValues } from "@/lib/research/timeline";
import type { LessonId } from "@/lib/training/types";

/**
 * The curated Research Lab catalogue: which published runs make each
 * experiment, how they are compared, and which documented claims the page
 * re-derives. The prose lives in the message catalogues
 * (`lib/i18n/messages/<locale>/research.ts`); the numbers live in the data.
 */

export type ExperimentId = "c2-lic103-simc" | "c2-lcv102-actuator-lag" | "c2-lcv102-stiction";
export type CatalogueEntryId = ExperimentId | "campaign-d-trajectories" | "field-calibrated-cases" | "operating-envelope";

/** Controller variants as the reader meets them, independent of dataset naming. */
export type ControllerKey = "deployed" | "simc" | "m6b" | "c2simc";

export const CONTROLLER_STYLE: Record<ControllerKey, { color: string; dash: string }> = {
  deployed: { color: "#ffb45c", dash: "" },
  m6b: { color: "#cf8cff", dash: "7 4" },
  simc: { color: "#48e5d2", dash: "2 3" },
  c2simc: { color: "#48e5d2", dash: "2 3" },
};

export interface ComparisonRun {
  replayId: string;
  controller: ControllerKey;
}

export interface ComparisonSet {
  id: string;
  scenarioId: string;
  seed: number;
  anchor: Anchor;
  runs: ComparisonRun[];
}

export type ChartId = "pressure" | "total" | "interface" | "valve-oil" | "valve-water" | "events";

export interface ExperimentDefinition {
  id: ExperimentId;
  campaign: string;
  stage: "confirmatory" | "exploratory";
  /** Seeds of the campaign; checked against every published run's evidence block. */
  seeds: number;
  focusLoop: LoopId;
  campaignSummaryId: string;
  comparisons: ComparisonSet[];
  charts: ChartId[];
  sources: DocReference[];
  relatedLessons: LessonId[];
  claims: ClaimDefinition[];
}

const C2_WATER = "control-c2-water-replication-20261115";
const C2_LAG = "control-c2-lag-followup-20261116";
const C2_ROBUST_E = "control-c2-robustness-e-pilot-20261116";
export const ENVELOPE_MAP_ID = "nominal-pilot-20261113T234459Z";
/** The stage-1 pilot ran one seed (7100); checked against the published map. */
export const ENVELOPE_SEEDS = 1;

const GUIDE = "docs/simulation/controllability_campaigns.md";
const ENVELOPE_GUIDE = "docs/simulation/operating_envelope.md";

/* ---------------------------- claim helpers ---------------------------- */

const hold = (replay: Replay | undefined): HoldMetrics | null => {
  const value = replay?.header.metrics.control?.hold;
  // Step campaigns carry an empty hold block; only a classified hold counts.
  return value && typeof value.class === "string" ? value : null;
};
const steps = (replay: Replay | undefined): StepMetrics[] => replay?.header.metrics.control?.steps ?? [];

const stepRows = (context: ClaimContext) => tableRows(context.campaign?.controlSteps);
const runRows = (context: ClaimContext) => tableRows(context.campaign?.runs);

function countWhere(context: ClaimContext, predicate: (row: Record<string, unknown>) => boolean): number[] | null {
  const rows = stepRows(context);
  return rows.length === 0 ? null : [rows.filter(predicate).length];
}

/** Total-level peak-to-peak in hold windows [a, b] hours, as the report tabulates. */
function holdWindowP2P(replay: Replay | undefined, windows: readonly (readonly [number, number])[]): number[] | null {
  if (!replay) return null;
  const origin = phaseOriginS(replay, "hold");
  if (origin === null) return null;
  return windows.map(([a, b]) =>
    peakToPeak(windowValues(replay, "level.total.truth", origin + a * 3600 + replay.dtS, origin + b * 3600)),
  );
}

/** Total-level peak-to-peak over the second half of the hold (report section 9.7). */
export function secondHalfP2P(replay: Replay | undefined, key: "level.total.truth" | "level.interface.truth" = "level.total.truth"): number | null {
  const phase = replay ? phaseByName(replay, "hold") : undefined;
  if (!replay || !phase) return null;
  const middle = (phase.startS + phase.endS) / 2;
  return peakToPeak(windowValues(replay, key, middle, phase.endS));
}

const id = (dataset: string, run: string) => `${dataset}/${run}`;

/* ------------------------------ experiments ----------------------------- */

const LIC103 = {
  centerNominal: id(C2_WATER, "center__nominal__s7200"),
  centerSimc: id(C2_WATER, "center__simc-tc120-f10__s7200"),
  piNominal: id(C2_WATER, "pi_1p5-000__nominal__s7200"),
  piSimc: id(C2_WATER, "pi_1p5-000__simc-tc120-f10__s7200"),
};

const LAG = {
  m6b: id(C2_LAG, "high_rate-000__lcv102-lag-m6b__s7100"),
  c2simc: id(C2_LAG, "high_rate-000__lcv102-lag-c2simc__s7100"),
};

const STICK = {
  deployed: id(C2_ROBUST_E, "center__lcv102-stick-nominal__s7100"),
  m6b: id(C2_ROBUST_E, "center__lcv102-stick-m6b__s7100"),
  c2simc: id(C2_ROBUST_E, "center__lcv102-stick-c2simc__s7100"),
};

const SIMC_VARIANT = "simc-tc120-f10";
const LAG_WINDOWS = [[0, 0.5], [1, 1.5], [2, 2.5], [3.5, 4]] as const;

export const EXPERIMENTS: Record<ExperimentId, ExperimentDefinition> = {
  "c2-lic103-simc": {
    id: "c2-lic103-simc",
    campaign: "C2",
    stage: "confirmatory",
    seeds: 3,
    focusLoop: "water",
    campaignSummaryId: C2_WATER,
    comparisons: [
      {
        id: "center",
        scenarioId: "center",
        seed: 7200,
        anchor: { kind: "phase", phase: "step_water" },
        runs: [
          { replayId: LIC103.centerNominal, controller: "deployed" },
          { replayId: LIC103.centerSimc, controller: "simc" },
        ],
      },
      {
        id: "pi_1p5",
        scenarioId: "pi_1p5-000",
        seed: 7200,
        anchor: { kind: "phase", phase: "step_water" },
        runs: [
          { replayId: LIC103.piNominal, controller: "deployed" },
          { replayId: LIC103.piSimc, controller: "simc" },
        ],
      },
    ],
    charts: ["interface", "valve-water", "total", "pressure", "events"],
    sources: [
      { path: GUIDE, section: "9.6", access: "private" },
      { path: "experiments/envelope/config/control_c2_water_replication.yaml", section: "header (pre-registration)", access: "private" },
    ],
    relatedLessons: ["systematic-tuning", "integral-action-and-windup"],
    claims: [
      {
        id: "simcFast",
        section: "9.6",
        documented: { kind: "range", low: 21, high: 21, decimals: 0, unit: "steps" },
        compute: (c) => countWhere(c, (r) => r.variant_id === SIMC_VARIANT && r.class === "fast"),
      },
      {
        id: "simcSaturated",
        section: "9.6",
        documented: { kind: "range", low: 3, high: 3, decimals: 0, unit: "steps" },
        compute: (c) => countWhere(c, (r) => r.variant_id === SIMC_VARIANT && r.class === "saturated" && String(r.scenario_id).startsWith("pi_1p5")),
      },
      {
        id: "nominalSlow",
        section: "9.6",
        documented: { kind: "series", values: [15, 6, 3], decimals: 0, unit: "steps" },
        compute: (c) => {
          const rows = stepRows(c).filter((r) => r.variant_id === "nominal");
          if (rows.length === 0) return null;
          return ["slow", "not_within_horizon", "fast"].map((cls) => rows.filter((r) => r.class === cls).length);
        },
      },
      {
        id: "centerSettling",
        section: "9.6",
        documented: { kind: "range", low: 179, high: 181, decimals: 0, unit: "s" },
        compute: (c) => numbersOf(stepRows(c).filter((r) => r.variant_id === SIMC_VARIANT && r.scenario_id === "center"), "settling_s"),
      },
      {
        // The report quotes one number, the largest of the three seeds.
        id: "piSaturationMax",
        section: "9.6",
        documented: { kind: "range", low: 0.204, high: 0.204, decimals: 3, unit: "fraction of the step window" },
        compute: (c) => {
          const values = numbersOf(stepRows(c).filter((r) => r.variant_id === SIMC_VARIANT && String(r.scenario_id).startsWith("pi_1p5")), "fraction_saturated");
          return values.length === 0 ? null : [Math.max(...values)];
        },
      },
      {
        // "saturated on every seed": above the frozen 0.20 criterion each time.
        id: "piSaturationEverySeed",
        section: "9.6",
        documented: { kind: "range", low: 0.201, high: 1, decimals: 3, unit: "fraction of the step window" },
        compute: (c) => numbersOf(stepRows(c).filter((r) => r.variant_id === SIMC_VARIANT && String(r.scenario_id).startsWith("pi_1p5")), "fraction_saturated"),
      },
      {
        id: "piSettling",
        section: "9.6",
        documented: { kind: "range", low: 165, high: 167, decimals: 0, unit: "s" },
        compute: (c) => numbersOf(stepRows(c).filter((r) => r.variant_id === SIMC_VARIANT && String(r.scenario_id).startsWith("pi_1p5")), "settling_s"),
      },
      {
        id: "piOpening",
        section: "9.6",
        documented: { kind: "range", low: 0.3, high: 0.8, decimals: 1, unit: "%" },
        compute: (c) => numbersOf(runRows(c).filter((r) => String(r.scenario_id).startsWith("pi_1p5")), "water_valve_mean_pct"),
      },
      {
        id: "replayCenterSettling",
        section: "9.6",
        documented: { kind: "range", low: 179, high: 181, decimals: 0, unit: "s" },
        compute: (c) => {
          const step = steps(c.replays.get(LIC103.centerSimc))[0];
          return step && typeof step.settling_s === "number" ? [step.settling_s] : null;
        },
      },
    ],
  },

  "c2-lcv102-actuator-lag": {
    id: "c2-lcv102-actuator-lag",
    campaign: "C2",
    stage: "exploratory",
    seeds: 1,
    focusLoop: "oil",
    campaignSummaryId: C2_LAG,
    comparisons: [
      {
        id: "high_rate",
        scenarioId: "high_rate-000",
        seed: 7100,
        anchor: { kind: "phase", phase: "hold" },
        runs: [
          { replayId: LAG.m6b, controller: "m6b" },
          { replayId: LAG.c2simc, controller: "c2simc" },
        ],
      },
    ],
    charts: ["total", "valve-oil", "interface", "pressure", "events"],
    sources: [{ path: GUIDE, section: "9.7", access: "private" }],
    relatedLessons: ["systematic-tuning", "integral-action-and-windup"],
    claims: [
      {
        id: "m6bExit",
        section: "9.7",
        documented: { kind: "range", low: 12415, high: 12415, decimals: 0, unit: "s from the hold start" },
        compute: (c) => {
          const value = hold(c.replays.get(LAG.m6b))?.first_exit_s;
          return typeof value === "number" ? [value] : null;
        },
      },
      {
        id: "c2simcSustains",
        section: "9.7",
        documented: { kind: "class", value: "sustains" },
        compute: (c) => {
          const metrics = hold(c.replays.get(LAG.c2simc));
          return metrics && metrics.observed_s >= 14400 ? metrics.class : null;
        },
      },
      {
        id: "m6bWindows",
        section: "9.7",
        documented: { kind: "series", values: [0.29, 1.07, 2.26, 5.41], decimals: 2, unit: "% p2p" },
        compute: (c) => holdWindowP2P(c.replays.get(LAG.m6b), LAG_WINDOWS),
      },
      {
        id: "c2simcWindows",
        section: "9.7",
        documented: { kind: "series", values: [0.28, 0.64, 0.34, 0.32], decimals: 2, unit: "% p2p" },
        compute: (c) => holdWindowP2P(c.replays.get(LAG.c2simc), LAG_WINDOWS),
      },
    ],
  },

  "c2-lcv102-stiction": {
    id: "c2-lcv102-stiction",
    campaign: "C2",
    stage: "exploratory",
    seeds: 1,
    focusLoop: "oil",
    campaignSummaryId: C2_ROBUST_E,
    comparisons: [
      {
        id: "center",
        scenarioId: "center",
        seed: 7100,
        anchor: { kind: "phase", phase: "hold" },
        runs: [
          { replayId: STICK.deployed, controller: "deployed" },
          { replayId: STICK.m6b, controller: "m6b" },
          { replayId: STICK.c2simc, controller: "c2simc" },
        ],
      },
    ],
    charts: ["total", "valve-oil", "interface", "pressure", "events"],
    sources: [
      { path: GUIDE, section: "9.7", access: "private" },
      { path: GUIDE, section: "9.5", access: "private" },
    ],
    relatedLessons: ["integral-action-and-windup", "level-and-proportional-action"],
    claims: [
      {
        id: "deployedLosesBand",
        section: "9.7",
        documented: { kind: "class", value: "loses_band" },
        compute: (c) => hold(c.replays.get(STICK.deployed))?.class ?? null,
      },
      {
        id: "deployedP2P",
        section: "9.7",
        documented: { kind: "range", low: 4.0, high: 4.2, decimals: 1, unit: "% p2p" },
        compute: (c) => {
          const value = secondHalfP2P(c.replays.get(STICK.deployed));
          return value === null ? null : [value];
        },
      },
      {
        id: "m6bP2P",
        section: "9.7",
        documented: { kind: "range", low: 2.5, high: 2.6, decimals: 1, unit: "% p2p" },
        compute: (c) => {
          const value = secondHalfP2P(c.replays.get(STICK.m6b));
          return value === null ? null : [value];
        },
      },
      {
        id: "c2simcP2P",
        section: "9.7",
        documented: { kind: "range", low: 0.6, high: 1.0, decimals: 1, unit: "% p2p" },
        compute: (c) => {
          const value = secondHalfP2P(c.replays.get(STICK.c2simc));
          return value === null ? null : [value];
        },
      },
      {
        id: "c2simcTravel",
        section: "9.7",
        documented: { kind: "range", low: 0, high: 240, decimals: 0, unit: "%/h" },
        compute: (c) => {
          const value = hold(c.replays.get(STICK.c2simc))?.loops?.oil?.output_travel_pct_per_h;
          return typeof value === "number" ? [value] : null;
        },
      },
    ],
  },
};

export const EXPERIMENT_IDS = Object.keys(EXPERIMENTS) as ExperimentId[];

export const isExperimentId = (value: string): value is ExperimentId => Object.hasOwn(EXPERIMENTS, value);

export function experimentReplayIds(experiment: ExperimentDefinition): string[] {
  return [...new Set(experiment.comparisons.flatMap((set) => set.runs.map((run) => run.replayId)))];
}

/* ------------------------------ envelope ------------------------------ */

const dominantCount = (constraint: string) => (c: ClaimContext) => {
  const points = c.envelope?.points;
  return points ? [points.filter((p) => p.dominantConstraint === constraint).length] : null;
};

export const ENVELOPE_CLAIMS: ClaimDefinition[] = [
  {
    id: "outcomes",
    section: "11",
    documented: { kind: "series", values: [9, 29, 1, 1, 0], decimals: 0, unit: "runs" },
    compute: (c) => {
      const points = c.envelope?.points;
      if (!points) return null;
      return ["marginal", "inadmissible", "inconclusive", "outside_model", "admissible"].map(
        (outcome) => points.filter((p) => p.outcome === outcome).length,
      );
    },
  },
  { id: "erosion", section: "11", documented: { kind: "range", low: 14, high: 14, decimals: 0, unit: "runs" }, compute: dominantCount("P.flowline_erosion") },
  { id: "gasRangeability", section: "11", documented: { kind: "range", low: 9, high: 9, decimals: 0, unit: "runs" }, compute: dominantCount("P.valve_rangeability.gas") },
  { id: "noFlow", section: "11", documented: { kind: "range", low: 3, high: 3, decimals: 0, unit: "runs" }, compute: dominantCount("P.no_flow") },
  { id: "oilTracking", section: "11", documented: { kind: "range", low: 2, high: 2, decimals: 0, unit: "runs" }, compute: dominantCount("C.tracking.oil") },
];

export const ENVELOPE_SOURCES: DocReference[] = [
  { path: ENVELOPE_GUIDE, section: "11", access: "private" },
  { path: ENVELOPE_GUIDE, section: "5", access: "private" },
];

/** Frontiers the report states, each with the constraint behind it. Text in the messages. */
export const DOCUMENTED_FRONTIERS = [
  { id: "erosion", constraint: "P.flowline_erosion" },
  { id: "gasRangeability", constraint: "P.valve_rangeability.gas" },
  { id: "waterRangeability", constraint: "P.valve_rangeability.water" },
  { id: "noFlow", constraint: "P.no_flow" },
  { id: "oilTracking", constraint: "C.tracking.oil" },
  { id: "model", constraint: "V.unsupported_regime" },
] as const;

/* ------------------------------ catalogue ----------------------------- */

export type Availability = "loaded" | "pending" | "not_publishable";

export interface CatalogueEntry {
  id: CatalogueEntryId;
  kind: "experiment" | "envelope" | "placeholder";
  /** Fixed availability for placeholders; computed from the index otherwise. */
  availability?: Exclude<Availability, "loaded">;
}

export const CATALOGUE: CatalogueEntry[] = [
  { id: "c2-lic103-simc", kind: "experiment" },
  { id: "c2-lcv102-actuator-lag", kind: "experiment" },
  { id: "c2-lcv102-stiction", kind: "experiment" },
  { id: "operating-envelope", kind: "envelope" },
  { id: "campaign-d-trajectories", kind: "placeholder", availability: "pending" },
  { id: "field-calibrated-cases", kind: "placeholder", availability: "not_publishable" },
];
