import { interpolationOf, type Phase, type SignalKey } from "@/lib/research/contract";
import type { Replay } from "@/lib/research/decode";

/**
 * Reading a recorded run at an arbitrary instant.
 *
 * Playback runs at any speed, so the requested time usually falls between two
 * recorded ticks. What is shown there is decided per signal, never by the
 * renderer:
 *
 * - `observed`: the instant is a recorded tick; the value is the recorded one.
 * - `interpolated`: a continuous physical state between two finite recorded
 *   values, drawn on the straight line between them.
 * - `held`: a register, command, setpoint, code or alarm between ticks; it keeps
 *   the last recorded value (zero-order hold), as a sampled register does.
 * - `missing`: outside the recording, or a gap in the data. No value is made up.
 *
 * Nothing here alters the stored arrays, and playback speed only changes which
 * instants are asked for.
 */

export type SampleProvenance = "observed" | "interpolated" | "held" | "missing";

export interface Sample {
  value: number;
  provenance: SampleProvenance;
}

export interface Location {
  /** Index of the recorded tick at or before the instant (clamped). */
  i0: number;
  /** Index of the next recorded tick (equal to i0 on a tick or at the end). */
  i1: number;
  /** Position between the two ticks, 0..1. */
  fraction: number;
  observed: boolean;
  inRange: boolean;
}

const EPSILON_S = 1e-6;

export function locate(replay: Pick<Replay, "startS" | "endS" | "dtS" | "count">, tS: number): Location {
  if (!Number.isFinite(tS) || tS < replay.startS - EPSILON_S || tS > replay.endS + EPSILON_S) {
    const edge = tS < replay.startS ? 0 : replay.count - 1;
    return { i0: edge, i1: edge, fraction: 0, observed: false, inRange: false };
  }
  const position = (tS - replay.startS) / replay.dtS;
  const nearest = Math.round(position);
  if (Math.abs(position - nearest) * replay.dtS <= EPSILON_S) {
    const index = Math.min(replay.count - 1, Math.max(0, nearest));
    return { i0: index, i1: index, fraction: 0, observed: true, inRange: true };
  }
  const i0 = Math.min(replay.count - 1, Math.max(0, Math.floor(position)));
  const i1 = Math.min(replay.count - 1, i0 + 1);
  return { i0, i1, fraction: position - i0, observed: false, inRange: true };
}

export function sampleAt(replay: Replay, key: SignalKey, location: Location): Sample {
  const signal = replay.signals.get(key);
  if (!signal || !location.inRange) return { value: Number.NaN, provenance: "missing" };
  const a = signal.data[location.i0];
  if (location.observed || location.i0 === location.i1) {
    return Number.isNaN(a) ? { value: Number.NaN, provenance: "missing" } : { value: a, provenance: "observed" };
  }
  if (interpolationOf(key) === "hold") {
    return Number.isNaN(a) ? { value: Number.NaN, provenance: "missing" } : { value: a, provenance: "held" };
  }
  const b = signal.data[location.i1];
  // Never draw a line across a gap: both ends must be recorded values.
  if (Number.isNaN(a) || Number.isNaN(b)) return { value: Number.NaN, provenance: "missing" };
  return { value: a + (b - a) * location.fraction, provenance: "interpolated" };
}

export function sampleSignal(replay: Replay, key: SignalKey, tS: number): Sample {
  return sampleAt(replay, key, locate(replay, tS));
}

export interface Frame {
  tS: number;
  location: Location;
  /** `observed` on a tick, `interpolated` between ticks, `missing` outside the run. */
  provenance: "observed" | "interpolated" | "missing";
  samples: Partial<Record<SignalKey, Sample>>;
  phase: string | null;
}

/** The phase of the tick at or before `tS` (a phase owns the interval up to its next tick). */
export function phaseAt(phases: readonly Phase[], tS: number, dtS = 1): string | null {
  for (const phase of phases) {
    if (tS >= phase.startS - EPSILON_S && tS < phase.endS + dtS - EPSILON_S) return phase.name;
  }
  return null;
}

export function frameAt(replay: Replay, tS: number, keys: readonly SignalKey[]): Frame {
  const location = locate(replay, tS);
  const samples: Partial<Record<SignalKey, Sample>> = {};
  for (const key of keys) samples[key] = sampleAt(replay, key, location);
  return {
    tS,
    location,
    provenance: !location.inRange ? "missing" : location.observed ? "observed" : "interpolated",
    samples,
    phase: location.inRange ? phaseAt(replay.phases, tS, replay.dtS) : null,
  };
}

/** Recorded values of one signal in a closed time window (no interpolation). */
export function windowValues(replay: Replay, key: SignalKey, fromS: number, toS: number): Float64Array {
  const signal = replay.signals.get(key);
  if (!signal) return new Float64Array(0);
  const first = Math.max(0, Math.ceil((fromS - replay.startS) / replay.dtS - EPSILON_S));
  const last = Math.min(replay.count - 1, Math.floor((toS - replay.startS) / replay.dtS + EPSILON_S));
  return last < first ? new Float64Array(0) : signal.data.subarray(first, last + 1);
}

export function peakToPeak(values: Float64Array): number {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (Number.isNaN(value)) continue;
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  return Number.isFinite(minimum) ? maximum - minimum : Number.NaN;
}

export function meanOf(values: Float64Array): number {
  let sum = 0;
  let n = 0;
  for (const value of values) {
    if (Number.isNaN(value)) continue;
    sum += value;
    n += 1;
  }
  return n === 0 ? Number.NaN : sum / n;
}

export function phaseByName(replay: Pick<Replay, "phases">, name: string): Phase | undefined {
  return replay.phases.find((phase) => phase.name === name);
}

/**
 * eng_dacs reports phase-relative seconds (first_exit_s, settling_s) from the
 * tick before the phase's first tick; this is that origin in run time.
 */
export function phaseOriginS(replay: Pick<Replay, "phases" | "dtS">, name: string): number | null {
  const phase = phaseByName(replay, name);
  return phase ? phase.startS - replay.dtS : null;
}
