"use client";

import { memo, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import type { DrawSeries } from "@/lib/research/decimate";

/**
 * A light SVG time chart built for playback: the curves are memoised and only
 * the cursor moves at frame rate. Curves are drawn from recorded samples
 * (decimated with every extreme kept); nothing is smoothed.
 */

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  dash?: string;
  width?: number;
  opacity?: number;
  points: DrawSeries;
}

export interface ChartLine {
  y: number;
  label: string;
  color: string;
  dash?: string;
}

export interface ChartMarker {
  t: number;
  color: string;
  label: string;
}

export interface ChartReadout {
  label: string;
  value: string;
  color: string;
  dash?: string;
}

interface TimeChartProps {
  title: string;
  unit: string;
  x0: number;
  x1: number;
  series: ChartSeries[];
  lines?: ChartLine[];
  markers?: ChartMarker[];
  cursorS: number;
  readout: ChartReadout[];
  formatTime: (seconds: number) => string;
  onSeek?: (seconds: number) => void;
  fixedDomain?: [number, number];
  height?: number;
}

const MARGIN = { top: 8, right: 10, bottom: 22, left: 48 };

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const next = Math.round(entries[0]?.contentRect.width ?? 0);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

function niceTicks(minimum: number, maximum: number, count: number): number[] {
  const span = maximum - minimum;
  if (!(span > 0)) return [minimum];
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= raw) ?? raw;
  const ticks: number[] = [];
  for (let value = Math.ceil(minimum / step) * step; value <= maximum + step * 1e-9; value += step) ticks.push(Number(value.toFixed(10)));
  return ticks;
}

function domainOf(series: ChartSeries[], lines: ChartLine[]): [number, number] {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  for (const s of series) for (const p of s.points) if (p) { low = Math.min(low, p.v); high = Math.max(high, p.v); }
  for (const line of lines) { low = Math.min(low, line.y); high = Math.max(high, line.y); }
  if (!Number.isFinite(low)) return [0, 1];
  const pad = Math.max((high - low) * 0.08, Math.abs(high) * 1e-4, 1e-6);
  return [low - pad, high + pad];
}

const ChartBody = memo(function ChartBody({
  width, height, x0, x1, y0, y1, series, lines, markers, formatTime,
}: {
  width: number; height: number; x0: number; x1: number; y0: number; y1: number;
  series: ChartSeries[]; lines: ChartLine[]; markers: ChartMarker[]; formatTime: (s: number) => string;
}) {
  const innerW = Math.max(10, width - MARGIN.left - MARGIN.right);
  const innerH = Math.max(10, height - MARGIN.top - MARGIN.bottom);
  const sx = (t: number) => MARGIN.left + ((t - x0) / (x1 - x0)) * innerW;
  const sy = (v: number) => MARGIN.top + (1 - (v - y0) / (y1 - y0)) * innerH;
  const paths = series.map((s) => {
    let d = "";
    let pen = false;
    for (const point of s.points) {
      if (!point) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${sx(point.t).toFixed(1)},${sy(point.v).toFixed(2)}`;
      pen = true;
    }
    return { ...s, d };
  });
  return (
    <g>
      {niceTicks(y0, y1, 4).map((tick) => (
        <g key={`y${tick}`}>
          <line className="research-chart-gridline" x1={MARGIN.left} x2={width - MARGIN.right} y1={sy(tick)} y2={sy(tick)} />
          <text className="research-chart-tick" textAnchor="end" x={MARGIN.left - 6} y={sy(tick) + 3}>{Number(tick.toPrecision(6))}</text>
        </g>
      ))}
      {niceTicks(x0, x1, Math.max(2, Math.floor(innerW / 110))).map((tick) => (
        <text className="research-chart-tick" key={`x${tick}`} textAnchor="middle" x={sx(tick)} y={height - 6}>{formatTime(tick)}</text>
      ))}
      {lines.map((line) => (
        <g key={`l${line.label}${line.y}`}>
          <line stroke={line.color} strokeDasharray={line.dash ?? "4 4"} strokeWidth={1} x1={MARGIN.left} x2={width - MARGIN.right} y1={sy(line.y)} y2={sy(line.y)} />
          <text className="research-chart-line-label" fill={line.color} textAnchor="end" x={width - MARGIN.right - 2} y={sy(line.y) - 3}>{line.label}</text>
        </g>
      ))}
      {markers.map((marker) => (
        <line key={`m${marker.t}${marker.label}`} stroke={marker.color} strokeDasharray="2 3" strokeWidth={1.2} x1={sx(marker.t)} x2={sx(marker.t)} y1={MARGIN.top} y2={height - MARGIN.bottom}>
          <title>{marker.label}</title>
        </line>
      ))}
      {paths.map((path) => (
        <path d={path.d} fill="none" key={path.id} opacity={path.opacity ?? 1} stroke={path.color} strokeDasharray={path.dash} strokeLinejoin="round" strokeWidth={path.width ?? 1.6} />
      ))}
    </g>
  );
});

const NO_LINES: ChartLine[] = [];
const NO_MARKERS: ChartMarker[] = [];

export function TimeChart({
  title, unit, x0, x1, series, lines = NO_LINES, markers = NO_MARKERS, cursorS, readout, formatTime, onSeek, fixedDomain, height = 168,
}: TimeChartProps) {
  const [frameRef, width] = useWidth<HTMLDivElement>();
  const [y0, y1] = useMemo(() => fixedDomain ?? domainOf(series, lines), [fixedDomain, series, lines]);
  const innerW = Math.max(10, width - MARGIN.left - MARGIN.right);
  const cursorX = MARGIN.left + ((cursorS - x0) / (x1 - x0)) * innerW;
  const cursorVisible = cursorS >= x0 && cursorS <= x1;

  const seekFrom = (event: PointerEvent<SVGSVGElement>) => {
    if (!onSeek) return;
    const box = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - box.left - MARGIN.left) / innerW;
    onSeek(x0 + Math.min(1, Math.max(0, fraction)) * (x1 - x0));
  };

  return (
    <figure className="research-chart">
      <figcaption>
        <span className="research-chart-title">{title}</span>
        <span className="research-chart-unit">{unit}</span>
      </figcaption>
      <div className="research-chart-frame" ref={frameRef}>
        <svg
          aria-hidden="true"
          height={height}
          onPointerDown={(event) => { event.currentTarget.setPointerCapture?.(event.pointerId); seekFrom(event); }}
          onPointerMove={(event) => { if (event.buttons === 1) seekFrom(event); }}
          role="presentation"
          width={width}
        >
          <ChartBody formatTime={formatTime} height={height} lines={lines} markers={markers} series={series} width={width} x0={x0} x1={x1} y0={y0} y1={y1} />
          {cursorVisible ? <line className="research-chart-cursor" x1={cursorX} x2={cursorX} y1={MARGIN.top} y2={height - MARGIN.bottom} /> : null}
        </svg>
      </div>
      <dl className="research-chart-readout">
        {readout.map((item) => (
          <div key={item.label}>
            <dt><span aria-hidden="true" className="research-swatch" style={{ borderColor: item.color, borderStyle: item.dash ? "dashed" : "solid" }} />{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
