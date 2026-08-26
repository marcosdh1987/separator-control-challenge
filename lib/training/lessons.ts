import {
  DEFAULT_DUAL_PID,
  DEFAULT_PID,
  DEFAULT_PRESSURE_PID,
} from "@/lib/simulation/types";
import { LESSON_IDS, type Lesson, type LessonId } from "./types";

const pid = (overrides: Partial<typeof DEFAULT_PID> = {}) => ({ ...DEFAULT_PID, ...overrides });

/**
 * The curriculum. Each lesson isolates one idea and gives it a scenario that
 * makes that idea visible; the wording lives in the `training` message namespace.
 *
 * Two lessons are deliberately unwinnable in the usual sense. Lesson two ends with
 * a standing offset, because that is what proportional-only control does, and
 * lesson five cannot be held perfectly, because a purely reactive controller
 * always arrives late to a slug. Both are graded on observing the effect, not on
 * defeating it.
 */
const LESSONS: Record<LessonId, Lesson> = {
  "what-is-a-separator": {
    id: "what-is-a-separator",
    level: "foundation",
    estimatedMinutes: 6,
    exercise: {
      scenarioId: "normal",
      gasEnabled: false,
      initialPid: DEFAULT_DUAL_PID,
    },
    // Reading and exploring; the vessel simply has to stay inside its envelope.
    successCriteria: { forbiddenTrips: [] },
  },

  "level-and-proportional-action": {
    id: "level-and-proportional-action",
    level: "foundation",
    estimatedMinutes: 10,
    exercise: {
      scenarioId: "feed-step",
      gasEnabled: false,
      // Proportional only: the offset this leaves behind is the lesson.
      initialPid: {
        total: pid({ kp: 3, ki: 0, kd: 0 }),
        interface: pid({ kp: 3, ki: 0, kd: 0 }),
      },
      lockedGains: ["ki", "kd"],
      expectedPatterns: ["offset"],
    },
    successCriteria: { forbiddenTrips: [], requiresSteadyStateOffset: true },
  },

  "integral-action-and-windup": {
    id: "integral-action-and-windup",
    level: "practice",
    estimatedMinutes: 12,
    exercise: {
      scenarioId: "feed-step",
      gasEnabled: false,
      initialPid: {
        total: pid({ kp: 3, ki: 0, kd: 0 }),
        interface: pid({ kp: 3, ki: 0, kd: 0 }),
      },
      lockedGains: ["kd"],
      expectedPatterns: ["offset", "overshoot"],
    },
    // Thresholds measured, not guessed. Proportional-only reaches 364 at best
    // (Kp = 8), so it cannot pass; Kp 4 with Ki 0.08 reaches 315. The overshoot
    // bound rules out buying a lower error with a wild Ki, which at 0.15 costs
    // 55% overshoot.
    successCriteria: {
      forbiddenTrips: [],
      maximumTotalIae: 330,
      maximumOvershootPct: 12,
    },
  },

  "interface-noise-and-derivative": {
    id: "interface-noise-and-derivative",
    level: "practice",
    estimatedMinutes: 12,
    exercise: {
      scenarioId: "noisy-interface",
      gasEnabled: false,
      initialPid: DEFAULT_DUAL_PID,
      expectedPatterns: ["noisy-command"],
    },
    // Derivative here buys nothing and costs travel: tracking error is 17 whether
    // Kd is 0 or 25, while travel goes from 148 to 875. The travel bound is what
    // makes that visible; the error bound only guards against abandoning the loop.
    successCriteria: {
      forbiddenTrips: [],
      maximumInterfaceIae: 60,
      maximumValveTravelPct: 250,
    },
  },

  "slugs-and-the-limits-of-feedback": {
    id: "slugs-and-the-limits-of-feedback",
    level: "advanced",
    estimatedMinutes: 15,
    exercise: {
      scenarioId: "water-rich-slug",
      gasEnabled: false,
      initialPid: DEFAULT_DUAL_PID,
      expectedPatterns: ["sluggish", "valve-saturation"],
    },
    // Surviving the slug at all is the pass mark; a perfect trace is not on offer.
    successCriteria: { forbiddenTrips: [], minimumScore: 45 },
  },

  "the-third-loop-pressure": {
    id: "the-third-loop-pressure",
    level: "advanced",
    estimatedMinutes: 15,
    exercise: {
      scenarioId: "gor-surge",
      gasEnabled: true,
      initialPid: {
        total: pid(),
        interface: pid(),
        pressure: { ...DEFAULT_PRESSURE_PID },
      },
      expectedPatterns: ["sustained-oscillation"],
    },
    // Too slow a pressure loop trips outright; Kp 1 survives but tracks poorly at
    // 344. The default 2.5 reaches 202, and a firmer loop reaches 90.
    successCriteria: {
      forbiddenTrips: ["PRESSURE_HH", "PRESSURE_LL"],
      maximumPressureIae: 230,
    },
  },

  "systematic-tuning": {
    id: "systematic-tuning",
    level: "advanced",
    estimatedMinutes: 18,
    exercise: {
      scenarioId: "oil-outlet-restriction",
      gasEnabled: false,
      initialPid: {
        total: pid({ kp: 1, ki: 0, kd: 0 }),
        interface: pid({ kp: 1, ki: 0, kd: 0 }),
      },
    },
    // The starting tuning reaches 734; Kp 6 with Ki 0.12 reaches 300. Valve travel
    // is deliberately not graded here: in this scenario it never exceeds 53 at any
    // tuning, so a travel bound would be a criterion that cannot fail. The trade-off
    // it was meant to teach is graded in the noisy-interface lesson, where the
    // numbers actually separate.
    successCriteria: {
      forbiddenTrips: [],
      maximumTotalIae: 340,
      minimumScore: 65,
    },
  },
};

export const LESSON_LIST: readonly Lesson[] = LESSON_IDS.map((id) => LESSONS[id]);

export function getLesson(id: LessonId): Lesson {
  const lesson = LESSONS[id];
  if (!lesson) throw new Error(`Unknown lesson: ${id}`);
  return lesson;
}

export function isLessonId(value: string): value is LessonId {
  return (LESSON_IDS as readonly string[]).includes(value);
}

/** The lesson that follows this one, or null at the end of the curriculum. */
export function nextLessonId(id: LessonId): LessonId | null {
  const index = LESSON_IDS.indexOf(id);
  return index >= 0 && index < LESSON_IDS.length - 1 ? LESSON_IDS[index + 1] : null;
}
