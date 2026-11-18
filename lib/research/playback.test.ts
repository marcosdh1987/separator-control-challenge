import { describe, expect, it } from "vitest";

import type { ReplayEvent } from "@/lib/research/contract";
import {
  createPlayback,
  isStopEvent,
  nextStop,
  PLAYBACK_SPEEDS,
  playbackReducer,
  STOP_LEAD_S,
  type StopPoint,
} from "@/lib/research/playback";

const stops: StopPoint[] = [{ id: "exit", tS: 1000, label: "band exit" }];

describe("playback clock", () => {
  it("offers exactly the four speeds", () => {
    expect([...PLAYBACK_SPEEDS]).toEqual([1, 5, 20, 50]);
  });

  it("advances by wall time multiplied by the speed", () => {
    let state = playbackReducer(createPlayback(0, 5000), { type: "play" });
    state = playbackReducer(state, { type: "speed", speed: 20 });
    state = playbackReducer(state, { type: "tick", wallDtS: 0.5, stops: [] });
    expect(state.tS).toBe(10);
  });

  it("does nothing while paused", () => {
    const state = createPlayback(0, 100);
    expect(playbackReducer(state, { type: "tick", wallDtS: 1, stops })).toBe(state);
  });

  it("pauses 30 simulated seconds before a stop point, at any speed", () => {
    for (const speed of PLAYBACK_SPEEDS) {
      let state = playbackReducer({ ...createPlayback(0, 5000, 900), speed }, { type: "play" });
      for (let i = 0; i < 1000 && state.playing; i += 1) state = playbackReducer(state, { type: "tick", wallDtS: 0.7, stops });
      expect(state.tS).toBe(1000 - STOP_LEAD_S);
      expect(state.playing).toBe(false);
      expect(state.pausedBefore?.id).toBe("exit");
    }
  });

  it("resumes past the stop point instead of pausing on it again", () => {
    let state = playbackReducer(createPlayback(0, 5000, 1000 - STOP_LEAD_S), { type: "play" });
    state = playbackReducer(state, { type: "tick", wallDtS: 1, stops });
    expect(state.playing).toBe(true);
    expect(state.tS).toBeGreaterThan(1000 - STOP_LEAD_S);
  });

  it("can play straight through when stops are disabled", () => {
    let state = playbackReducer(createPlayback(0, 5000, 960), { type: "stops", enabled: false });
    state = playbackReducer(state, { type: "play" });
    state = playbackReducer(state, { type: "tick", wallDtS: 10, stops });
    expect(state.tS).toBe(1010);
  });

  it("stops at the end and restarts from the beginning on play", () => {
    let state = playbackReducer(createPlayback(-100, 100, 90), { type: "play" });
    state = playbackReducer({ ...state, speed: 50 }, { type: "tick", wallDtS: 1, stops: [] });
    expect(state).toMatchObject({ tS: 100, playing: false });
    expect(playbackReducer(state, { type: "play" }).tS).toBe(-100);
  });

  it("clamps seeks and resets to the start", () => {
    const state = createPlayback(-50, 50);
    expect(playbackReducer(state, { type: "seek", tS: 999 }).tS).toBe(50);
    expect(playbackReducer(state, { type: "seek", tS: -999 }).tS).toBe(-50);
    expect(playbackReducer({ ...state, tS: 20, playing: true }, { type: "reset" })).toMatchObject({ tS: -50, playing: false });
  });

  it("finds the earliest stop whose pause instant lies ahead", () => {
    const many: StopPoint[] = [
      { id: "b", tS: 300, label: "b" },
      { id: "a", tS: 200, label: "a" },
    ];
    expect(nextStop(many, 0, 1000)?.id).toBe("a");
    expect(nextStop(many, 170, 1000)?.id).toBe("b");
    expect(nextStop(many, 0, 100)).toBeNull();
  });

  it("stops before failures, alarms, faults and lost wells, not before routine events", () => {
    const event = (kind: ReplayEvent["kind"], detail: Record<string, unknown> = {}): ReplayEvent => ({
      id: kind, tS: 0, kind, severity: "info", origin: "recorded", source: "t", detail,
    });
    expect(isStopEvent(event("band_exit"))).toBe(true);
    expect(isStopEvent(event("trip"))).toBe(true);
    expect(isStopEvent(event("fault"))).toBe(true);
    expect(isStopEvent(event("well_state", { to: "NO_FLOW" }))).toBe(true);
    expect(isStopEvent(event("well_state", { to: "CONVERGED" }))).toBe(false);
    expect(isStopEvent(event("command"))).toBe(false);
    expect(isStopEvent(event("setpoint_change"))).toBe(false);
  });
});
