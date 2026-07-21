"use client";

import {
  Activity,
  AlertTriangle,
  BookOpen,
  Clock3,
  Crosshair,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { DualPidControls } from "./dual-pid-controls";
import { ProcessHero } from "./process-hero";
import { ResultPanel } from "./result-panel";
import { ScenarioSelector } from "./scenario-selector";
import { TrendCharts } from "./trend-charts";
import { useSimulation } from "@/hooks/use-simulation";
import { getScenario } from "@/lib/simulation/scenarios";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_SIMULATION,
  type DualPidConfig,
  type PidConfig,
  type ScenarioId,
} from "@/lib/simulation/types";

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
};

function tuningTip(pid: PidConfig, scenarioId: ScenarioId): string {
  if (pid.kp >= 7) return "High Kp can recover quickly, but watch the crossing count for oscillation.";
  if (pid.ki >= 0.18) return "Strong integral action removes offset but can drive overshoot and saturation.";
  if (pid.kd >= 15 && scenarioId === "noisy-interface") {
    return "Derivative action amplifies transmitter noise; use the filter or reduce Kd.";
  }
  if (pid.kp <= 1) return "Low Kp is calm but may be too slow for the slug and capacity challenges.";
  return "Low error is only half the job—watch actual valve travel and saturation too.";
}

export function GameDashboard() {
  const [pid, setPid] = useState<DualPidConfig>(DEFAULT_DUAL_PID);
  const [scenarioId, setScenarioId] = useState<ScenarioId>("water-rich-slug");
  const simulation = useSimulation(pid, scenarioId);
  const sample = simulation.currentSample;
  const locked = simulation.status !== "idle";
  const scenario = getScenario(scenarioId);
  const live = useMemo(() => {
    let totalOutsideS = 0;
    let interfaceOutsideS = 0;
    let oilTravelPct = 0;
    let waterTravelPct = 0;
    let totalAbsoluteError = 0;
    let interfaceAbsoluteError = 0;
    let maximumTotalPct = sample.total.processValuePct;
    let minimumInterfacePct = sample.interface.processValuePct;
    for (let index = 0; index < simulation.samples.length; index += 1) {
      const item = simulation.samples[index];
      maximumTotalPct = Math.max(maximumTotalPct, item.total.processValuePct);
      minimumInterfacePct = Math.min(minimumInterfacePct, item.interface.processValuePct);
      totalAbsoluteError += Math.abs(item.total.processValuePct - item.total.setpointPct);
      interfaceAbsoluteError += Math.abs(item.interface.processValuePct - item.interface.setpointPct);
      if (Math.abs(item.total.processValuePct - item.total.setpointPct) > DEFAULT_SIMULATION.totalTargetBandPct) totalOutsideS += DEFAULT_SIMULATION.chartSampleS;
      if (Math.abs(item.interface.processValuePct - item.interface.setpointPct) > DEFAULT_SIMULATION.interfaceTargetBandPct) interfaceOutsideS += DEFAULT_SIMULATION.chartSampleS;
      const previous = simulation.samples[index - 1];
      if (previous) {
        oilTravelPct += Math.abs(item.total.valvePositionPct - previous.total.valvePositionPct);
        waterTravelPct += Math.abs(item.interface.valvePositionPct - previous.interface.valvePositionPct);
      }
    }
    const count = Math.max(1, simulation.samples.length);
    return {
      totalMaePct: totalAbsoluteError / count,
      interfaceMaePct: interfaceAbsoluteError / count,
      totalOutsideS,
      interfaceOutsideS,
      oilTravelPct,
      waterTravelPct,
      maximumTotalPct,
      minimumInterfacePct,
    };
  }, [sample.interface.processValuePct, sample.total.processValuePct, simulation.samples]);
  const safety = sample.safety.severity === "trip"
    ? "TRIPPED"
    : sample.safety.severity.toUpperCase();
  const previousSeverity = useRef(sample.safety.severity);
  const [safetyAnnouncement, setSafetyAnnouncement] = useState("");
  useEffect(() => {
    if (sample.safety.severity !== previousSeverity.current) {
      previousSeverity.current = sample.safety.severity;
      setSafetyAnnouncement(`Safety changed to ${sample.safety.severity}: ${sample.safety.label}`);
    }
  }, [sample.safety.label, sample.safety.severity]);

  const retry = () => simulation.reset();

  return (
    <main className="app-shell">
      <a className="skip-link" href="#control-room">Skip to simulator</a>
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true"><i /><i /><i /></div>
        <div className="brand-copy">
          <p>PROCESS CONTROL LAB / CHALLENGE 01</p>
          <h1>Separator Control Challenge</h1>
        </div>
        <div className="header-disclaimer">
          <BookOpen aria-hidden="true" />
          <span><strong>Educational simulator</strong>Not for field operation or equipment sizing</span>
        </div>
      </header>

      <section aria-label="Current attempt status" className="status-strip">
        <div><span className={`safety-indicator ${safety.toLowerCase()}`}><ShieldCheck aria-hidden="true" /> {safety}</span><small>Safety status</small></div>
        <div><strong className="timer"><Clock3 aria-hidden="true" /> {formatTime(DEFAULT_SIMULATION.durationS - sample.timeS)}</strong><small>Time remaining</small></div>
        <div><strong>{simulation.result?.score.total ?? "—"}<em>/100</em></strong><small>Current score</small></div>
        <div className="disturbance-status"><strong><Activity aria-hidden="true" /> {sample.disturbance}</strong><small>Active disturbance</small></div>
        <div><strong>{scenario.seed}</strong><small>Deterministic seed</small></div>
      </section>
      <p aria-live="assertive" className="sr-only">{safetyAnnouncement}</p>

      <div id="control-room" className="control-room">
        <ScenarioSelector
          disabled={locked}
          value={scenarioId}
          onChange={setScenarioId}
        />

        {simulation.error && (
          <div className="error-banner" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span><strong>Simulation worker unavailable.</strong> {simulation.error}</span>
            <button className="secondary-button" type="button" onClick={simulation.retryWorker}>Retry simulation worker</button>
          </div>
        )}

        <DualPidControls
            config={pid}
            hero={<ProcessHero sample={sample} status={simulation.status} />}
            locked={locked}
            ready={simulation.ready}
            sample={sample}
            speed={simulation.speed}
            status={simulation.status}
            onChange={setPid}
            onPause={simulation.pause}
            onReset={simulation.reset}
            onResume={simulation.resume}
            onSpeedChange={simulation.setSpeed}
            onStart={simulation.start}
          />

        <section aria-label="Live performance metrics" className="metrics-grid">
          <article><TrendingUp aria-hidden="true" /><span>Total level</span><strong>{sample.total.processValuePct.toFixed(1)}%</strong><small>MAE {live.totalMaePct.toFixed(1)}% · peak {live.maximumTotalPct.toFixed(1)}%</small></article>
          <article><Crosshair aria-hidden="true" /><span>Oil/water interface</span><strong>{sample.interface.processValuePct.toFixed(1)}%</strong><small>MAE {live.interfaceMaePct.toFixed(1)}% · low {live.minimumInterfacePct.toFixed(1)}%</small></article>
          <article><SlidersHorizontal aria-hidden="true" /><span>Oil valve LV-101</span><strong>{sample.total.valvePositionPct.toFixed(1)}%</strong><small>Command {sample.total.valveCommandPct.toFixed(1)}% · travel {live.oilTravelPct.toFixed(1)}%</small></article>
          <article><SlidersHorizontal aria-hidden="true" /><span>Water valve WV-101</span><strong>{sample.interface.valvePositionPct.toFixed(1)}%</strong><small>Command {sample.interface.valveCommandPct.toFixed(1)}% · travel {live.waterTravelPct.toFixed(1)}%</small></article>
          <article><Activity aria-hidden="true" /><span>Safety envelope</span><strong>{sample.safety.label}</strong><small>Total outside {live.totalOutsideS.toFixed(1)} s · interface {live.interfaceOutsideS.toFixed(1)} s</small></article>
          <article className="coach-metric"><BookOpen aria-hidden="true" /><span>Control note</span><p>{tuningTip(pid.total, scenarioId)}</p></article>
        </section>

        <TrendCharts samples={simulation.samples} />

        <footer className="simulator-footer">
          <span>FIXED STEP 0.05 s</span><span>CLIENT-SIDE PHYSICS</span><span>NO RUNTIME AI</span>
          <p>Coupled oil/water inventories · simplified hydraulics · educational use only</p>
        </footer>
      </div>

      {simulation.result && (
        <ResultPanel
          result={simulation.result}
          onClose={simulation.dismissResult}
          onRetry={retry}
        />
      )}
    </main>
  );
}
