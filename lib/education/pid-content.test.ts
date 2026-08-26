import { describe, expect, it } from "vitest";

import { DIAGNOSIS_PATTERN_IDS } from "@/lib/education/diagnosis";
import {
  GAIN_IDS,
  LOOP_EXPLANATION_IDS,
  MANUAL_TUNING_ORDER,
  MANUAL_TUNING_STEP_IDS,
  PID_PARALLEL_FORMULA,
  REFERENCES,
} from "@/lib/education/pid-content";
import { messagesFor } from "@/lib/i18n/test-utils";

const LOCALES = ["en", "es"] as const;

describe("PID education content", () => {
  it("keeps notation out of the message files so it cannot drift between locales", () => {
    expect(PID_PARALLEL_FORMULA).toBe(
      "u(t) = bias + Kp · (PV − SP) + Ki · ∫(PV − SP)dt + Kd · filtered(dPV/dt)",
    );
    expect(MANUAL_TUNING_ORDER).toBe("Kp → Ki → Kd");
  });

  it("keeps the approved external references with their citations untranslated", () => {
    expect(REFERENCES).toHaveLength(8);
    expect(REFERENCES.map(({ url }) => url)).toContain("https://fbsbook.org/");
    expect(
      REFERENCES.find(({ title }) => title === "PID Controllers: Theory, Design, and Tuning")?.url,
    ).toBeUndefined();
    expect(new Set(REFERENCES.map(({ id }) => id)).size).toBe(REFERENCES.length);
  });

  it("freezes the exported reference list and its entries for safe reuse", () => {
    expect(Object.isFrozen(REFERENCES)).toBe(true);
    expect(Object.isFrozen(REFERENCES[0])).toBe(true);
  });

  it.each(LOCALES)("covers every teaching identifier in %s", (locale) => {
    const { education } = messagesFor(locale);

    expect(Object.keys(education.gain)).toEqual([...GAIN_IDS]);
    expect(Object.keys(education.diagnosisPattern)).toEqual([...DIAGNOSIS_PATTERN_IDS]);
    expect(Object.keys(education.manualTuning.step)).toEqual([...MANUAL_TUNING_STEP_IDS]);
    expect(Object.keys(education.loopExplanation)).toEqual([...LOOP_EXPLANATION_IDS]);
    expect(Object.keys(education.referenceDescription).sort()).toEqual(
      REFERENCES.map(({ id }) => id).sort(),
    );
  });

  it("teaches the reverse-action convention and derivative-on-measurement choice", () => {
    const { education } = messagesFor("en");

    expect(education.theory.reverseActionConvention).toContain("reverse-acting");
    expect(education.gain.kd.description).toContain("measurement (PV)");
    expect(education.gain.kd.importantNote).toContain("measurement, not setpoint error");
    expect(education.repeatableExperimentGoldenRule).toBe(
      "Change one parameter at a time and repeat the same deterministic scenario. Otherwise, you cannot know which change improved or degraded the response.",
    );
  });
});
