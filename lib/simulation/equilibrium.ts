import {
  horizontalLevelFromVolume,
  horizontalVolumeFromLevel,
} from "./geometry";
import { calculatePhaseOutletFlows, splitFeed } from "./phase-hydraulics";
import type {
  GasConfig,
  PhaseFlows,
  SafetyConditionId,
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

/** The safety condition each trip corresponds to, for naming a finished run's outcome. */
export const TRIP_CONDITIONS: Record<Exclude<TripKind, null>, SafetyConditionId> = Object.freeze({
  TOTAL_LL: "total-low-low",
  TOTAL_HH: "total-high-high",
  INTERFACE_LL: "interface-low-low",
  INTERFACE_HH: "interface-high-high",
  OIL_LAYER_LL: "oil-layer-low-low",
  PRESSURE_LL: "pressure-low-low",
  PRESSURE_HH: "pressure-high-high",
});

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

/** Pressure protection, in the same gauge units the operator reads. */
export function tripForPressure(pressureBarG: number, gas: GasConfig): TripKind {
  if (!Number.isFinite(pressureBarG)) return null;
  if (pressureBarG >= gas.highHighBarG) return "PRESSURE_HH";
  if (pressureBarG <= gas.lowLowBarG) return "PRESSURE_LL";
  return null;
}

/**
 * Pressure alarms only outrank a calm liquid state: a level alarm already in
 * progress stays the headline, because it is the slower and more damaging one.
 */
export function safetyWithPressure(
  liquidSafety: SafetyState,
  pressureBarG: number,
  gas: GasConfig,
  trip = tripForPressure(pressureBarG, gas),
): SafetyState {
  if (trip === "PRESSURE_HH") {
    return { severity: "trip", source: "pressure", condition: "pressure-high-high", trip };
  }
  if (trip === "PRESSURE_LL") {
    return { severity: "trip", source: "pressure", condition: "pressure-low-low", trip };
  }
  if (liquidSafety.severity !== "safe") return liquidSafety;
  if (pressureBarG >= gas.highAlarmBarG) {
    return { severity: "alarm", source: "pressure", condition: "pressure-high", trip: null };
  }
  if (pressureBarG <= gas.lowAlarmBarG) {
    return { severity: "alarm", source: "pressure", condition: "pressure-low", trip: null };
  }
  return liquidSafety;
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
    condition: "total-high-high",
    trip,
  };
  if (trip === "TOTAL_LL") return {
    severity: "trip",
    source: "total",
    condition: "total-low-low",
    trip,
  };
  if (trip === "INTERFACE_HH") return {
    severity: "trip",
    source: "interface",
    condition: "interface-high-high",
    trip,
  };
  if (trip === "INTERFACE_LL") return {
    severity: "trip",
    source: "interface",
    condition: "interface-low-low",
    trip,
  };
  if (trip === "OIL_LAYER_LL") return {
    severity: "trip",
    source: "oil-layer",
    condition: "oil-layer-low-low",
    trip,
  };
  if (totalLevelPct >= config.totalHighAlarmPct) return {
    severity: "alarm",
    source: "total",
    condition: "total-high",
    trip: null,
  };
  if (totalLevelPct <= config.totalLowAlarmPct) return {
    severity: "alarm",
    source: "total",
    condition: "total-low",
    trip: null,
  };
  if (interfaceLevelPct >= config.interfaceHighAlarmPct) return {
    severity: "alarm",
    source: "interface",
    condition: "interface-high",
    trip: null,
  };
  if (interfaceLevelPct <= config.interfaceLowAlarmPct) return {
    severity: "alarm",
    source: "interface",
    condition: "interface-low",
    trip: null,
  };
  return {
    severity: "safe",
    source: null,
    condition: "normal",
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
