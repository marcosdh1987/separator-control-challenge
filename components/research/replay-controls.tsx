"use client";

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import type { KeyboardEvent } from "react";

import { useMessages } from "@/lib/i18n/provider";
import { formatClock } from "@/lib/research/format";
import { PLAYBACK_SPEEDS, STOP_LEAD_S, type PlaybackAction, type PlaybackState, type StopPoint } from "@/lib/research/playback";

export interface TimelineMarker {
  id: string;
  tS: number;
  label: string;
  severity: "info" | "warning" | "critical";
  color: string;
}

interface ReplayControlsProps {
  state: PlaybackState;
  dispatch: (action: PlaybackAction) => void;
  markers: TimelineMarker[];
  stops: StopPoint[];
  anchorPhase: string;
}

export function ReplayControls({ state, dispatch, markers, stops, anchorPhase }: ReplayControlsProps) {
  const copy = useMessages().research.player;
  const span = state.maxS - state.minS;
  const pct = (t: number) => `${(((t - state.minS) / span) * 100).toFixed(3)}%`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    // Space keeps its native meaning on anything interactive (buttons, inputs,
    // the events disclosure, selects, links); elsewhere in the group it toggles.
    const interactive = ["BUTTON", "INPUT", "SUMMARY", "SELECT", "A", "TEXTAREA"].includes(target.tagName);
    if (event.key === " " && !interactive) {
      event.preventDefault();
      dispatch({ type: "toggle" });
    }
  };

  return (
    <div aria-label={copy.seek} className="research-controls" onKeyDown={onKeyDown} role="group">
      <div className="research-controls-row">
        <button
          aria-label={state.playing ? copy.pause : copy.play}
          className="primary-button research-play"
          onClick={() => dispatch({ type: "toggle" })}
          type="button"
        >
          {state.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{state.playing ? copy.pause : copy.play}</span>
        </button>
        <button className="secondary-button" onClick={() => dispatch({ type: "reset" })} type="button">
          <RotateCcw aria-hidden="true" /> {copy.reset}
        </button>
        <fieldset className="research-speeds">
          <legend>{copy.speed}</legend>
          {PLAYBACK_SPEEDS.map((speed) => (
            <button
              aria-pressed={state.speed === speed}
              className="research-speed"
              key={speed}
              onClick={() => dispatch({ type: "speed", speed })}
              type="button"
            >
              {copy.speedOption(speed)}
            </button>
          ))}
        </fieldset>
        <label className="research-toggle">
          <input
            checked={state.stopBeforeEvents}
            onChange={(event) => dispatch({ type: "stops", enabled: event.target.checked })}
            type="checkbox"
          />
          {copy.stopBefore}
        </label>
      </div>

      <div className="research-timeline">
        <div aria-hidden="true" className="research-timeline-markers">
          {markers.map((marker) => (
            <span className={`research-timeline-marker is-${marker.severity}`} key={marker.id} style={{ left: pct(marker.tS), background: marker.color }} title={marker.label} />
          ))}
        </div>
        <input
          aria-label={copy.seek}
          aria-valuetext={`${formatClock(state.tS)} (${copy.relativeTo(anchorPhase)})`}
          className="research-slider"
          max={state.maxS}
          min={state.minS}
          onChange={(event) => dispatch({ type: "seek", tS: Number(event.target.value) })}
          step={1}
          type="range"
          value={state.tS}
        />
        <div className="research-time-readout">
          <span>
            <strong>{copy.time}</strong> <output data-testid="research-time">{formatClock(state.tS)}</output>
            <small> {copy.relativeTo(anchorPhase)}</small>
          </span>
          <span><strong>{copy.duration}</strong> {formatClock(state.minS)} … {formatClock(state.maxS)}</span>
        </div>
      </div>

      <p className="research-note">{copy.speedNote} {copy.keyboardHint}</p>

      {/* Mounted once so screen readers announce the text when it appears. */}
      <p aria-live="polite" className={state.pausedBefore ? "research-paused" : "sr-only"} role="status">
        {state.pausedBefore ? copy.pausedBefore(state.pausedBefore.label) : ""}
      </p>

      <details className="research-events">
        <summary>{copy.events} ({stops.length})</summary>
        {stops.length === 0 ? <p>{copy.noEvents}</p> : (
          <ul>
            {stops.map((stop) => (
              <li key={stop.id}>
                <button className="research-link-button" onClick={() => dispatch({ type: "seek", tS: stop.tS - STOP_LEAD_S })} type="button">
                  <SkipForward aria-hidden="true" /> {formatClock(stop.tS)} · {copy.jumpBefore(stop.label)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
