/**
 * Gas property and gas-valve helpers, ported from the DACS separator model.
 *
 * Every routine maps to a published correlation or standard so the numbers are
 * defensible in a classroom:
 *
 * - Compressibility factor Z: Dranchuk & Abou-Kassem (1975), the eleven-constant
 *   fit to the Standing-Katz chart, with pseudo-criticals from Sutton (1985).
 * - Gas valve flow: IEC 60534-2-1 / ISA-75.01.01 compressible sizing in its mass
 *   form, metric Kv convention.
 *
 * Units are named in each symbol: pressures in bar absolute, temperature in
 * Celsius, flows in mol/h unless stated otherwise.
 */

/** Universal gas constant, J/(mol·K). */
export const R_GAS = 8.314462618;

/** Moles per standard cubic metre at 15.56 °C and 101.325 kPa. */
export const MOLES_PER_SM3 = 101325 / (R_GAS * (15.56 + 273.15));

/** Molar mass of dry air, kg/mol. Gas molar mass is gravity times this. */
export const AIR_MOLAR_MASS_KG_MOL = 0.02896;

/**
 * IEC 60534-2-1 constant N6 in the metric Kv convention (W in kg/h, pressure in
 * bar, density in kg/m³). It follows from the Kv definition itself; the familiar
 * imperial-Cv value 27.3 is this same number times 0.865.
 */
export const IEC_N6_KV = Math.sqrt(1000);

/** Ratio of specific heats of the IEC reference gas (air), used to scale F_gamma. */
const REFERENCE_SPECIFIC_HEAT_RATIO = 1.4;

/** cp/cv for associated gas at separator conditions. */
export const GAS_SPECIFIC_HEAT_RATIO = 1.27;

/** Pressure differential ratio factor xT at choked flow, IEC reference globe valve. */
export const VALVE_XT_GLOBE = 0.7;

export interface PseudoCriticals {
  pressureBarA: number;
  temperatureK: number;
}

/** Sutton (1985) pseudo-criticals for associated and wet gases. */
export function suttonPseudoCriticals(gasGravity: number): PseudoCriticals {
  // The correlation is published in psia and Rankine.
  const ppcPsia = 756.8 - 131 * gasGravity - 3.6 * gasGravity ** 2;
  const tpcRankine = 169.2 + 349.5 * gasGravity - 74 * gasGravity ** 2;
  return {
    pressureBarA: ppcPsia * 0.0689476,
    temperatureK: (tpcRankine * 5) / 9,
  };
}

const DAK_COEFFICIENTS = [
  0.3265, -1.07, -0.5339, 0.01569, -0.05165,
  0.5475, -0.7361, 0.1844, 0.1056, 0.6134, 0.721,
] as const;

/**
 * Compressibility factor by fixed-point iteration on reduced density. Returns 1
 * outside the correlation's validity window (near-atmospheric pressure, extreme
 * reduced temperature), which is the physically reasonable limit there.
 */
export function zFactorDak(
  pressureBarA: number,
  temperatureC: number,
  gasGravity = 0.7,
): number {
  const criticals = suttonPseudoCriticals(gasGravity);
  const temperatureK = temperatureC + 273.15;
  const pr = pressureBarA / Math.max(criticals.pressureBarA, 1e-6);
  const tr = temperatureK / Math.max(criticals.temperatureK, 1e-6);
  if (!Number.isFinite(pr) || !Number.isFinite(tr)) return 1;
  if (pr < 0.2 || tr < 1 || tr > 3) return 1;

  const a = DAK_COEFFICIENTS;
  const c1 = a[0] + a[1] / tr + a[2] / tr ** 3 + a[3] / tr ** 4 + a[4] / tr ** 5;
  const c2 = a[5] + a[6] / tr + a[7] / tr ** 2;
  const c3 = a[8] * (a[6] / tr + a[7] / tr ** 2);

  let rhoR = (0.27 * pr) / tr;
  let z = 1;
  for (let iteration = 0; iteration < 50; iteration += 1) {
    const c4 =
      a[9] * (1 + a[10] * rhoR ** 2) * (rhoR ** 2 / tr ** 3) * Math.exp(-a[10] * rhoR ** 2);
    z = 1 + c1 * rhoR + c2 * rhoR ** 2 - c3 * rhoR ** 5 + c4;
    const next = (0.27 * pr) / (z * tr);
    if (Math.abs(next - rhoR) < 1e-9) {
      rhoR = next;
      break;
    }
    rhoR = next;
  }
  if (!Number.isFinite(z)) return 1;
  return Math.max(0.2, Math.min(1.2, z));
}

/** Real-gas density in kg/m³ at the given conditions. */
export function gasDensityKgM3(
  pressureBarA: number,
  temperatureC: number,
  gasGravity: number,
  zFactor: number,
): number {
  const temperatureK = temperatureC + 273.15;
  const molarMass = gasGravity * AIR_MOLAR_MASS_KG_MOL;
  const denominator = zFactor * R_GAS * temperatureK;
  if (denominator <= 0) return 0;
  return (pressureBarA * 1e5 * molarMass) / denominator;
}

export interface GasValveFlowInput {
  kv: number;
  openFraction: number;
  upstreamPressureBarA: number;
  downstreamPressureBarA: number;
  temperatureC: number;
  gasGravity: number;
  zFactor: number;
  pressureDropRatioFactor?: number;
  specificHeatRatio?: number;
}

/**
 * Molar gas flow through the backpressure valve, mol/h.
 *
 * Above the choked threshold `x` saturates and the expansion factor bottoms out
 * at 2/3, so the valve stops seeing downstream pressure and flow becomes
 * proportional to upstream pressure alone. That monotonicity in upstream
 * pressure is what makes the gas-cap balance self-stabilising, and what the
 * semi-implicit moles update in `gas.ts` relies on.
 */
export function gasValveMolarFlow({
  kv,
  openFraction,
  upstreamPressureBarA,
  downstreamPressureBarA,
  temperatureC,
  gasGravity,
  zFactor,
  pressureDropRatioFactor = VALVE_XT_GLOBE,
  specificHeatRatio = GAS_SPECIFIC_HEAT_RATIO,
}: GasValveFlowInput): number {
  const fraction = Math.max(0, Math.min(1, openFraction));
  if (fraction <= 0 || upstreamPressureBarA <= 0) return 0;
  const deltaP = upstreamPressureBarA - downstreamPressureBarA;
  if (deltaP <= 0) return 0;

  const x = deltaP / upstreamPressureBarA;
  const fGamma = specificHeatRatio / REFERENCE_SPECIFIC_HEAT_RATIO;
  const xChoked = Math.max(fGamma * pressureDropRatioFactor, 1e-9);
  const xEffective = Math.min(x, xChoked);
  const expansionFactor = 1 - xEffective / (3 * xChoked);

  const density = gasDensityKgM3(upstreamPressureBarA, temperatureC, gasGravity, zFactor);
  const massFlowKgH =
    IEC_N6_KV * kv * fraction * expansionFactor *
    Math.sqrt(Math.max(0, xEffective * upstreamPressureBarA * density));
  const molarMass = gasGravity * AIR_MOLAR_MASS_KG_MOL;
  if (molarMass <= 0) return 0;
  const molarFlow = massFlowKgH / molarMass;
  return Number.isFinite(molarFlow) ? Math.max(0, molarFlow) : 0;
}
