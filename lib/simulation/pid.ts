import type { PidConfig, PidTerms } from "./types";

export interface PidState {
  integralTerm: number;
  filteredDerivative: number;
  previousMeasurement: number | null;
}

interface PidInput {
  measurement: number;
  setpoint: number;
  dt: number;
  bias: number;
}

interface PidStep {
  output: number;
  state: PidState;
  terms: PidTerms;
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export const createPidState = (): PidState => ({
  integralTerm: 0,
  filteredDerivative: 0,
  previousMeasurement: null,
});

/**
 * Calculates one reverse-acting PID sample for an outlet valve.
 *
 * The output is clamped to the configured physical range (normally 0–100%).
 * Conditional integration provides anti-windup: when the proposed output is
 * already beyond a limit and the current error would drive it farther beyond
 * that same limit, the integrator freezes. Once the error reverses, the stored
 * integral is allowed to unwind so the controller can recover from saturation.
 * Derivative action is calculated from measurement, not setpoint error, then
 * filtered with a first-order filter to avoid a derivative kick and reduce
 * measurement-noise amplification.
 */
export function stepPid(
  state: PidState,
  config: PidConfig,
  input: PidInput,
): PidStep {
  const error = input.measurement - input.setpoint;
  const proportional = config.kp * error;
  const rawDerivative = state.previousMeasurement === null
    ? 0
    : (input.measurement - state.previousMeasurement) / input.dt;
  const alpha = config.derivativeFilterTauS /
    (config.derivativeFilterTauS + input.dt);
  const filteredDerivative =
    alpha * state.filteredDerivative + (1 - alpha) * rawDerivative;
  const derivative = config.kd * filteredDerivative;
  const candidateIntegral = clamp(
    state.integralTerm + config.ki * error * input.dt,
    -config.integralLimit,
    config.integralLimit,
  );
  const candidateOutput = input.bias + proportional + candidateIntegral + derivative;
  const drivesFurtherIntoSaturation =
    (candidateOutput > config.outputMax && error > 0) ||
    (candidateOutput < config.outputMin && error < 0);
  const integral = drivesFurtherIntoSaturation
    ? state.integralTerm
    : candidateIntegral;
  const output = clamp(
    input.bias + proportional + integral + derivative,
    config.outputMin,
    config.outputMax,
  );

  return {
    output,
    state: {
      integralTerm: integral,
      filteredDerivative,
      previousMeasurement: input.measurement,
    },
    terms: { proportional, integral, derivative },
  };
}
