import type { PidConfig } from "@/lib/simulation/types";

/**
 * Two ways of writing the same controller.
 *
 * The engine works in the **parallel** form, with independent gains Kp, Ki and Kd.
 * Control courses and this simulator's own material use it, and it is the form the
 * maths is cleanest in.
 *
 * A field operator standing at a DCS almost never sees it. Panels are set up in the
 * **standard** form: proportional band as a percentage, integral time in seconds or
 * minutes per repeat, derivative time in seconds. An operator who is fluent in
 * "twelve percent band, ninety second reset" gets nothing from being told Kp is 8.3.
 *
 * Both describe the same controller; only the notation differs. Converting between
 * them in the interface lets each reader work in their own units without the engine
 * or the golden runs ever changing.
 */
export type GainForm = "parallel" | "standard";

export interface StandardGains {
  /** Proportional band, percent. PB = 100 / Kp. */
  proportionalBandPct: number;
  /**
   * Integral time, seconds per repeat. Ti = Kp / Ki. Infinite when there is no
   * integral action, which is how a panel shows the term switched off.
   */
  integralTimeS: number;
  /** Derivative time, seconds. Td = Kd / Kp. */
  derivativeTimeS: number;
}

/** Below this the reciprocal stops being meaningful and starts being noise. */
const MINIMUM_GAIN = 1e-6;

export function toStandardForm(config: Pick<PidConfig, "kp" | "ki" | "kd">): StandardGains {
  const kp = Number.isFinite(config.kp) ? config.kp : 0;
  const ki = Number.isFinite(config.ki) ? config.ki : 0;
  const kd = Number.isFinite(config.kd) ? config.kd : 0;

  return {
    // A zero proportional gain is an infinitely wide band: the controller ignores
    // error entirely.
    proportionalBandPct: kp > MINIMUM_GAIN ? 100 / kp : Number.POSITIVE_INFINITY,
    // No integral action is an infinite reset time, which is what a panel shows.
    integralTimeS: ki > MINIMUM_GAIN && kp > MINIMUM_GAIN
      ? kp / ki
      : Number.POSITIVE_INFINITY,
    derivativeTimeS: kp > MINIMUM_GAIN ? kd / kp : 0,
  };
}

export function toParallelForm(gains: StandardGains): Pick<PidConfig, "kp" | "ki" | "kd"> {
  const band = Number.isFinite(gains.proportionalBandPct) ? gains.proportionalBandPct : 0;
  const kp = band > MINIMUM_GAIN ? 100 / band : 0;
  const integralTimeS = gains.integralTimeS;
  const derivativeTimeS = Number.isFinite(gains.derivativeTimeS) ? gains.derivativeTimeS : 0;

  return {
    kp,
    ki: Number.isFinite(integralTimeS) && integralTimeS > MINIMUM_GAIN
      ? kp / integralTimeS
      : 0,
    kd: kp * derivativeTimeS,
  };
}

/**
 * How a panel shows a term that is switched off. Writing "∞" is what an operator
 * expects; writing a very large number would look like a setting someone chose.
 */
export const OFF_SYMBOL = "∞";

export function formatStandardValue(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return OFF_SYMBOL;
  return value.toFixed(digits);
}
