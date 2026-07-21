import { stepActuator } from "./actuator";
import {
  fullCylinderVolume,
  horizontalLevelFromVolume,
} from "./geometry";
import {
  createEquilibriumSnapshot,
  safetyForLevels,
  tripForLevels,
} from "./equilibrium";
import { calculateMetrics } from "./metrics";
import {
  calculatePhaseOutletFlows,
  integratePhaseInventories,
  splitFeed,
} from "./phase-hydraulics";
import { createPidState, stepPid, type PidState } from "./pid";
import { nextRandom } from "./prng";
import { getScenario, scenarioAt } from "./scenarios";
import { calculateScore } from "./scoring";
import { sanitizeDualPidConfig, sanitizeSimulationConfig } from "./validation";
import type {
  DualPidConfig,
  LoopId,
  LoopSample,
  PhaseFlows,
  PidConfig,
  PidTerms,
  RunResult,
  SafetyState,
  ScenarioId,
  SimulationConfig,
  SimulationSample,
  SimulationStatus,
  TripKind,
} from "./types";

const EPSILON = 1e-9;
const MAX_SAMPLES = 900;
// Sanitized inputs expire at most five controller periods per physics step.
// This higher ceiling only guards against manually forged EngineState values.
const MAX_CLOCK_EXPIRATIONS_PER_STEP = 64;

interface ControllerRuntime {
  measuredValuePct: number;
  commandPct: number;
  valvePositionPct: number;
  pidState: PidState;
  pidTerms: PidTerms;
  controllerElapsedS: number;
  sensorElapsedS: number;
}

export interface EngineState {
  config: SimulationConfig;
  pidConfig: DualPidConfig;
  scenarioId: ScenarioId;
  rngState: number;
  status: SimulationStatus;
  trip: TripKind;
  timeS: number;
  controllers: Record<LoopId, ControllerRuntime>;
  oilVolumeM3: number;
  waterVolumeM3: number;
  totalLevelPct: number;
  interfaceLevelPct: number;
  oilLayerPct: number;
  flows: PhaseFlows;
  sampleElapsedS: number;
  samples: SimulationSample[];
  /** Full chart-resolution history used only for terminal metrics and scoring. */
  metricSamples: SimulationSample[];
}

export interface CompletedRun {
  samples: SimulationSample[];
  result: RunResult;
  status: "completed" | "tripped";
}

interface SensorStep {
  measuredValuePct: number;
  sensorElapsedS: number;
  rngState: number;
}

interface ClockConsumption {
  expirations: number;
  residualS: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function consumeClockPeriods(elapsedS: number, periodS: number): ClockConsumption {
  if (
    !Number.isFinite(elapsedS) ||
    elapsedS < 0 ||
    !Number.isFinite(periodS) ||
    periodS <= 0
  ) return { expirations: 0, residualS: 0 };

  const rawExpirations = Math.max(0, Math.floor((elapsedS + EPSILON) / periodS));
  if (rawExpirations === 0) {
    return { expirations: 0, residualS: elapsedS };
  }

  const expirations = Math.min(rawExpirations, MAX_CLOCK_EXPIRATIONS_PER_STEP);
  const directResidual = elapsedS - rawExpirations * periodS;
  const residualS = Number.isFinite(directResidual)
    ? Math.max(0, Math.min(periodS - Number.EPSILON, directResidual))
    : Math.max(0, elapsedS % periodS);

  return { expirations, residualS };
}

function createController(measurementPct: number): ControllerRuntime {
  return {
    measuredValuePct: measurementPct,
    commandPct: 50,
    valvePositionPct: 50,
    pidState: createPidState(),
    pidTerms: { proportional: 0, integral: 0, derivative: 0 },
    controllerElapsedS: 0,
    sensorElapsedS: 0,
  };
}

function safetyFor(engine: EngineState): SafetyState {
  return safetyForLevels(
    engine.totalLevelPct,
    engine.interfaceLevelPct,
    engine.oilLayerPct,
    engine.config,
    engine.trip,
  );
}

function makeLoopSample(
  runtime: ControllerRuntime,
  processValuePct: number,
  setpointPct: number,
): LoopSample {
  return {
    processValuePct,
    measuredValuePct: runtime.measuredValuePct,
    setpointPct,
    errorPct: setpointPct - runtime.measuredValuePct,
    valveCommandPct: runtime.commandPct,
    valvePositionPct: runtime.valvePositionPct,
    proportionalTerm: runtime.pidTerms.proportional,
    integralTerm: runtime.pidTerms.integral,
    derivativeTerm: runtime.pidTerms.derivative,
  };
}

function makeSample(engine: EngineState, disturbance: string): SimulationSample {
  const total = makeLoopSample(
    engine.controllers.total,
    engine.totalLevelPct,
    engine.config.totalSetpointPct,
  );
  const interfaceLoop = makeLoopSample(
    engine.controllers.interface,
    engine.interfaceLevelPct,
    engine.config.interfaceSetpointPct,
  );

  return {
    timeS: Number(engine.timeS.toFixed(5)),
    total,
    interface: interfaceLoop,
    oilVolumeM3: engine.oilVolumeM3,
    waterVolumeM3: engine.waterVolumeM3,
    oilLayerPct: engine.oilLayerPct,
    flows: { ...engine.flows },
    safety: safetyFor(engine),
    disturbance,
  };
}

function sampleSensor(
  runtime: ControllerRuntime,
  processValuePct: number,
  sampleIntervalS: number,
  noiseAmplitudePct: number,
  dtS: number,
  rngState: number,
): SensorStep {
  const clock = consumeClockPeriods(
    runtime.sensorElapsedS + dtS,
    sampleIntervalS,
  );
  if (clock.expirations === 0) {
    return {
      measuredValuePct: runtime.measuredValuePct,
      sensorElapsedS: clock.residualS,
      rngState,
    };
  }

  let measuredValuePct = runtime.measuredValuePct;
  let nextRngState = rngState;
  for (let index = 0; index < clock.expirations; index += 1) {
    const random = nextRandom(nextRngState);
    nextRngState = random.state;
    measuredValuePct = clampPercent(
      processValuePct + (random.value * 2 - 1) * noiseAmplitudePct,
    );
  }

  return {
    measuredValuePct,
    sensorElapsedS: clock.residualS,
    rngState: nextRngState,
  };
}

function stepController(
  runtime: ControllerRuntime,
  config: PidConfig,
  setpointPct: number,
  dtS: number,
): ControllerRuntime {
  const clock = consumeClockPeriods(
    runtime.controllerElapsedS + dtS,
    config.sampleTimeS,
  );
  if (clock.expirations === 0) {
    return { ...runtime, controllerElapsedS: clock.residualS };
  }

  let commandPct = runtime.commandPct;
  let pidState = runtime.pidState;
  let pidTerms = runtime.pidTerms;
  for (let index = 0; index < clock.expirations; index += 1) {
    const pid = stepPid(pidState, config, {
      measurement: runtime.measuredValuePct,
      setpoint: setpointPct,
      dt: config.sampleTimeS,
      bias: 50,
    });
    commandPct = pid.output;
    pidState = pid.state;
    pidTerms = pid.terms;
  }

  return {
    ...runtime,
    commandPct,
    pidState,
    pidTerms,
    controllerElapsedS: clock.residualS,
  };
}

export function createEngine(
  config: SimulationConfig,
  pidConfig: DualPidConfig,
  scenarioId: ScenarioId,
  seed: number,
): EngineState {
  const sanitizedConfig = sanitizeSimulationConfig(config);
  const sanitizedPidConfig = sanitizeDualPidConfig(pidConfig);
  const scenario = scenarioAt(
    scenarioId,
    0,
    sanitizedConfig.actuatorTauS,
  );
  const equilibrium = createEquilibriumSnapshot(sanitizedConfig, scenario);
  const controllers: Record<LoopId, ControllerRuntime> = {
    total: createController(equilibrium.totalLevelPct),
    interface: createController(equilibrium.interfaceLevelPct),
  };
  const engine: EngineState = {
    config: sanitizedConfig,
    pidConfig: sanitizedPidConfig,
    scenarioId,
    rngState: seed >>> 0,
    status: equilibrium.trip ? "tripped" : "running",
    trip: equilibrium.trip,
    timeS: 0,
    controllers,
    oilVolumeM3: equilibrium.oilVolumeM3,
    waterVolumeM3: equilibrium.waterVolumeM3,
    totalLevelPct: equilibrium.totalLevelPct,
    interfaceLevelPct: equilibrium.interfaceLevelPct,
    oilLayerPct: equilibrium.oilLayerPct,
    flows: equilibrium.flows,
    sampleElapsedS: 0,
    samples: [],
    metricSamples: [],
  };

  return {
    ...engine,
    samples: [equilibrium.sample],
    metricSamples: [equilibrium.sample],
  };
}

export function stepEngine(engine: EngineState): EngineState {
  if (engine.status !== "running") return engine;

  const { config, pidConfig } = engine;
  const timeS = Number((engine.timeS + config.dtS).toFixed(8));
  const scenario = scenarioAt(engine.scenarioId, timeS, config.actuatorTauS);

  // When both sensor clocks expire in one physics step, consume every total
  // sample first and then every interface sample. This stable ordering keeps
  // seeded replay independent of render timing and matches the public contract.
  const totalSensor = sampleSensor(
    engine.controllers.total,
    engine.totalLevelPct,
    scenario.totalSensorSampleS,
    scenario.totalSensorNoisePct,
    config.dtS,
    engine.rngState,
  );
  const interfaceSensor = sampleSensor(
    engine.controllers.interface,
    engine.interfaceLevelPct,
    scenario.interfaceSensorSampleS,
    scenario.interfaceSensorNoisePct,
    config.dtS,
    totalSensor.rngState,
  );

  let totalController = stepController(
    {
      ...engine.controllers.total,
      measuredValuePct: totalSensor.measuredValuePct,
      sensorElapsedS: totalSensor.sensorElapsedS,
    },
    pidConfig.total,
    config.totalSetpointPct,
    config.dtS,
  );
  let interfaceController = stepController(
    {
      ...engine.controllers.interface,
      measuredValuePct: interfaceSensor.measuredValuePct,
      sensorElapsedS: interfaceSensor.sensorElapsedS,
    },
    pidConfig.interface,
    config.interfaceSetpointPct,
    config.dtS,
  );

  totalController = {
    ...totalController,
    valvePositionPct: stepActuator(
      engine.controllers.total.valvePositionPct,
      totalController.commandPct,
      config.dtS,
      scenario.oilActuatorTauS,
      config.actuatorStrokeRatePctS,
    ),
  };
  interfaceController = {
    ...interfaceController,
    valvePositionPct: stepActuator(
      engine.controllers.interface.valvePositionPct,
      interfaceController.commandPct,
      config.dtS,
      scenario.waterActuatorTauS,
      config.actuatorStrokeRatePctS,
    ),
  };

  const requestedInlet = splitFeed(
    scenario.totalInletM3H,
    scenario.waterCutFraction,
  );
  const requestedOutlet = calculatePhaseOutletFlows({
    totalLevelPct: engine.totalLevelPct,
    interfaceLevelPct: engine.interfaceLevelPct,
    oilValvePct: totalController.valvePositionPct,
    waterValvePct: interfaceController.valvePositionPct,
    oilCapacityFactor: scenario.oilCapacityFactor,
    waterCapacityFactor: scenario.waterCapacityFactor,
    config,
  });
  const inventory = integratePhaseInventories({
    oilVolumeM3: engine.oilVolumeM3,
    waterVolumeM3: engine.waterVolumeM3,
    ...requestedInlet,
    ...requestedOutlet,
    dtS: config.dtS,
    fullVolumeM3: fullCylinderVolume(config.diameterM, config.lengthM),
  });
  const oilVolumeM3 = inventory.oilVolumeM3;
  const waterVolumeM3 = inventory.waterVolumeM3;
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
  const trip = tripForLevels(totalLevelPct, interfaceLevelPct, oilLayerPct, config);
  const status: SimulationStatus = trip
    ? "tripped"
    : timeS + EPSILON >= config.durationS
      ? "completed"
      : "running";
  const actualTotalInletM3H =
    inventory.acceptedOilInletM3H + inventory.acceptedWaterInletM3H;
  const flows: PhaseFlows = {
    totalInletM3H: actualTotalInletM3H,
    waterCutFraction: actualTotalInletM3H > 0
      ? inventory.acceptedWaterInletM3H / actualTotalInletM3H
      : scenario.waterCutFraction,
    oilInletM3H: inventory.acceptedOilInletM3H,
    waterInletM3H: inventory.acceptedWaterInletM3H,
    oilOutletM3H: inventory.actualOilOutletM3H,
    waterOutletM3H: inventory.actualWaterOutletM3H,
  };
  const chartClock = consumeClockPeriods(
    engine.sampleElapsedS + config.dtS,
    config.chartSampleS,
  );
  const sampleElapsedS = chartClock.residualS;
  let samples = engine.samples;
  let metricSamples = engine.metricSamples;
  const next: EngineState = {
    ...engine,
    rngState: interfaceSensor.rngState,
    status,
    trip,
    timeS,
    controllers: {
      total: totalController,
      interface: interfaceController,
    },
    oilVolumeM3,
    waterVolumeM3,
    totalLevelPct,
    interfaceLevelPct,
    oilLayerPct,
    flows,
    sampleElapsedS,
    samples,
    metricSamples,
  };

  if (chartClock.expirations > 0 || status !== "running") {
    const sample = makeSample(next, scenario.disturbance);
    samples = [...samples, sample].slice(-MAX_SAMPLES);
    metricSamples = [...metricSamples, sample];
  }

  return { ...next, samples, metricSamples, sampleElapsedS };
}

export function finishEngine(engine: EngineState): CompletedRun {
  if (engine.status !== "completed" && engine.status !== "tripped") {
    throw new Error("Cannot finish an active simulation");
  }

  const metrics = calculateMetrics(
    engine.metricSamples,
    engine.config,
    engine.trip,
    getScenario(engine.scenarioId).disturbanceEndS,
    {
      total: engine.pidConfig.total.integralLimit,
      interface: engine.pidConfig.interface.integralLimit,
    },
  );
  return {
    samples: engine.samples,
    result: { metrics, score: calculateScore(metrics) },
    status: engine.status,
  };
}

export function runToEnd(
  config: SimulationConfig,
  pidConfig: DualPidConfig,
  scenarioId: ScenarioId,
  seed: number,
): CompletedRun {
  let engine = createEngine(config, pidConfig, scenarioId, seed);
  while (engine.status === "running") engine = stepEngine(engine);
  return finishEngine(engine);
}
