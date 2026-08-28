import type { DiagnosisPatternId } from "@/lib/education/diagnosis";
import type { GainId, ManualTuningStepId, ReferenceId } from "@/lib/education/pid-content";
import type { TeachingPresetId } from "@/lib/onboarding/types";
import type { LoopId } from "@/lib/simulation/types";

export interface GainHelpCopy {
  /** What the gain does, in operator language, shown before the textbook term. */
  friendlyName: string;
  technicalName: string;
  summary: string;
  description: string;
  increaseWhen: readonly string[];
  tooMuchCanCause: readonly string[];
  reduceWhen: readonly string[];
  importantNote: string;
}

export interface DiagnosisPatternCopy {
  title: string;
  symptoms: readonly string[];
  suggestion: string;
}

export interface LoopExplanationCopy {
  title: string;
  paragraphs: readonly string[];
  caution: string;
}

export interface TuningStepCopy {
  title: string;
  body: readonly string[];
}

/** A teaching preset the coach can load, named and justified in the reader's language. */
export interface CoachPresetCopy {
  label: string;
  guidance: string;
}

export const education = {
  panel: {
    ariaLabel: "PID learning resources",
    eyebrow: "Learning station",
    title: "Observe, change, compare",
    theory: "PID theory",
    goldenRule: "Manual tuning golden rule",
    diagnosis: "How do I diagnose the response?",
    learnMore: "Learn more",
    loops: "What each loop moves",
  },

  theory: {
    errorDefinition:
      "PV is the process variable and SP is the setpoint. Conventional theory often defines e(t) = SP − PV; this reverse-acting outlet-valve implementation uses PV − SP internally.",
    parallelGainsNote:
      "This simulator uses parallel gains Kp, Ki and Kd. Do not mix these values with proportional band, reset time or derivative time without explicit conversion.",
    reverseActionConvention:
      "This simulator uses a reverse-acting outlet-valve convention: a level above setpoint opens the relevant outlet further because a larger outlet opening lowers that level.",
  },

  gain: {
    kp: {
      friendlyName: "Response strength",
      technicalName: "Proportional gain (Kp)",
      summary: "Higher Kp → faster response, but lower stability margin.",
      description:
        "Kp determines how strongly the controller reacts to the current error. A larger Kp produces a larger valve-command change for the same deviation from setpoint.",
      increaseWhen: [
        "The response is clearly too slow.",
        "A disturbance produces a large error but little corrective action.",
        "The process takes too long to begin recovering.",
      ],
      tooMuchCanCause: [
        "Overshoot.",
        "Repeated crossings of the setpoint.",
        "Sustained oscillation.",
        "Excessive valve travel.",
        "Actuator saturation.",
      ],
      reduceWhen: [
        "The process repeatedly crosses the setpoint.",
        "Each correction generates another correction in the opposite direction.",
        "Valve motion is unnecessarily aggressive.",
      ],
      importantNote: "Proportional control alone may leave a persistent offset after a disturbance.",
    },
    ki: {
      friendlyName: "Offset removal",
      technicalName: "Integral gain (Ki)",
      summary: "Higher Ki → less persistent offset, but more overshoot and windup risk.",
      description:
        "Ki accumulates error over time. Even a small persistent error continues increasing the integral contribution until the controller removes the offset.",
      increaseWhen: [
        "The process settles away from the setpoint.",
        "A small error remains for a long time.",
        "Proportional action recovers most of the disturbance but does not fully return to target.",
      ],
      tooMuchCanCause: [
        "Overshoot.",
        "Slow repeated oscillation.",
        "Integral windup.",
        "Long recovery after actuator saturation.",
        "Excessive valve movement.",
      ],
      reduceWhen: [
        "The controller keeps hunting around the setpoint.",
        "The valve remains saturated.",
        "The process overshoots and takes a long time to recover.",
      ],
      importantNote:
        "Integral action should usually be added only after obtaining a reasonable response with Kp.",
    },
    kd: {
      friendlyName: "Damping and anticipation",
      technicalName: "Derivative gain (Kd)",
      summary: "Higher Kd → more damping, but more sensitivity to noise.",
      description:
        "Kd reacts to how quickly the measurement (PV) is changing. It can add damping and reduce overshoot by opposing rapid changes.",
      increaseWhen: [
        "Proportional and integral tuning already work reasonably well.",
        "Overshoot remains excessive.",
        "The response needs additional damping.",
      ],
      tooMuchCanCause: [
        "Sensitivity to measurement noise.",
        "Erratic valve commands.",
        "Unnecessary actuator movement.",
        "Derivative kick if implemented directly on setpoint error.",
      ],
      reduceWhen: [
        "Measurement noise causes rapid valve movement.",
        "Derivative action does not improve the complete response.",
      ],
      importantNote:
        "Keep Kd at zero during the first tuning steps. This controller differentiates measurement, not setpoint error, to avoid derivative kick. For noisy industrial measurements, PI control is often preferable to a full PID.",
    },
  } satisfies Record<GainId, GainHelpCopy>,

  gainHelp: {
    increaseWhen: "Increase when",
    tooMuchCanCause: "Too much can cause",
    reduceWhen: "Reduce when",
    /** Written as functions so a translation can reorder the gain name freely. */
    trigger: (gainName: string) => `Help with ${gainName}`,
    close: (gainName: string) => `Close ${gainName} help`,
  },

  /**
   * Keyed by the pattern identifiers in `lib/education/diagnosis.ts` so the
   * dashboard advisory and the learning panel cannot drift apart.
   */
  diagnosisPattern: {
    "sluggish": {
      title: "Sluggish response",
      symptoms: [
        "Recovery starts slowly.",
        "Settling time is long.",
        "Valve action is weak.",
        "There is little or no overshoot.",
      ],
      suggestion: "Consider increasing Kp slightly.",
    },
    "offset": {
      title: "Persistent offset",
      symptoms: [
        "The response becomes stable.",
        "PV remains above or below SP.",
        "The error does not disappear.",
      ],
      suggestion: "After Kp is reasonably tuned, increase Ki slightly.",
    },
    "overshoot": {
      title: "Overshoot",
      symptoms: [
        "PV crosses the setpoint significantly.",
        "Correction continues after the process should slow down.",
      ],
      suggestion: "Reduce Kp or Ki. If PI tuning is already reasonable, test a small Kd.",
    },
    "sustained-oscillation": {
      title: "Sustained oscillation",
      symptoms: [
        "Repeated crossings do not decay.",
        "The valve repeatedly opens and closes.",
        "The process never settles.",
      ],
      suggestion: "Reduce Kp first. If the oscillation is slow, also reduce Ki.",
    },
    "hunting": {
      title: "Slow oscillation or hunting",
      symptoms: [
        "Long-period waves occur around the setpoint.",
        "Accumulated integral action keeps reversing the valve.",
      ],
      suggestion: "Reduce Ki.",
    },
    "valve-saturation": {
      title: "Valve saturation",
      symptoms: [
        "The valve remains near 0% or 100%.",
        "Error continues accumulating.",
        "Recovery is delayed after leaving saturation.",
      ],
      suggestion: "Reduce aggressive gains and inspect integral windup.",
    },
    "noisy-command": {
      title: "Noisy valve command",
      symptoms: [
        "Rapid small valve movements occur.",
        "PV itself does not justify each movement.",
      ],
      suggestion: "Reduce Kd or apply derivative filtering.",
    },
  } satisfies Record<DiagnosisPatternId, DiagnosisPatternCopy>,

  /** Shown when no single diagnosis pattern dominates the current gains. */
  gainAdvisoryFallback:
    "Low error is only half the job: watch actual valve travel and saturation too.",

  repeatableExperimentGoldenRule:
    "Change one parameter at a time and repeat the same deterministic scenario. Otherwise, you cannot know which change improved or degraded the response.",

  manualTuning: {
    reminder: "One parameter at a time. Same scenario. Same seed. Compare the complete response.",
    step: {
      "repeatable-experiment": {
        title: "Establish a repeatable experiment",
        body: [
          "Choose one disturbance scenario and keep the deterministic seed unchanged.",
          "Use the same initial levels, feed conditions, duration and playback settings for every comparison.",
        ],
      },
      "disable-integral-derivative": {
        title: "Disable integral and derivative action",
        body: ["Set Ki = 0 and Kd = 0.", "Begin by tuning proportional action only."],
      },
      "increase-proportional": {
        title: "Increase Kp gradually",
        body: [
          "Start with a low Kp.",
          "Run the complete scenario.",
          "Increase Kp in small increments until the loop responds promptly.",
          "Stop increasing Kp before sustained oscillation or excessive valve saturation appears.",
          "Do not tune based only on the first seconds. Wait long enough to observe the complete recovery.",
        ],
      },
      "add-integral": {
        title: "Add integral action",
        body: [
          "Once Kp gives a stable and reasonably fast response, add a small Ki.",
          "Increase Ki gradually until persistent offset disappears.",
          "Stop increasing Ki if overshoot, slow oscillation or actuator saturation becomes significant.",
        ],
      },
      "add-derivative": {
        title: "Add derivative only if justified",
        body: [
          "If the PI controller remains too underdamped, add a small Kd.",
          "Compare the result against the same scenario.",
          "Keep Kd only if it reduces overshoot or settling time without increasing noise-driven valve movement.",
        ],
      },
    } satisfies Record<ManualTuningStepId, TuningStepCopy>,
  },

  piNote:
    "Level-control loops are often implemented as PI controllers rather than full PID controllers. Derivative action is not automatically beneficial. Level measurements may be noisy and separator dynamics are often slow, so derivative action should only be added when the simulation shows a clear benefit.",
  antiWindupNote:
    "Integral windup occurs when the controller keeps accumulating error while the valve is already at its physical limit. Anti-windup prevents this stored integral action from delaying recovery.",
  derivativeNoiseNote:
    "Derivative action amplifies high-frequency measurement noise. Industrial PID implementations normally filter the derivative term.",

  classicalTuning: {
    title: "Classical tuning methods",
    body: "Methods such as Ziegler–Nichols, Cohen–Coon, relay autotuning and model-based tuning can provide initial controller parameters. They are not universal optimal solutions. Some classical settings are deliberately aggressive and may produce substantial overshoot. For this simulator, manual tuning and metric-based comparison are preferred because the educational goal is to understand the response rather than copy a formula.",
  },

  loopExplanation: {
    total: {
      title: "Total level / oil valve loop",
      paragraphs: [
        "The total-liquid-level controller manipulates the oil outlet valve.",
        "When total liquid level rises above its setpoint, the controller should open the oil valve further to remove more liquid.",
        "When total level falls below its setpoint, it should reduce the oil outlet.",
        "The controlled variable is total liquid level. The manipulated variable is oil-valve opening.",
        "A larger valve opening should reduce total liquid level, although the effect is delayed by the separator dynamics.",
      ],
      caution:
        "The process response is not instantaneous. Increasing the gain because nothing happens immediately can produce overshoot once the delayed response becomes visible.",
    },
    interface: {
      title: "Oil/water interface / water valve loop",
      paragraphs: [
        "The interface controller manipulates the water outlet valve.",
        "When the oil/water interface rises above its setpoint, the controller should open the water valve further.",
        "When the interface falls below its setpoint, it should reduce the water outlet.",
        "The controlled variable is oil/water interface level. The manipulated variable is water-valve opening.",
        "The interface loop may respond differently from the total-level loop because phase inflows, vessel geometry and outlet capacities are not identical.",
      ],
      caution: "Do not assume both loops require the same PID gains.",
    },
    pressure: {
      title: "Gas cap pressure / gas valve loop",
      paragraphs: [
        "The pressure controller manipulates the gas backpressure valve on the vessel outlet.",
        "Gas released by the feed accumulates in the space above the liquid, raising pressure; opening the gas valve vents it away.",
        "The controlled variable is gas-cap pressure. The manipulated variable is gas-valve opening.",
        "This loop is far faster than either level loop. Pressure responds in seconds where levels take minutes, so gains that feel gentle on a level loop are violent here.",
        "The three loops are coupled through the gas cap: draining liquid enlarges the gas space and drops pressure, while a pressure swing pushes back on the liquid outlets.",
      ],
      caution:
        "A pressure loop tuned like a level loop will oscillate. Start with a smaller Kp than you would use on level, and add derivative only if the measurement is clean.",
    },
  } satisfies Record<LoopId, LoopExplanationCopy>,

  /** Only the description is localised; the citation itself stays as published. */
  referenceDescription: {
    "feedback-systems":
      "Open textbook covering feedback, stability, PID control, loop shaping and practical control-system design.",
    "control-tutorials-pid":
      "Practical explanations and interactive examples of proportional, integral and derivative control.",
    "mathworks-pid-tuning":
      "Practical material on PID response, automatic tuning and the trade-offs among speed, robustness and transient behavior.",
    "controlguru-pid":
      "Process-control-oriented articles on controller tuning, process dynamics, integral action and practical implementation.",
    "pid-controllers-theory-design-tuning":
      "Classic reference on PID structure, tuning, robustness and implementation.",
    "advanced-pid-control":
      "Advanced treatment of industrial PID design, tuning, anti-windup, setpoint weighting and practical implementation.",
    "practical-guide-pid-implementation":
      "Modern practical guide covering actuator limits, noise, anti-windup, bumpless transfer, sampling and implementation details.",
    "process-dynamics-and-control":
      "Standard process-control textbook covering dynamic models, feedback control, PID tuning and multiloop systems.",
  } satisfies Record<ReferenceId, string>,

  /**
   * Post-run coaching. The diagnosis itself is deterministic and computed in
   * `components/education/control-coach.tsx`; every pattern it can name is one of
   * the `DiagnosisPatternId` values above, so the coach and the learning panel can
   * never describe the same symptom in two different ways.
   */
  coach: {
    ariaLabel: "Post-run tuning coach",
    eyebrow: "Control coach",
    title: "What this run is telling you",
    empty: "Finish an attempt and the coach will read the response for you.",
    headline: (loop: string, pattern: string) => `${loop}: ${pattern.toLowerCase()}`,
    headlineClean: "No single fault dominates this response.",
    loopHeading: (loop: string, valve: string) => `${loop} loop · ${valve}`,
    noPattern: "Nothing in this loop stands out as the thing to fix next.",

    gainName: {
      kp: "Kp",
      ki: "Ki",
      kd: "Kd",
    } satisfies Record<GainId, string>,

    /** Written as functions so each language orders the verb and the gain freely. */
    move: {
      raise: (gain: string, from: string, to: string) => `Raise ${gain} from ${from} to ${to}.`,
      lower: (gain: string, from: string, to: string) => `Lower ${gain} from ${from} to ${to}.`,
      remove: (gain: string) => `Set ${gain} to 0 and re-run before changing anything else.`,
      hold: "Keep these gains and change the scenario instead: this loop is doing its job.",
    },

    nextMove: "Next move",
    evidence: "What it is based on",
    evidenceLine: (overshoot: string, settling: string, travel: string) =>
      `Overshoot ${overshoot} · settling ${settling} · commanded travel ${travel}`,
    reminder:
      "Change only the gain named above, re-run the same scenario with the same seed, and compare the debrief.",

    experiment: "Try the experiment",
    /**
     * Teaching presets the coach can load. Their ids come from `TeachingPresetId`
     * in `lib/onboarding/types.ts`; they are deliberately not offered by the
     * onboarding preset selector, so their copy lives here rather than there.
     */
    preset: {
      "p-only": {
        label: "Untuned P-only",
        guidance:
          "Same Kp as Balanced, with Ki and Kd switched off. The loop still corrects and still stops short: proportional action needs a standing error to hold a standing correction, so the offset never goes away on its own.",
      },
    } satisfies Record<TeachingPresetId, CoachPresetCopy>,
    applyPreset: (label: string) => `Load the ${label} gains`,
  },

  /**
   * Wording for the post-run figures in `lib/simulation/analysis.ts` and for the
   * attempt-against-attempt debrief that compares them.
   */
  analysis: {
    ariaLabel: "Tuning debrief",
    eyebrow: "Tuning debrief",
    title: "This attempt against the last one",
    firstAttempt:
      "First attempt on this scenario. Change one gain, run it again, and this panel will show what moved.",
    baseline: "Previous",
    current: "This run",
    change: "Change",
    metricColumn: "Metric",

    metric: {
      iae: "IAE",
      ise: "ISE",
      itae: "ITAE",
      overshoot: "Overshoot",
      settlingTime: "Settling time",
      riseTime: "Rise time",
      steadyOffset: "Steady-state offset",
      totalVariation: "Commanded valve travel (TV)",
      reversals: "Command reversals",
    },

    metricHint: {
      iae: "Total error, area under |PV − SP|. The plain measure of how far off target the run was.",
      ise: "Squares the error, so one large excursion costs far more than a long small one.",
      itae: "Weights error by how late it happened, so error that lingers is punished.",
      overshoot: "How far past setpoint the loop swung on the way back, relative to how far the disturbance pushed it.",
      settlingTime: "Time from the disturbance until the loop entered its target band and stayed there.",
      riseTime: "Time to go from 90% of the peak deviation down to 10% of it.",
      steadyOffset: "Where the loop finally sat relative to setpoint. Only integral action removes this.",
      totalVariation: "How much movement the controller asked the valve for, Σ|Δu|. Sensor noise shows up here first.",
      reversals: "How often the command changed direction. High counts are chatter, not control.",
    },

    unit: {
      level: "%",
      pressure: "bar",
    },

    /** Value formatters: units are composed here so a translation can reorder them. */
    integralValue: (value: string, unit: string) => `${value} ${unit}·s`,
    squaredIntegralValue: (value: string, unit: string) => `${value} ${unit}²·s`,
    timeIntegralValue: (value: string, unit: string) => `${value} ${unit}·s²`,
    secondsValue: (value: string) => `${value} s`,
    percentValue: (value: string) => `${value}%`,
    deviationValue: (value: string, unit: string) => `${value} ${unit}`,
    countValue: (value: string) => value,
    /** Shown where a figure has no value: an unsettled run has no settling time. */
    unavailable: "not reached",

    verdict: {
      better: "better",
      worse: "worse",
      unchanged: "unchanged",
    },
    verdictLabel: (metric: string, verdict: string) => `${metric}: ${verdict}`,

    gainsChanged: "What you changed",
    gainChange: (loop: string, gain: string, from: string, to: string) =>
      `${loop}: ${gain} ${from} → ${to}`,
    gainsUnchanged: "Gains were identical to the previous attempt.",
    /** The golden rule, checked against what actually changed between attempts. */
    tooManyChanges:
      "More than one gain changed, so this comparison cannot tell you which change did what. Change one at a time.",
  },
};

export type EducationMessages = typeof education;
