import { stepActuator } from "./actuator";
import {
  fullCylinderVolume,
  horizontalLevelFromVolume,
} from "./geometry";
import {
  createEquilibriumSnapshot,
  safetyForLevels,
  safetyWithPressure,
  tripForLevels,
  tripForPressure,
} from "./equilibrium";
import { barAToBarG, gasCapPressureBarA, molesForPressure, stepGasCap, type GasState } from "./gas";
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
  DisturbanceId,
  DualPidConfig,
  GasConfig,
  LiquidLoopId,
  LoopSample,
  PhaseFlows,
  PidConfig,
  PidTerms,
  RunResult,
  SafetyState,
  ScenarioId,
  ScenarioState,
  SimulationConfig,
  SimulationSample,
  SimulationStatus,
  TripKind,
} from "./types";

const EPSILON = 1e-9;
/**
 * A default-length run emits one sample per chart period plus the opening t=0
 * sample, so the buffer keeps 901 and no longer drops the first point of a
 * complete run. Longer or finer-grained runs still truncate here, which is what
 * bounds the memory the chart holds.
 */
const MAX_SAMPLES = 901;
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
  controllers: Record<LiquidLoopId, ControllerRuntime> & { pressure?: ControllerRuntime };
  oilVolumeM3: number;
  waterVolumeM3: number;
  totalLevelPct: number;
  interfaceLevelPct: number;
  oilLayerPct: number;
  flows: PhaseFlows;
  /** Present only when the configuration includes a gas cap. */
  gas?: GasState;
  gasFlows?: { inletSm3H: number; outletSm3H: number; gasVolumeM3: number };
  gasPressureBarG?: number;
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
  const liquidTrip = engine.trip === "PRESSURE_HH" || engine.trip === "PRESSURE_LL"
    ? null
    : engine.trip;
  const liquid = safetyForLevels(
    engine.totalLevelPct,
    engine.interfaceLevelPct,
    engine.oilLayerPct,
    engine.config,
    liquidTrip,
  );
  const gasConfig = engine.config.gas;
  if (!gasConfig || engine.gasPressureBarG === undefined) return liquid;
  return safetyWithPressure(liquid, engine.gasPressureBarG, gasConfig, engine.trip === "PRESSURE_HH" || engine.trip === "PRESSURE_LL" ? engine.trip : null);
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

interface GasSeed {
  state: GasState;
  pressureBarG: number;
  inletSm3H: number;
  gasVolumeM3: number;
}

/**
 * Place the gas cap at its stated operating pressure so a run starts in balance
 * rather than swinging while the cap fills.
 */
function seedGasCap(
  config: SimulationConfig,
  gas: GasConfig,
  liquidVolumeM3: number,
  oilInletM3H: number,
): GasSeed {
  const vesselVolumeM3 = fullCylinderVolume(config.diameterM, config.lengthM);
  const gasVolumeM3 = Math.max(vesselVolumeM3 * 0.01, vesselVolumeM3 - liquidVolumeM3);
  const moles = molesForPressure(
    gas.initialPressureBarA,
    gasVolumeM3,
    gas.temperatureC,
    gas.gasGravity,
  );
  const pressure = gasCapPressureBarA(moles, gasVolumeM3, gas.temperatureC, gas.gasGravity);
  return {
    state: { moles },
    pressureBarG: barAToBarG(pressure.pressureBarA),
    inletSm3H: Math.max(0, oilInletM3H) * gas.gorSm3M3,
    gasVolumeM3,
  };
}

function makeSample(engine: EngineState, disturbance: DisturbanceId): SimulationSample {
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

  const gasConfig = engine.config.gas;
  const pressureRuntime = engine.controllers.pressure;
  const pressure = gasConfig && pressureRuntime && engine.gasPressureBarG !== undefined
    ? makeLoopSample(pressureRuntime, engine.gasPressureBarG, gasConfig.setpointBarG)
    : undefined;
  const gas = gasConfig && engine.gasFlows && engine.gasPressureBarG !== undefined
    ? {
        pressureBarG: engine.gasPressureBarG,
        measuredPressureBarG: pressureRuntime?.measuredValuePct ?? engine.gasPressureBarG,
        setpointBarG: gasConfig.setpointBarG,
        inletSm3H: engine.gasFlows.inletSm3H,
        outletSm3H: engine.gasFlows.outletSm3H,
        gasVolumeM3: engine.gasFlows.gasVolumeM3,
      }
    : undefined;

  return {
    timeS: Number(engine.timeS.toFixed(5)),
    total,
    interface: interfaceLoop,
    ...(pressure ? { pressure } : {}),
    ...(gas ? { gas } : {}),
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
  const controllers: EngineState["controllers"] = {
    total: createController(equilibrium.totalLevelPct),
    interface: createController(equilibrium.interfaceLevelPct),
  };
  const gasSetup = sanitizedConfig.gas
    ? seedGasCap(sanitizedConfig, sanitizedConfig.gas, equilibrium.oilVolumeM3 + equilibrium.waterVolumeM3, equilibrium.flows.oilInletM3H)
    : undefined;
  if (gasSetup) controllers.pressure = createController(gasSetup.pressureBarG);
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
    gas: gasSetup?.state,
    gasPressureBarG: gasSetup?.pressureBarG,
    gasFlows: gasSetup
      ? { inletSm3H: gasSetup.inletSm3H, outletSm3H: gasSetup.inletSm3H, gasVolumeM3: gasSetup.gasVolumeM3 }
      : undefined,
    sampleElapsedS: 0,
    samples: [],
    metricSamples: [],
  };

  const openingSample = gasSetup
    ? makeSample(engine, scenario.disturbance)
    : equilibrium.sample;

  return {
    ...engine,
    samples: [openingSample],
    metricSamples: [openingSample],
  };
}

interface GasStepContext {
  liquidVolumeBeforeM3: number;
  liquidVolumeAfterM3: number;
  oilInletM3H: number;
}

interface GasStepOutcome {
  controller: ControllerRuntime;
  state: GasState;
  pressureBarG: number;
  flows: { inletSm3H: number; outletSm3H: number; gasVolumeM3: number };
  trip: TripKind;
}

/**
 * Advance the pressure loop and the gas cap. Returns undefined when the run has
 * no gas configured, which is what keeps the two-loop model untouched.
 */
function stepGas(
  engine: EngineState,
  config: SimulationConfig,
  scenario: ScenarioState,
  context: GasStepContext,
): GasStepOutcome | undefined {
  const gasConfig = config.gas;
  const runtime = engine.controllers.pressure;
  const state = engine.gas;
  const pidConfig = engine.pidConfig.pressure;
  if (!gasConfig || !runtime || !state || !pidConfig) return undefined;

  const measuredBarG = engine.gasPressureBarG ?? 0;
  let controller = stepController(
    { ...runtime, measuredValuePct: measuredBarG },
    pidConfig,
    gasConfig.setpointBarG,
    config.dtS,
  );
  controller = {
    ...controller,
    valvePositionPct: stepActuator(
      runtime.valvePositionPct,
      controller.commandPct,
      config.dtS,
      scenario.oilActuatorTauS,
      config.actuatorStrokeRatePctS,
    ),
  };

  const inletSm3H = Math.max(0, context.oilInletM3H) * gasConfig.gorSm3M3 * scenario.gorFactor;
  const result = stepGasCap({
    state,
    config: gasConfig,
    liquidVolumeM3: context.liquidVolumeBeforeM3,
    nextLiquidVolumeM3: context.liquidVolumeAfterM3,
    vesselVolumeM3: fullCylinderVolume(config.diameterM, config.lengthM),
    gasInletSm3H: inletSm3H,
    valveOpenFraction: controller.valvePositionPct / 100,
    dtS: config.dtS,
  });

  const pressureBarG = barAToBarG(result.pressureBarA);
  return {
    controller,
    state: result.state,
    pressureBarG,
    flows: {
      inletSm3H,
      outletSm3H: result.gasOutletSm3H,
      gasVolumeM3: result.gasVolumeM3,
    },
    trip: tripForPressure(pressureBarG, gasConfig),
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

  // The gas cap runs after the liquid balance, because its volume is whatever the
  // liquid leaves behind. Draining liquid enlarges the cap and drops pressure:
  // that is the coupling between the level loops and the pressure loop.
  const gasStep = stepGas(engine, config, scenario, {
    liquidVolumeBeforeM3: engine.oilVolumeM3 + engine.waterVolumeM3,
    liquidVolumeAfterM3: oilVolumeM3 + waterVolumeM3,
    oilInletM3H: inventory.acceptedOilInletM3H,
  });

  const trip = tripForLevels(totalLevelPct, interfaceLevelPct, oilLayerPct, config)
    ?? gasStep?.trip
    ?? null;
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
      ...(gasStep ? { pressure: gasStep.controller } : {}),
    },
    oilVolumeM3,
    waterVolumeM3,
    totalLevelPct,
    interfaceLevelPct,
    oilLayerPct,
    flows,
    gas: gasStep?.state ?? engine.gas,
    gasPressureBarG: gasStep?.pressureBarG ?? engine.gasPressureBarG,
    gasFlows: gasStep?.flows ?? engine.gasFlows,
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
      ...(engine.pidConfig.pressure
        ? { pressure: engine.pidConfig.pressure.integralLimit }
        : {}),
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
