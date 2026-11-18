"use client";

import { useMemo } from "react";

import { TimeChart, type ChartLine, type ChartMarker, type ChartReadout, type ChartSeries } from "./time-chart";
import { useLocale, useMessages } from "@/lib/i18n/provider";
import type { AlignedRun } from "@/lib/research/alignment";
import { CONTROLLER_STYLE, type ChartId, type ControllerKey } from "@/lib/research/catalog";
import type { SignalKey } from "@/lib/research/contract";
import type { Replay } from "@/lib/research/decode";
import { decimateMinMax, toSteps } from "@/lib/research/decimate";
import { describeEvent } from "@/lib/research/describe";
import { formatClock, formatNumber } from "@/lib/research/format";
import { sampleSignal } from "@/lib/research/timeline";

export interface ChartRun {
  aligned: AlignedRun;
  controller: ControllerKey;
  name: string;
}

const BUCKETS = 700;
const timesCache = new WeakMap<Replay, Float64Array>();

export function timesOf(replay: Replay): Float64Array {
  let times = timesCache.get(replay);
  if (!times) {
    times = Float64Array.from({ length: replay.count }, (_, i) => replay.startS + i * replay.dtS);
    timesCache.set(replay, times);
  }
  return times;
}

function drawSignal(run: ChartRun, key: SignalKey, x0: number, x1: number, step: boolean) {
  const replay = run.aligned.replay;
  const signal = replay.signals.get(key);
  if (!signal) return [];
  const points = decimateMinMax(timesOf(replay), signal.data, x0, x1, BUCKETS, run.aligned.offsetS, step);
  return step ? toSteps(points) : points;
}

interface LevelChartSpec {
  pv: SignalKey;
  sp: SignalKey;
  band: "level" | "pressure";
  title: string;
  unit: string;
  digits: number;
}

interface ResearchChartsProps {
  charts: ChartId[];
  runs: ChartRun[];
  x0: number;
  x1: number;
  cursorS: number;
  onSeek: (seconds: number) => void;
}

export function ResearchCharts({ charts, runs, x0, x1, cursorS, onSeek }: ResearchChartsProps) {
  const copy = useMessages().research;
  const locale = useLocale();
  const thresholds = runs[0]?.aligned.replay.header.criteria.thresholds ?? {};

  const specs: Partial<Record<ChartId, LevelChartSpec>> = {
    pressure: { pv: "pressure.truth", sp: "loop.gas.sp", band: "pressure", title: copy.charts.pressure, unit: "bar a", digits: 2 },
    total: { pv: "level.total.truth", sp: "loop.oil.sp", band: "level", title: copy.charts.total, unit: "%", digits: 2 },
    interface: { pv: "level.interface.truth", sp: "loop.water.sp", band: "level", title: copy.charts.interface, unit: "%", digits: 2 },
  };

  const markers: ChartMarker[] = useMemo(() => runs.flatMap((run) =>
    run.aligned.replay.events
      .filter((event) => event.kind === "band_exit" || event.kind === "trip" || event.kind === "oil_pad_lost")
      .map((event) => ({
        t: event.tS - run.aligned.offsetS,
        color: CONTROLLER_STYLE[run.controller].color,
        label: `${run.name}: ${describeEvent(event, copy, locale)}`,
      }))), [runs, copy, locale]);

  const levelSeries = useMemo(() => {
    const out: Partial<Record<ChartId, { series: ChartSeries[]; lines: ChartLine[] }>> = {};
    for (const [id, spec] of Object.entries(specs) as [ChartId, LevelChartSpec][]) {
      if (!charts.includes(id)) continue;
      const series: ChartSeries[] = [];
      for (const run of runs) {
        const style = CONTROLLER_STYLE[run.controller];
        series.push({ id: `${run.aligned.replay.id}:${spec.pv}`, label: run.name, color: style.color, dash: style.dash || undefined, width: 1.8, points: drawSignal(run, spec.pv, x0, x1, false) });
        series.push({ id: `${run.aligned.replay.id}:${spec.sp}`, label: `${run.name} ${copy.charts.setpoint}`, color: style.color, width: 1, opacity: 0.55, dash: "1 3", points: drawSignal(run, spec.sp, x0, x1, true) });
      }
      // The criterion band around the first run's setpoint at the anchor.
      const first = runs[0];
      const lines: ChartLine[] = [];
      if (first) {
        const sp = sampleSignal(first.aligned.replay, spec.sp, first.aligned.anchorS ?? first.aligned.replay.startS).value;
        const half = spec.band === "level" ? thresholds.level_band_pct : (thresholds.pressure_band_frac ?? Number.NaN) * sp;
        if (Number.isFinite(sp) && Number.isFinite(half)) {
          const label = copy.charts.band(spec.band === "level" ? `${formatNumber(half, locale, 0)} %` : `${formatNumber(half, locale, 2)} bar`);
          lines.push({ y: sp + half, label, color: "#ffcd70" }, { y: sp - half, label: "", color: "#ffcd70" });
        }
      }
      out[id] = { series, lines };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- specs derive from copy
  }, [charts, runs, x0, x1, copy, locale, thresholds]);

  const valveSeries = useMemo(() => {
    const out: Partial<Record<ChartId, { series: ChartSeries[]; lines: ChartLine[] }>> = {};
    for (const [id, loop] of [["valve-oil", "oil"], ["valve-water", "water"]] as const) {
      if (!charts.includes(id)) continue;
      const series: ChartSeries[] = runs.flatMap((run) => {
        const color = CONTROLLER_STYLE[run.controller].color;
        return [
          { id: `${run.aligned.replay.id}:cmd`, label: `${run.name} ${copy.charts.command}`, color, dash: "4 3", width: 1.1, opacity: 0.85, points: drawSignal(run, `valve.${loop}.command`, x0, x1, true) },
          { id: `${run.aligned.replay.id}:stem`, label: `${run.name} ${copy.charts.stem}`, color, width: 1.9, points: drawSignal(run, `valve.${loop}.stem`, x0, x1, true) },
        ];
      });
      let low = Number.POSITIVE_INFINITY;
      let high = Number.NEGATIVE_INFINITY;
      for (const item of series) for (const p of item.points) if (p) { low = Math.min(low, p.v); high = Math.max(high, p.v); }
      // Show a travel limit only when the valve comes near it; otherwise it
      // would flatten the very movement the chart is there to show.
      const lines: ChartLine[] = [];
      if (low < 10) lines.push({ y: 0, label: copy.charts.limits, color: "#ff626a", dash: "2 3" });
      if (high > 90) lines.push({ y: 100, label: copy.charts.limits, color: "#ff626a", dash: "2 3" });
      out[id] = { series, lines };
    }
    return out;
  }, [charts, runs, x0, x1, copy]);

  const readoutFor = (keys: { key: SignalKey; label: string; dash?: string }[], digits: number, unit: string): ChartReadout[] =>
    runs.flatMap((run) => keys.map(({ key, label, dash }) => {
      const sample = sampleSignal(run.aligned.replay, key, cursorS + run.aligned.offsetS);
      const value = sample.provenance === "missing" ? "—" : `${formatNumber(sample.value, locale, digits)} ${unit}`;
      return { label: `${run.name} ${label}`.trim(), value, color: CONTROLLER_STYLE[run.controller].color, dash };
    }));

  // formatClock is a module function: a stable reference keeps the memoised
  // chart bodies from redrawing on every animation frame.
  const formatTime = formatClock;

  return (
    <section aria-labelledby="research-charts-heading" className="research-charts">
      <h2 className="research-section-title" id="research-charts-heading">{copy.charts.heading}</h2>
      <p className="research-note">{copy.charts.decimationNote}</p>
      <div className="research-chart-grid">
        {charts.map((id) => {
          const spec = specs[id];
          if (spec) {
            const data = levelSeries[id]!;
            return (
              <TimeChart
                cursorS={cursorS}
                formatTime={formatTime}
                key={id}
                lines={data.lines}
                markers={markers}
                onSeek={onSeek}
                readout={readoutFor([{ key: spec.pv, label: "" }, { key: spec.sp, label: copy.charts.setpoint, dash: "1 3" }], spec.digits, spec.unit)}
                series={data.series}
                title={spec.title}
                unit={spec.unit}
                x0={x0}
                x1={x1}
              />
            );
          }
          if (id === "valve-oil" || id === "valve-water") {
            const loop = id === "valve-oil" ? "oil" : "water";
            return (
              <TimeChart
                cursorS={cursorS}
                formatTime={formatTime}
                key={id}
                lines={valveSeries[id]?.lines ?? []}
                markers={markers}
                onSeek={onSeek}
                readout={readoutFor([{ key: `valve.${loop}.command`, label: copy.charts.command, dash: "4 3" }, { key: `valve.${loop}.stem`, label: copy.charts.stem }], 2, "%")}
                series={valveSeries[id]?.series ?? []}
                title={id === "valve-oil" ? copy.charts.valveOil : copy.charts.valveWater}
                unit="%"
                x0={x0}
                x1={x1}
              />
            );
          }
          if (id === "events") {
            return <EventLane cursorS={cursorS} key={id} onSeek={onSeek} runs={runs} x0={x0} x1={x1} />;
          }
          return null;
        })}
      </div>
    </section>
  );
}

const SEVERITY_COLOR = { info: "#6f8b92", warning: "#ffcd70", critical: "#ff626a" } as const;

function EventLane({ runs, x0, x1, cursorS, onSeek }: { runs: ChartRun[]; x0: number; x1: number; cursorS: number; onSeek: (s: number) => void }) {
  const copy = useMessages().research;
  const locale = useLocale();
  const pct = (t: number) => `${(((t - x0) / (x1 - x0)) * 100).toFixed(3)}%`;
  return (
    <figure className="research-chart research-event-lane">
      <figcaption><span className="research-chart-title">{copy.charts.events}</span></figcaption>
      <div className="research-lane-rows">
        {runs.map((run) => {
          const offset = run.aligned.offsetS;
          const events = run.aligned.replay.events.filter((e) => e.tS - offset >= x0 && e.tS - offset <= x1 && e.kind !== "plant_state");
          return (
            <div className="research-lane-row" key={run.aligned.replay.id}>
              <span className="research-lane-name" style={{ color: CONTROLLER_STYLE[run.controller].color }}>{run.name}</span>
              <div className="research-lane-track">
                {run.aligned.replay.phases.map((phase) => {
                  const from = Math.max(x0, phase.startS - offset);
                  const to = Math.min(x1, phase.endS - offset);
                  if (to <= from) return null;
                  return (
                    <span className="research-lane-phase" key={phase.name + phase.startS} style={{ left: pct(from), width: `calc(${pct(to)} - ${pct(from)})` }} title={phase.name}>
                      <i>{phase.name}</i>
                    </span>
                  );
                })}
                {events.map((event) => (
                  <button
                    aria-label={`${run.name}: ${describeEvent(event, copy, locale)}`}
                    className={`research-lane-event is-${event.severity}`}
                    key={event.id}
                    onClick={() => onSeek(event.tS - offset)}
                    style={{ left: pct(event.tS - offset), background: SEVERITY_COLOR[event.severity] }}
                    title={`${formatClock(event.tS - offset)} ${describeEvent(event, copy, locale)}`}
                    type="button"
                  />
                ))}
                {cursorS >= x0 && cursorS <= x1 ? <span aria-hidden="true" className="research-lane-cursor" style={{ left: pct(cursorS) }} /> : null}
              </div>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
