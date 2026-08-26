export type ScenarioId =
  | "normal"
  | "gor-surge"
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

/**
 * Liquid loops are always present. The pressure loop exists only when the gas cap
 * is enabled, so that a lesson can teach two-loop level control before adding the
 * coupling a third loop brings.
 */
export type LiquidLoopId = "total" | "interface";

export type LoopId = LiquidLoopId | "pressure";

export type PhaseId = "oil" | "water";

/** Every actuator in the vessel, including the gas backpressure valve. */
export type ActuatorId = PhaseId | "gas";

export type TripKind =
  | "TOTAL_LL"
  | "TOTAL_HH"
  | "INTERFACE_LL"
  | "INTERFACE_HH"
  | "OIL_LAYER_LL"
  | "PRESSURE_LL"
  | "PRESSURE_HH"
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
  /** Present only when the gas cap is enabled. */
  pressure?: PidConfig;
}

/**
 * The gas cap and its pressure loop. Absent by default: with no gas block the
 * model is exactly the two-liquid-loop simulator, bit for bit, which is what the
 * early lessons and the original golden runs rely on.
 */
export interface GasConfig {
  /** Gas-oil ratio of the feed, standard m³ of gas per m³ of oil. */
  gorSm3M3: number;
  /** Gas relative density, air = 1. */
  gasGravity: number;
  temperatureC: number;
  setpointBarG: number;
  /** Flow coefficient of the gas backpressure valve, metric Kv. */
  valveKv: number;
  /** Header pressure the valve discharges into, bar absolute. */
  downstreamPressureBarA: number;
  targetBandBarG: number;
  lowLowBarG: number;
  lowAlarmBarG: number;
  highAlarmBarG: number;
  highHighBarG: number;
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
  /**
   * Seconds the feed takes to ramp from shut-in to the scenario rate after Start.
   * Opening a choke is never a step, and the ramp keeps the first seconds of a
   * run readable instead of instantaneous.
   */
  feedRampS: number;
  /** Omitted for the two-loop liquid model; present once gas is taught. */
  gas?: GasConfig;
}

/**
 * Difficulty is a teaching concern, not a physics one, so it lives with the rest
 * of the guidance in `lib/onboarding/scenario-guidance.ts`, which also fixes the
 * order scenarios are presented in. Names and descriptions are likewise owned by
 * the interface, which has a language; the engine only needs the identifier.
 */
export interface ScenarioDefinition {
  id: ScenarioId;
  seed: number;
  disturbanceStartS: number;
  disturbanceEndS: number;
}

/** What the scenario is doing to the process right now. */
export type DisturbanceId =
  | "well-opening"
  | "well-shut-in"
  | "steady"
  | "feed-step-active"
  | "slug-active"
  | "slug-ended"
  | "oil-restriction-active"
  | "slow-water-dump"
  | "slow-water-dump-high-cut"
  | "noisy-interface"
  | "gor-surge-active";

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
  /**
   * Multiplier on the feed gas-oil ratio. Only the gas model reads it, so a run
   * without a gas cap is unaffected by a scenario that moves it.
   */
  gorFactor: number;
  disturbance: DisturbanceId;
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

/**
 * One controller's readings. The `Pct` suffix reflects the liquid loops, whose
 * values are percentages of vessel height. The pressure loop reuses this shape
 * and carries **bar gauge** in the same fields; the interface labels the unit.
 */
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

/**
 * Identifies the condition a safety state describes. The engine reports the code;
 * the interface owns the wording, so the simulation stays language-neutral.
 */
export type SafetyConditionId =
  | "normal"
  | "startup"
  | "pressure-low-low"
  | "pressure-low"
  | "pressure-high"
  | "pressure-high-high"
  | "total-low-low"
  | "total-low"
  | "total-high"
  | "total-high-high"
  | "interface-low-low"
  | "interface-low"
  | "interface-high"
  | "interface-high-high"
  | "oil-layer-low-low";

export interface SafetyState {
  severity: "safe" | "alarm" | "trip";
  source: "total" | "interface" | "oil-layer" | "pressure" | null;
  condition: SafetyConditionId;
  trip: TripKind;
}

/** Gas-cap readings, present only while the gas model is enabled. */
export interface GasSample {
  pressureBarG: number;
  measuredPressureBarG: number;
  setpointBarG: number;
  inletSm3H: number;
  outletSm3H: number;
  gasVolumeM3: number;
}

export interface SimulationSample {
  timeS: number;
  total: LoopSample;
  interface: LoopSample;
  pressure?: LoopSample;
  gas?: GasSample;
  oilVolumeM3: number;
  waterVolumeM3: number;
  oilLayerPct: number;
  flows: PhaseFlows;
  safety: SafetyState;
  disturbance: DisturbanceId;
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
  /**
   * When the total level first entered its target band and scoring began. Zero
   * when the run never established, in which case the whole run is scored.
   */
  establishedAtS: number;
  alarmTimeS: number;
  recoveryTimeS: number;
  settled: boolean;
  minimumOilLayerPct: number;
  loops: Record<LiquidLoopId, LoopMetrics>;
  /** Present only when the run had a pressure loop to score. */
  pressureLoop?: LoopMetrics;
  actuators: Record<PhaseId, ActuatorMetrics>;
  gasActuator?: ActuatorMetrics;
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
  | "interface-windup"
  | "pressure-oscillation"
  | "gas-saturation"
  | "gas-travel"
  | "pressure-windup";

export interface ScoreModifier {
  id: ScoreModifierId;
  /** Set only for the `trip` modifier, whose wording depends on which trip fired. */
  trip?: Exclude<TripKind, null>;
  points: number;
}

export type RankId = "trainee" | "technician" | "engineer" | "specialist" | "master";

/**
 * The reason a run scored the way it did, as data rather than a sentence. Each
 * variant carries only what the wording needs, which lets a translation reorder
 * or inflect it freely instead of concatenating fragments.
 */
export type FeedbackCode =
  | { kind: "trip"; trip: Exclude<TripKind, null> }
  | { kind: "modifier"; modifier: Exclude<ScoreModifierId, "trip"> }
  | { kind: "balanced" }
  | { kind: "safety"; loop: LiquidLoopId }
  | { kind: "tracking"; loop: LiquidLoopId }
  | { kind: "stability"; loop: LiquidLoopId }
  | { kind: "recovery"; loop: LiquidLoopId }
  | { kind: "valve"; phase: PhaseId; effort: "travel" | "saturation" }
  | { kind: "pressure" };

export interface ScoreBreakdown {
  safety: number;
  tracking: number;
  stability: number;
  recovery: number;
  valveEfficiency: number;
  modifiers: ScoreModifier[];
  total: number;
  rank: RankId;
  feedback: FeedbackCode;
}

export interface RunResult {
  metrics: RunMetrics;
  score: ScoreBreakdown;
}

/**
 * Bumped whenever the shape of a request or event changes. The runtime rejects a
 * message it does not recognise instead of misreading an older or newer client.
 */
export const WORKER_PROTOCOL_VERSION = 3;

export type WorkerRequest =
  | {
      type: "initialize";
      protocolVersion?: number;
      runId: string;
      config: SimulationConfig;
      pid: DualPidConfig;
      scenarioId: ScenarioId;
      seed: number;
    }
  | { type: "start"; runId: string }
  | { type: "pause"; runId: string }
  | { type: "reset"; runId: string }
  | { type: "set-speed"; runId: string; speed: number }
  /**
   * Open or shut the well while the run is live. Shutting the feed mid-run is the
   * classic tuning drill: the loops must close their valves before the vessel
   * drains, or the low-level protection ends the exercise.
   */
  | { type: "set-well"; runId: string; open: boolean };

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

/**
 * Pressure responds far faster than level, so the pressure loop starts from
 * gentler proportional action and no derivative at all: derivative on a fast,
 * noisy measurement is how a trainee first meets valve chatter.
 */
export const DEFAULT_PRESSURE_PID: PidConfig = Object.freeze({
  ...DEFAULT_PID,
  kp: 2.5,
  ki: 0.12,
  kd: 0,
});

/**
 * A wet-gas separator at a modest well-testing pressure. The valve is sized so the
 * design duty (35 m³/h of oil at this GOR, about 4200 Sm³/h of gas) sits near
 * mid-travel, which leaves authority in both directions and is what a correctly
 * sized valve looks like — the counter-example to the oversized valve that can
 * only cycle between shut and slammed open.
 */
export const DEFAULT_GAS: GasConfig = Object.freeze({
  gorSm3M3: 120,
  gasGravity: 0.72,
  temperatureC: 45,
  setpointBarG: 8,
  valveKv: 55,
  downstreamPressureBarA: 2,
  targetBandBarG: 0.4,
  lowLowBarG: 4,
  lowAlarmBarG: 6,
  highAlarmBarG: 10,
  highHighBarG: 12,
});

export const DEFAULT_TRIPLE_PID: DualPidConfig = Object.freeze({
  total: Object.freeze({ ...DEFAULT_PID }),
  interface: Object.freeze({ ...DEFAULT_PID }),
  pressure: Object.freeze({ ...DEFAULT_PRESSURE_PID }),
});

export const DEFAULT_SIMULATION: SimulationConfig = Object.freeze({
  dtS: 0.05,
  durationS: 300,
  chartSampleS: 0.2,
  feedRampS: 15,
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

/** The same simulation with the gas cap and its pressure loop switched on. */
export const DEFAULT_SIMULATION_WITH_GAS: SimulationConfig = Object.freeze({
  ...DEFAULT_SIMULATION,
  gas: DEFAULT_GAS,
});
