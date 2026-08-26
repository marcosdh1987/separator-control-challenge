import type { SafetyState, SimulationSample } from "@/lib/simulation/types";

/**
 * Pure mapping from a simulation sample to the visual state of the P&ID mimic.
 *
 * Nothing here touches the DOM or React: the diagram is a projection of a sample,
 * so it can be reasoned about — and tested — as data. Alarm logic is deliberately
 * *not* recomputed from thresholds; the engine already owns it and reports the
 * active condition, so the mimic only decides which symbol carries it.
 */

export type ValveState = "shut" | "throttling" | "open";

/** Same vocabulary the engine uses, reused so the two cannot drift. */
export type AlarmSeverity = SafetyState["severity"];

export type TransmitterTag = "LT-101" | "LT-102" | "PT-101";
export type ControllerTag = "LIC-101" | "IIC-101" | "PIC-101";
export type ValveTag = "LV-101" | "WV-101" | "PCV-101";

/** The pressure loop reports bar gauge in the fields the liquid loops use for %. */
export type MimicUnit = "percent" | "barGauge";

/**
 * A control valve is called shut or open only at the ends of its travel; a valve
 * one percent off its seat is still throttling, and an operator reads it that way.
 */
export const SHUT_FRACTION = 0.005;
export const OPEN_FRACTION = 0.995;

export interface ValveBinding {
  tag: ValveTag;
  controller: ControllerTag;
  /** Controller output, 0..1. */
  commandFraction: number;
  /** Actual stem position, 0..1 — what the drawing strokes. */
  openFraction: number;
  state: ValveState;
}

export interface TransmitterBinding {
  tag: TransmitterTag;
  controller: ControllerTag;
  /** True process value, in `unit`. */
  processValue: number;
  measuredValue: number;
  setpoint: number;
  unit: MimicUnit;
  severity: AlarmSeverity;
}

/** Fill fractions of vessel height, 0..1, already clamped and ordered. */
export interface LevelBinding {
  totalFraction: number;
  interfaceFraction: number;
  oilLayerFraction: number;
  gasFraction: number;
}

export interface FlowBinding {
  inletM3H: number;
  oilM3H: number;
  waterM3H: number;
  /** Null while the gas cap is disabled. */
  gasSm3H: number | null;
}

export interface MimicModel {
  /** The pressure loop, the gas line and PT/PIC/PCV exist only when this is true. */
  gasEnabled: boolean;
  levels: LevelBinding;
  transmitters: {
    total: TransmitterBinding;
    interface: TransmitterBinding;
    pressure: TransmitterBinding | null;
  };
  valves: {
    oil: ValveBinding;
    water: ValveBinding;
    gas: ValveBinding | null;
  };
  flows: FlowBinding;
  safety: {
    severity: AlarmSeverity;
    condition: SafetyState["condition"];
    source: SafetyState["source"];
    tripped: boolean;
  };
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

/** A non-finite reading is drawn as zero rather than tearing the geometry apart. */
const finite = (value: number, fallback = 0) => (Number.isFinite(value) ? value : fallback);

const fraction = (percentage: number) => clamp(finite(percentage), 0, 100) / 100;

export function valveStateFor(openFraction: number): ValveState {
  if (openFraction <= SHUT_FRACTION) return "shut";
  if (openFraction >= OPEN_FRACTION) return "open";
  return "throttling";
}

/**
 * Which transmitter carries the active alarm. The oil-layer trip has no dedicated
 * instrument: the layer is the distance between the two level transmitters, so it
 * is flagged on both rather than attributed to one of them.
 */
const ALARM_SOURCES: Record<TransmitterTag, readonly SafetyState["source"][]> = {
  "LT-101": ["total", "oil-layer"],
  "LT-102": ["interface", "oil-layer"],
  "PT-101": ["pressure"],
};

export function severityFor(tag: TransmitterTag, safety: SafetyState): AlarmSeverity {
  if (safety.severity === "safe" || safety.source === null) return "safe";
  return ALARM_SOURCES[tag].includes(safety.source) ? safety.severity : "safe";
}

export function createMimicModel(sample: SimulationSample): MimicModel {
  const totalFraction = fraction(sample.total.processValuePct);
  // The interface can never be drawn above the total surface, whatever the sample says.
  const interfaceFraction = Math.min(totalFraction, fraction(sample.interface.processValuePct));
  const gasSample = sample.gas;
  const pressureLoop = sample.pressure;
  const gasEnabled = Boolean(gasSample);

  const oilValve: ValveBinding = {
    tag: "LV-101",
    controller: "LIC-101",
    commandFraction: fraction(sample.total.valveCommandPct),
    openFraction: fraction(sample.total.valvePositionPct),
    state: valveStateFor(fraction(sample.total.valvePositionPct)),
  };
  const waterValve: ValveBinding = {
    tag: "WV-101",
    controller: "IIC-101",
    commandFraction: fraction(sample.interface.valveCommandPct),
    openFraction: fraction(sample.interface.valvePositionPct),
    state: valveStateFor(fraction(sample.interface.valvePositionPct)),
  };
  const gasValve: ValveBinding | null = gasEnabled
    ? {
        tag: "PCV-101",
        controller: "PIC-101",
        commandFraction: fraction(pressureLoop?.valveCommandPct ?? 0),
        openFraction: fraction(pressureLoop?.valvePositionPct ?? 0),
        state: valveStateFor(fraction(pressureLoop?.valvePositionPct ?? 0)),
      }
    : null;

  return {
    gasEnabled,
    levels: {
      totalFraction,
      interfaceFraction,
      oilLayerFraction: Math.max(0, totalFraction - interfaceFraction),
      gasFraction: 1 - totalFraction,
    },
    transmitters: {
      total: {
        tag: "LT-101",
        controller: "LIC-101",
        processValue: finite(sample.total.processValuePct),
        measuredValue: finite(sample.total.measuredValuePct),
        setpoint: finite(sample.total.setpointPct),
        unit: "percent",
        severity: severityFor("LT-101", sample.safety),
      },
      interface: {
        tag: "LT-102",
        controller: "IIC-101",
        processValue: finite(sample.interface.processValuePct),
        measuredValue: finite(sample.interface.measuredValuePct),
        setpoint: finite(sample.interface.setpointPct),
        unit: "percent",
        severity: severityFor("LT-102", sample.safety),
      },
      pressure: gasSample
        ? {
            tag: "PT-101",
            controller: "PIC-101",
            processValue: finite(gasSample.pressureBarG),
            measuredValue: finite(gasSample.measuredPressureBarG),
            setpoint: finite(gasSample.setpointBarG),
            unit: "barGauge",
            severity: severityFor("PT-101", sample.safety),
          }
        : null,
    },
    valves: { oil: oilValve, water: waterValve, gas: gasValve },
    flows: {
      inletM3H: finite(sample.flows.totalInletM3H),
      oilM3H: finite(sample.flows.oilOutletM3H),
      waterM3H: finite(sample.flows.waterOutletM3H),
      gasSm3H: gasSample ? finite(gasSample.outletSm3H) : null,
    },
    safety: {
      severity: sample.safety.severity,
      condition: sample.safety.condition,
      source: sample.safety.source,
      tripped: sample.safety.trip !== null,
    },
  };
}
