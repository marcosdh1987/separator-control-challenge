export type ScenarioId =
  | "normal"
  | "feed-step"
  | "water-rich-slug"
  | "oil-outlet-restriction"
  | "slow-water-dump"
  | "noisy-interface";

export type SimulationStatus =
  | "idle"
  | "running"
  | "paused"
  | "completed"
  | "tripped"
  | "error";

export type LoopId = "total" | "interface";

export type PhaseId = "oil" | "water";

export type TripKind =
  | "TOTAL_LL"
  | "TOTAL_HH"
  | "INTERFACE_LL"
  | "INTERFACE_HH"
  | "OIL_LAYER_LL"
  | null;

export interface PidConfig {
  kp: number;
  ki: number;
  kd: number;
  sampleTimeS: number;
  outputMin: number;
  outputMax: number;
  integralLimit: number;
  derivativeFilterTauS: number;
}

export interface DualPidConfig {
  total: PidConfig;
  interface: PidConfig;
}

export interface SimulationConfig {
  dtS: number;
  durationS: number;
  chartSampleS: number;
  diameterM: number;
  lengthM: number;
  oilDensityKgM3: number;
  waterDensityKgM3: number;
  totalSetpointPct: number;
  interfaceSetpointPct: number;
  totalTargetBandPct: number;
  interfaceTargetBandPct: number;
  totalLowLowPct: number;
  totalLowAlarmPct: number;
  totalHighAlarmPct: number;
  totalHighHighPct: number;
  interfaceLowLowPct: number;
  interfaceLowAlarmPct: number;
  interfaceHighAlarmPct: number;
  interfaceHighHighPct: number;
  oilLayerLowLowPct: number;
  oilRatedFlowM3H: number;
  waterRatedFlowM3H: number;
  actuatorTauS: number;
  actuatorStrokeRatePctS: number;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  shortName: string;
  description: string;
  difficulty: "Foundations" | "Intermediate" | "Advanced";
  seed: number;
  disturbanceStartS: number;
  disturbanceEndS: number;
}

export interface ScenarioState {
  totalInletM3H: number;
  waterCutFraction: number;
  oilCapacityFactor: number;
  waterCapacityFactor: number;
  oilActuatorTauS: number;
  waterActuatorTauS: number;
  totalSensorNoisePct: number;
  interfaceSensorNoisePct: number;
  totalSensorSampleS: number;
  interfaceSensorSampleS: number;
  disturbance: string;
}

export interface PidTerms {
  proportional: number;
  integral: number;
  derivative: number;
}

export interface PhaseFlows {
  totalInletM3H: number;
  waterCutFraction: number;
  oilInletM3H: number;
  waterInletM3H: number;
  oilOutletM3H: number;
  waterOutletM3H: number;
}

export interface LoopSample {
  processValuePct: number;
  measuredValuePct: number;
  setpointPct: number;
  errorPct: number;
  valveCommandPct: number;
  valvePositionPct: number;
  proportionalTerm: number;
  integralTerm: number;
  derivativeTerm: number;
}

export interface SafetyState {
  severity: "safe" | "alarm" | "trip";
  source: "total" | "interface" | "oil-layer" | null;
  label: string;
  trip: TripKind;
}

export interface SimulationSample {
  timeS: number;
  total: LoopSample;
  interface: LoopSample;
  oilVolumeM3: number;
  waterVolumeM3: number;
  oilLayerPct: number;
  flows: PhaseFlows;
  safety: SafetyState;
  disturbance: string;
}

export interface LoopMetrics {
  alarmTimeS: number;
  mae: number;
  maximumPct: number;
  minimumPct: number;
  targetBandTimeOutsideS: number;
  stabilityStdDev: number;
  oscillationCrossings: number;
  oscillationPeakToPeakPct: number;
  recoveryTimeS: number;
  settled: boolean;
}

export interface ActuatorMetrics {
  travelPct: number;
  saturationTimeS: number;
  integralLimitTimeS: number;
}

export interface PhaseRunTotals {
  oilInletM3: number;
  waterInletM3: number;
  oilOutletM3: number;
  waterOutletM3: number;
  finalOilVolumeM3: number;
  finalWaterVolumeM3: number;
}

export interface RunMetrics {
  alarmTimeS: number;
  recoveryTimeS: number;
  settled: boolean;
  minimumOilLayerPct: number;
  loops: Record<LoopId, LoopMetrics>;
  actuators: Record<PhaseId, ActuatorMetrics>;
  phaseTotals: PhaseRunTotals;
  trip: TripKind;
}

export type ScoreModifierId =
  | "trip"
  | "total-oscillation"
  | "interface-oscillation"
  | "oil-saturation"
  | "water-saturation"
  | "oil-travel"
  | "water-travel"
  | "total-windup"
  | "interface-windup";

export interface ScoreModifier {
  id: ScoreModifierId;
  label: string;
  points: number;
}

export interface ScoreBreakdown {
  safety: number;
  tracking: number;
  stability: number;
  recovery: number;
  valveEfficiency: number;
  modifiers: ScoreModifier[];
  total: number;
  rank: string;
  diagnosis: string;
  suggestion: string;
}

export interface RunResult {
  metrics: RunMetrics;
  score: ScoreBreakdown;
}

export type WorkerRequest =
  | {
      type: "initialize";
      runId: string;
      config: SimulationConfig;
      pid: DualPidConfig;
      scenarioId: ScenarioId;
      seed: number;
    }
  | { type: "start"; runId: string }
  | { type: "pause"; runId: string }
  | { type: "reset"; runId: string }
  | { type: "set-speed"; runId: string; speed: number };

export type WorkerEvent =
  | { type: "ready"; runId: string; sample: SimulationSample }
  | { type: "samples"; runId: string; samples: SimulationSample[] }
  | { type: "status"; runId: string; status: SimulationStatus }
  | {
      type: "finished";
      runId: string;
      status: "completed" | "tripped";
      result: RunResult;
    }
  | { type: "error"; runId: string; message: string };

export const DEFAULT_PID: PidConfig = Object.freeze({
  kp: 4,
  ki: 0.08,
  kd: 8,
  sampleTimeS: 0.2,
  outputMin: 0,
  outputMax: 100,
  integralLimit: 40,
  derivativeFilterTauS: 1,
});

export const DEFAULT_DUAL_PID: DualPidConfig = Object.freeze({
  total: Object.freeze({ ...DEFAULT_PID }),
  interface: Object.freeze({ ...DEFAULT_PID }),
});

export const DEFAULT_SIMULATION: SimulationConfig = Object.freeze({
  dtS: 0.05,
  durationS: 180,
  chartSampleS: 0.2,
  diameterM: 1.2,
  lengthM: 3,
  oilDensityKgM3: 850,
  waterDensityKgM3: 1000,
  totalSetpointPct: 50,
  interfaceSetpointPct: 20,
  totalTargetBandPct: 5,
  interfaceTargetBandPct: 3,
  totalLowLowPct: 10,
  totalLowAlarmPct: 25,
  totalHighAlarmPct: 75,
  totalHighHighPct: 90,
  interfaceLowLowPct: 3,
  interfaceLowAlarmPct: 8,
  interfaceHighAlarmPct: 35,
  interfaceHighHighPct: 45,
  oilLayerLowLowPct: 5,
  oilRatedFlowM3H: 70,
  waterRatedFlowM3H: 30,
  actuatorTauS: 3,
  actuatorStrokeRatePctS: 20,
});
