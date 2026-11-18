"use client";

import { useLocale, useMessages } from "@/lib/i18n/provider";
import type { LoopId, ResearchReplayV1 } from "@/lib/research/contract";
import { codeLabel } from "@/lib/research/describe";
import { formatNumber } from "@/lib/research/format";
import type { Frame, Sample } from "@/lib/research/timeline";

/**
 * Technical (P&ID-style) view of PV-WT-001 drawn from one recorded frame.
 *
 * It names the eng_dacs instruments (PIC-101/PCV-101, LIC-102/LCV-102,
 * LIC-103/LCV-103) and shows, for each loop, what the PLC measured, wanted and
 * commanded, next to where the valve stem actually is. It is the explicit
 * alternative for signals the 3D scene has no geometry for (the gas line).
 */

const W = 860;
const H = 470;
const VESSEL = { x: 250, y: 170, width: 360, height: 150 } as const;
const BOTTOM = VESSEL.y + VESSEL.height;

const levelY = (pct: number) => BOTTOM - (Math.min(100, Math.max(0, pct)) / 100) * VESSEL.height;

interface LoopLayout {
  loop: LoopId;
  controller: string;
  valve: string;
  bubble: { x: number; y: number };
  valveAt: { x: number; y: number };
  color: string;
  unit: string;
  digits: number;
}

const LOOPS: LoopLayout[] = [
  { loop: "gas", controller: "PIC-101", valve: "PCV-101", bubble: { x: 590, y: 52 }, valveAt: { x: 720, y: 140 }, color: "#78e8dc", unit: "bar", digits: 2 },
  { loop: "oil", controller: "LIC-102", valve: "LCV-102", bubble: { x: 120, y: 200 }, valveAt: { x: 700, y: 385 }, color: "#f7a93d", unit: "%", digits: 2 },
  { loop: "water", controller: "LIC-103", valve: "LCV-103", bubble: { x: 120, y: 300 }, valveAt: { x: 430, y: 430 }, color: "#28bff2", unit: "%", digits: 2 },
];

function value(sample: Sample | undefined, locale: "en" | "es", digits: number): string {
  if (!sample || sample.provenance === "missing") return "—";
  return formatNumber(sample.value, locale, digits);
}

function ValveSymbol({ x, y, stem, command, color, tag, labels }: {
  x: number; y: number; stem: Sample | undefined; command: Sample | undefined; color: string; tag: string;
  labels: { cmd: string; stem: string; locale: "en" | "es" };
}) {
  const barW = 64;
  const stemPct = stem && stem.provenance !== "missing" ? stem.value : Number.NaN;
  const cmdPct = command && command.provenance !== "missing" ? command.value : Number.NaN;
  return (
    <g className="research-pid-valve" data-valve={tag}>
      <polygon className="research-pid-bowtie" points={`${x - 20},${y - 14} ${x + 20},${y + 14} ${x + 20},${y - 14} ${x - 20},${y + 14}`} style={{ stroke: color }} />
      <line className="research-pid-stem" x1={x} x2={x} y1={y} y2={y - 30} />
      <path className="research-pid-dome" d={`M${x - 14},${y - 30} A14,10 0 0 1 ${x + 14},${y - 30} Z`} />
      <text className="research-pid-tag" textAnchor="middle" x={x} y={y + 32}>{tag}</text>
      <g transform={`translate(${x - barW / 2}, ${y + 40})`}>
        <rect className="research-pid-bar" height={8} width={barW} />
        {Number.isFinite(stemPct) ? <rect height={8} style={{ fill: color }} width={(Math.min(100, Math.max(0, stemPct)) / 100) * barW} /> : null}
        {Number.isFinite(cmdPct) ? <line className="research-pid-cmd-mark" x1={(Math.min(100, Math.max(0, cmdPct)) / 100) * barW} x2={(Math.min(100, Math.max(0, cmdPct)) / 100) * barW} y1={-4} y2={12} /> : null}
        <text className="research-pid-small" x={0} y={24}>{labels.cmd} {value(command, labels.locale, 1)}% · {labels.stem} {value(stem, labels.locale, 1)}%</text>
      </g>
    </g>
  );
}

/** Code name from the bundle's own code table (copied from the eng_dacs enums). */
function codeName(tables: ResearchReplayV1["codeTables"], table: string, sample: Sample | undefined): string | null {
  if (!sample || sample.provenance === "missing") return null;
  return tables[table]?.codes?.[String(sample.value)] ?? String(sample.value);
}

export function ResearchPid({ frame, title, codeTables }: { frame: Frame; title: string; codeTables: ResearchReplayV1["codeTables"] }) {
  const copy = useMessages().research;
  const locale = useLocale();
  const s = frame.samples;
  const total = s["level.total.truth"];
  const interfaceLevel = s["level.interface.truth"];
  const totalPct = total && total.provenance !== "missing" ? total.value : Number.NaN;
  const interfacePct = interfaceLevel && interfaceLevel.provenance !== "missing" ? interfaceLevel.value : Number.NaN;
  const alarms = (["alarm.pah", "alarm.lah", "alarm.high_water_level", "alarm.oil_overflow", "alarm.liquid_carryover"] as const)
    .filter((key) => s[key] && s[key]!.provenance !== "missing" && s[key]!.value === 1)
    .map((key) => copy.events.alarms[key.split(".")[1]] ?? key);
  const plant = s["plant.state"];
  const well = s["well.nodal_status"];
  const summary = copy.pid.summary(
    `${value(s["pressure.truth"], locale, 2)} bar a`,
    `${value(total, locale, 1)} %`,
    `${value(interfaceLevel, locale, 1)} %`,
  );

  return (
    <figure className="research-pid">
      <svg aria-label={copy.pid.ariaLabel(summary)} role="img" viewBox={`0 0 ${W} ${H}`}>
        <title>{title}</title>
        {/* Process lines */}
        <path className="pid-pipe" d={`M30,120 H330 V${VESSEL.y}`} />
        <path className="pid-pipe" d={`M500,${VESSEL.y} V140 H850`} />
        <path className="pid-pipe" d={`M540,${BOTTOM} V385 H850`} />
        <path className="pid-pipe" d={`M340,${BOTTOM} V430 H850`} />
        <text className="research-pid-small" x={34} y={110}>{copy.pid.feed}</text>
        <text className="research-pid-small" x={760} y={130}>{copy.pid.gas}</text>
        <text className="research-pid-small" x={760} y={375}>{copy.pid.oil}</text>
        <text className="research-pid-small" x={760} y={420}>{copy.pid.water}</text>
        {/* Vessel with recorded phase bands */}
        <defs>
          <clipPath id="research-pid-vessel">
            <rect height={VESSEL.height} rx={70} width={VESSEL.width} x={VESSEL.x} y={VESSEL.y} />
          </clipPath>
        </defs>
        <g clipPath="url(#research-pid-vessel)">
          {Number.isFinite(totalPct) ? <rect className="research-pid-oil" height={BOTTOM - levelY(totalPct)} width={VESSEL.width} x={VESSEL.x} y={levelY(totalPct)} /> : null}
          {Number.isFinite(interfacePct) ? <rect className="research-pid-water" height={BOTTOM - levelY(interfacePct)} width={VESSEL.width} x={VESSEL.x} y={levelY(interfacePct)} /> : null}
        </g>
        <rect className="pid-vessel-outline" height={VESSEL.height} rx={70} width={VESSEL.width} x={VESSEL.x} y={VESSEL.y} />
        <text className="research-pid-tag" textAnchor="middle" x={VESSEL.x + VESSEL.width / 2} y={VESSEL.y - 12}>PV-WT-001</text>
        {Number.isFinite(totalPct) ? <text className="research-pid-small" x={VESSEL.x + 14} y={levelY(totalPct) - 4}>{value(total, locale, 2)} %</text> : null}
        {Number.isFinite(interfacePct) ? <text className="research-pid-small" x={VESSEL.x + 14} y={levelY(interfacePct) - 4}>{value(interfaceLevel, locale, 2)} %</text> : null}
        {/* Loops */}
        {LOOPS.map((layout) => {
          const pv = s[`loop.${layout.loop}.pv`];
          const sp = s[`loop.${layout.loop}.sp`];
          const mode = s[`loop.${layout.loop}.mode`];
          return (
            <g data-loop={layout.loop} key={layout.loop}>
              <line className="pid-signal" x1={layout.bubble.x} x2={layout.valveAt.x} y1={layout.bubble.y} y2={layout.valveAt.y} />
              <circle className="research-pid-bubble" cx={layout.bubble.x} cy={layout.bubble.y} r={26} style={{ stroke: layout.color }} />
              <text className="research-pid-tag" textAnchor="middle" x={layout.bubble.x} y={layout.bubble.y + 4}>{layout.controller}</text>
              <text className="research-pid-small" textAnchor="middle" x={layout.bubble.x} y={layout.bubble.y + 42}>
                {copy.pid.pv} {value(pv, locale, layout.digits)} · {copy.pid.sp} {value(sp, locale, layout.digits)} {layout.unit}
              </text>
              <text className="research-pid-small" textAnchor="middle" x={layout.bubble.x} y={layout.bubble.y + 56}>
                {copy.pid.mode} {codeName(codeTables, "loop.mode", mode) ? codeLabel(copy, codeName(codeTables, "loop.mode", mode)) : "—"}
              </text>
              <ValveSymbol
                color={layout.color}
                command={s[`valve.${layout.loop}.command`]}
                labels={{ cmd: copy.views.command, stem: copy.views.stem, locale }}
                stem={s[`valve.${layout.loop}.stem`]}
                tag={layout.valve}
                x={layout.valveAt.x}
                y={layout.valveAt.y}
              />
            </g>
          );
        })}
        {/* Status */}
        <g transform="translate(250, 40)">
          <text className="research-pid-small" x={0} y={0}>{copy.pid.plant}: {codeName(codeTables, "plant.state", plant) ? codeLabel(copy, codeName(codeTables, "plant.state", plant)) : "—"}</text>
          <text className="research-pid-small" x={0} y={16}>{copy.pid.well}: {codeName(codeTables, "well.nodal_status", well) ? codeLabel(copy, codeName(codeTables, "well.nodal_status", well)) : "—"}</text>
          <text className={`research-pid-small ${alarms.length > 0 ? "is-alarm" : ""}`} x={0} y={32}>{copy.pid.alarms}: {alarms.length > 0 ? alarms.join(", ") : copy.pid.none}</text>
        </g>
      </svg>
    </figure>
  );
}
