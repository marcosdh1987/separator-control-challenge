"use client";

import { AlertTriangle, Waves } from "lucide-react";
import { useId } from "react";

import { createProcessSummary, createSceneModel, formatEngineeringValue, type FlowMotion } from "@/lib/visualization/scene-model";
import type { SimulationSample, SimulationStatus } from "@/lib/simulation/types";

interface ProcessVisualizationProps {
  sample: SimulationSample;
  status: SimulationStatus;
  announceSafety?: boolean;
}

const VIEW_TOP = 75;
const VIEW_BOTTOM = 255;
const LEVEL_HEIGHT = VIEW_BOTTOM - VIEW_TOP;
const levelY = (levelPct: number) => VIEW_BOTTOM - Math.min(100, Math.max(0, Number.isFinite(levelPct) ? levelPct : 0)) / 100 * LEVEL_HEIGHT;
const pct = (value: number) => formatEngineeringValue(value, { unit: "%", separator: "" });
const flow = (value: number) => formatEngineeringValue(value, { unit: "m³/h" });
const flowLabel = (value: number) => value === 0 ? `Stopped / ${flow(value)}` : flow(value);

function FlowIndicator({ motion, markerId, name, path }: { motion: FlowMotion; markerId: string; name: string; path: string }) {
  const state = motion.direction > 0 ? "forward" : motion.direction < 0 ? "reverse" : "stopped";
  return (
    <path
      className={`flow-indicator ${name}-flow`}
      d={path}
      data-flow-state={state}
      data-testid={`${name}-flow-indicator`}
      markerEnd={motion.direction > 0 ? `url(#${markerId})` : undefined}
      markerStart={motion.direction < 0 ? `url(#${markerId})` : undefined}
      style={{
        animationDirection: motion.direction < 0 ? "reverse" : "normal",
        animationDuration: `${1.2 - motion.speed * 2}s`,
        animationName: motion.direction === 0 ? "none" : undefined,
        animationPlayState: motion.speed === 0 ? "paused" : undefined,
        opacity: motion.direction === 0 ? .35 : .3 + .7 * motion.visibleFraction,
      }}
    />
  );
}

export function ProcessVisualization({ sample, status, announceSafety = true }: ProcessVisualizationProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `${name}-${reactId}`;
  const headingId = id("process-heading");
  const model = createSceneModel(sample);
  const summary = createProcessSummary(sample);
  const totalY = levelY(sample.total.processValuePct);
  const interfaceY = levelY(sample.interface.processValuePct);
  const phaseInterfaceY = Math.max(totalY, interfaceY);
  const motionActive = status === "running" && model.safety.motionEnabled;

  return (
    <section aria-labelledby={headingId} className={`panel process-panel safety-${model.safety.severity}`}>
      <div className="panel-heading process-heading">
        <div>
          <p className="eyebrow">SEP-101 · engineering fallback</p>
          <h2 id={headingId}><Waves aria-hidden="true" /> Separator process cutaway</h2>
        </div>
        <div aria-live={announceSafety ? "polite" : undefined} className={`alarm-badge ${model.safety.severity}`}>
          {model.safety.severity !== "safe" && <AlertTriangle aria-hidden="true" />}
          {model.safety.label}
        </div>
      </div>

      <div className="mimic-stage three-phase-mimic">
        <svg aria-label={summary} className="separator-mimic" role="img" viewBox="0 0 720 370">
          <defs>
            <linearGradient id={id("steel")} x1="0" x2="1">
              <stop offset="0%" stopColor="var(--steel-dark)" />
              <stop offset="45%" stopColor="var(--steel-light)" />
              <stop offset="100%" stopColor="var(--steel-dark)" />
            </linearGradient>
            <linearGradient id={id("gas")} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1b343d" />
              <stop offset="100%" stopColor="#10272e" />
            </linearGradient>
            <linearGradient id={id("oil")} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#d4933e" />
              <stop offset="100%" stopColor="#85511f" />
            </linearGradient>
            <linearGradient id={id("water")} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#20b7ca" />
              <stop offset="100%" stopColor="#075a73" />
            </linearGradient>
            <clipPath id={id("vessel-clip")}><rect height="180" rx="90" width="430" x="145" y="75" /></clipPath>
            <pattern height="14" id={id("gas-texture")} patternUnits="userSpaceOnUse" width="14">
              <circle cx="3" cy="3" fill="white" opacity=".08" r="1" />
            </pattern>
            <pattern height="12" id={id("oil-texture")} patternUnits="userSpaceOnUse" width="24">
              <path d="M0 6 Q6 2 12 6 T24 6" fill="none" stroke="white" strokeOpacity=".15" />
            </pattern>
            <pattern height="10" id={id("water-texture")} patternUnits="userSpaceOnUse" width="20">
              <path d="M0 5 H20" stroke="white" strokeDasharray="3 4" strokeOpacity=".18" />
            </pattern>
            <marker id={id("inlet-arrow")} markerHeight="8" markerWidth="8" orient="auto-start-reverse" refX="7" refY="4"><path d="M0 0 L8 4 0 8z" data-testid="inlet-flow-marker" fill="var(--cyan-bright)" /></marker>
            <marker id={id("oil-arrow")} markerHeight="8" markerWidth="8" orient="auto-start-reverse" refX="7" refY="4"><path d="M0 0 L8 4 0 8z" data-testid="oil-flow-marker" fill="var(--amber)" /></marker>
            <marker id={id("water-arrow")} markerHeight="8" markerWidth="8" orient="auto-start-reverse" refX="7" refY="4"><path d="M0 0 L8 4 0 8z" data-testid="water-flow-marker" fill="var(--cyan-bright)" /></marker>
          </defs>

          <g className={`process-flow ${motionActive ? "is-flowing" : "is-still"}`}>
            <path className="process-pipe" d="M20 126 H145" />
            <path className="process-pipe oil-pipe" d="M485 255 V310 H660" />
            <path className="process-pipe water-pipe" d="M305 255 V344 H660" />
            <FlowIndicator markerId={id("inlet-arrow")} motion={model.inletFlow} name="inlet" path="M42 126 H125" />
            <FlowIndicator markerId={id("oil-arrow")} motion={model.oilFlow} name="oil" path="M520 310 H635" />
            <FlowIndicator markerId={id("water-arrow")} motion={model.waterFlow} name="water" path="M350 344 H635" />
          </g>

          <rect fill={`url(#${id("steel")})`} height="180" rx="90" width="430" x="145" y="75" />
          <g clipPath={`url(#${id("vessel-clip")})`}>
            <rect fill={`url(#${id("gas")})`} height={Math.max(0, totalY - VIEW_TOP)} width="430" x="145" y={VIEW_TOP} />
            <rect fill={`url(#${id("gas-texture")})`} height={Math.max(0, totalY - VIEW_TOP)} width="430" x="145" y={VIEW_TOP} />
            <rect className="oil-phase" fill={`url(#${id("oil")})`} height={Math.max(0, phaseInterfaceY - totalY)} width="430" x="145" y={totalY} />
            <rect fill={`url(#${id("oil-texture")})`} height={Math.max(0, phaseInterfaceY - totalY)} width="430" x="145" y={totalY} />
            <rect className="water-phase" fill={`url(#${id("water")})`} height={Math.max(0, VIEW_BOTTOM - phaseInterfaceY)} width="430" x="145" y={phaseInterfaceY} />
            <rect fill={`url(#${id("water-texture")})`} height={Math.max(0, VIEW_BOTTOM - phaseInterfaceY)} width="430" x="145" y={phaseInterfaceY} />
            <line className="total-surface" x1="145" x2="575" y1={totalY} y2={totalY} />
            <line className="interface-surface" x1="145" x2="575" y1={interfaceY} y2={interfaceY} />
          </g>
          <rect className="vessel-outline" height="180" rx="90" width="430" x="145" y="75" />
          <path className="vessel-leg" d="M235 249 v42 h-36 M485 249 v42 h36" />

          <g className="phase-labels" textAnchor="middle">
            <text x="360" y={Math.max(94, (VIEW_TOP + totalY) / 2)}>GAS SPACE</text>
            <text x="360" y={Math.min(245, Math.max(102, (totalY + phaseInterfaceY) / 2 + 4))}>OIL INVENTORY</text>
            <text x="360" y={Math.min(246, (phaseInterfaceY + VIEW_BOTTOM) / 2 + 4)}>WATER INVENTORY</text>
          </g>
          <g className="process-annotations">
            <text x="20" y="99">TOTAL INLET · {flowLabel(sample.flows.totalInletM3H)}</text>
            <text x="500" y="296">OIL OUTLET · {flowLabel(sample.flows.oilOutletM3H)}</text>
            <text x="375" y="365">WATER OUTLET · {flowLabel(sample.flows.waterOutletM3H)}</text>
            <text x="589" y={Math.max(85, totalY - 6)}>TOTAL TRUE {pct(sample.total.processValuePct)}</text>
            <text x="589" y={Math.max(98, totalY + 8)}>MEASURED {pct(sample.total.measuredValuePct)}</text>
            <text x="20" y={Math.min(248, interfaceY - 6)}>INTERFACE TRUE {pct(sample.interface.processValuePct)}</text>
            <text x="20" y={Math.min(262, interfaceY + 8)}>MEASURED {pct(sample.interface.measuredValuePct)}</text>
          </g>
          <text className="equipment-tag" x="360" y="57">SEP-101 · THREE-PHASE INVENTORY</text>
        </svg>

      </div>

      <dl aria-label="Critical separator instruments" className="process-instrument-grid" role="group">
        <div><dt>Total true</dt><dd>{pct(sample.total.processValuePct)}</dd></div>
        <div><dt>Total measured</dt><dd>{pct(sample.total.measuredValuePct)}</dd></div>
        <div><dt>Total SP</dt><dd>{pct(sample.total.setpointPct)}</dd></div>
        <div><dt>Interface true</dt><dd>{pct(sample.interface.processValuePct)}</dd></div>
        <div><dt>Interface measured</dt><dd>{pct(sample.interface.measuredValuePct)}</dd></div>
        <div><dt>Interface SP</dt><dd>{pct(sample.interface.setpointPct)}</dd></div>
        <div><dt>Total inlet</dt><dd>{flowLabel(sample.flows.totalInletM3H)}</dd></div>
        <div><dt>Oil outlet</dt><dd>{flowLabel(sample.flows.oilOutletM3H)}</dd></div>
        <div><dt>Water outlet</dt><dd>{flowLabel(sample.flows.waterOutletM3H)}</dd></div>
        <div><dt>Oil command</dt><dd>{pct(sample.total.valveCommandPct)}</dd></div>
        <div><dt>Oil actual</dt><dd>{pct(sample.total.valvePositionPct)}</dd></div>
        <div><dt>Water command</dt><dd>{pct(sample.interface.valveCommandPct)}</dd></div>
        <div><dt>Water actual</dt><dd>{pct(sample.interface.valvePositionPct)}</dd></div>
        <div className="instrument-safety"><dt>Active safety</dt><dd>{model.safety.label}</dd></div>
      </dl>

      <div className="process-footer">
        <span><i className={`status-dot ${status}`} /> {status.toUpperCase()}</span>
        <span>Total SP <strong>{pct(sample.total.setpointPct)}</strong></span>
        <span>Interface SP <strong>{pct(sample.interface.setpointPct)}</strong></span>
      </div>
      <p className="fallback-note">2D engineering fallback · process values and safety logic remain fully active.</p>
    </section>
  );
}
