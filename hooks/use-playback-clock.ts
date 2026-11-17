"use client";

import { useEffect, useReducer, useRef } from "react";

import {
  createPlayback,
  playbackReducer,
  type PlaybackAction,
  type PlaybackState,
  type StopPoint,
} from "@/lib/research/playback";

/**
 * Drives the pure playback reducer from `requestAnimationFrame`. The frame
 * loop is the external system; the clock arithmetic lives in the reducer so it
 * can be tested without a browser. Wall time per frame is capped so a
 * backgrounded tab does not jump the recording forward in one leap.
 */
const MAX_WALL_STEP_S = 0.25;

export function usePlaybackClock(minS: number, maxS: number, initialS: number, stops: readonly StopPoint[]) {
  const [state, dispatch] = useReducer(playbackReducer, undefined, () => createPlayback(minS, maxS, initialS));
  const stopsRef = useRef(stops);

  // The range is fixed for the life of the hook: callers remount it (with a
  // `key`) when the comparison or its alignment changes.
  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  useEffect(() => {
    if (!state.playing) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const wallDtS = Math.min(MAX_WALL_STEP_S, (now - last) / 1000);
      last = now;
      dispatch({ type: "tick", wallDtS, stops: stopsRef.current });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [state.playing]);

  return [state, dispatch] as [PlaybackState, (action: PlaybackAction) => void];
}
