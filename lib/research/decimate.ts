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
  /**
   * For held (step) signals: also keep the sample right after each bucket's
   * minimum and maximum. Without it, a one-tick spike would be held until the
   * next drawn point and look up to a bucket wide.
   */
  holdSuccessors = false,
): DrawSeries {
  const out: DrawSeries = [];
  if (times.length === 0 || !(toS > fromS) || buckets < 1) return out;
  const width = (toS - fromS) / buckets;
  let bucket = -1;
  let first = -1;
  let low = -1;
  let high = -1;
  let last = -1;
  let broken = false;
  let lastTime = Number.NEGATIVE_INFINITY;

  const push = (index: number) => {
    const t = times[index] - offsetS;
    if (t <= lastTime || t > toS || Number.isNaN(values[index])) return;
    out.push({ t, v: values[index] });
    lastTime = t;
  };

  const flush = () => {
    if (first < 0) return;
    const chosen = new Set([first, low, high, last]);
    if (holdSuccessors) {
      if (low + 1 < times.length) chosen.add(low + 1);
      if (high + 1 < times.length) chosen.add(high + 1);
    }
    for (const index of [...chosen].sort((a, b) => a - b)) push(index);
    first = low = high = last = -1;
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
    if (first < 0) {
      first = low = high = i;
    } else {
      if (v < values[low]) low = i;
      if (v > values[high]) high = i;
    }
    last = i;
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
