/**
 * Chart decimation for long runs.
 *
 * A 4 h run has 16 000 samples per signal; a chart is a few hundred pixels
 * wide. Each pixel column keeps the first, minimum, maximum and last recorded
 * sample in it, so every peak and trough survives and nothing is averaged
 * away. Gaps (NaN) break the line instead of being bridged. This only affects
 * drawing; readouts always use the recorded samples.
 */

export interface SeriesPoint {
  t: number;
  v: number;
}

/** Points to draw, with `null` marking a break in the line. */
export type DrawSeries = (SeriesPoint | null)[];

export function decimateMinMax(
  times: Float64Array,
  values: Float64Array,
  fromS: number,
  toS: number,
  buckets: number,
  offsetS = 0,
): DrawSeries {
  const out: DrawSeries = [];
  if (times.length === 0 || !(toS > fromS) || buckets < 1) return out;
  const width = (toS - fromS) / buckets;
  let bucket = -1;
  let first: SeriesPoint | null = null;
  let low: SeriesPoint | null = null;
  let high: SeriesPoint | null = null;
  let last: SeriesPoint | null = null;
  let broken = false;

  const flush = () => {
    if (!first || !low || !high || !last) return;
    const chosen = [first, low, high, last].sort((a, b) => a.t - b.t);
    for (let i = 0; i < chosen.length; i += 1) {
      if (i === 0 || chosen[i] !== chosen[i - 1]) out.push(chosen[i]);
    }
    first = low = high = last = null;
  };

  for (let i = 0; i < times.length; i += 1) {
    const t = times[i] - offsetS;
    if (t < fromS || t > toS) continue;
    const v = values[i];
    if (Number.isNaN(v)) {
      flush();
      if (!broken && out.length > 0) out.push(null);
      broken = true;
      continue;
    }
    broken = false;
    const index = Math.min(buckets - 1, Math.floor((t - fromS) / width));
    if (index !== bucket) {
      flush();
      bucket = index;
    }
    const point = { t, v };
    if (!first) {
      first = low = high = point;
    } else {
      if (v < (low as SeriesPoint).v) low = point;
      if (v > (high as SeriesPoint).v) high = point;
    }
    last = point;
  }
  flush();
  return out;
}

/** Step-shaped series for held signals: hold each value until the next tick. */
export function toSteps(series: DrawSeries): DrawSeries {
  const out: DrawSeries = [];
  for (let i = 0; i < series.length; i += 1) {
    const point = series[i];
    const next = series[i + 1];
    out.push(point);
    if (point && next) out.push({ t: next.t, v: point.v });
  }
  return out;
}
