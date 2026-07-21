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
    expect(PID_EDUCATION_CONTENT.theory.reverseActionConvention).toContain("reverse process action");
  });

  it("includes the complete diagnosis set and the approved external references", () => {
    expect(DIAGNOSIS_PATTERNS).toHaveLength(7);
    expect(REFERENCES.map(({ url }) => url)).toContain("https://fbsbook.org/");
    expect(REFERENCES.find(({ title }) => title === "PID Controllers: Theory, Design, and Tuning")?.url).toBeUndefined();
  });
});
