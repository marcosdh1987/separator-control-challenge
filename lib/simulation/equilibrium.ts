import {
  horizontalLevelFromVolume,
  horizontalVolumeFromLevel,
} from "./geometry";
import { calculatePhaseOutletFlows, splitFeed } from "./phase-hydraulics";
import type {
  PhaseFlows,
  SafetyState,
  ScenarioState,
  SimulationConfig,
  SimulationSample,
  TripKind,
} from "./types";

export interface EquilibriumSnapshot {
  oilVolumeM3: number;
  waterVolumeM3: number;
  totalLevelPct: number;
  interfaceLevelPct: number;
  oilLayerPct: number;
  flows: PhaseFlows;
  trip: TripKind;
  sample: SimulationSample;
}

export function tripForLevels(
  totalLevelPct: number,
  interfaceLevelPct: number,
  oilLayerPct: number,
  config: SimulationConfig,
): TripKind {
  if (totalLevelPct >= config.totalHighHighPct) return "TOTAL_HH";
  if (totalLevelPct <= config.totalLowLowPct) return "TOTAL_LL";
  if (interfaceLevelPct >= config.interfaceHighHighPct) return "INTERFACE_HH";
  if (interfaceLevelPct <= config.interfaceLowLowPct) return "INTERFACE_LL";
  if (oilLayerPct <= config.oilLayerLowLowPct) return "OIL_LAYER_LL";
  return null;
}

export function safetyForLevels(
  totalLevelPct: number,
  interfaceLevelPct: number,
  oilLayerPct: number,
  config: SimulationConfig,
  trip = tripForLevels(totalLevelPct, interfaceLevelPct, oilLayerPct, config),
): SafetyState {
  if (trip === "TOTAL_HH") return {
    severity: "trip",
    source: "total",
    label: "Total level high-high trip",
    trip,
  };
  if (trip === "TOTAL_LL") return {
    severity: "trip",
    source: "total",
    label: "Total level low-low trip",
    trip,
  };
  if (trip === "INTERFACE_HH") return {
    severity: "trip",
    source: "interface",
    label: "Interface high-high trip",
    trip,
  };
  if (trip === "INTERFACE_LL") return {
    severity: "trip",
    source: "interface",
    label: "Interface low-low trip",
    trip,
  };
  if (trip === "OIL_LAYER_LL") return {
    severity: "trip",
    source: "oil-layer",
    label: "Oil layer low-low trip",
    trip,
  };
  if (totalLevelPct >= config.totalHighAlarmPct) return {
    severity: "alarm",
    source: "total",
    label: "Total level high alarm",
    trip: null,
  };
  if (totalLevelPct <= config.totalLowAlarmPct) return {
    severity: "alarm",
    source: "total",
    label: "Total level low alarm",
    trip: null,
  };
  if (interfaceLevelPct >= config.interfaceHighAlarmPct) return {
    severity: "alarm",
    source: "interface",
    label: "Interface high alarm",
    trip: null,
  };
  if (interfaceLevelPct <= config.interfaceLowAlarmPct) return {
    severity: "alarm",
    source: "interface",
    label: "Interface low alarm",
    trip: null,
  };
  return {
    severity: "safe",
    source: null,
    label: "Normal operating envelope",
    trip: null,
  };
}

export function createEquilibriumSnapshot(
  config: SimulationConfig,
  scenario: ScenarioState,
): EquilibriumSnapshot {
  const waterVolumeM3 = horizontalVolumeFromLevel(
    config.interfaceSetpointPct,
    config.diameterM,
    config.lengthM,
  );
  const totalVolumeM3 = horizontalVolumeFromLevel(
    config.totalSetpointPct,
    config.diameterM,
    config.lengthM,
  );
  const oilVolumeM3 = Math.max(0, totalVolumeM3 - waterVolumeM3);
  const totalLevelPct = horizontalLevelFromVolume(
    oilVolumeM3 + waterVolumeM3,
    config.diameterM,
    config.lengthM,
  );
  const interfaceLevelPct = horizontalLevelFromVolume(
    waterVolumeM3,
    config.diameterM,
    config.lengthM,
  );
  const oilLayerPct = Math.max(0, totalLevelPct - interfaceLevelPct);
  const inlet = splitFeed(scenario.totalInletM3H, scenario.waterCutFraction);
  const outlet = calculatePhaseOutletFlows({
    totalLevelPct,
    interfaceLevelPct,
    oilValvePct: 50,
    waterValvePct: 50,
    oilCapacityFactor: scenario.oilCapacityFactor,
    waterCapacityFactor: scenario.waterCapacityFactor,
    config,
  });
  const flows: PhaseFlows = {
    totalInletM3H: inlet.oilInletM3H + inlet.waterInletM3H,
    waterCutFraction: scenario.waterCutFraction,
    ...inlet,
    ...outlet,
  };
  const trip = tripForLevels(
    totalLevelPct,
    interfaceLevelPct,
    oilLayerPct,
    config,
  );
  const total = {
    processValuePct: totalLevelPct,
    measuredValuePct: totalLevelPct,
    setpointPct: config.totalSetpointPct,
    errorPct: config.totalSetpointPct - totalLevelPct,
    valveCommandPct: 50,
    valvePositionPct: 50,
    proportionalTerm: 0,
    integralTerm: 0,
    derivativeTerm: 0,
  };
  const interfaceLoop = {
    processValuePct: interfaceLevelPct,
    measuredValuePct: interfaceLevelPct,
    setpointPct: config.interfaceSetpointPct,
    errorPct: config.interfaceSetpointPct - interfaceLevelPct,
    valveCommandPct: 50,
    valvePositionPct: 50,
    proportionalTerm: 0,
    integralTerm: 0,
    derivativeTerm: 0,
  };
  const sample: SimulationSample = {
    timeS: 0,
    total,
    interface: interfaceLoop,
    oilVolumeM3,
    waterVolumeM3,
    oilLayerPct,
    flows: { ...flows },
    safety: safetyForLevels(
      totalLevelPct,
      interfaceLevelPct,
      oilLayerPct,
      config,
      trip,
    ),
    disturbance: scenario.disturbance,
  };

  return {
    oilVolumeM3,
    waterVolumeM3,
    totalLevelPct,
    interfaceLevelPct,
    oilLayerPct,
    flows,
    trip,
    sample,
  };
}
