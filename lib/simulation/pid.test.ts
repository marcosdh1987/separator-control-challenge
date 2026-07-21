import { describe, expect, it } from "vitest";

import { createPidState, stepPid } from "./pid";
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
});
