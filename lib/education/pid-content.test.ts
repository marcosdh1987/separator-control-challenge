import { describe, expect, it } from "vitest";

import {
  DIAGNOSIS_PATTERNS,
  PID_EDUCATION_CONTENT,
  REFERENCES,
} from "./pid-content";

describe("PID education content", () => {
  it("keeps the repeatable-experiment rule and reverse-action convention in centralized data", () => {
    expect(PID_EDUCATION_CONTENT.repeatableExperimentGoldenRule).toBe(
      "Change one parameter at a time and repeat the same deterministic scenario. Otherwise, you cannot know which change improved or degraded the response.",
    );
    expect(PID_EDUCATION_CONTENT.theory.parallelFormula).toBe(
      "u(t) = bias + Kp · (PV − SP) + Ki · ∫(PV − SP)dt + Kd · filtered(dPV/dt)",
    );
    expect(PID_EDUCATION_CONTENT.theory.reverseActionConvention).toContain("reverse-acting");
    expect(PID_EDUCATION_CONTENT.gains.kd.description).toContain("measurement (PV)");
    expect(PID_EDUCATION_CONTENT.gains.kd.importantNote).toContain("measurement, not setpoint error");
  });

  it("includes the complete diagnosis set and the approved external references", () => {
    expect(DIAGNOSIS_PATTERNS).toHaveLength(7);
    expect(REFERENCES.map(({ url }) => url)).toContain("https://fbsbook.org/");
    expect(REFERENCES.find(({ title }) => title === "PID Controllers: Theory, Design, and Tuning")?.url).toBeUndefined();
  });

  it("freezes exported content lists and their items for safe reuse", () => {
    expect(Object.isFrozen(REFERENCES)).toBe(true);
    expect(Object.isFrozen(REFERENCES[0])).toBe(true);
    expect(Object.isFrozen(DIAGNOSIS_PATTERNS)).toBe(true);
    expect(Object.isFrozen(DIAGNOSIS_PATTERNS[0])).toBe(true);
    expect(Object.isFrozen(DIAGNOSIS_PATTERNS[0].symptoms)).toBe(true);
    expect(Object.isFrozen(PID_EDUCATION_CONTENT)).toBe(true);
    expect(Object.isFrozen(PID_EDUCATION_CONTENT.gains.kp)).toBe(true);
    expect(Object.isFrozen(PID_EDUCATION_CONTENT.gains.kp.increaseWhen)).toBe(true);
  });
});
