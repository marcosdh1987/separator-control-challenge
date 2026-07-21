export interface SurfaceImpulseInput {
  levelRatePctS: number;
  totalFeedM3H: number;
}

const finiteOrZero = (value: number) => Number.isFinite(value) ? value : 0;

/** Returns a dimensionless, bounded display-only disturbance amplitude. */
export function surfaceImpulse(input: SurfaceImpulseInput): number {
  if (!Number.isFinite(input.levelRatePctS) || !Number.isFinite(input.totalFeedM3H)) return 0;
  const levelComponent = Math.abs(input.levelRatePctS) / 8;
  const feedComponent = Math.abs(input.totalFeedM3H - 50) / 90;
  return Math.min(1, Math.max(0, 0.68 * levelComponent + 0.32 * feedComponent));
}

/** Exponential decay for visual energy; never feeds back into simulation state. */
export function decaySurfaceAmplitude(amplitude: number, elapsedS: number, decayRate = 2.4): number {
  const safeAmplitude = Math.max(0, finiteOrZero(amplitude));
  const safeElapsed = Math.max(0, finiteOrZero(elapsedS));
  const safeRate = Math.max(0, finiteOrZero(decayRate));
  return safeAmplitude * Math.exp(-safeRate * safeElapsed);
}
