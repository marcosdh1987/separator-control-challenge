import type { ReplayEvent } from "@/lib/research/contract";

/**
 * The playback clock, as a pure reducer.
 *
 * Time here is the comparison axis (seconds from the alignment anchor). Speed
 * only scales how fast this clock advances against the wall clock; it never
 * touches the recorded data, which is read at whatever instant the clock
 * reaches.
 */

export const PLAYBACK_SPEEDS = [1, 5, 20, 50] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

/** How far ahead of a stop point the clock pauses, in simulated seconds. */
export const STOP_LEAD_S = 30;

export interface StopPoint {
  id: string;
  /** Comparison-axis time of the event. */
  tS: number;
  label: string;
}

export interface PlaybackState {
  tS: number;
  minS: number;
  maxS: number;
  playing: boolean;
  speed: PlaybackSpeed;
  stopBeforeEvents: boolean;
  /** The stop point the clock last paused in front of, if any. */
  pausedBefore: StopPoint | null;
}

export type PlaybackAction =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle" }
  | { type: "reset" }
  | { type: "seek"; tS: number }
  | { type: "speed"; speed: PlaybackSpeed }
  | { type: "stops"; enabled: boolean }
  | { type: "range"; minS: number; maxS: number; tS?: number }
  | { type: "tick"; wallDtS: number; stops: readonly StopPoint[] };

export function createPlayback(minS: number, maxS: number, tS = minS): PlaybackState {
  return {
    tS: clamp(tS, minS, maxS),
    minS,
    maxS,
    playing: false,
    speed: 5,
    stopBeforeEvents: true,
    pausedBefore: null,
  };
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** The first stop point whose pause instant lies in (from, to]. */
export function nextStop(stops: readonly StopPoint[], fromS: number, toS: number, leadS = STOP_LEAD_S): StopPoint | null {
  let best: StopPoint | null = null;
  for (const stop of stops) {
    const pauseAt = stop.tS - leadS;
    if (pauseAt > fromS && pauseAt <= toS && (best === null || stop.tS < best.tS)) best = stop;
  }
  return best;
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "play":
      // Playing from the very end restarts, as a media player does.
      return { ...state, playing: true, pausedBefore: null, tS: state.tS >= state.maxS ? state.minS : state.tS };
    case "pause":
      return { ...state, playing: false };
    case "toggle":
      return playbackReducer(state, { type: state.playing ? "pause" : "play" });
    case "reset":
      return { ...state, tS: state.minS, playing: false, pausedBefore: null };
    case "seek":
      return { ...state, tS: clamp(action.tS, state.minS, state.maxS), pausedBefore: null };
    case "speed":
      return { ...state, speed: action.speed };
    case "stops":
      return { ...state, stopBeforeEvents: action.enabled };
    case "range":
      return {
        ...state,
        minS: action.minS,
        maxS: action.maxS,
        tS: clamp(action.tS ?? state.tS, action.minS, action.maxS),
        playing: false,
        pausedBefore: null,
      };
    case "tick": {
      if (!state.playing || !(action.wallDtS > 0)) return state;
      const target = state.tS + action.wallDtS * state.speed;
      if (state.stopBeforeEvents) {
        const stop = nextStop(action.stops, state.tS, Math.min(target, state.maxS));
        if (stop) {
          return { ...state, tS: clamp(stop.tS - STOP_LEAD_S, state.minS, state.maxS), playing: false, pausedBefore: stop };
        }
      }
      if (target >= state.maxS) return { ...state, tS: state.maxS, playing: false };
      return { ...state, tS: target };
    }
    default:
      return state;
  }
}

/** Events worth stopping in front of: failures, trips, alarms, faults, lost wells. */
export function isStopEvent(event: ReplayEvent): boolean {
  if (event.kind === "band_exit" || event.kind === "trip" || event.kind === "oil_pad_lost") return true;
  if (event.kind === "alarm_on" || event.kind === "fault") return true;
  return event.kind === "well_state" && event.detail.to === "NO_FLOW";
}

/** Wall-clock seconds the remaining run takes at a speed (for display). */
export function remainingWallS(state: PlaybackState): number {
  return (state.maxS - state.tS) / state.speed;
}
