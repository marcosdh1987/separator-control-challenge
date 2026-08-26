"use client";

import { useId } from "react";

import {
  createMimicModel,
  type AlarmSeverity,
  type TransmitterBinding,
  type ValveBinding,
  type ValveTag,
} from "@/components/mimic/mimic-bindings";
import { useMessages } from "@/lib/i18n/provider";
import type { SimulationSample, SimulationStatus } from "@/lib/simulation/types";
import { createProcessSummary, formatEngineeringValue } from "@/lib/visualization/scene-model";

/**
 * ISA-5.1 piping and instrumentation view of the separator.
 *
 * The diagram is inline SVG rather than an imported asset so its geometry stays
 * typed, its text stays translatable, and every symbol binds to the sample
 * directly instead of through a second contract of element ids.
 */

const VIEW_WIDTH = 840;
const VIEW_HEIGHT = 500;

const VESSEL = { x: 230, y: 180, width: 370, height: 150 } as const;
const VESSEL_BOTTOM = VESSEL.y + VESSEL.height;

/** Nozzles sit on the flat part of the shell so no pipe ends short of a curve. */
const NOZZLE_X = { feed: 350, gas: 470, oil: 520, water: 330, pressureTap: 430 } as const;

/** Body half-width and half-height of a control-valve bowtie. */
const VALVE_HALF_WIDTH = 22;
const VALVE_HALF_HEIGHT = 17;
/** Stem length and diaphragm rise, measured up from the body centre. */
const VALVE_STEM_TOP = 36;
const VALVE_DOME_TOP = 49;

const BUBBLE_RADIUS = 22;

/** A phase band thinner than this cannot hold its label legibly. */
const MINIMUM_LABEL_BAND = 24;

const levelY = (fraction: number) => VESSEL_BOTTOM - fraction * VESSEL.height;

const PLACEMENT = {
  total: { x: 140, y: 205 },
  interface: { x: 140, y: 305 },
  pressure: { x: NOZZLE_X.pressureTap, y: 110 },
  totalController: { x: 60, y: 205 },
  interfaceController: { x: 60, y: 305 },
  pressureController: { x: 760, y: 60 },
  oilValve: { x: 700, y: 380 },
  waterValve: { x: 420, y: 450 },
  gasValve: { x: 660, y: 140 },
} as const satisfies Record<string, { x: number; y: number }>;

/**
 * ISA-18.2 asks that an alarm be distinguishable by more than colour, so alarm
 * and trip differ in shape and glyph as well: a triangle for an alarm that can
 * still be recovered, an octagon for the trip that has already stopped the run.
 */
function AlarmBadge({ severity, label, x, y }: { severity: Exclude<AlarmSeverity, "safe">; label: string; x: number; y: number }) {
  const octagon = Array.from({ length: 8 }, (_unused, step) => {
    const angle = (Math.PI / 4) * step + Math.PI / 8;
    return `${(x + 13 * Math.cos(angle)).toFixed(1)},${(y + 13 * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");

  return (
    <g className={`pid-alarm-badge is-${severity}`} data-severity={severity} data-testid={`pid-alarm-${severity}`}>
      <title>{label}</title>
      {severity === "trip" ? (
        <polygon points={octagon} />
      ) : (
        <polygon points={`${x},${y - 13} ${x + 13},${y + 10} ${x - 13},${y + 10}`} />
      )}
      <text textAnchor="middle" x={x} y={severity === "trip" ? y + 5 : y + 8}>
        {severity === "trip" ? "!!" : "!"}
      </text>
    </g>
  );
}

interface BubbleProps {
  tag: string;
  description: string;
  /** `field` is the plain circle of a field instrument; `shared` the circle in a
   *  square of a shared display and shared control function (the DCS faceplate). */
  kind: "field" | "shared";
  x: number;
  y: number;
  severity?: AlarmSeverity;
  severityLabel?: string;
}

function InstrumentBubble({ tag, description, kind, x, y, severity = "safe", severityLabel }: BubbleProps) {
  const [prefix, number] = tag.split("-");
  return (
    <g className={`pid-bubble is-${kind} severity-${severity}`} data-severity={severity} data-tag={tag}>
      <title>{`${tag} — ${description}`}</title>
      {kind === "shared" ? (
        <rect
          className="pid-bubble-frame"
          height={BUBBLE_RADIUS * 2}
          rx="3"
          width={BUBBLE_RADIUS * 2}
          x={x - BUBBLE_RADIUS}
          y={y - BUBBLE_RADIUS}
        />
      ) : null}
      <circle className="pid-bubble-body" cx={x} cy={y} r={BUBBLE_RADIUS} />
      <text className="pid-bubble-tag" textAnchor="middle" x={x} y={y - 2}>{prefix}</text>
      <text className="pid-bubble-tag" textAnchor="middle" x={x} y={y + 13}>{number}</text>
      {severity !== "safe" && severityLabel ? (
        <AlarmBadge label={`${tag} ${severityLabel}`} severity={severity} x={x + 30} y={y - 26} />
      ) : null}
    </g>
  );
}

interface ControlValveProps {
  valve: ValveBinding;
  description: string;
  reading: string;
  x: number;
  y: number;
  clipId: string;
}

/**
 * A globe body with a diaphragm actuator. The body fills from the seat upwards
 * with the actual stem position, so a shut valve reads as an empty bowtie before
 * the percentage beside it is read at all.
 */
function ControlValve({ valve, description, reading, x, y, clipId }: ControlValveProps) {
  const body = [
    `M ${x - VALVE_HALF_WIDTH} ${y - VALVE_HALF_HEIGHT}`,
    `L ${x - VALVE_HALF_WIDTH} ${y + VALVE_HALF_HEIGHT}`,
    `L ${x} ${y}`,
    `L ${x + VALVE_HALF_WIDTH} ${y + VALVE_HALF_HEIGHT}`,
    `L ${x + VALVE_HALF_WIDTH} ${y - VALVE_HALF_HEIGHT}`,
    `L ${x} ${y}`,
    "Z",
  ].join(" ");
  const fillHeight = 2 * VALVE_HALF_HEIGHT * valve.openFraction;

  return (
    <g
      className={`pid-valve state-${valve.state}`}
      data-open-fraction={valve.openFraction.toFixed(3)}
      data-tag={valve.tag}
      data-valve-state={valve.state}
    >
      <title>{`${valve.tag} — ${description}`}</title>
      <clipPath id={clipId}>
        <rect
          height={fillHeight}
          width={VALVE_HALF_WIDTH * 2}
          x={x - VALVE_HALF_WIDTH}
          y={y + VALVE_HALF_HEIGHT - fillHeight}
        />
      </clipPath>
      <line className="pid-valve-stem" x1={x} x2={x} y1={y - VALVE_HALF_HEIGHT} y2={y - VALVE_STEM_TOP} />
      <path
        className="pid-valve-actuator"
        d={`M ${x - 19} ${y - VALVE_STEM_TOP} A 19 ${VALVE_DOME_TOP - VALVE_STEM_TOP} 0 0 1 ${x + 19} ${y - VALVE_STEM_TOP} Z`}
      />
      <path className="pid-valve-body" d={body} />
      <path className="pid-valve-fill" clipPath={`url(#${clipId})`} d={body} />
      <text className="pid-valve-tag" textAnchor="middle" x={x} y={y - VALVE_DOME_TOP - 25}>{valve.tag}</text>
      <text className="pid-valve-reading" textAnchor="middle" x={x} y={y - VALVE_DOME_TOP - 13}>{reading}</text>
    </g>
  );
}

function SignalLine({ points }: { points: readonly (readonly [number, number])[] }) {
  return <polyline className="pid-signal" points={points.map(([x, y]) => `${x},${y}`).join(" ")} />;
}

interface SeparatorMimicProps {
  sample: SimulationSample;
  status: SimulationStatus;
}

export function SeparatorMimic({ sample, status }: SeparatorMimicProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const id = (name: string) => `${name}-${reactId}`;
  const messages = useMessages();
  const copy = messages.challenge.pid;
  const model = createMimicModel(sample);
  const safetyCondition = messages.simulation.safetyCondition[sample.safety.condition];
  const summary = createProcessSummary(sample, messages.challenge.processSummary, safetyCondition);

  const percent = (value: number) => formatEngineeringValue(value, { unit: copy.units.percent, separator: "" });
  const pressure = (value: number) => formatEngineeringValue(value, { unit: copy.units.barGauge, digits: 2 });
  const liquidFlow = (value: number) => formatEngineeringValue(value, { unit: copy.units.liquidFlow });
  const gasFlow = (value: number) => formatEngineeringValue(value, { unit: copy.units.gasFlow, digits: 0 });
  const severityWord = (severity: AlarmSeverity) =>
    severity === "trip" ? copy.severity.trip : severity === "alarm" ? copy.severity.alarm : "";

  const transmitterValue = (transmitter: TransmitterBinding) => {
    const format = transmitter.unit === "barGauge" ? pressure : percent;
    const base = copy.measuredReading(format(transmitter.processValue), format(transmitter.setpoint));
    return transmitter.severity === "safe" ? base : copy.withState(base, severityWord(transmitter.severity));
  };
  const valveValue = (valve: ValveBinding) =>
    copy.withState(percent(valve.openFraction * 100), copy.valveState[valve.state]);
  const valveClip = (tag: ValveTag) => id(`valve-${tag}`);

  const totalY = levelY(model.levels.totalFraction);
  const interfaceY = levelY(model.levels.interfaceFraction);
  const motionActive = status === "running" && model.safety.severity !== "trip";

  return (
    <div
      className={`pid-mimic safety-${model.safety.severity}`}
      data-gas-enabled={model.gasEnabled ? "true" : "false"}
      data-testid="pid-mimic"
    >
      {/* A P&ID has a legibility floor: below it the drawing scrolls sideways in its
          own frame rather than shrinking its tags past reading size on a phone. */}
      <div className="pid-diagram-frame">
        <svg
          aria-label={`${copy.diagramLabel}. ${summary}`}
          className="pid-diagram"
          role="img"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        >
          <defs>
            <linearGradient id={id("shell")} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--steel-light)" />
              <stop offset="100%" stopColor="var(--steel-dark)" />
            </linearGradient>
            <clipPath id={id("vessel-clip")}>
              <rect height={VESSEL.height} rx={VESSEL.height / 2} width={VESSEL.width} x={VESSEL.x} y={VESSEL.y} />
            </clipPath>
            <marker id={id("flow-arrow")} markerHeight="9" markerWidth="9" orient="auto" refX="8" refY="4.5">
              <path className="pid-flow-arrow" d="M0 0 L9 4.5 L0 9 Z" />
            </marker>
          </defs>

          {/* Signals are drawn first: where a process line crosses one, the heavier
              process stroke breaks it, which is how a crossing is read on paper. */}
          <g className="pid-signals">
            <SignalLine points={[[118, 205], [82, 205]]} />
            <SignalLine points={[[118, 305], [82, 305]]} />
            <SignalLine points={[[60, 183], [60, 25], [800, 25], [800, 300], [700, 300], [700, 331]]} />
            <SignalLine points={[[60, 327], [60, 401], [420, 401]]} />
            {model.gasEnabled ? (
              <>
                <SignalLine points={[[430, 88], [430, 45], [760, 45], [760, 38]]} />
                <SignalLine points={[[760, 82], [760, 91], [660, 91]]} />
              </>
            ) : null}
          </g>

          <g className={`pid-process ${motionActive ? "is-flowing" : "is-still"}`}>
            <path className="pid-pipe" d={`M30 90 H${NOZZLE_X.feed} V${VESSEL.y}`} />
            <path className="pid-pipe" d={`M${NOZZLE_X.oil} ${VESSEL_BOTTOM} V380 H810`} />
            <path className="pid-pipe" d={`M${NOZZLE_X.water} ${VESSEL_BOTTOM} V450 H810`} />
            {model.gasEnabled ? <path className="pid-pipe" d={`M${NOZZLE_X.gas} ${VESSEL.y} V140 H810`} /> : null}
            {/* Level bridle and pressure tap are process connections, so they stay solid. */}
            <path className="pid-tap" d={`M${VESSEL.x} 205 H180 V305 H${VESSEL.x}`} />
            <path className="pid-tap" d="M180 205 H162" />
            <path className="pid-tap" d="M180 305 H162" />
            {model.gasEnabled ? <path className="pid-tap" d={`M${NOZZLE_X.pressureTap} ${VESSEL.y} V132`} /> : null}
            <path className="pid-flow-line" d="M70 90 H260" markerEnd={`url(#${id("flow-arrow")})`} />
            <path className="pid-flow-line" d="M730 380 H795" markerEnd={`url(#${id("flow-arrow")})`} />
            <path className="pid-flow-line" d="M462 450 H795" markerEnd={`url(#${id("flow-arrow")})`} />
            {model.gasEnabled ? <path className="pid-flow-line" d="M690 140 H795" markerEnd={`url(#${id("flow-arrow")})`} /> : null}
          </g>

          <g className="pid-vessel">
            <rect
              fill={`url(#${id("shell")})`}
              height={VESSEL.height}
              rx={VESSEL.height / 2}
              width={VESSEL.width}
              x={VESSEL.x}
              y={VESSEL.y}
            />
            <g clipPath={`url(#${id("vessel-clip")})`}>
              <rect className="pid-phase-gas" height={Math.max(0, totalY - VESSEL.y)} width={VESSEL.width} x={VESSEL.x} y={VESSEL.y} />
              <rect className="pid-phase-oil" height={Math.max(0, interfaceY - totalY)} width={VESSEL.width} x={VESSEL.x} y={totalY} />
              <rect className="pid-phase-water" height={Math.max(0, VESSEL_BOTTOM - interfaceY)} width={VESSEL.width} x={VESSEL.x} y={interfaceY} />
              <line className="pid-surface is-total" x1={VESSEL.x} x2={VESSEL.x + VESSEL.width} y1={totalY} y2={totalY} />
              <line className="pid-surface is-interface" x1={VESSEL.x} x2={VESSEL.x + VESSEL.width} y1={interfaceY} y2={interfaceY} />
              {/* Inlet deflector: the one internal worth drawing at this scale. */}
              <path className="pid-internal" d="M282 188 V264" />
            </g>
            <rect
              className="pid-vessel-outline"
              height={VESSEL.height}
              rx={VESSEL.height / 2}
              width={VESSEL.width}
              x={VESSEL.x}
              y={VESSEL.y}
            />
            <path className="pid-saddle" d="M376 328 l-12 26 h52 l-12 -26 M456 328 l-12 26 h52 l-12 -26" />
          </g>

          <g className="pid-phase-labels">
            {totalY - VESSEL.y >= MINIMUM_LABEL_BAND ? (
              <text textAnchor="middle" x={VESSEL.x + VESSEL.width / 2} y={(VESSEL.y + totalY) / 2 + 4}>{copy.phases.gas}</text>
            ) : null}
            {interfaceY - totalY >= MINIMUM_LABEL_BAND ? (
              <text textAnchor="middle" x={VESSEL.x + VESSEL.width / 2} y={(totalY + interfaceY) / 2 + 4}>{copy.phases.oil}</text>
            ) : null}
            {VESSEL_BOTTOM - interfaceY >= MINIMUM_LABEL_BAND ? (
              <text textAnchor="middle" x={VESSEL.x + VESSEL.width / 2} y={(interfaceY + VESSEL_BOTTOM) / 2 + 4}>{copy.phases.water}</text>
            ) : null}
          </g>

          <ControlValve
            clipId={valveClip("LV-101")}
            description={copy.tags["LV-101"]}
            reading={valveValue(model.valves.oil)}
            valve={model.valves.oil}
            x={PLACEMENT.oilValve.x}
            y={PLACEMENT.oilValve.y}
          />
          <ControlValve
            clipId={valveClip("WV-101")}
            description={copy.tags["WV-101"]}
            reading={valveValue(model.valves.water)}
            valve={model.valves.water}
            x={PLACEMENT.waterValve.x}
            y={PLACEMENT.waterValve.y}
          />
          {model.valves.gas ? (
            <ControlValve
              clipId={valveClip("PCV-101")}
              description={copy.tags["PCV-101"]}
              reading={valveValue(model.valves.gas)}
              valve={model.valves.gas}
              x={PLACEMENT.gasValve.x}
              y={PLACEMENT.gasValve.y}
            />
          ) : null}

          <InstrumentBubble
            description={copy.tags["LT-101"]}
            kind="field"
            severity={model.transmitters.total.severity}
            severityLabel={severityWord(model.transmitters.total.severity)}
            tag="LT-101"
            x={PLACEMENT.total.x}
            y={PLACEMENT.total.y}
          />
          <InstrumentBubble
            description={copy.tags["LT-102"]}
            kind="field"
            severity={model.transmitters.interface.severity}
            severityLabel={severityWord(model.transmitters.interface.severity)}
            tag="LT-102"
            x={PLACEMENT.interface.x}
            y={PLACEMENT.interface.y}
          />
          <InstrumentBubble description={copy.tags["LIC-101"]} kind="shared" tag="LIC-101" x={PLACEMENT.totalController.x} y={PLACEMENT.totalController.y} />
          <InstrumentBubble description={copy.tags["IIC-101"]} kind="shared" tag="IIC-101" x={PLACEMENT.interfaceController.x} y={PLACEMENT.interfaceController.y} />
          {model.transmitters.pressure ? (
            <>
              <InstrumentBubble
                description={copy.tags["PT-101"]}
                kind="field"
                severity={model.transmitters.pressure.severity}
                severityLabel={severityWord(model.transmitters.pressure.severity)}
                tag="PT-101"
                x={PLACEMENT.pressure.x}
                y={PLACEMENT.pressure.y}
              />
              <InstrumentBubble
                description={copy.tags["PIC-101"]}
                kind="shared"
                tag="PIC-101"
                x={PLACEMENT.pressureController.x}
                y={PLACEMENT.pressureController.y}
              />
            </>
          ) : null}

          <g className="pid-annotations">
            <text textAnchor="middle" x={PLACEMENT.total.x} y={PLACEMENT.total.y + 42}>
              {percent(model.transmitters.total.processValue)}
            </text>
            <text textAnchor="middle" x={PLACEMENT.interface.x} y={PLACEMENT.interface.y + 42}>
              {percent(model.transmitters.interface.processValue)}
            </text>
            {model.transmitters.pressure ? (
              <text x={PLACEMENT.pressure.x + 30} y={PLACEMENT.pressure.y + 4}>
                {pressure(model.transmitters.pressure.processValue)}
              </text>
            ) : null}
            <text x="95" y="76">{copy.lines.feed}</text>
            <text x="95" y="118">{liquidFlow(model.flows.inletM3H)}</text>
            <text textAnchor="end" x="806" y="360">{copy.lines.oil}</text>
            <text textAnchor="end" x="806" y="410">{liquidFlow(model.flows.oilM3H)}</text>
            <text textAnchor="end" x="806" y="430">{copy.lines.water}</text>
            <text textAnchor="end" x="806" y="480">{liquidFlow(model.flows.waterM3H)}</text>
            {model.gasEnabled ? (
              <>
                <text textAnchor="end" x="790" y="120">{copy.lines.gas}</text>
                <text textAnchor="end" x="790" y="168">{gasFlow(model.flows.gasSm3H ?? 0)}</text>
              </>
            ) : null}
            <text className="pid-equipment-tag" x="95" y="160">{copy.equipmentTag} · {copy.equipmentService}</text>
          </g>

          <g className="pid-legend">
            <title>{copy.legendTitle}</title>
            <line className="pid-legend-process" x1="20" x2="56" y1="452" y2="452" />
            <text x="62" y="456">{copy.legendProcess}</text>
            <line className="pid-legend-signal" x1="20" x2="56" y1="474" y2="474" />
            <text x="62" y="478">{copy.legendSignal}</text>
          </g>
        </svg>
      </div>

      <dl aria-label={copy.readingsLabel} className="pid-readings" role="group">
        <div data-severity={model.transmitters.total.severity}>
          <dt>{copy.readingLabel("LT-101", copy.readings.totalLevel)}</dt>
          <dd>{transmitterValue(model.transmitters.total)}</dd>
        </div>
        <div data-severity={model.transmitters.interface.severity}>
          <dt>{copy.readingLabel("LT-102", copy.readings.interfaceLevel)}</dt>
          <dd>{transmitterValue(model.transmitters.interface)}</dd>
        </div>
        {model.transmitters.pressure ? (
          <div data-severity={model.transmitters.pressure.severity}>
            <dt>{copy.readingLabel("PT-101", copy.readings.pressure)}</dt>
            <dd>{transmitterValue(model.transmitters.pressure)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{copy.readings.oilLayer}</dt>
          <dd>{percent(model.levels.oilLayerFraction * 100)}</dd>
        </div>
        <div>
          <dt>{copy.readingLabel("LV-101", copy.readings.oilValve)}</dt>
          <dd>{valveValue(model.valves.oil)}</dd>
        </div>
        <div>
          <dt>{copy.readingLabel("WV-101", copy.readings.waterValve)}</dt>
          <dd>{valveValue(model.valves.water)}</dd>
        </div>
        {model.valves.gas ? (
          <div>
            <dt>{copy.readingLabel("PCV-101", copy.readings.gasValve)}</dt>
            <dd>{valveValue(model.valves.gas)}</dd>
          </div>
        ) : null}
        <div>
          <dt>{copy.readings.feedFlow}</dt>
          <dd>{liquidFlow(model.flows.inletM3H)}</dd>
        </div>
        <div>
          <dt>{copy.readings.oilFlow}</dt>
          <dd>{liquidFlow(model.flows.oilM3H)}</dd>
        </div>
        <div>
          <dt>{copy.readings.waterFlow}</dt>
          <dd>{liquidFlow(model.flows.waterM3H)}</dd>
        </div>
        {model.flows.gasSm3H !== null ? (
          <div>
            <dt>{copy.readings.gasFlow}</dt>
            <dd>{gasFlow(model.flows.gasSm3H)}</dd>
          </div>
        ) : null}
        <div className="pid-reading-safety" data-severity={model.safety.severity}>
          <dt>{copy.readings.activeSafety}</dt>
          <dd>{safetyCondition}</dd>
        </div>
      </dl>

      <p className="pid-note">{copy.note}</p>
    </div>
  );
}
