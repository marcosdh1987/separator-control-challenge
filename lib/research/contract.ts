/**
 * ResearchReplayV1 and companion documents, as the browser reads them.
 *
 * The producer is the offline exporter in
 * `src/separator_control_challenge/research_export/` (Python). Both sides
 * implement the same rules; `contract.test.ts` checks that the signal table
 * here matches the Python one, and `published.test.ts` validates every
 * committed bundle with this module.
 *
 * These documents come from eng_dacs, a different simulator. Nothing here
 * touches the educational engine in `lib/simulation`.
 */

export const SCHEMA_REPLAY = "scc.research-replay";
export const SCHEMA_CAMPAIGN = "scc.research-campaign-summary";
export const SCHEMA_ENVELOPE = "scc.research-envelope-map";
export const SCHEMA_INDEX = "scc.research-index";
export const SCHEMA_VERSION = 1;

export type SignalRole = "continuous" | "discrete";
export type LoopId = "gas" | "oil" | "water";

export interface SignalSpec {
  column: string;
  role: SignalRole;
  group: string;
  loop?: LoopId;
}

/**
 * Only `continuous` signals (physical states of the plant model) may be
 * interpolated; every register, command, setpoint, mode, code and alarm is held.
 */
export const SIGNAL_SPECS = {
  "pressure.truth": { column: "separator_pressure_truth_bar", role: "continuous", group: "pressure", loop: "gas" },
  "level.total.truth": { column: "total_level_truth_pct", role: "continuous", group: "level", loop: "oil" },
  "level.interface.truth": { column: "interface_level_truth_pct", role: "continuous", group: "level", loop: "water" },
  "flow.inlet_liquid.truth": { column: "inlet_liquid_truth_m3_h", role: "continuous", group: "flow" },
  "flow.oil.truth": { column: "oil_flow_truth_m3_h", role: "continuous", group: "flow", loop: "oil" },
  "flow.water.truth": { column: "water_flow_truth_m3_h", role: "continuous", group: "flow", loop: "water" },
  "flow.gas_std.truth": { column: "gas_std_flow_truth_sm3_h", role: "continuous", group: "flow", loop: "gas" },
  "pressure.measured": { column: "separator_pressure_meas_bar", role: "discrete", group: "measured", loop: "gas" },
  "level.total.measured": { column: "total_level_meas_pct", role: "discrete", group: "measured", loop: "oil" },
  "level.interface.measured": { column: "interface_level_meas_pct", role: "discrete", group: "measured", loop: "water" },
  "loop.gas.pv": { column: "gas_loop_pv", role: "discrete", group: "loop", loop: "gas" },
  "loop.oil.pv": { column: "oil_loop_pv", role: "discrete", group: "loop", loop: "oil" },
  "loop.water.pv": { column: "water_loop_pv", role: "discrete", group: "loop", loop: "water" },
  "loop.gas.sp": { column: "gas_loop_sp", role: "discrete", group: "setpoint", loop: "gas" },
  "loop.oil.sp": { column: "oil_loop_sp", role: "discrete", group: "setpoint", loop: "oil" },
  "loop.water.sp": { column: "water_loop_sp", role: "discrete", group: "setpoint", loop: "water" },
  "loop.gas.mode": { column: "gas_loop_mode", role: "discrete", group: "mode", loop: "gas" },
  "loop.oil.mode": { column: "oil_loop_mode", role: "discrete", group: "mode", loop: "oil" },
  "loop.water.mode": { column: "water_loop_mode", role: "discrete", group: "mode", loop: "water" },
  "valve.gas.command": { column: "gas_loop_output_pct", role: "discrete", group: "valve", loop: "gas" },
  "valve.oil.command": { column: "oil_loop_output_pct", role: "discrete", group: "valve", loop: "oil" },
  "valve.water.command": { column: "water_loop_output_pct", role: "discrete", group: "valve", loop: "water" },
  "valve.gas.stem": { column: "gas_valve_stem_pct", role: "discrete", group: "valve", loop: "gas" },
  "valve.oil.stem": { column: "oil_valve_stem_pct", role: "discrete", group: "valve", loop: "oil" },
  "valve.water.stem": { column: "water_valve_stem_pct", role: "discrete", group: "valve", loop: "water" },
  "plant.state": { column: "plant_state", role: "discrete", group: "plant" },
  "plant.shut_in_status": { column: "shut_in_status", role: "discrete", group: "plant" },
  "plant.trip_causes": { column: "trip_causes", role: "discrete", group: "plant" },
  "plant.first_out": { column: "first_out", role: "discrete", group: "plant" },
  "well.nodal_status": { column: "nodal_status", role: "discrete", group: "well" },
  "well.no_flow_reason": { column: "nodal_no_flow_reason", role: "discrete", group: "well" },
  "well.whp": { column: "whp_effective_bar", role: "discrete", group: "wellhead" },
  "choke.bean": { column: "bean_64th", role: "discrete", group: "choke" },
  "boundary.water_cut": { column: "water_cut_boundary_pct", role: "discrete", group: "boundary" },
  "boundary.gor": { column: "gor_boundary_sm3_sm3", role: "discrete", group: "boundary" },
  "alarm.pah": { column: "pah", role: "discrete", group: "alarm", loop: "gas" },
  "alarm.lah": { column: "lah", role: "discrete", group: "alarm", loop: "oil" },
  "alarm.high_water_level": { column: "high_water_level", role: "discrete", group: "alarm", loop: "water" },
  "alarm.oil_overflow": { column: "oil_overflow", role: "discrete", group: "alarm", loop: "oil" },
  "alarm.liquid_carryover": { column: "liquid_carryover", role: "discrete", group: "alarm" },
} as const satisfies Record<string, SignalSpec>;

export type SignalKey = keyof typeof SIGNAL_SPECS;
export const SIGNAL_KEYS = Object.keys(SIGNAL_SPECS) as SignalKey[];

export const isSignalKey = (value: unknown): value is SignalKey =>
  typeof value === "string" && Object.hasOwn(SIGNAL_SPECS, value);

export const interpolationOf = (key: SignalKey): "linear" | "hold" =>
  SIGNAL_SPECS[key].role === "continuous" ? "linear" : "hold";

export const ALARM_KEYS = SIGNAL_KEYS.filter((key) => SIGNAL_SPECS[key].group === "alarm");

export type NumberFormat = "f64" | "f32" | "int";
export type EventKind =
  | "command" | "fault" | "setpoint_change" | "alarm_on" | "alarm_off" | "trip"
  | "plant_state" | "well_state" | "band_exit" | "settled" | "oil_pad_lost";
export const EVENT_KINDS: readonly EventKind[] = [
  "command", "fault", "setpoint_change", "alarm_on", "alarm_off", "trip",
  "plant_state", "well_state", "band_exit", "settled", "oil_pad_lost",
];
export type EventOrigin = "recorded" | "evaluation";
export type Stage = "confirmatory" | "exploratory";

export interface ReplaySignalJson {
  key: SignalKey;
  originalName: string;
  unit: string;
  kind: string;
  source: string;
  description: string;
  /** "trace_columns.json" (copied) or "publication policy" (curated replacement). */
  descriptionSource?: string;
  role: SignalRole;
  interpolation: "linear" | "hold";
  group: string;
  loop: LoopId | null;
  numberFormat: NumberFormat;
  nullCount: number;
  digest: string;
  encoding: "dense" | "changes";
  values?: (number | null)[];
  changes?: [number, number | null][];
}

export interface DocReference {
  path: string;
  section: string | null;
  access: string;
}

export interface SourceBlock {
  simulator: string;
  simulatorDescription: string;
  repository: string;
  repositoryAccess: string;
  datasetId: string;
  campaignId: string;
  campaignDescription: string;
  datasetContractVersion: string;
  datasetGeneratedAt: string | null;
  gitSha: string;
  gitBranch: string | null;
  gitDirtyFileCount: number;
  configSha256Raw: string | null;
  configSha256Resolved: string | null;
  sourceCodeDigest: string | null;
  documentation: DocReference[];
  runDigest?: string;
  specHash?: string;
  traceFileSha256?: string | null;
  runRecordSha256?: string | null;
  reproductions?: { at: string | null; identical: boolean }[];
}

export interface EvidenceBlock {
  stage: Stage;
  stageDeclared: boolean;
  calibration: "synthetic_uncalibrated" | "calibrated";
  calibrationIds: string[];
  scenarioEvidence: string;
  modelUncertainties: string[];
  campaignSeeds: number[];
  frozenCriteriaSha256: string | null;
}

export interface ReplayEvent {
  id: string;
  tS: number;
  kind: EventKind;
  severity: "info" | "warning" | "critical";
  origin: EventOrigin;
  source: string;
  detail: Record<string, unknown>;
  verified?: boolean;
}

export interface Phase {
  name: string;
  startS: number;
  endS: number;
}

export interface VariantBlock {
  variantId: string | null;
  policy: string | null;
  params: Record<string, unknown>;
  basis: string | null;
  provenance: string | null;
  references: string[];
  modifiers: unknown[];
}

export interface HoldLoopMetrics {
  band: number;
  sp_ref: number;
  first_exit_s: number | null;
  pv_p2p_tail: number | null;
  output_travel_pct_per_h: number | null;
  in_band_fraction: number | null;
  max_abs_deviation: number | null;
  [key: string]: unknown;
}

export interface HoldMetrics {
  class: string;
  first_exit_s: number | null;
  first_exit_loop: LoopId | null;
  observed_s: number;
  planned_s: number;
  loops: Partial<Record<LoopId, HoldLoopMetrics>>;
  [key: string]: unknown;
}

export interface StepMetrics {
  loop: LoopId;
  class: string;
  reason: string;
  delta: number;
  settling_s: number | null;
  settling_band: number;
  overshoot_frac: number | null;
  fraction_saturated: number | null;
  window_s: number;
  iae: number | null;
  [key: string]: unknown;
}

export interface ResearchReplayV1 {
  schema: typeof SCHEMA_REPLAY;
  schemaVersion: 1;
  contractVersion: string;
  replayId: string;
  generatedAt: string;
  exporter: { name: string; version: string; policyId: string };
  source: SourceBlock;
  evidence: EvidenceBlock;
  run: {
    runId: string;
    scenarioId: string;
    variantId: string;
    seed: number;
    block: string | null;
    variant: VariantBlock;
    controller: {
      policy: string | null;
      params: Record<string, unknown> | null;
      valid: boolean | null;
      records: { loop: string | null; event: string | null; requested: unknown; running: unknown; accepted: boolean | null; tS: number | null }[];
    };
    setpointSteps: Record<string, unknown>[];
    factors: Record<string, number>;
    plantConstants: Record<string, number | string>;
    outcome: string | null;
    dominantConstraint: string | null;
    closestConstraint: string | null;
    closestUtilization: number | null;
    tripped: boolean;
  };
  instrumentation: Record<LoopId, { controller: string; valve: string; measurement: string }>;
  codeTables: Record<string, { source: string; codes?: Record<string, string>; bits?: Record<string, string> }>;
  time: {
    unit: "s";
    origin: string;
    sampleIntervalS: number;
    intervalSource: string;
    startS: number;
    endS: number;
    count: number;
  };
  phases: Phase[];
  events: ReplayEvent[];
  signals: ReplaySignalJson[];
  missingSignals: { key: string; originalName: string; reason: string }[];
  metrics: {
    control?: { hold?: HoldMetrics; steps?: StepMetrics[]; controller?: unknown; modifiers?: unknown[] };
    [group: string]: unknown;
  };
  metricsSource: string;
  constraints: { id: string; category: string; severity: string; value: number | null; threshold: number | null; utilization: number | null; attributed_to: string | null }[];
  criteria: { thresholds: Record<string, number>; controlCriteria: Record<string, unknown> | null; reportKind: string | null };
  privacy: { policyId: string; policySha256: string; withheld: { field: string; reason: string }[] };
  disclaimer: string;
}

export interface TableJson {
  columns: string[];
  units: Record<string, string>;
  rows: unknown[][];
}

export interface ResearchCampaignSummaryV1 {
  schema: typeof SCHEMA_CAMPAIGN;
  schemaVersion: 1;
  contractVersion: string;
  summaryId: string;
  generatedAt: string;
  source: SourceBlock;
  evidence: EvidenceBlock;
  variants: VariantBlock[];
  runs: TableJson;
  controlSteps?: TableJson;
  criteria: ResearchReplayV1["criteria"];
  privacy: ResearchReplayV1["privacy"];
  disclaimer: string;
}

export type EnvelopeOutcome = "outside_model" | "inadmissible" | "inconclusive" | "marginal" | "admissible";
export const ENVELOPE_OUTCOMES: readonly EnvelopeOutcome[] = [
  "outside_model", "inadmissible", "inconclusive", "marginal", "admissible",
];

export interface EnvelopeAxis {
  key: string;
  factor: string;
  kind: "factor" | "operating_point";
  unit: string;
  scale: "linear" | "log";
  designRange: [number | null, number | null] | null;
  provenance: string;
}

export interface EnvelopePoint {
  runId: string;
  scenarioId: string;
  block: string;
  values: Record<string, number | null>;
  outcome: EnvelopeOutcome;
  dominantConstraint: string | null;
  dominantCategory: string | null;
  closestConstraint: string | null;
  closestUtilization: number | null;
  activeConstraints: string[];
  nViolations: number;
  nWarnings: number;
  startupOutcome: string | null;
  digest: string;
  replayId: string | null;
}

export interface ResearchEnvelopeMapV1 {
  schema: typeof SCHEMA_ENVELOPE;
  schemaVersion: 1;
  contractVersion: string;
  mapId: string;
  generatedAt: string;
  source: SourceBlock;
  evidence: EvidenceBlock;
  axes: EnvelopeAxis[];
  points: EnvelopePoint[];
  outcomes: { id: EnvelopeOutcome; definition: string }[];
  /** Catalogue entries; their eng_dacs "basis" text is withheld by the policy. */
  constraints: { id: string; category: string; title: string; status: string }[];
  interpolation: string;
  criteria: ResearchReplayV1["criteria"];
  privacy: ResearchReplayV1["privacy"];
  disclaimer: string;
}

export interface IndexFile {
  id: string;
  type: "replay" | "campaign" | "envelope";
  path: string;
  bytes: number;
  sha256: string;
  datasetId: string;
  runId?: string;
  scenarioId?: string;
  variantId?: string;
  seed?: number;
  stage: Stage;
  durationS?: number;
  samples?: number;
  points?: number;
}

export interface ResearchIndex {
  schema: typeof SCHEMA_INDEX;
  schemaVersion: 1;
  contractVersion: string;
  generatedAt: string;
  policyId: string;
  policySha256: string;
  files: IndexFile[];
  pending: { id: string; type: string; reason: string }[];
  notPublishable: { id: string; reason: string }[];
}

/* ------------------------------------------------------------------ */
/* Validation: the same rules as contract.py, reported as messages.    */
/* ------------------------------------------------------------------ */

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const SHA256 = /^[0-9a-f]{64}$/;

function checkHeader(doc: Record<string, unknown>, schema: string, errors: string[]): void {
  if (doc.schema !== schema) errors.push(`schema must be ${schema}`);
  if (doc.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (String(doc.contractVersion ?? "").split(".")[0] !== String(SCHEMA_VERSION)) {
    errors.push("contractVersion major must match schemaVersion");
  }
  if (typeof doc.generatedAt !== "string") errors.push("generatedAt is required");
  if (typeof doc.disclaimer !== "string") errors.push("disclaimer is required");
}

function checkSource(source: unknown, errors: string[]): void {
  if (!isObject(source)) {
    errors.push("source must be an object");
    return;
  }
  for (const key of ["simulator", "datasetId", "campaignId", "gitSha"]) {
    if (typeof source[key] !== "string") errors.push(`source.${key} is required`);
  }
  for (const key of ["configSha256Raw", "sourceCodeDigest"]) {
    const value = source[key];
    if (!(value === null || value === undefined || (typeof value === "string" && SHA256.test(value)))) {
      errors.push(`source.${key} must be a SHA-256 hex digest`);
    }
  }
}

function checkEvidence(evidence: unknown, errors: string[]): void {
  if (!isObject(evidence)) {
    errors.push("evidence must be an object");
    return;
  }
  if (evidence.stage !== "confirmatory" && evidence.stage !== "exploratory") errors.push("evidence.stage is invalid");
  if (evidence.calibration !== "synthetic_uncalibrated" && evidence.calibration !== "calibrated") {
    errors.push("evidence.calibration is invalid");
  }
  const seeds = evidence.campaignSeeds;
  if (!Array.isArray(seeds) || !seeds.every((seed) => Number.isInteger(seed))) {
    errors.push("evidence.campaignSeeds must list integers");
  }
}

function checkSignal(signal: unknown, count: number, errors: string[]): void {
  if (!isObject(signal)) {
    errors.push("signal must be an object");
    return;
  }
  const key = String(signal.key);
  if (!isSignalKey(key)) {
    errors.push(`signal ${key}: unknown key`);
  } else {
    if (signal.originalName !== SIGNAL_SPECS[key].column) errors.push(`signal ${key}: originalName must be ${SIGNAL_SPECS[key].column}`);
    if (signal.interpolation !== interpolationOf(key)) errors.push(`signal ${key}: interpolation must be ${interpolationOf(key)}`);
    if (signal.role !== SIGNAL_SPECS[key].role) errors.push(`signal ${key}: role mismatch`);
  }
  for (const field of ["originalName", "unit", "kind", "source", "description"]) {
    if (typeof signal[field] !== "string") errors.push(`signal ${key}: ${field} required`);
  }
  if (!["f64", "f32", "int"].includes(String(signal.numberFormat))) errors.push(`signal ${key}: numberFormat invalid`);
  if (typeof signal.digest !== "string" || !signal.digest.startsWith("sha256:")) errors.push(`signal ${key}: digest required`);
  if (signal.encoding === "dense") {
    const values = signal.values;
    if (!Array.isArray(values) || values.length !== count) {
      errors.push(`signal ${key}: dense values must have ${count} entries`);
    } else if (!values.every((value) => value === null || isNumber(value))) {
      errors.push(`signal ${key}: values must be numbers or null`);
    }
  } else if (signal.encoding === "changes") {
    const changes = signal.changes;
    if (!Array.isArray(changes) || changes.length === 0) {
      errors.push(`signal ${key}: changes must be a non-empty list`);
      return;
    }
    const indices = changes.filter((c) => Array.isArray(c) && c.length === 2).map((c) => (c as unknown[])[0]);
    if (indices.length !== changes.length) errors.push(`signal ${key}: change = [index, value]`);
    if (indices[0] !== 0) errors.push(`signal ${key}: first change at 0`);
    for (let i = 1; i < indices.length; i += 1) {
      if (!((indices[i] as number) > (indices[i - 1] as number))) {
        errors.push(`signal ${key}: change indices must increase`);
        break;
      }
    }
    if (!indices.every((i) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < count)) {
      errors.push(`signal ${key}: change index out of range`);
    }
    if (!changes.every((c) => Array.isArray(c) && (c[1] === null || isNumber(c[1])))) {
      errors.push(`signal ${key}: values must be numbers or null`);
    }
  } else {
    errors.push(`signal ${key}: encoding must be dense or changes`);
  }
}

export function validateReplay(doc: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(doc)) return ["document must be an object"];
  checkHeader(doc, SCHEMA_REPLAY, errors);
  if (typeof doc.replayId !== "string") errors.push("replayId is required");
  checkSource(doc.source, errors);
  checkEvidence(doc.evidence, errors);
  const run = doc.run;
  if (isObject(run)) {
    for (const key of ["runId", "scenarioId", "variantId"]) {
      if (typeof run[key] !== "string") errors.push(`run.${key} is required`);
    }
    if (!Number.isInteger(run.seed)) errors.push("run.seed must be an integer");
  } else {
    errors.push("run must be an object");
  }
  const time = doc.time;
  let count = 0;
  if (isObject(time)) {
    count = Number(time.count ?? 0);
    if (time.unit !== "s") errors.push("time.unit must be s");
    if (!isNumber(time.sampleIntervalS) || time.sampleIntervalS <= 0) errors.push("time.sampleIntervalS must be positive");
    if (!(count > 1)) errors.push("time.count must be above 1");
    if (isNumber(time.startS) && isNumber(time.sampleIntervalS)) {
      const expected = time.startS + (count - 1) * time.sampleIntervalS;
      if (!isNumber(time.endS) || Math.abs(time.endS - expected) > 1e-9) {
        errors.push("time.endS must equal startS + (count - 1) x sampleIntervalS");
      }
    }
  } else {
    errors.push("time must be an object");
  }
  const phases = doc.phases;
  if (Array.isArray(phases) && phases.length > 0) {
    let previousEnd: number | null = null;
    for (const phase of phases) {
      if (!isObject(phase) || !isNumber(phase.startS) || !isNumber(phase.endS) || phase.endS < phase.startS) {
        errors.push(`phase ${isObject(phase) ? String(phase.name) : "?"}: invalid range`);
        continue;
      }
      if (previousEnd !== null && !(phase.startS > previousEnd)) errors.push(`phase ${String(phase.name)}: phases must not overlap`);
      previousEnd = phase.endS;
    }
  } else {
    errors.push("phases must be a non-empty list");
  }
  const events = Array.isArray(doc.events) ? doc.events : [];
  for (const event of events) {
    if (!isObject(event)) continue;
    if (!EVENT_KINDS.includes(event.kind as EventKind)) errors.push(`event kind ${String(event.kind)}`);
    if (event.origin !== "recorded" && event.origin !== "evaluation") errors.push(`event origin ${String(event.origin)}`);
    if (isObject(time) && !(isNumber(event.tS) && event.tS >= Number(time.startS) && event.tS <= Number(time.endS))) {
      errors.push(`event ${String(event.id)}: tS outside the recorded time`);
    }
  }
  const signals = doc.signals;
  if (Array.isArray(signals) && signals.length > 0) {
    const seen = new Set<string>();
    for (const signal of signals) {
      checkSignal(signal, count, errors);
      const key = isObject(signal) ? String(signal.key) : "";
      if (seen.has(key)) errors.push(`signal ${key}: duplicated`);
      seen.add(key);
    }
    const missing = Array.isArray(doc.missingSignals) ? doc.missingSignals : [];
    if (missing.some((m) => isObject(m) && seen.has(String(m.key)))) errors.push("a signal cannot be both present and missing");
  } else {
    errors.push("signals must be a non-empty list");
  }
  if (!isObject(doc.metrics)) errors.push("metrics must be an object");
  return errors;
}

export function validateCampaign(doc: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(doc)) return ["document must be an object"];
  checkHeader(doc, SCHEMA_CAMPAIGN, errors);
  checkSource(doc.source, errors);
  checkEvidence(doc.evidence, errors);
  for (const name of ["runs", "controlSteps"] as const) {
    const table = doc[name];
    if (table === undefined && name === "controlSteps") continue;
    if (!isObject(table) || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
      errors.push(`${name} must be a table`);
      continue;
    }
    const width = table.columns.length;
    if (!table.rows.every((row) => Array.isArray(row) && row.length === width)) errors.push(`${name} rows must match columns`);
  }
  return errors;
}

export function validateEnvelope(doc: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(doc)) return ["document must be an object"];
  checkHeader(doc, SCHEMA_ENVELOPE, errors);
  checkSource(doc.source, errors);
  checkEvidence(doc.evidence, errors);
  const axes = new Set((Array.isArray(doc.axes) ? doc.axes : []).map((axis) => (isObject(axis) ? String(axis.key) : "")));
  if (axes.size < 2) errors.push("an envelope map needs at least two axes");
  const points = doc.points;
  if (!Array.isArray(points) || points.length === 0) {
    errors.push("points must be a non-empty list");
    return errors;
  }
  for (const point of points) {
    if (!isObject(point)) continue;
    if (!ENVELOPE_OUTCOMES.includes(point.outcome as EnvelopeOutcome)) errors.push(`point ${String(point.runId)}: outcome`);
    const values = isObject(point.values) ? point.values : {};
    if (!Object.keys(values).every((key) => axes.has(key))) errors.push(`point ${String(point.runId)}: unknown axis`);
    if (!Object.values(values).every((value) => value === null || isNumber(value))) {
      errors.push(`point ${String(point.runId)}: axis values must be numbers or null`);
    }
  }
  return errors;
}

export function validateIndex(doc: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(doc)) return ["document must be an object"];
  if (doc.schema !== SCHEMA_INDEX) errors.push(`schema must be ${SCHEMA_INDEX}`);
  if (doc.schemaVersion !== SCHEMA_VERSION) errors.push(`schemaVersion must be ${SCHEMA_VERSION}`);
  if (!Array.isArray(doc.files)) errors.push("files must be a list");
  for (const file of Array.isArray(doc.files) ? doc.files : []) {
    if (!isObject(file) || typeof file.path !== "string" || typeof file.id !== "string") {
      errors.push("each file needs an id and a path");
    } else if (file.path.includes("..") || file.path.startsWith("/")) {
      errors.push(`file ${file.id}: path must stay inside the data folder`);
    }
  }
  if (!Array.isArray(doc.pending)) errors.push("pending must be a list");
  return errors;
}

export class ContractError extends Error {
  constructor(what: string, readonly errors: string[]) {
    super(`${what} violates the research contract: ${errors.slice(0, 5).join("; ")}`);
    this.name = "ContractError";
  }
}
