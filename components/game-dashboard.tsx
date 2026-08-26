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
import { GuidedTour } from "./onboarding/guided-tour";
import { QuickStartModal } from "./onboarding/quick-start-modal";
import { ControlCoach } from "./education/control-coach";
import { PidLearningPanel } from "./education/pid-learning-panel";
import { TuningDebrief, type TuningAttempt } from "./education/tuning-debrief";
import { LanguageSwitcher } from "./language-switcher";
import { useOnboarding } from "@/hooks/use-onboarding";
import { useSimulation } from "@/hooks/use-simulation";
import { gainAdvisory } from "@/lib/education/diagnosis";
import type { GainForm } from "@/lib/education/gain-forms";
import { formatMillimetres, formatMinutes, levelToMillimetres, marginToMillimetres, residenceTimeMinutes } from "@/lib/education/units";
import { LIQUID_LOOP_EXPLANATION_IDS, LOOP_EXPLANATION_IDS } from "@/lib/education/pid-content";
import { useMessages } from "@/lib/i18n/provider";
import { FIRST_SCORED_SCENARIO } from "@/lib/onboarding/scenario-guidance";
import { analyseRun } from "@/lib/simulation/analysis";
import { getScenario } from "@/lib/simulation/scenarios";
import {
  DEFAULT_DUAL_PID,
  DEFAULT_PRESSURE_PID,
  DEFAULT_SIMULATION,
  DEFAULT_SIMULATION_WITH_GAS,
  type DualPidConfig,
  type RunResult,
  type ScenarioId,
} from "@/lib/simulation/types";

const formatTime = (seconds: number) => {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(safe / 60).toString().padStart(2, "0")}:${(safe % 60).toString().padStart(2, "0")}`;
};

export function GameDashboard() {
  const messages = useMessages();
  const copy = messages.challenge;
  const onboarding = useOnboarding();
  const [pid, setPid] = useState<DualPidConfig>(DEFAULT_DUAL_PID);
  const [scenarioId, setScenarioId] = useState<ScenarioId>(FIRST_SCORED_SCENARIO);
  const [gasEnabled, setGasEnabled] = useState(false);
  const [gainForm, setGainForm] = useState<GainForm>("parallel");
  // Kept so the debrief can say what changed between this attempt and the last one.
  const [previousAttempt, setPreviousAttempt] = useState<TuningAttempt | null>(null);
  const [currentAttempt, setCurrentAttempt] = useState<TuningAttempt | null>(null);
  const [quickStartClosedForSession, setQuickStartClosedForSession] = useState(false);
  const [guidedTourRequested, setGuidedTourRequested] = useState(false);
  const config = gasEnabled ? DEFAULT_SIMULATION_WITH_GAS : DEFAULT_SIMULATION;
  const pidBank = useMemo(
    () => (gasEnabled ? { ...pid, pressure: pid.pressure ?? DEFAULT_PRESSURE_PID } : { total: pid.total, interface: pid.interface }),
    [gasEnabled, pid],
  );
  const simulation = useSimulation(pidBank, scenarioId, config);
  const sample = simulation.currentSample;
  const locked = simulation.status !== "idle";
  const scenario = getScenario(scenarioId);
  const advisoryId = gainAdvisory(pid.total, { noisyMeasurement: scenarioId === "noisy-interface" });
  const advisory = advisoryId ? messages.education.diagnosisPattern[advisoryId] : null;
  const controlNote = advisory
    ? `${advisory.title}: ${advisory.suggestion}`
    : messages.education.gainAdvisoryFallback;
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
  const safetyLabel = sample.safety.severity === "trip"
    ? copy.status.tripped
    : sample.safety.severity === "alarm"
      ? copy.status.alarm
      : copy.status.safe;
  const safetyCondition = messages.simulation.safetyCondition[sample.safety.condition];
  const previousSeverity = useRef(sample.safety.severity);
  const [safetyAnnouncement, setSafetyAnnouncement] = useState("");
  const [resultDismissed, setResultDismissed] = useState(false);
  const [freshAttemptPending, setFreshAttemptPending] = useState(false);
  useEffect(() => {
    if (sample.safety.severity !== previousSeverity.current) {
      previousSeverity.current = sample.safety.severity;
      setSafetyAnnouncement(copy.status.safetyAnnouncement(
        copy.status.severity[sample.safety.severity],
        safetyCondition,
      ));
    }
  }, [copy.status, safetyCondition, sample.safety.severity]);

  const gradedResultRef = useRef<RunResult | null>(null);
  useEffect(() => {
    const result = simulation.result;
    if (!result || gradedResultRef.current === result) return;
    gradedResultRef.current = result;
    const attempt: TuningAttempt = {
      analysis: analyseRun(simulation.samples, config, { startS: scenario.disturbanceStartS }),
      pid: pidBank,
    };
    setPreviousAttempt(currentAttempt);
    setCurrentAttempt(attempt);
  }, [config, currentAttempt, pidBank, scenario.disturbanceStartS, simulation.result, simulation.samples]);

  useEffect(() => {
    const terminal = simulation.status === "completed" || simulation.status === "tripped";
    if (!freshAttemptPending || terminal) return;
    const timer = window.setTimeout(() => setFreshAttemptPending(false), 0);
    return () => window.clearTimeout(timer);
  }, [freshAttemptPending, simulation.status]);

  const retry = () => {
    setResultDismissed(false);
    setFreshAttemptPending(true);
    simulation.reset();
  };
  const resetAttempt = () => {
    setResultDismissed(false);
    setFreshAttemptPending(true);
    simulation.reset();
  };
  const startAttempt = () => {
    setResultDismissed(false);
    setFreshAttemptPending(true);
    simulation.start();
  };
  const dismissResult = () => {
    setResultDismissed(true);
    simulation.dismissResult();
  };
  const hasFinalScore = Boolean(simulation.result);
  const showQuickStart = onboarding.hydrated
    && !onboarding.flags.quickStartDismissed
    && !quickStartClosedForSession;
  const scoreSummary = hasFinalScore
    ? simulation.result!.score.total
    : simulation.status === "idle"
      ? copy.scoreSummary.notStarted
      : simulation.status === "completed" || simulation.status === "tripped"
        ? freshAttemptPending
          ? copy.scoreSummary.preparing
          : resultDismissed
          ? copy.scoreSummary.closed
          : copy.scoreSummary.calculating
      : simulation.status === "error"
        ? copy.scoreSummary.unavailable
      : copy.scoreSummary.pending;

  return (
    <main className="app-shell">
      <a className="skip-link" href="#control-room">{copy.header.skipToSimulator}</a>
      <header className="site-header">
        <div className="brand-mark" aria-hidden="true"><i /><i /><i /></div>
        <div className="brand-copy">
          <p>{copy.header.eyebrow}</p>
          <h1>{messages.common.appName}</h1>
        </div>
        <div className="header-disclaimer">
          <BookOpen aria-hidden="true" />
          <span><strong>{copy.header.disclaimerTitle}</strong>{copy.header.disclaimerBody}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <section aria-label={copy.status.regionLabel} className="status-strip">
        <div data-tour="score-safety"><span className={`safety-indicator ${sample.safety.severity === "trip" ? "tripped" : sample.safety.severity}`}><ShieldCheck aria-hidden="true" /> {safetyLabel}</span><small>{copy.status.safety}</small></div>
        <div><strong className="timer"><Clock3 aria-hidden="true" /> {formatTime(DEFAULT_SIMULATION.durationS - sample.timeS)}</strong><small>{copy.status.timeRemaining}</small></div>
        <div className="score-status"><strong>{scoreSummary}{hasFinalScore ? <em>/100</em> : null}</strong><small>{hasFinalScore ? copy.status.finalScore : copy.status.scoreStatus}</small></div>
        <div className="disturbance-status"><strong><Activity aria-hidden="true" /> {messages.simulation.disturbance[sample.disturbance]}</strong><small>{copy.status.activeDisturbance}</small></div>
      </section>
      <p aria-live="assertive" className="sr-only">{safetyAnnouncement}</p>

      <div id="control-room" className="control-room">
        <ScenarioSelector
          disabled={locked}
          value={scenarioId}
          onChange={setScenarioId}
        />

        <div className="notation-toggle">
          <span id="gain-form-label">{copy.controller.gainFormLabel}</span>
          <div aria-labelledby="gain-form-label" className="notation-options" role="group">
            {(["parallel", "standard"] as const).map((form) => (
              <button
                aria-pressed={gainForm === form}
                disabled={locked}
                key={form}
                onClick={() => setGainForm(form)}
                type="button"
              >
                {form === "parallel" ? copy.controller.gainFormParallel : copy.controller.gainFormStandard}
              </button>
            ))}
          </div>
          <p>{copy.controller.gainFormHint}</p>
        </div>

        <div className="gas-toggle">
          <label htmlFor="gas-cap-toggle">
            <input
              checked={gasEnabled}
              disabled={locked}
              id="gas-cap-toggle"
              onChange={(event) => setGasEnabled(event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>{copy.transport.gasToggle}</strong>
              <em>{gasEnabled ? copy.transport.gasOn : copy.transport.gasOff}</em>
            </span>
          </label>
          <p>{copy.transport.gasToggleHint}</p>
        </div>

        {simulation.error && (
          <div className="error-banner" role="alert">
            <AlertTriangle aria-hidden="true" />
            <span><strong>{copy.error.workerUnavailableTitle}</strong> {simulation.error}</span>
            <button className="secondary-button" type="button" onClick={simulation.retryWorker}>{copy.error.retryWorker}</button>
          </div>
        )}

        <DualPidControls
            config={pidBank}
            gainForm={gainForm}
            hero={<ProcessHero sample={sample} status={simulation.status} />}
            locked={locked}
            ready={simulation.ready}
            sample={sample}
            speed={simulation.speed}
            status={simulation.status}
            onChange={setPid}
            onPause={simulation.pause}
            onReset={resetAttempt}
            onResume={simulation.resume}
            onSpeedChange={simulation.setSpeed}
            onStart={startAttempt}
          />

        {currentAttempt && simulation.result ? (
          <>
            <ControlCoach
              analysis={currentAttempt.analysis}
              metrics={simulation.result.metrics}
              noisyMeasurement={scenarioId === "noisy-interface"}
              pid={pidBank}
              onApplyPreset={setPid}
            />
            <TuningDebrief current={currentAttempt} previous={previousAttempt} />
          </>
        ) : null}

        <PidLearningPanel loopIds={gasEnabled ? LOOP_EXPLANATION_IDS : LIQUID_LOOP_EXPLANATION_IDS} />

        <section aria-label={copy.metrics.regionLabel} className="metrics-grid">
          <article><TrendingUp aria-hidden="true" /><span>{copy.metrics.totalLevel}</span><strong>{sample.total.processValuePct.toFixed(1)}%</strong><small>{copy.controller.levelInMillimetres(formatMillimetres(levelToMillimetres(sample.total.processValuePct)))} · {copy.controller.marginToHighAlarm(formatMillimetres(marginToMillimetres(sample.total.processValuePct, DEFAULT_SIMULATION.totalHighAlarmPct)))}</small></article>
          <article><Crosshair aria-hidden="true" /><span>{copy.metrics.interface}</span><strong>{sample.interface.processValuePct.toFixed(1)}%</strong><small>{copy.metrics.interfaceDetail(live.interfaceMaePct.toFixed(1), live.minimumInterfacePct.toFixed(1))}</small></article>
          <article><SlidersHorizontal aria-hidden="true" /><span>{copy.metrics.oilValve}</span><strong>{sample.total.valvePositionPct.toFixed(1)}%</strong><small>{copy.metrics.valveDetail(sample.total.valveCommandPct.toFixed(1), live.oilTravelPct.toFixed(1))}</small></article>
          <article><SlidersHorizontal aria-hidden="true" /><span>{copy.metrics.waterValve}</span><strong>{sample.interface.valvePositionPct.toFixed(1)}%</strong><small>{copy.metrics.valveDetail(sample.interface.valveCommandPct.toFixed(1), live.waterTravelPct.toFixed(1))}</small></article>
          <article><Activity aria-hidden="true" /><span>{copy.metrics.safetyEnvelope}</span><strong>{safetyCondition}</strong><small>{copy.metrics.safetyDetail(live.totalOutsideS.toFixed(1), live.interfaceOutsideS.toFixed(1))}</small></article>
          <article className="coach-metric"><BookOpen aria-hidden="true" /><span>{copy.metrics.controlNote}</span><p>{controlNote}</p></article>
        </section>

        <TrendCharts samples={simulation.samples} />

        <details className="run-details">
          <summary>{copy.controller.runDetails}</summary>
          <dl>
            <div><dt>{copy.status.deterministicSeed}</dt><dd>{scenario.seed}</dd></div>
            <div><dt>{copy.controller.residenceTime}</dt><dd>{formatMinutes(residenceTimeMinutes(sample.oilVolumeM3 + sample.waterVolumeM3, sample.flows.oilOutletM3H + sample.flows.waterOutletM3H))}</dd></div>
          </dl>
        </details>

        <footer className="simulator-footer">
          <span>{copy.footer.fixedStep}</span><span>{copy.footer.clientPhysics}</span><span>{messages.common.noRuntimeAi}</span>
          <p>{copy.footer.note}</p>
        </footer>
      </div>

      {simulation.result && (
        <ResultPanel
          result={simulation.result}
          onClose={dismissResult}
          onRetry={retry}
        />
      )}
      {showQuickStart && (
        <QuickStartModal
          onDismiss={(persist) => {
            setQuickStartClosedForSession(true);
            onboarding.dismissQuickStart(persist);
          }}
          onStartGuidedTour={() => {
            setQuickStartClosedForSession(true);
            setGuidedTourRequested(true);
          }}
        />
      )}
      <GuidedTour
        active={guidedTourRequested}
        onComplete={() => {
          setGuidedTourRequested(false);
          onboarding.dismissGuidedTour();
        }}
        onSkip={() => {
          setGuidedTourRequested(false);
          onboarding.dismissGuidedTour();
        }}
      />
    </main>
  );
}
