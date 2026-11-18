import { DEFAULT_SIMULATION, type SafetyState, type SimulationSample } from "@/lib/simulation/types";

/**
 * Scene geometry derives from the simulated vessel so a change to the physical
 * model cannot silently leave the rendered vessel behind.
 */
export const VESSEL_DIAMETER_M = DEFAULT_SIMULATION.diameterM;
export const VESSEL_RADIUS_M = VESSEL_DIAMETER_M / 2;
export const VESSEL_LENGTH_M = DEFAULT_SIMULATION.lengthM;

/** Shell plate sits outside the modelled bore, so the drawn shell reads slightly wider. */
export const SHELL_WALL_THICKNESS_M = 0.03;
export const SHELL_RADIUS_M = VESSEL_RADIUS_M + SHELL_WALL_THICKNESS_M;

/** Phase volumes stop short of both heads so the dished ends stay readable. */
export const PHASE_END_INSET_M = 0.07;
export const PHASE_LENGTH_M = VESSEL_LENGTH_M - 2 * PHASE_END_INSET_M;

export type ScenePoint = readonly [number, number, number];

/**
 * Nozzle anchors are the single source of truth for where process lines meet the
 * vessel: the vessel draws a nozzle at each anchor and every pipe path starts or
 * ends on the same x, so the two can no longer drift apart by hand-editing.
 */
export const NOZZLE_ANCHORS = Object.freeze({
  feed: Object.freeze({ x: -0.95, y: 0.72, rotationZ: 0 }),
  oilOutlet: Object.freeze({ x: 0.82, y: -0.73, rotationZ: Math.PI }),
  waterOutlet: Object.freeze({ x: -0.1, y: -0.73, rotationZ: Math.PI }),
});

export const PIPE_PATHS: Readonly<Record<"feed" | "oil" | "water", readonly ScenePoint[]>> =
  Object.freeze({
    feed: Object.freeze([
      [-2.9, 1.38, -0.18],
      [-2.15, 1.38, -0.18],
      [-1.55, 1.2, -0.08],
      [NOZZLE_ANCHORS.feed.x, 1.05, 0],
    ]) as readonly ScenePoint[],
    oil: Object.freeze([
      [NOZZLE_ANCHORS.oilOutlet.x, -1.05, 0],
      [1.2, -1.2, 0.05],
      [1.75, -1.2, 0.18],
      [2.85, -1.2, 0.18],
    ]) as readonly ScenePoint[],
    water: Object.freeze([
      [NOZZLE_ANCHORS.waterOutlet.x, -1.05, 0],
      [-0.42, -1.36, 0.12],
      [-1.25, -1.42, 0.3],
      [-2.72, -1.42, 0.3],
    ]) as readonly ScenePoint[],
  });

/** Each control valve sits on its own outlet run, between the second and last elbow. */
export const VALVE_POSITIONS: Readonly<Record<"oil" | "water", ScenePoint>> = Object.freeze({
  oil: [2.05, PIPE_PATHS.oil[2][1], PIPE_PATHS.oil[2][2]],
  water: [-1.55, PIPE_PATHS.water[2][1], PIPE_PATHS.water[2][2]],
});

export interface FlowMotion {
  direction: -1 | 0 | 1;
  speed: number;
  visibleFraction: number;
}

export interface SceneModel {
  totalSurfaceY: number;
  interfaceSurfaceY: number;
  totalChordWidthM: number;
  interfaceChordWidthM: number;
  oilLayerHeightM: number;
  waterHeightM: number;
  oilRegionHeightM: number;
  gasHeightM: number;
  inletFlow: FlowMotion;
  oilFlow: FlowMotion;
  waterFlow: FlowMotion;
  oilValve: { openFraction: number };
  waterValve: { openFraction: number };
  safety: Pick<SafetyState, "severity" | "source" | "condition"> & {
    motionEnabled: boolean;
    markerY: number | null;
    beaconIntensity: number;
    rimIntensity: number;
    pulseHz: number;
  };
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

const safePercentage = (value: number) => {
  if (value === Number.POSITIVE_INFINITY) return 100;
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 100);
};

const levelToY = (levelPct: number) =>
  -VESSEL_RADIUS_M + VESSEL_DIAMETER_M * (safePercentage(levelPct) / 100);

const chordAtY = (yM: number) =>
  2 * Math.sqrt(Math.max(0, VESSEL_RADIUS_M ** 2 - yM ** 2));

/** The part of the scene model that only depends on the two level readings. */
export type PhaseGeometryModel = Pick<
  SceneModel,
  "totalSurfaceY" | "interfaceSurfaceY" | "totalChordWidthM" | "interfaceChordWidthM" | "oilLayerHeightM" | "waterHeightM" | "oilRegionHeightM" | "gasHeightM"
>;

/**
 * Phase surfaces from a total level and an interface level, both in percent of
 * the vessel diameter. Shared by the simulator scene and the Research Lab
 * replay, which draws levels recorded by a different simulator.
 */
export function phaseGeometryFromLevels(totalLevelPct: number, interfaceLevelPct: number): PhaseGeometryModel {
  const totalPct = safePercentage(totalLevelPct);
  const interfacePct = safePercentage(interfaceLevelPct);
  const totalSurfaceY = levelToY(totalPct);
  const interfaceSurfaceY = levelToY(interfacePct);
  const oilLayerHeightM = Math.max(0, totalSurfaceY - interfaceSurfaceY);
  return {
    totalSurfaceY,
    interfaceSurfaceY,
    totalChordWidthM: chordAtY(totalSurfaceY),
    interfaceChordWidthM: chordAtY(interfaceSurfaceY),
    oilLayerHeightM,
    waterHeightM: VESSEL_DIAMETER_M * interfacePct / 100,
    oilRegionHeightM: oilLayerHeightM,
    gasHeightM: VESSEL_DIAMETER_M * (1 - totalPct / 100),
  };
}

export const flowMotion = (flowM3H: number): FlowMotion => {
  if (!Number.isFinite(flowM3H)) return { direction: 0, speed: 0, visibleFraction: 0 };
  const normalized = clamp(Math.abs(flowM3H) / 110, 0, 1);
  return {
    direction: Math.sign(flowM3H) as -1 | 0 | 1,
    speed: normalized < 0.001 ? 0 : 0.08 + 0.32 * normalized,
    visibleFraction: normalized,
  };
};

interface EngineeringFormatOptions {
  unit?: string;
  digits?: number;
  separator?: string;
  invalid?: "dash" | "unavailable";
  /** Spoken stand-in for a missing value; supplied by the message catalogue. */
  unavailableText?: string;
}

export function formatEngineeringValue(
  value: number,
  {
    unit = "",
    digits = 1,
    separator = unit ? " " : "",
    invalid = "dash",
    unavailableText = "unavailable",
  }: EngineeringFormatOptions = {},
): string {
  if (!Number.isFinite(value)) {
    return invalid === "unavailable" ? unavailableText : `—${unit ? `${separator}${unit}` : ""}`;
  }
  return `${value.toFixed(digits)}${unit ? `${separator}${unit}` : ""}`;
}

export function createSceneModel(sample: SimulationSample): SceneModel {
  const geometry = phaseGeometryFromLevels(sample.total.processValuePct, sample.interface.processValuePct);
  const { totalSurfaceY, interfaceSurfaceY, oilLayerHeightM } = geometry;
  const markerY = sample.safety.source === "total"
    ? totalSurfaceY
    : sample.safety.source === "interface"
      ? interfaceSurfaceY
      : sample.safety.source === "oil-layer"
        ? interfaceSurfaceY + oilLayerHeightM / 2
        : null;
  const safetyPresentation = sample.safety.severity === "trip"
    ? { beaconIntensity: 2.4, rimIntensity: 5.2, pulseHz: 0 }
    : sample.safety.severity === "alarm"
      ? { beaconIntensity: 1.25, rimIntensity: 3.6, pulseHz: 0.7 }
      : { beaconIntensity: 0.34, rimIntensity: 1.9, pulseHz: 0 };

  return {
    ...geometry,
    inletFlow: flowMotion(sample.flows.totalInletM3H),
    oilFlow: flowMotion(sample.flows.oilOutletM3H),
    waterFlow: flowMotion(sample.flows.waterOutletM3H),
    oilValve: { openFraction: safePercentage(sample.total.valvePositionPct) / 100 },
    waterValve: { openFraction: safePercentage(sample.interface.valvePositionPct) / 100 },
    safety: {
      severity: sample.safety.severity,
      source: sample.safety.source,
      condition: sample.safety.condition,
      motionEnabled: sample.safety.severity !== "trip",
      markerY,
      ...safetyPresentation,
    },
  };
}

export interface ProcessSummaryCopy {
  vessel: string;
  levels: (trueTotal: string, measuredTotal: string) => string;
  interface: (trueInterface: string, measuredInterface: string) => string;
  flows: (inlet: string, oilOutlet: string, waterOutlet: string) => string;
  valves: (oil: string, water: string) => string;
  safety: (condition: string) => string;
  units: { percent: string; cubicMetresPerHour: string; unavailable: string };
}

/**
 * The spoken description a screen reader announces. Wording arrives from the
 * message catalogue so this stays a layout of numbers rather than English prose.
 */
export function createProcessSummary(
  sample: SimulationSample,
  copy: ProcessSummaryCopy,
  safetyCondition: string,
): string {
  const percent = (value: number) =>
    formatEngineeringValue(value, { unit: copy.units.percent, invalid: "unavailable", unavailableText: copy.units.unavailable });
  const flow = (value: number) =>
    formatEngineeringValue(value, { unit: copy.units.cubicMetresPerHour, invalid: "unavailable", unavailableText: copy.units.unavailable });

  return [
    copy.vessel,
    copy.levels(percent(sample.total.processValuePct), percent(sample.total.measuredValuePct)),
    copy.interface(percent(sample.interface.processValuePct), percent(sample.interface.measuredValuePct)),
    copy.flows(flow(sample.flows.totalInletM3H), flow(sample.flows.oilOutletM3H), flow(sample.flows.waterOutletM3H)),
    copy.valves(percent(sample.total.valvePositionPct), percent(sample.interface.valvePositionPct)),
    copy.safety(safetyCondition),
  ].join(" ");
}
