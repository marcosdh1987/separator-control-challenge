"use client";

import { Box, Network } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { EvidenceLine } from "./evidence-badges";
import { ReplayControls, type TimelineMarker } from "./replay-controls";
import { ResearchCharts, type ChartRun } from "./research-charts";
import { ResearchDisclaimer, ResearchHeader } from "./research-header";
import { ClaimsPanel, LearningPanel, MetricsTable, ProvenancePanel, type PanelRun } from "./research-panels";
import { ResearchPid } from "./research-pid";
import { ProjectAttribution } from "@/components/project-attribution";
import { SceneErrorBoundary } from "@/components/scene/scene-error-boundary";
import { usePlaybackClock } from "@/hooks/use-playback-clock";
import { useExperimentData, useResearchIndex } from "@/hooks/use-research-data";
import { useLocale, useMessages } from "@/lib/i18n/provider";
import { alignRuns, commonPhases, compatibility } from "@/lib/research/alignment";
import {
  CONTROLLER_STYLE,
  EXPERIMENTS,
  experimentReplayIds,
  type ComparisonSet,
  type ExperimentDefinition,
  type ExperimentId,
} from "@/lib/research/catalog";
import { evaluateClaim } from "@/lib/research/claims";
import { SIGNAL_KEYS, type SignalKey } from "@/lib/research/contract";
import { verifyDigests, type DigestReport, type Replay } from "@/lib/research/decode";
import { codeLabel, describeEvent } from "@/lib/research/describe";
import { formatNumber } from "@/lib/research/format";
import { isStopEvent, type StopPoint } from "@/lib/research/playback";
import { frameAt, type Frame, type Sample } from "@/lib/research/timeline";

const ResearchScene = dynamic(() => import("./research-scene").then((module) => module.ResearchScene), {
  ssr: false,
  loading: () => null,
});

/** How far before the anchor playback starts, so the change is seen coming. */
const PRE_ANCHOR_S = 120;
const ZOOM_MARGIN_S = 60;

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
    context?.getExtension("WEBGL_lose_context")?.loseContext();
    return Boolean(context);
  } catch {
    return false;
  }
}

function useWebGLAvailable(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setAvailable(supportsWebGL()); });
    return () => { active = false; };
  }, []);
  return available;
}

const known = (sample: Sample | undefined) => (sample && sample.provenance !== "missing" ? sample.value : Number.NaN);

function ValueRow({ label, sample, unit, digits }: { label: string; sample: Sample | undefined; unit: string; digits: number }) {
  const locale = useLocale();
  const provenance = sample?.provenance ?? "missing";
  return (
    <div className={`research-readout-row is-${provenance}`}>
      <dt>{label}</dt>
      <dd>{provenance === "missing" ? "—" : `${formatNumber(sample!.value, locale, digits)} ${unit}`}</dd>
    </div>
  );
}

function Readout({ frame, run, integrity }: { frame: Frame; run: ChartRun; integrity: DigestReport | undefined }) {
  const copy = useMessages().research;
  const s = frame.samples;
  const header = run.aligned.replay.header;
  const code = (table: string, sample: Sample | undefined) =>
    sample && sample.provenance !== "missing" ? codeLabel(copy, header.codeTables[table]?.codes?.[String(sample.value)] ?? sample.value) : "—";
  const alarms = (["alarm.pah", "alarm.lah", "alarm.high_water_level", "alarm.oil_overflow", "alarm.liquid_carryover"] as const)
    .filter((key) => known(s[key]) === 1)
    .map((key) => copy.events.alarms[key.split(".")[1]]);
  const v = copy.views;
  return (
    <aside aria-label={v.readout} className="research-readout">
      <p className={`research-frame is-${frame.provenance}`} data-testid="research-frame">
        {copy.player.frame[frame.provenance]}
      </p>
      <p className="research-note">{copy.player.frameHelp}</p>
      <p className="research-readout-phase"><strong>{copy.player.phase}:</strong> {frame.phase ?? "—"}</p>
      <dl>
        <ValueRow digits={2} label={copy.signals["pressure.truth"]} sample={s["pressure.truth"]} unit="bar a" />
        <ValueRow digits={2} label={copy.signals["loop.gas.sp"]} sample={s["loop.gas.sp"]} unit="bar" />
        <ValueRow digits={2} label={copy.signals["level.total.truth"]} sample={s["level.total.truth"]} unit="%" />
        <ValueRow digits={2} label={copy.signals["loop.oil.sp"]} sample={s["loop.oil.sp"]} unit="%" />
        <ValueRow digits={2} label={copy.signals["level.interface.truth"]} sample={s["level.interface.truth"]} unit="%" />
        <ValueRow digits={2} label={copy.signals["loop.water.sp"]} sample={s["loop.water.sp"]} unit="%" />
        <ValueRow digits={1} label={`PCV-101 ${v.command}`} sample={s["valve.gas.command"]} unit="%" />
        <ValueRow digits={1} label={`PCV-101 ${v.stem}`} sample={s["valve.gas.stem"]} unit="%" />
        <ValueRow digits={1} label={`LCV-102 ${v.command}`} sample={s["valve.oil.command"]} unit="%" />
        <ValueRow digits={1} label={`LCV-102 ${v.stem}`} sample={s["valve.oil.stem"]} unit="%" />
        <ValueRow digits={1} label={`LCV-103 ${v.command}`} sample={s["valve.water.command"]} unit="%" />
        <ValueRow digits={1} label={`LCV-103 ${v.stem}`} sample={s["valve.water.stem"]} unit="%" />
        <ValueRow digits={2} label={copy.signals["flow.inlet_liquid.truth"]} sample={s["flow.inlet_liquid.truth"]} unit="m³/h" />
        <ValueRow digits={2} label={copy.signals["flow.oil.truth"]} sample={s["flow.oil.truth"]} unit="m³/h" />
        <ValueRow digits={2} label={copy.signals["flow.water.truth"]} sample={s["flow.water.truth"]} unit="m³/h" />
        <ValueRow digits={0} label={copy.signals["flow.gas_std.truth"]} sample={s["flow.gas_std.truth"]} unit="Sm³/h" />
        <div className="research-readout-row"><dt>{copy.pid.plant}</dt><dd>{code("plant.state", s["plant.state"])}</dd></div>
        <div className="research-readout-row"><dt>{copy.pid.well}</dt><dd>{code("well.nodal_status", s["well.nodal_status"])}</dd></div>
        <div className={`research-readout-row ${alarms.length ? "is-alarm" : ""}`}><dt>{copy.pid.alarms}</dt><dd>{alarms.length ? alarms.join(", ") : copy.pid.none}</dd></div>
      </dl>
      <p className={`research-integrity is-${integrity?.status ?? "checking"}`}>
        {!integrity
          ? copy.player.integrity.checking
          : integrity.status === "verified"
            ? copy.player.integrity.verified(integrity.checked)
            : integrity.status === "mismatch"
              ? copy.player.integrity.mismatch(integrity.failures.join(", "))
              : copy.player.integrity.unavailable}
      </p>
    </aside>
  );
}

/** What the player needs from an experiment: which charts and which loop to feature. */
export type ViewConfig = Pick<ExperimentDefinition, "charts" | "focusLoop">;

interface AlignedPlayerProps {
  experiment: ViewConfig;
  initialZoom?: "phase" | "full";
  runs: PanelRun[];
  anchorPhase: string;
  phases: string[];
  onAnchorChange: (phase: string) => void;
  integrity: Record<string, DigestReport>;
}

export function AlignedPlayer({ experiment, runs, anchorPhase, phases, onAnchorChange, integrity, initialZoom = "phase" }: AlignedPlayerProps) {
  const copy = useMessages().research;
  const locale = useLocale();
  const webgl = useWebGLAvailable();
  const [view, setView] = useState<"scene" | "technical">("scene");
  const [focus, setFocus] = useState(0);
  const [zoom, setZoom] = useState<"phase" | "full">(initialZoom);

  const alignment = useMemo(() => alignRuns(runs.map((run) => run.replay), { kind: "phase", phase: anchorPhase }), [runs, anchorPhase]);
  const chartRuns: ChartRun[] = useMemo(
    () => runs.map((run, index) => ({ aligned: alignment.runs[index], controller: run.controller, name: run.name })),
    [runs, alignment],
  );
  const stops: StopPoint[] = useMemo(() => chartRuns
    .flatMap((run) => run.aligned.replay.events.filter(isStopEvent).map((event) => ({
      id: `${run.aligned.replay.id}:${event.id}`,
      tS: event.tS - run.aligned.offsetS,
      label: `${run.name}: ${describeEvent(event, copy, locale)}`,
    })))
    .sort((a, b) => a.tS - b.tS), [chartRuns, copy, locale]);
  const markers: TimelineMarker[] = useMemo(() => chartRuns.flatMap((run) => run.aligned.replay.events
    .filter(isStopEvent)
    .map((event) => ({
      id: `${run.aligned.replay.id}:${event.id}`,
      tS: event.tS - run.aligned.offsetS,
      label: `${run.name}: ${describeEvent(event, copy, locale)}`,
      severity: event.severity,
      color: CONTROLLER_STYLE[run.controller].color,
    }))), [chartRuns, copy, locale]);

  const [state, dispatch] = usePlaybackClock(alignment.minS, alignment.maxS, Math.max(alignment.minS, -PRE_ANCHOR_S), stops);
  const focusRun = chartRuns[Math.min(focus, chartRuns.length - 1)];
  const frame = frameAt(focusRun.aligned.replay, state.tS + focusRun.aligned.offsetS, SIGNAL_KEYS as SignalKey[]);
  const s = frame.samples;

  const phaseSpan = Math.max(...chartRuns.map((run) => {
    const phase = run.aligned.replay.phases.find((candidate) => candidate.name === anchorPhase);
    return phase ? phase.endS - phase.startS + run.aligned.replay.dtS : 0;
  }));
  const [x0, x1] = zoom === "full" || phaseSpan <= 0
    ? [alignment.minS, alignment.maxS]
    : [Math.max(alignment.minS, -ZOOM_MARGIN_S), Math.min(alignment.maxS, phaseSpan + ZOOM_MARGIN_S)];

  const comp = compatibility(runs.map((run) => run.replay));
  const sceneFrame = {
    timeS: frame.tS,
    totalPct: known(s["level.total.truth"]),
    interfacePct: known(s["level.interface.truth"]),
    inletM3H: known(s["flow.inlet_liquid.truth"]),
    oilM3H: known(s["flow.oil.truth"]),
    waterM3H: known(s["flow.water.truth"]),
    oilCommandPct: known(s["valve.oil.command"]),
    oilStemPct: known(s["valve.oil.stem"]),
    waterCommandPct: known(s["valve.water.command"]),
    waterStemPct: known(s["valve.water.stem"]),
  };
  const valveLabel = (cmd: number, stem: number) =>
    `${copy.views.command} ${formatNumber(cmd, locale, 1)}% · ${copy.views.stem} ${formatNumber(stem, locale, 1)}%`;
  const showScene = view === "scene" && webgl === true;

  return (
    <section aria-label={copy.compare.heading} className="research-player">
      <div className="research-compare">
        <h2 className="research-section-title">{runs.length > 1 ? copy.compare.heading : copy.provenance.run}</h2>
        <ul className="research-run-legend">
          {chartRuns.map((run) => (
            <li key={run.aligned.replay.id} title={copy.controllerHelp[run.controller]}>
              <span aria-hidden="true" className="research-swatch" style={{ borderColor: CONTROLLER_STYLE[run.controller].color, borderStyle: CONTROLLER_STYLE[run.controller].dash ? "dashed" : "solid" }} />
              <strong>{run.name}</strong> <small>{copy.controllerHelp[run.controller]}</small>
            </li>
          ))}
        </ul>
        {runs.length > 1 ? (
          <p className={comp.paired ? "research-ok" : "research-warning"}>
            {comp.paired ? copy.compare.paired(comp.scenarios[0], comp.seeds[0]) : copy.compare.notPaired}
          </p>
        ) : null}
        <div className="research-compare-row">
          <label>
            {copy.compare.anchor}{" "}
            <select onChange={(event) => onAnchorChange(event.target.value)} value={anchorPhase}>
              {phases.map((phase) => <option key={phase} value={phase}>{phase}</option>)}
            </select>
          </label>
          <span>{copy.compare.aligned(anchorPhase)}</span>
        </div>
        <ul className="research-shifts" data-testid="research-shifts">
          {alignment.runs.every((run) => run.shiftS === 0)
            ? <li>{copy.compare.noShift}</li>
            : chartRuns.map((run) => (
              <li key={run.aligned.replay.id}>
                {copy.compare.shift(run.name, formatNumber(run.aligned.anchorS, locale, 0), formatNumber(run.aligned.shiftS, locale, 0))}
              </li>
            ))}
          {alignment.missingAnchor.length > 0 ? <li>{copy.compare.missingAnchor(alignment.missingAnchor.join(", "))}</li> : null}
        </ul>
      </div>

      <ReplayControls anchorPhase={anchorPhase} dispatch={dispatch} markers={markers} state={state} stops={stops} />

      <div className="research-stage">
        <div className="research-view">
          <div className="research-view-bar">
            <div aria-label={copy.views.label} className="research-tabs" role="group">
              <button aria-pressed={view === "scene"} onClick={() => setView("scene")} type="button"><Box aria-hidden="true" /> {copy.views.scene}</button>
              <button aria-pressed={view === "technical"} onClick={() => setView("technical")} type="button"><Network aria-hidden="true" /> {copy.views.technical}</button>
            </div>
            {chartRuns.length > 1 ? (
              <label>
                {copy.views.focusRun}{" "}
                <select onChange={(event) => setFocus(Number(event.target.value))} value={focus}>
                  {chartRuns.map((run, index) => <option key={run.aligned.replay.id} value={index}>{run.name}</option>)}
                </select>
              </label>
            ) : null}
          </div>
          <div className="research-view-canvas">
            {showScene ? (
              <SceneErrorBoundary fallback={<p className="research-warning">{copy.views.sceneUnavailable}</p>} resetKey={focusRun.aligned.replay.id}>
                <ResearchScene
                  frame={sceneFrame}
                  labels={{
                    oilValve: valveLabel(sceneFrame.oilCommandPct, sceneFrame.oilStemPct),
                    waterValve: valveLabel(sceneFrame.waterCommandPct, sceneFrame.waterStemPct),
                  }}
                  playing={state.playing}
                />
              </SceneErrorBoundary>
            ) : (
              <>
                {view === "scene" && webgl === false ? <p className="research-warning">{copy.views.sceneUnavailable}</p> : null}
                <ResearchPid codeTables={focusRun.aligned.replay.header.codeTables} frame={frame} title={copy.pid.title} />
              </>
            )}
          </div>
          <ul className="research-view-notes">
            {showScene ? <><li>{copy.views.schematicNote}</li><li>{copy.views.illustrative}</li><li>{copy.views.gasNote}</li></> : null}
          </ul>
        </div>
        <Readout frame={frame} integrity={integrity[focusRun.aligned.replay.id]} run={focusRun} />
      </div>

      <div className="research-zoom" role="group" aria-label={copy.charts.zoom.label}>
        <span>{copy.charts.zoom.label}:</span>
        <button aria-pressed={zoom === "phase"} onClick={() => setZoom("phase")} type="button">{copy.charts.zoom.phase(anchorPhase)}</button>
        <button aria-pressed={zoom === "full"} onClick={() => setZoom("full")} type="button">{copy.charts.zoom.full}</button>
      </div>
      <ResearchCharts charts={experiment.charts} cursorS={state.tS} onSeek={(t) => dispatch({ type: "seek", tS: t })} runs={chartRuns} x0={x0} x1={x1} />
      <MetricsTable experiment={experiment} runs={runs} />
    </section>
  );
}

function ComparisonPlayer({ experiment, set, replays, integrity }: {
  experiment: ExperimentDefinition;
  set: ComparisonSet;
  replays: Map<string, Replay>;
  integrity: Record<string, DigestReport>;
}) {
  const copy = useMessages().research;
  const runs: PanelRun[] = useMemo(() => set.runs.map((run) => ({
    replay: replays.get(run.replayId)!,
    controller: run.controller,
    name: copy.controllers[run.controller],
  })), [set, replays, copy]);
  const phases = useMemo(() => commonPhases(runs.map((run) => run.replay)), [runs]);
  const [anchorPhase, setAnchorPhase] = useState(set.anchor.phase);
  return (
    <AlignedPlayer
      anchorPhase={anchorPhase}
      experiment={experiment}
      integrity={integrity}
      key={anchorPhase}
      onAnchorChange={setAnchorPhase}
      phases={phases}
      runs={runs}
    />
  );
}

export function ExperimentView({ experimentId }: { experimentId: ExperimentId }) {
  const copy = useMessages().research;
  const experiment = EXPERIMENTS[experimentId];
  const text = copy.experiments[experimentId];
  const [indexState, retryIndex] = useResearchIndex();
  const index = indexState.status === "ready" ? indexState.data : null;
  const replayIds = useMemo(() => experimentReplayIds(experiment), [experiment]);
  const [dataState, retryData] = useExperimentData(index, replayIds, experiment.campaignSummaryId);
  const [setId, setSetId] = useState(experiment.comparisons[0].id);
  const set = experiment.comparisons.find((candidate) => candidate.id === setId) ?? experiment.comparisons[0];
  const [integrity, setIntegrity] = useState<Record<string, DigestReport>>({});
  const data = dataState.status === "ready" ? dataState.data : null;

  useEffect(() => {
    if (!data) return;
    let active = true;
    Promise.all([...data.replays.values()].map(async (replay) => [replay.id, await verifyDigests(replay)] as const)).then((entries) => {
      if (active) setIntegrity(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [data]);

  const claims = useMemo(
    () => (data ? experiment.claims.map((claim) => evaluateClaim(claim, { replays: data.replays, campaign: data.campaign })) : []),
    [data, experiment],
  );
  const failed = indexState.status === "error" || dataState.status === "error";
  const uncertainties = data ? [...data.replays.values()][0]?.header.evidence.modelUncertainties ?? [] : [];
  const setRuns: PanelRun[] = data
    ? set.runs.map((run) => ({ replay: data.replays.get(run.replayId)!, controller: run.controller, name: copy.controllers[run.controller] }))
    : [];

  return (
    <main className="research-shell">
      <ResearchHeader back={{ href: "/research", label: copy.nav.backToLab }} eyebrow={`${copy.page.eyebrow} · ${experiment.campaign}`} title={text.title} />
      <EvidenceLine seeds={experiment.seeds} stage={experiment.stage} />
      <p className="research-intro">{text.question}</p>
      <p className="research-summary">{text.summary}</p>
      <ResearchDisclaimer compact />

      {experiment.comparisons.length > 1 ? (
        <fieldset className="research-sets">
          <legend>{copy.compare.set}</legend>
          {experiment.comparisons.map((candidate) => (
            <button aria-pressed={candidate.id === set.id} key={candidate.id} onClick={() => setSetId(candidate.id)} type="button">
              {text.comparisonLabels[candidate.id] ?? candidate.id}
            </button>
          ))}
        </fieldset>
      ) : null}

      {!failed && !data ? <p className="research-loading" role="status">{copy.player.loading}</p> : null}
      {failed ? (
        <div className="research-error" role="alert">
          <p>{copy.player.loadFailed}</p>
          <button className="secondary-button" onClick={() => { retryIndex(); retryData(); }} type="button">{copy.player.retry}</button>
        </div>
      ) : null}
      {data ? <ComparisonPlayer experiment={experiment} integrity={integrity} key={set.id} replays={data.replays} set={set} /> : null}
      {data ? <ClaimsPanel results={claims} /> : null}
      <LearningPanel experiment={experiment} uncertainties={uncertainties} />
      {data ? <ProvenancePanel runs={setRuns} /> : null}
      <ProjectAttribution variant="compact" />
    </main>
  );
}
