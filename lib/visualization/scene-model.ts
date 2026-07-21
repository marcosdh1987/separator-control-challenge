import type { SafetyState, SimulationSample } from "@/lib/simulation/types";

export const VESSEL_RADIUS_M = 0.6;
export const VESSEL_DIAMETER_M = VESSEL_RADIUS_M * 2;

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
  safety: Pick<SafetyState, "severity" | "source" | "label"> & {
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

const flowMotion = (flowM3H: number): FlowMotion => {
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
}

export function formatEngineeringValue(
  value: number,
  { unit = "", digits = 1, separator = unit ? " " : "", invalid = "dash" }: EngineeringFormatOptions = {},
): string {
  if (!Number.isFinite(value)) {
    return invalid === "unavailable" ? "unavailable" : `—${unit ? `${separator}${unit}` : ""}`;
  }
  return `${value.toFixed(digits)}${unit ? `${separator}${unit}` : ""}`;
}

export function createSceneModel(sample: SimulationSample): SceneModel {
  const totalPct = safePercentage(sample.total.processValuePct);
  const interfacePct = safePercentage(sample.interface.processValuePct);
  const totalSurfaceY = levelToY(totalPct);
  const interfaceSurfaceY = levelToY(interfacePct);
  const waterHeightM = VESSEL_DIAMETER_M * interfacePct / 100;
  const oilLayerHeightM = Math.max(0, totalSurfaceY - interfaceSurfaceY);
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
    totalSurfaceY,
    interfaceSurfaceY,
    totalChordWidthM: chordAtY(totalSurfaceY),
    interfaceChordWidthM: chordAtY(interfaceSurfaceY),
    oilLayerHeightM,
    waterHeightM,
    oilRegionHeightM: oilLayerHeightM,
    gasHeightM: VESSEL_DIAMETER_M * (1 - totalPct / 100),
    inletFlow: flowMotion(sample.flows.totalInletM3H),
    oilFlow: flowMotion(sample.flows.oilOutletM3H),
    waterFlow: flowMotion(sample.flows.waterOutletM3H),
    oilValve: { openFraction: safePercentage(sample.total.valvePositionPct) / 100 },
    waterValve: { openFraction: safePercentage(sample.interface.valvePositionPct) / 100 },
    safety: {
      severity: sample.safety.severity,
      source: sample.safety.source,
      label: sample.safety.label,
      motionEnabled: sample.safety.severity !== "trip",
      markerY,
      ...safetyPresentation,
    },
  };
}

export function createProcessSummary(sample: SimulationSample): string {
  return [
    "SEP-101 horizontal separator with gas, oil, and water.",
    `True total level ${formatEngineeringValue(sample.total.processValuePct, { unit: "percent", invalid: "unavailable" })}; measured total level ${formatEngineeringValue(sample.total.measuredValuePct, { unit: "percent", invalid: "unavailable" })}.`,
    `True interface ${formatEngineeringValue(sample.interface.processValuePct, { unit: "percent", invalid: "unavailable" })}; measured interface ${formatEngineeringValue(sample.interface.measuredValuePct, { unit: "percent", invalid: "unavailable" })}.`,
    `Total inlet ${formatEngineeringValue(sample.flows.totalInletM3H, { unit: "cubic metres per hour", invalid: "unavailable" })}; oil outlet ${formatEngineeringValue(sample.flows.oilOutletM3H, { unit: "cubic metres per hour", invalid: "unavailable" })}; water outlet ${formatEngineeringValue(sample.flows.waterOutletM3H, { unit: "cubic metres per hour", invalid: "unavailable" })}.`,
    `Actual oil valve ${formatEngineeringValue(sample.total.valvePositionPct, { unit: "percent", invalid: "unavailable" })}; actual water valve ${formatEngineeringValue(sample.interface.valvePositionPct, { unit: "percent", invalid: "unavailable" })}.`,
    `Safety: ${sample.safety.label}.`,
  ].join(" ");
}
