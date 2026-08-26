import {
  gasValveMolarFlow,
  MOLES_PER_SM3,
  R_GAS,
  zFactorDak,
} from "./gas-properties";
import type { GasConfig } from "./types";

/**
 * Sub-steps per physics step for the gas balance. Gas is far stiffer than the
 * liquid inventories — pressure responds in seconds where levels respond in
 * minutes — so the gas cap is integrated on a finer grid than the 0.05 s step.
 */
export const GAS_SUBSTEPS = 10;

/** Never let the modelled gas cap vanish; a zero volume would divide by zero. */
const MINIMUM_GAS_VOLUME_FRACTION = 0.01;

export interface GasState {
  /** Moles of gas held in the vessel's gas cap. */
  moles: number;
}

export interface GasStepInput {
  state: GasState;
  config: GasConfig;
  /** Liquid inventory at the start of the step, m³. */
  liquidVolumeM3: number;
  /** Liquid inventory at the end of the step, m³. The cap is what is left over. */
  nextLiquidVolumeM3: number;
  vesselVolumeM3: number;
  /** Gas released by the feed, standard m³/h. */
  gasInletSm3H: number;
  /** Gas valve opening as a fraction of full travel. */
  valveOpenFraction: number;
  dtS: number;
}

export interface GasStepResult {
  state: GasState;
  pressureBarA: number;
  /** Gas leaving through the backpressure valve, standard m³/h. */
  gasOutletSm3H: number;
  gasVolumeM3: number;
  zFactor: number;
}

function gasVolume(vesselVolumeM3: number, liquidVolumeM3: number): number {
  return Math.max(
    vesselVolumeM3 * MINIMUM_GAS_VOLUME_FRACTION,
    vesselVolumeM3 - liquidVolumeM3,
  );
}

/**
 * Pressure of the gas cap from the real-gas law, `P = nRTZ/V`.
 *
 * Z depends on pressure, so it is evaluated in two passes: an ideal-gas estimate
 * first, then the corrected value. One pass is enough at separator conditions and
 * keeps the step cost fixed.
 */
export function gasCapPressureBarA(
  moles: number,
  gasVolumeM3: number,
  temperatureC: number,
  gasGravity: number,
): { pressureBarA: number; zFactor: number } {
  const temperatureK = temperatureC + 273.15;
  if (gasVolumeM3 <= 0 || moles <= 0) return { pressureBarA: 0, zFactor: 1 };
  const idealBarA = (moles * R_GAS * temperatureK) / gasVolumeM3 / 1e5;
  const zFactor = zFactorDak(idealBarA, temperatureC, gasGravity);
  return { pressureBarA: Math.max(0, idealBarA * zFactor), zFactor };
}

/** Moles the gas cap holds at a target pressure, used to seed a run at equilibrium. */
export function molesForPressure(
  pressureBarA: number,
  gasVolumeM3: number,
  temperatureC: number,
  gasGravity: number,
): number {
  const temperatureK = temperatureC + 273.15;
  // Z varies slowly, so evaluating it at the target pressure is accurate enough
  // to place the initial condition.
  const zFactor = zFactorDak(pressureBarA, temperatureC, gasGravity);
  const denominator = zFactor * R_GAS * temperatureK;
  if (denominator <= 0) return 0;
  return (pressureBarA * 1e5 * gasVolumeM3) / denominator;
}

/**
 * Advance the gas cap by one physics step.
 *
 * The moles balance uses a linearised backward-Euler (semi-implicit) update.
 * Outflow is close to linear in the held moles, because pressure tracks moles at
 * fixed temperature and volume, so solving for the new value implicitly is
 * unconditionally stable. An explicit update can overshoot past zero within a
 * single sub-step when the valve is wide open, which reads on screen as the
 * separator pressure collapsing instantly; the implicit solve instead relaxes
 * smoothly toward whatever equilibrium the inflow and outflow actually support.
 */
export function stepGasCap({
  state,
  config,
  liquidVolumeM3,
  nextLiquidVolumeM3,
  vesselVolumeM3,
  gasInletSm3H,
  valveOpenFraction,
  dtS,
}: GasStepInput): GasStepResult {
  const subStepS = dtS / GAS_SUBSTEPS;
  const inletMolarRate = Math.max(0, gasInletSm3H) * MOLES_PER_SM3;

  let moles = Math.max(1, state.moles);
  let pressureBarA = 0;
  let zFactor = 1;
  let outletMolarRate = 0;
  let currentGasVolume = gasVolume(vesselVolumeM3, liquidVolumeM3);

  for (let index = 0; index < GAS_SUBSTEPS; index += 1) {
    // Interpolate the liquid inventory across the sub-steps so the gas cap sees
    // the same volume change the liquid balance just applied.
    const progress = (index + 1) / GAS_SUBSTEPS;
    const liquidNow = liquidVolumeM3 + (nextLiquidVolumeM3 - liquidVolumeM3) * progress;
    currentGasVolume = gasVolume(vesselVolumeM3, liquidNow);

    const pressure = gasCapPressureBarA(
      moles,
      currentGasVolume,
      config.temperatureC,
      config.gasGravity,
    );
    pressureBarA = pressure.pressureBarA;
    zFactor = pressure.zFactor;

    outletMolarRate = gasValveMolarFlow({
      kv: config.valveKv,
      openFraction: valveOpenFraction,
      upstreamPressureBarA: pressureBarA,
      downstreamPressureBarA: config.downstreamPressureBarA,
      temperatureC: config.temperatureC,
      gasGravity: config.gasGravity,
      zFactor,
    });

    const inletMoles = (inletMolarRate * subStepS) / 3600;
    const outflowPerMole = moles > 0 ? outletMolarRate / moles : 0;
    const nextMoles = (moles + inletMoles) / (1 + (outflowPerMole * subStepS) / 3600);

    // Report the outflow the implicit solve actually supports, so the reported
    // gas rate can never claim more gas left than the balance allows.
    outletMolarRate = ((moles + inletMoles - nextMoles) * 3600) / subStepS;
    moles = Math.max(1, nextMoles);
  }

  const finalPressure = gasCapPressureBarA(
    moles,
    currentGasVolume,
    config.temperatureC,
    config.gasGravity,
  );

  return {
    state: { moles },
    pressureBarA: finalPressure.pressureBarA,
    zFactor: finalPressure.zFactor,
    gasVolumeM3: currentGasVolume,
    gasOutletSm3H: Math.max(0, outletMolarRate / MOLES_PER_SM3),
  };
}

/** Gauge pressure is what an operator reads off the field gauge. */
export const barAToBarG = (barA: number, atmosphericBarA = 1.01325) =>
  barA - atmosphericBarA;

export const barGToBarA = (barG: number, atmosphericBarA = 1.01325) =>
  barG + atmosphericBarA;
