import type { PhaseFlows, SimulationConfig } from "./types";

const DELTA_P0_PA = 100_000;
const G = 9.80665;
const SECONDS_PER_HOUR = 3600;

/** Smallest positive timestep supported by the inventory integrator. */
export const MIN_TIMESTEP_S = 1e-9;

export interface PhaseOutletFlowInput {
  totalLevelPct: number;
  interfaceLevelPct: number;
  oilValvePct: number;
  waterValvePct: number;
  oilCapacityFactor: number;
  waterCapacityFactor: number;
  config: SimulationConfig;
}

export interface InventoryStepInput {
  oilVolumeM3: number;
  waterVolumeM3: number;
  oilInletM3H: number;
  waterInletM3H: number;
  oilOutletM3H: number;
  waterOutletM3H: number;
  dtS: number;
  fullVolumeM3: number;
}

/**
 * Inventory balance for one supported positive timestep.
 *
 * For each phase, the balance identity subject to floating-point precision is:
 * `finalPhaseVolume = sanitizedStart - normalizationDiscard -
 * actualOutlet * dtS / 3600 + acceptedInlet * dtS / 3600`.
 */
export interface InventoryStepResult {
  oilVolumeM3: number;
  waterVolumeM3: number;
  actualOilOutletM3H: number;
  actualWaterOutletM3H: number;
  acceptedOilInletM3H: number;
  acceptedWaterInletM3H: number;
  normalizationOilDiscardM3: number;
  normalizationWaterDiscardM3: number;
}

function finiteNonnegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function nonnegativeCapacity(value: number): number {
  return value === Number.POSITIVE_INFINITY ? value : finiteNonnegative(value);
}

function clampPercent(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function phaseHeads(
  totalLevelPct: number,
  interfaceLevelPct: number,
  config: SimulationConfig,
): { oil: number; water: number } {
  const diameterM = finiteNonnegative(config.diameterM);
  const oilDensityKgM3 = finiteNonnegative(config.oilDensityKgM3);
  const waterDensityKgM3 = finiteNonnegative(config.waterDensityKgM3);
  const boundedTotalLevelPct = clampPercent(totalLevelPct);
  const boundedInterfaceLevelPct = clampPercent(interfaceLevelPct);
  const totalHeightM = diameterM * boundedTotalLevelPct / 100;
  const interfaceHeightM = diameterM * boundedInterfaceLevelPct / 100;
  const oilLayerHeightM = Math.max(totalHeightM - interfaceHeightM, 0);

  return {
    oil: DELTA_P0_PA + oilDensityKgM3 * G * oilLayerHeightM,
    water:
      DELTA_P0_PA +
      G *
        (waterDensityKgM3 * interfaceHeightM + oilDensityKgM3 * oilLayerHeightM),
  };
}

function saturatingProduct(...values: number[]): number {
  const factors = values.map(finiteNonnegative).sort((left, right) => left - right);
  let product = 1;
  for (const factor of factors) {
    if (factor === 0) return 0;
    if (product > Number.MAX_VALUE / factor) return Number.MAX_VALUE;
    product *= factor;
  }
  return product;
}

function divideVolumeProportionally(
  totalVolumeM3: number,
  oilBasis: number,
  waterBasis: number,
): { oilVolumeM3: number; waterVolumeM3: number } {
  const maximumBasis = Math.max(oilBasis, waterBasis);
  if (maximumBasis <= 0 || totalVolumeM3 <= 0) {
    return { oilVolumeM3: 0, waterVolumeM3: 0 };
  }

  const scaledOil = oilBasis / maximumBasis;
  const scaledWater = waterBasis / maximumBasis;
  const oilShare = scaledOil / (scaledOil + scaledWater);
  const oilVolumeM3 = totalVolumeM3 * oilShare;

  return {
    oilVolumeM3,
    waterVolumeM3: totalVolumeM3 - oilVolumeM3,
  };
}

export function splitFeed(
  totalInletM3H: number,
  waterCutFraction: number,
): { oilInletM3H: number; waterInletM3H: number } {
  const totalFlow = finiteNonnegative(totalInletM3H);
  const waterCut = Number.isNaN(waterCutFraction)
    ? 0
    : Math.max(0, Math.min(1, waterCutFraction));

  return {
    oilInletM3H: totalFlow * (1 - waterCut),
    waterInletM3H: totalFlow * waterCut,
  };
}

export function calculatePhaseOutletFlows(
  input: PhaseOutletFlowInput,
): Pick<PhaseFlows, "oilOutletM3H" | "waterOutletM3H"> {
  const { config } = input;
  const heads = phaseHeads(input.totalLevelPct, input.interfaceLevelPct, config);
  const referenceHeads = phaseHeads(
    config.totalSetpointPct,
    config.interfaceSetpointPct,
    config,
  );

  return {
    oilOutletM3H: saturatingProduct(
      input.oilCapacityFactor,
      config.oilRatedFlowM3H,
      clampPercent(input.oilValvePct) / 100,
      Math.sqrt(heads.oil / referenceHeads.oil),
    ),
    waterOutletM3H: saturatingProduct(
      input.waterCapacityFactor,
      config.waterRatedFlowM3H,
      clampPercent(input.waterValvePct) / 100,
      Math.sqrt(heads.water / referenceHeads.water),
    ),
  };
}

export function integratePhaseInventories(input: InventoryStepInput): InventoryStepResult {
  let oilVolumeM3 = finiteNonnegative(input.oilVolumeM3);
  let waterVolumeM3 = finiteNonnegative(input.waterVolumeM3);
  if (!Number.isFinite(input.dtS) || input.dtS < MIN_TIMESTEP_S) {
    return {
      oilVolumeM3,
      waterVolumeM3,
      actualOilOutletM3H: 0,
      actualWaterOutletM3H: 0,
      acceptedOilInletM3H: 0,
      acceptedWaterInletM3H: 0,
      normalizationOilDiscardM3: 0,
      normalizationWaterDiscardM3: 0,
    };
  }

  const initialOilVolumeM3 = oilVolumeM3;
  const initialWaterVolumeM3 = waterVolumeM3;
  const physicalCapacityM3 = nonnegativeCapacity(input.fullVolumeM3);
  const inventoryLimitM3 = Math.min(physicalCapacityM3, Number.MAX_VALUE);
  const exceedsInventoryLimit =
    oilVolumeM3 > inventoryLimitM3 ||
    waterVolumeM3 > inventoryLimitM3 - oilVolumeM3;

  if (exceedsInventoryLimit) {
    const normalized = divideVolumeProportionally(
      inventoryLimitM3,
      oilVolumeM3,
      waterVolumeM3,
    );
    oilVolumeM3 = normalized.oilVolumeM3;
    waterVolumeM3 = normalized.waterVolumeM3;
  }
  const discardedOilVolumeM3 = initialOilVolumeM3 - oilVolumeM3;
  const discardedWaterVolumeM3 = initialWaterVolumeM3 - waterVolumeM3;

  const dtS = input.dtS;
  const stepHours = dtS / SECONDS_PER_HOUR;
  const requestedOilOutletM3H = finiteNonnegative(input.oilOutletM3H);
  const requestedWaterOutletM3H = finiteNonnegative(input.waterOutletM3H);
  const oilOutletVolumeM3 = Math.min(
    oilVolumeM3,
    requestedOilOutletM3H * stepHours,
  );
  const waterOutletVolumeM3 = Math.min(
    waterVolumeM3,
    requestedWaterOutletM3H * stepHours,
  );
  const retainedOilVolumeM3 = oilVolumeM3 - oilOutletVolumeM3;
  const retainedWaterVolumeM3 = waterVolumeM3 - waterOutletVolumeM3;

  const requestedOilInletM3H = finiteNonnegative(input.oilInletM3H);
  const requestedWaterInletM3H = finiteNonnegative(input.waterInletM3H);
  const availableCapacityM3 = Math.max(
    0,
    inventoryLimitM3 - retainedOilVolumeM3 - retainedWaterVolumeM3,
  );
  let acceptedOilInletVolumeM3: number;
  let acceptedWaterInletVolumeM3: number;

  const maximumInletRateM3H = Math.max(
    requestedOilInletM3H,
    requestedWaterInletM3H,
  );
  if (maximumInletRateM3H <= 0 || availableCapacityM3 <= 0) {
    acceptedOilInletVolumeM3 = 0;
    acceptedWaterInletVolumeM3 = 0;
  } else {
    const scaledOilInlet = requestedOilInletM3H / maximumInletRateM3H;
    const scaledWaterInlet = requestedWaterInletM3H / maximumInletRateM3H;
    const scaledTotalInlet = scaledOilInlet + scaledWaterInlet;
    const availableInletRateM3H = availableCapacityM3 / stepHours;
    const requestsFit =
      maximumInletRateM3H <= availableInletRateM3H / scaledTotalInlet;

    if (requestsFit) {
      acceptedOilInletVolumeM3 = requestedOilInletM3H * stepHours;
      acceptedWaterInletVolumeM3 = requestedWaterInletM3H * stepHours;
    } else {
      const accepted = divideVolumeProportionally(
        availableCapacityM3,
        requestedOilInletM3H,
        requestedWaterInletM3H,
      );
      acceptedOilInletVolumeM3 = accepted.oilVolumeM3;
      acceptedWaterInletVolumeM3 = accepted.waterVolumeM3;
    }
  }

  return {
    oilVolumeM3: Math.max(0, retainedOilVolumeM3 + acceptedOilInletVolumeM3),
    waterVolumeM3: Math.max(0, retainedWaterVolumeM3 + acceptedWaterInletVolumeM3),
    actualOilOutletM3H: oilOutletVolumeM3 / stepHours,
    actualWaterOutletM3H: waterOutletVolumeM3 / stepHours,
    acceptedOilInletM3H: acceptedOilInletVolumeM3 / stepHours,
    acceptedWaterInletM3H: acceptedWaterInletVolumeM3 / stepHours,
    normalizationOilDiscardM3: discardedOilVolumeM3,
    normalizationWaterDiscardM3: discardedWaterVolumeM3,
  };
}
