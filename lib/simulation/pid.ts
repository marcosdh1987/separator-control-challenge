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
