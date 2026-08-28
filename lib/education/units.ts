import { DEFAULT_SIMULATION } from "@/lib/simulation/types";

/**
 * Percentages are how a control engineer reads a vessel. Operators tend to think in
 * the physical thing: how many millimetres of liquid, how much room is left before
 * the alarm. This module converts between the two so the interface can show both,
 * without the simulation ever leaving percent.
 */

/** Vessel height, which is the diameter of a horizontal cylinder. */
export const VESSEL_HEIGHT_MM = DEFAULT_SIMULATION.diameterM * 1000;

/** Level as a height above the bottom of the vessel, in millimetres. */
export function levelToMillimetres(levelPct: number, heightMm = VESSEL_HEIGHT_MM): number {
  if (!Number.isFinite(levelPct)) return 0;
  return (Math.max(0, Math.min(100, levelPct)) / 100) * heightMm;
}

/** How much level is left before a limit, in millimetres. Negative once past it. */
export function marginToMillimetres(
  levelPct: number,
  limitPct: number,
  heightMm = VESSEL_HEIGHT_MM,
): number {
  if (!Number.isFinite(levelPct) || !Number.isFinite(limitPct)) return 0;
  return ((limitPct - levelPct) / 100) * heightMm;
}

/**
 * Residence time at the current inventory and outflow: the quantity separation
 * actually depends on. Returns null when nothing is leaving, because a vessel with
 * no outflow does not have a meaningful residence time; it has a filling time.
 */
export function residenceTimeMinutes(
  liquidVolumeM3: number,
  outflowM3H: number,
): number | null {
  if (!Number.isFinite(liquidVolumeM3) || !Number.isFinite(outflowM3H)) return null;
  if (outflowM3H <= 0) return null;
  return (liquidVolumeM3 / outflowM3H) * 60;
}

export function formatMillimetres(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${Math.round(value)} mm`;
}

export function formatMinutes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} min`;
}
