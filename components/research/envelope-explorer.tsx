"use client";

import Link from "next/link";
import { useMemo, useState, type KeyboardEvent } from "react";

import { EvidenceLine } from "./evidence-badges";
import { ResearchDisclaimer, ResearchHeader } from "./research-header";
import { SourceList } from "./research-lab";
import { ClaimsPanel } from "./research-panels";
import { ProjectAttribution } from "@/components/project-attribution";
import { useEnvelopeData, useResearchIndex } from "@/hooks/use-research-data";
import { useLocale, useMessages } from "@/lib/i18n/provider";
import { DOCUMENTED_FRONTIERS, ENVELOPE_CLAIMS, ENVELOPE_MAP_ID, ENVELOPE_SEEDS, ENVELOPE_SOURCES } from "@/lib/research/catalog";
import { evaluateClaim } from "@/lib/research/claims";
import { ENVELOPE_OUTCOMES, type EnvelopeAxis, type EnvelopeOutcome, type EnvelopePoint, type ResearchEnvelopeMapV1 } from "@/lib/research/contract";
import { formatNumber } from "@/lib/research/format";

/** Colour and shape per outcome: never colour alone (WCAG 1.4.1). */
export const OUTCOME_STYLE: Record<EnvelopeOutcome, { color: string; shape: "diamond" | "cross" | "square" | "circle" | "star" }> = {
  outside_model: { color: "#cf8cff", shape: "diamond" },
  inadmissible: { color: "#ff626a", shape: "cross" },
  inconclusive: { color: "#9aadb2", shape: "square" },
  marginal: { color: "#ffcd70", shape: "circle" },
  admissible: { color: "#54dfa8", shape: "star" },
};

function Marker({ shape, x, y, r, color, selected }: { shape: string; x: number; y: number; r: number; color: string; selected: boolean }) {
  const stroke = selected ? "#ffffff" : color;
  const width = selected ? 2.4 : 1.6;
  switch (shape) {
    case "diamond":
      return <polygon fill={color} fillOpacity={0.35} points={`${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}`} stroke={stroke} strokeWidth={width} />;
    case "cross":
      return <path d={`M${x - r},${y - r}L${x + r},${y + r}M${x + r},${y - r}L${x - r},${y + r}`} stroke={selected ? "#ffffff" : color} strokeWidth={selected ? 3.2 : 2.4} />;
    case "square":
      return <rect fill={color} fillOpacity={0.35} height={2 * r * 0.85} stroke={stroke} strokeWidth={width} width={2 * r * 0.85} x={x - r * 0.85} y={y - r * 0.85} />;
    case "star":
      return <polygon fill={color} points={[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
        const angle = (Math.PI / 5) * i - Math.PI / 2;
        const radius = i % 2 === 0 ? r : r * 0.45;
        return `${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`;
      }).join(" ")} stroke={stroke} strokeWidth={width} />;
    default:
      return <circle cx={x} cy={y} fill={color} fillOpacity={0.35} r={r * 0.9} stroke={stroke} strokeWidth={width} />;
  }
}

const W = 720;
const H = 460;
const M = { top: 16, right: 18, bottom: 46, left: 64 };

function scaleFor(axis: EnvelopeAxis, values: number[], pixels: [number, number]) {
  const finite = values.filter((v) => Number.isFinite(v) && (axis.scale !== "log" || v > 0));
  const design = axis.designRange ?? [null, null];
  let low = Math.min(...finite, ...(design[0] !== null ? [design[0]] : []));
  const high = Math.max(...finite, ...(design[1] !== null ? [design[1]] : []));
  if (axis.scale === "log") {
    low = Math.max(low, 1e-9);
    const [a, b] = [Math.log10(low), Math.log10(high)];
    const pad = (b - a) * 0.05 || 0.1;
    const [lo, hi] = [a - pad, b + pad];
    return {
      map: (v: number) => pixels[0] + ((Math.log10(v) - lo) / (hi - lo)) * (pixels[1] - pixels[0]),
      ticks: (() => {
        const out: number[] = [];
        for (let e = Math.floor(lo); e <= Math.ceil(hi); e += 1) for (const m of [1, 2, 5]) { const t = m * 10 ** e; if (Math.log10(t) >= lo && Math.log10(t) <= hi) out.push(t); }
        return out;
      })(),
    };
  }
  const pad = (high - low) * 0.06 || 1;
  const [lo, hi] = [low - pad, high + pad];
  const step = (() => { const raw = (hi - lo) / 5; const mag = 10 ** Math.floor(Math.log10(raw)); return [1, 2, 2.5, 5, 10].map((k) => k * mag).find((c) => c >= raw) ?? raw; })();
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) ticks.push(Number(t.toFixed(10)));
  return { map: (v: number) => pixels[0] + ((v - lo) / (hi - lo)) * (pixels[1] - pixels[0]), ticks };
}

function EnvelopeMap({ map }: { map: ResearchEnvelopeMapV1 }) {
  const copy = useMessages().research.envelope;
  const locale = useLocale();
  const axisLabel = (axis: EnvelopeAxis) => `${copy.axisLabels[axis.key] ?? axis.factor} (${axis.unit})`;
  const [xKey, setXKey] = useState("f_gor_sm3_sm3");
  const [yKey, setYKey] = useState("f_water_cut_pct");
  const [shown, setShown] = useState<Set<EnvelopeOutcome>>(new Set(ENVELOPE_OUTCOMES));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const xAxis = map.axes.find((a) => a.key === xKey) ?? map.axes[0];
  const yAxis = map.axes.find((a) => a.key === yKey) ?? map.axes[1];
  const plotted = map.points.filter((p) => p.values[xAxis.key] != null && p.values[yAxis.key] != null);
  const missing = map.points.length - plotted.length;
  const sx = useMemo(() => scaleFor(xAxis, plotted.map((p) => p.values[xAxis.key] as number), [M.left, W - M.right]), [xAxis, plotted]);
  const sy = useMemo(() => scaleFor(yAxis, plotted.map((p) => p.values[yAxis.key] as number), [H - M.bottom, M.top]), [yAxis, plotted]);
  const selected = map.points.find((p) => p.runId === selectedId) ?? null;
  // One-at-a-time scenarios often share both coordinates (they vary another
  // factor). They are not nudged apart; the overlap is counted and listed.
  const coordinateKey = (p: EnvelopePoint) => `${p.values[xAxis.key]}|${p.values[yAxis.key]}`;
  const sameSpot = new Map<string, EnvelopePoint[]>();
  for (const point of plotted) sameSpot.set(coordinateKey(point), [...(sameSpot.get(coordinateKey(point)) ?? []), point]);
  const companions = selected && selected.values[xAxis.key] != null && selected.values[yAxis.key] != null
    ? (sameSpot.get(coordinateKey(selected)) ?? []).filter((p) => p.runId !== selected.runId)
    : [];
  const constraint = (id: string | null) => map.constraints.find((c) => c.id === id);
  const counts = Object.fromEntries(ENVELOPE_OUTCOMES.map((o) => [o, map.points.filter((p) => p.outcome === o).length])) as Record<EnvelopeOutcome, number>;

  const onPointKey = (event: KeyboardEvent<SVGGElement>, point: EnvelopePoint) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedId(point.runId);
    }
  };

  const designRect = (() => {
    const [x0, x1] = xAxis.designRange ?? [null, null];
    const [y0, y1] = yAxis.designRange ?? [null, null];
    if (x0 === null || x1 === null || y0 === null || y1 === null) return null;
    return { x: sx.map(x0), y: sy.map(y1), w: sx.map(x1) - sx.map(x0), h: sy.map(y0) - sy.map(y1) };
  })();

  return (
    <div className="research-envelope">
      <div className="research-envelope-controls">
        {([["x", xKey, setXKey, copy.xAxis], ["y", yKey, setYKey, copy.yAxis]] as const).map(([id, value, set, label]) => (
          <label key={id}>
            {label}
            <select onChange={(event) => set(event.target.value)} value={value}>
              {map.axes.map((axis) => (
                <option key={axis.key} value={axis.key}>
                  {axisLabel(axis)} · {axis.kind === "factor" ? copy.factorAxis : copy.operatingAxis}{axis.scale === "log" ? `, ${copy.logScale}` : ""}
                </option>
              ))}
            </select>
          </label>
        ))}
        <fieldset className="research-envelope-filter">
          <legend>{copy.filter}</legend>
          {ENVELOPE_OUTCOMES.map((outcome) => (
            <label key={outcome} title={copy.outcomeHelp[outcome]}>
              <input
                checked={shown.has(outcome)}
                onChange={(event) => {
                  const next = new Set(shown);
                  if (event.target.checked) next.add(outcome); else next.delete(outcome);
                  setShown(next);
                }}
                type="checkbox"
              />
              <svg aria-hidden="true" height={16} width={16}><Marker color={OUTCOME_STYLE[outcome].color} r={6} selected={false} shape={OUTCOME_STYLE[outcome].shape} x={8} y={8} /></svg>
              {copy.outcomes[outcome]} ({counts[outcome]})
            </label>
          ))}
        </fieldset>
      </div>

      <div className="research-envelope-body">
        <figure className="research-envelope-figure">
          <svg aria-label={copy.chartLabel(axisLabel(xAxis), axisLabel(yAxis), plotted.length)} role="group" viewBox={`0 0 ${W} ${H}`}>
            {sx.ticks.map((t) => (
              <g key={`x${t}`}>
                <line className="research-chart-gridline" x1={sx.map(t)} x2={sx.map(t)} y1={M.top} y2={H - M.bottom} />
                <text className="research-chart-tick" textAnchor="middle" x={sx.map(t)} y={H - M.bottom + 16}>{Number(t.toPrecision(4))}</text>
              </g>
            ))}
            {sy.ticks.map((t) => (
              <g key={`y${t}`}>
                <line className="research-chart-gridline" x1={M.left} x2={W - M.right} y1={sy.map(t)} y2={sy.map(t)} />
                <text className="research-chart-tick" textAnchor="end" x={M.left - 6} y={sy.map(t) + 3}>{Number(t.toPrecision(4))}</text>
              </g>
            ))}
            <text className="research-axis-title" textAnchor="middle" x={(M.left + W - M.right) / 2} y={H - 8}>{axisLabel(xAxis)}{xAxis.scale === "log" ? ` · ${copy.logScale}` : ""}</text>
            <text className="research-axis-title" textAnchor="middle" transform={`translate(16 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}>{axisLabel(yAxis)}{yAxis.scale === "log" ? ` · ${copy.logScale}` : ""}</text>
            {designRect ? (
              <g>
                <rect className="research-design-range" height={designRect.h} width={designRect.w} x={designRect.x} y={designRect.y} />
                <text className="research-chart-line-label" x={designRect.x + 4} y={designRect.y + 12}>{copy.designRange}</text>
              </g>
            ) : null}
            {plotted.filter((p) => shown.has(p.outcome)).map((point) => (
              <g
                aria-label={copy.pointLabel(point.runId, copy.outcomes[point.outcome])}
                aria-pressed={point.runId === selectedId}
                className="research-envelope-point"
                data-outcome={point.outcome}
                key={point.runId}
                onClick={() => setSelectedId(point.runId)}
                onKeyDown={(event) => onPointKey(event, point)}
                role="button"
                tabIndex={0}
              >
                <circle cx={sx.map(point.values[xAxis.key] as number)} cy={sy.map(point.values[yAxis.key] as number)} fill="transparent" r={12} />
                <Marker
                  color={OUTCOME_STYLE[point.outcome].color}
                  r={7}
                  selected={point.runId === selectedId}
                  shape={OUTCOME_STYLE[point.outcome].shape}
                  x={sx.map(point.values[xAxis.key] as number)}
                  y={sy.map(point.values[yAxis.key] as number)}
                />
                <title>{copy.pointLabel(point.runId, copy.outcomes[point.outcome])}</title>
              </g>
            ))}
            {[...sameSpot.values()].filter((group) => group.length > 1).map((group) => (
              <text
                aria-hidden="true"
                className="research-overlap-count"
                key={coordinateKey(group[0])}
                x={sx.map(group[0].values[xAxis.key] as number) + 9}
                y={sy.map(group[0].values[yAxis.key] as number) - 8}
              >
                ×{group.length}
              </text>
            ))}
          </svg>
          {missing > 0 ? <figcaption className="research-note">{copy.notPlotted(missing)}</figcaption> : null}
        </figure>

        <aside aria-live="polite" className="research-envelope-detail">
          {!selected ? <p>{copy.selectPrompt}</p> : (
            <>
              <h3>{copy.selected}</h3>
              <p><code>{selected.runId}</code></p>
              {companions.length > 0 ? (
                <div className="research-overlap">
                  <p className="research-note">{copy.overlap(companions.length + 1)}</p>
                  <ul>
                    {companions.map((point) => (
                      <li key={point.runId}>
                        <button className="research-link-button" onClick={() => setSelectedId(point.runId)} type="button">
                          {point.runId} · {copy.outcomes[point.outcome]}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <p className="research-envelope-outcome" style={{ color: OUTCOME_STYLE[selected.outcome].color }}>
                <strong>{copy.outcomes[selected.outcome]}</strong>
              </p>
              <p className="research-note">{copy.outcomeHelp[selected.outcome]}</p>
              <dl>
                <div>
                  <dt>{copy.dominant}</dt>
                  <dd>
                    {selected.dominantConstraint ? (
                      <><code>{selected.dominantConstraint}</code>{constraint(selected.dominantConstraint) ? <> · {constraint(selected.dominantConstraint)!.title} <small>({constraint(selected.dominantConstraint)!.category})</small></> : null}</>
                    ) : copy.noDominant}
                  </dd>
                </div>
                <div>
                  <dt>{copy.closest}</dt>
                  <dd>{selected.closestConstraint ? <><code>{selected.closestConstraint}</code> {copy.utilization(formatNumber(selected.closestUtilization, locale, 2))}</> : "—"}</dd>
                </div>
                <div>
                  <dt>{copy.active}</dt>
                  <dd>{selected.activeConstraints.length ? selected.activeConstraints.map((c) => <code key={c}>{c} </code>) : "—"}</dd>
                </div>
                {map.axes.map((axis) => (
                  <div key={axis.key}>
                    <dt>{axisLabel(axis)}</dt>
                    <dd>{formatNumber(selected.values[axis.key], locale, axis.unit === "Sm3/h" ? 0 : 2)}</dd>
                  </div>
                ))}
              </dl>
              {selected.replayId ? (
                <Link className="primary-button" href={`/research/replay/${selected.replayId}`}>{copy.openReplay}</Link>
              ) : <p className="research-note">{copy.replayNotPublished}</p>}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export function EnvelopeExplorer() {
  const messages = useMessages();
  const copy = messages.research;
  const [indexState] = useResearchIndex();
  const index = indexState.status === "ready" ? indexState.data : null;
  const [mapState] = useEnvelopeData(index, ENVELOPE_MAP_ID);
  const map = mapState.status === "ready" ? mapState.data : null;
  const claims = useMemo(() => (map ? ENVELOPE_CLAIMS.map((claim) => evaluateClaim(claim, { replays: new Map(), envelope: map })) : []), [map]);
  const failed = indexState.status === "error" || mapState.status === "error";

  return (
    <main className="research-shell">
      <ResearchHeader back={{ href: "/research", label: copy.nav.backToLab }} title={copy.envelope.title} />
      <EvidenceLine seeds={ENVELOPE_SEEDS} stage="exploratory" />
      <p className="research-intro">{copy.envelope.intro}</p>
      <p className="research-warning">{copy.envelope.noFrontier}</p>
      <ResearchDisclaimer compact />
      {!failed && !map ? <p className="research-loading" role="status">{copy.envelope.loading}</p> : null}
      {failed ? <p role="alert">{copy.envelope.failed}</p> : null}
      {map ? <EnvelopeMap map={map} /> : null}
      <section className="research-panel">
        <h2 className="research-section-title">{copy.envelope.frontiersHeading}</h2>
        <ul className="research-frontiers">
          {DOCUMENTED_FRONTIERS.map((frontier) => (
            <li key={frontier.id}><code>{frontier.constraint}</code> · {copy.envelope.frontiers[frontier.id]}</li>
          ))}
        </ul>
        <SourceList sources={ENVELOPE_SOURCES} />
      </section>
      {map ? <ClaimsPanel results={claims} /> : null}
      <ProjectAttribution variant="compact" />
    </main>
  );
}
