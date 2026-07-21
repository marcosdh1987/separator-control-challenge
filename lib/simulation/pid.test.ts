import { describe, expect, it } from "vitest";

import { createPidState, stepPid, type PidState } from "./pid";
import { DEFAULT_PID } from "./types";

describe("reverse-acting PID", () => {
  it("opens the dump valve when measured level rises above setpoint", () => {
    const result = stepPid(createPidState(), DEFAULT_PID, {
      measurement: 55,
      setpoint: 50,
      dt: 0.2,
      bias: 50,
    });

    expect(result.output).toBeGreaterThan(50);
    expect(result.terms.proportional).toBe(20);
  });

  it("does not wind the integral farther into saturation", () => {
    let state = createPidState();
    for (let index = 0; index < 200; index += 1) {
      state = stepPid(state, { ...DEFAULT_PID, kp: 10, ki: 0.3 }, {
        measurement: 100,
        setpoint: 50,
        dt: 0.2,
        bias: 50,
      }).state;
    }

    expect(Math.abs(state.integralTerm)).toBeLessThanOrEqual(DEFAULT_PID.integralLimit);
    expect(state.integralTerm).toBe(0);
  });

  it("freezes the integral at high saturation when positive error drives the output higher", () => {
    const result = stepPid(createPidState(), { ...DEFAULT_PID, kp: 10, ki: 0.3 }, {
      measurement: 100,
      setpoint: 50,
      dt: 0.2,
      bias: 50,
    });

    expect(result.output).toBe(DEFAULT_PID.outputMax);
    expect(result.state.integralTerm).toBe(0);
  });

  it("freezes the integral at low saturation when negative error drives the output lower", () => {
    const result = stepPid(createPidState(), { ...DEFAULT_PID, kp: 10, ki: 0.3 }, {
      measurement: 0,
      setpoint: 50,
      dt: 0.2,
      bias: 50,
    });

    expect(result.output).toBe(DEFAULT_PID.outputMin);
    expect(result.state.integralTerm).toBe(0);
  });

  it("unwinds a stored integral after error reverses and eventually leaves saturation", () => {
    const config = {
      ...DEFAULT_PID,
      kp: 0,
      ki: 1,
      integralLimit: 100,
    };
    let state: PidState = createPidState();
    let saturatedOutput = 0;
    for (let index = 0; index < 7; index += 1) {
      const result = stepPid(state, config, {
        measurement: 60,
        setpoint: 50,
        dt: 1,
        bias: 50,
      });
      state = result.state;
      saturatedOutput = result.output;
    }

    const woundIntegral = state.integralTerm;
    const recovered = stepPid(state, config, {
      measurement: 40,
      setpoint: 50,
      dt: 1,
      bias: 50,
    });

    expect(saturatedOutput).toBe(config.outputMax);
    expect(woundIntegral).toBe(50);
    expect(recovered.state.integralTerm).toBeLessThan(woundIntegral);
    expect(recovered.output).toBeLessThan(config.outputMax);
  });

  it("bounds the integral contribution independently of output saturation", () => {
    let state = createPidState();
    const config = { ...DEFAULT_PID, kp: 0, ki: 1, integralLimit: 2 };

    for (let index = 0; index < 10; index += 1) {
      state = stepPid(state, config, {
        measurement: 70,
        setpoint: 50,
        dt: 1,
        bias: 50,
      }).state;
    }

    expect(state.integralTerm).toBe(2);
    expect(Math.abs(state.integralTerm)).toBeLessThanOrEqual(config.integralLimit);
  });

  it("filters derivative-on-measurement", () => {
    const initial = stepPid(createPidState(), DEFAULT_PID, {
      measurement: 50,
      setpoint: 50,
      dt: 0.2,
      bias: 50,
    });
    const changed = stepPid(initial.state, DEFAULT_PID, {
      measurement: 52,
      setpoint: 50,
      dt: 0.2,
      bias: 50,
    });

    expect(changed.terms.derivative).toBeGreaterThan(0);
    expect(changed.terms.derivative).toBeLessThan(DEFAULT_PID.kd * 10);
  });

  it("does not create a derivative kick from a setpoint change alone", () => {
    const initial = stepPid(createPidState(), DEFAULT_PID, {
      measurement: 50,
      setpoint: 50,
      dt: 0.2,
      bias: 50,
    });
    const changedSetpoint = stepPid(initial.state, DEFAULT_PID, {
      measurement: 50,
      setpoint: 55,
      dt: 0.2,
      bias: 50,
    });

    expect(changedSetpoint.terms.derivative).toBe(0);
  });

  it("shows derivative sensitivity to noisy measurements and reduces it with filtering", () => {
    const measurements = [50, 51, 49, 51, 49, 50];
    const unfilteredConfig = {
      ...DEFAULT_PID,
      kp: 0,
      ki: 0,
      kd: 10,
      derivativeFilterTauS: 0,
    };
    const filteredConfig = { ...unfilteredConfig, derivativeFilterTauS: 1 };
    const evaluate = (config: typeof DEFAULT_PID, series: number[]) => {
      let state = createPidState();
      return series.map((measurement) => {
        const result = stepPid(state, config, {
          measurement,
          setpoint: 50,
          dt: 0.2,
          bias: 50,
        });
        state = result.state;
        return result.terms.derivative;
      });
    };
    const clean = evaluate(unfilteredConfig, measurements.map(() => 50));
    const noisyUnfiltered = evaluate(unfilteredConfig, measurements);
    const noisyFiltered = evaluate(filteredConfig, measurements);
    const maxMagnitude = (values: number[]) => Math.max(...values.map(Math.abs));
    const variance = (values: number[]) => {
      const mean = values.reduce((total, value) => total + value, 0) / values.length;
      return values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
    };

    expect(maxMagnitude(clean)).toBe(0);
    expect(maxMagnitude(noisyUnfiltered)).toBeGreaterThan(0);
    expect(maxMagnitude(noisyFiltered)).toBeLessThan(maxMagnitude(noisyUnfiltered));
    expect(variance(noisyFiltered)).toBeLessThan(variance(noisyUnfiltered));
  });
});
