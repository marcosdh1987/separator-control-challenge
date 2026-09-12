import { describe, expect, it } from "vitest";

import { MESSAGES } from "@/lib/i18n/messages";
import { runToEnd } from "@/lib/simulation/engine";
import { getScenario } from "@/lib/simulation/scenarios";
import {
  DEFAULT_SIMULATION,
  DEFAULT_SIMULATION_WITH_GAS,
  type DualPidConfig,
} from "@/lib/simulation/types";
import { buildAttemptEvidence, gradeAttempt } from "./grading";
import { LESSON_LIST, getLesson, nextLessonId } from "./lessons";
import { LESSON_IDS, LESSON_VISUAL_KINDS, type Lesson } from "./types";

/** Runs a lesson's exercise with a given tuning and grades the attempt. */
function attempt(lesson: Lesson, pid: DualPidConfig) {
  const config = lesson.exercise.gasEnabled ? DEFAULT_SIMULATION_WITH_GAS : DEFAULT_SIMULATION;
  const scenario = getScenario(lesson.exercise.scenarioId);
  const run = runToEnd(config, pid, lesson.exercise.scenarioId, scenario.seed);
  return gradeAttempt(
    lesson,
    buildAttemptEvidence(run.samples, run.result, config, scenario.disturbanceStartS),
  );
}

describe("lesson catalogue", () => {
  it("is ordered, complete and internally consistent", () => {
    expect(LESSON_LIST.map((lesson) => lesson.id)).toEqual([...LESSON_IDS]);
    for (const lesson of LESSON_LIST) {
      expect(getLesson(lesson.id)).toBe(lesson);
      expect(lesson.estimatedMinutes).toBeGreaterThan(0);
      expect(lesson.exercise.scenarioId).toBeTruthy();
    }
    expect(nextLessonId(LESSON_IDS.at(-1)!)).toBeNull();
    expect(nextLessonId(LESSON_IDS[0])).toBe(LESSON_IDS[1]);
  });

  it("only asks for pressure performance where the gas cap is enabled", () => {
    for (const lesson of LESSON_LIST) {
      if (lesson.successCriteria.maximumPressureIae !== undefined) {
        expect(lesson.exercise.gasEnabled).toBe(true);
      }
    }
  });

  it("provides a visual kind and localized accessible text for every lesson", () => {
    const supportedKinds = new Set<string>(LESSON_VISUAL_KINDS);

    for (const lesson of LESSON_LIST) {
      expect(supportedKinds.has(lesson.visualKind)).toBe(true);
      expect(MESSAGES.en.training.lesson[lesson.id].visualAlt.trim()).not.toBe("");
      expect(MESSAGES.es.training.lesson[lesson.id].visualAlt.trim()).not.toBe("");
    }
  });
});

describe("grading", () => {
  it("passes the opening lesson, which only asks the vessel to stay safe", () => {
    const lesson = getLesson("what-is-a-separator");
    const outcome = attempt(lesson, lesson.exercise.initialPid);
    expect(outcome.passed).toBe(true);
  });

  it("requires the proportional-only lesson to actually leave an offset", () => {
    const lesson = getLesson("level-and-proportional-action");
    const outcome = attempt(lesson, lesson.exercise.initialPid);
    const offsetCheck = outcome.checks.find((check) => check.id === "steady-state-offset");

    expect(offsetCheck).toBeDefined();
    // The lesson's whole point is that this gap exists and cannot be tuned away.
    expect(offsetCheck!.passed).toBe(true);
    expect(outcome.passed).toBe(true);
  });

  it("fails the integral lesson while integral action is still switched off", () => {
    const lesson = getLesson("integral-action-and-windup");
    // Its starting tuning is proportional-only, which is exactly what it asks the
    // trainee to move away from, so the untouched exercise must not pass.
    const outcome = attempt(lesson, lesson.exercise.initialPid);
    expect(outcome.passed).toBe(false);
  });

  it("passes the integral lesson once integral action is added", () => {
    const lesson = getLesson("integral-action-and-windup");
    const tuned: DualPidConfig = {
      total: { ...lesson.exercise.initialPid.total, kp: 4, ki: 0.08 },
      interface: { ...lesson.exercise.initialPid.interface, kp: 4, ki: 0.08 },
    };
    const outcome = attempt(lesson, tuned);
    expect(outcome.passed).toBe(true);
  });

  it("reports every criterion it judged, with the measured value", () => {
    const lesson = getLesson("systematic-tuning");
    const outcome = attempt(lesson, lesson.exercise.initialPid);
    const ids = outcome.checks.map((check) => check.id);

    expect(ids).toContain("no-trip");
    expect(ids).toContain("total-iae");
    expect(ids).toContain("score");
    for (const check of outcome.checks) {
      if (check.target !== undefined) expect(check.actual).toBeTypeOf("number");
    }
  });

  it("is won by removing the derivative action, which is what it teaches", () => {
    const lesson = getLesson("interface-noise-and-derivative");
    const base = lesson.exercise.initialPid;

    // It starts on the standard tuning, whose derivative gain is too much for a
    // noisy measurement; that is the situation the trainee has to recognise.
    const asFound = attempt(lesson, base);
    expect(asFound.passed).toBe(false);
    expect(asFound.checks.find((check) => check.id === "valve-travel")?.passed).toBe(false);

    const withoutDerivative = attempt(lesson, {
      total: { ...base.total, kd: 0 },
      interface: { ...base.interface, kd: 0 },
    });
    expect(withoutDerivative.passed).toBe(true);
    // Removing it costs nothing in tracking: the error bound still passes.
    expect(withoutDerivative.checks.find((check) => check.id === "interface-iae")?.passed).toBe(true);
  });

  it("does not credit pressure performance to a run without a gas cap", () => {
    const lesson = getLesson("the-third-loop-pressure");
    const withoutGas: Lesson = {
      ...lesson,
      exercise: { ...lesson.exercise, gasEnabled: false },
    };
    const outcome = attempt(withoutGas, lesson.exercise.initialPid);
    const pressureCheck = outcome.checks.find((check) => check.id === "pressure-iae");

    expect(pressureCheck?.passed).toBe(false);
  });
});
