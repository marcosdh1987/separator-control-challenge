export interface GainHelpContent {
  friendlyName: string;
  technicalName: string;
  summary: string;
  description: string;
  increaseWhen: readonly string[];
  tooMuchCanCause: readonly string[];
  reduceWhen: readonly string[];
  importantNote: string;
}

export interface LoopExplanation {
  title: string;
  paragraphs: readonly string[];
  caution?: string;
}

export interface TuningStep {
  title: string;
  body: readonly string[];
}

export interface DiagnosisPattern {
  title: string;
  symptoms: readonly string[];
  suggestion: string;
}

export interface Reference {
  title: string;
  description: string;
  authors?: string;
  publisher?: string;
  url?: string;
}

const freezeItems = <T>(items: readonly T[]) => Object.freeze(items.map((item) => Object.freeze(item)));

export const REFERENCES = freezeItems<Reference>([
  {
    title: "Feedback Systems: An Introduction for Scientists and Engineers",
    description: "Open textbook covering feedback, stability, PID control, loop shaping and practical control-system design.",
    authors: "Karl J. Åström and Richard M. Murray",
    url: "https://fbsbook.org/",
  },
  {
    title: "Control Tutorials for MATLAB and Simulink — PID",
    description: "Practical explanations and interactive examples of proportional, integral and derivative control.",
    url: "https://ctms.engin.umich.edu/CTMS/index.php?example=Introduction&section=ControlPID",
  },
  {
    title: "MathWorks — PID Controller Tuning",
    description: "Practical material on PID response, automatic tuning and the trade-offs among speed, robustness and transient behavior.",
    url: "https://www.mathworks.com/help/control/pid-controller-design.html",
  },
  {
    title: "ControlGuru — PID Control",
    description: "Process-control-oriented articles on controller tuning, process dynamics, integral action and practical implementation.",
    url: "https://controlguru.com/",
  },
  {
    title: "PID Controllers: Theory, Design, and Tuning",
    authors: "Karl J. Åström and Tore Hägglund",
    description: "Classic reference on PID structure, tuning, robustness and implementation.",
  },
  {
    title: "Advanced PID Control",
    authors: "Karl J. Åström and Tore Hägglund",
    publisher: "ISA",
    description: "Advanced treatment of industrial PID design, tuning, anti-windup, setpoint weighting and practical implementation.",
    url: "https://www.isa.org/products/advanced-pid-control",
  },
  {
    title: "A Practical Guide to PID Controller Implementation",
    authors: "E. Sundström, M. Bauer, J. L. Guzmán, T. Hägglund and K. Soltesz",
    description: "Modern practical guide covering actuator limits, noise, anti-windup, bumpless transfer, sampling and implementation details.",
    url: "https://arxiv.org/abs/2604.15918",
  },
  {
    title: "Process Dynamics and Control",
    authors: "Dale E. Seborg, Thomas F. Edgar, Duncan A. Mellichamp and Francis J. Doyle III",
    description: "Standard process-control textbook covering dynamic models, feedback control, PID tuning and multiloop systems.",
  },
]);

export const DIAGNOSIS_PATTERNS = freezeItems<DiagnosisPattern>([
  {
    title: "Sluggish response",
    symptoms: Object.freeze(["Recovery starts slowly.", "Settling time is long.", "Valve action is weak.", "There is little or no overshoot."]),
    suggestion: "Consider increasing Kp slightly.",
  },
  {
    title: "Persistent offset",
    symptoms: Object.freeze(["The response becomes stable.", "PV remains above or below SP.", "The error does not disappear."]),
    suggestion: "After Kp is reasonably tuned, increase Ki slightly.",
  },
  {
    title: "Overshoot",
    symptoms: Object.freeze(["PV crosses the setpoint significantly.", "Correction continues after the process should slow down."]),
    suggestion: "Reduce Kp or Ki. If PI tuning is already reasonable, test a small Kd.",
  },
  {
    title: "Sustained oscillation",
    symptoms: Object.freeze(["Repeated crossings do not decay.", "The valve repeatedly opens and closes.", "The process never settles."]),
    suggestion: "Reduce Kp first. If the oscillation is slow, also reduce Ki.",
  },
  {
    title: "Slow oscillation or hunting",
    symptoms: Object.freeze(["Long-period waves occur around the setpoint.", "Accumulated integral action keeps reversing the valve."]),
    suggestion: "Reduce Ki.",
  },
  {
    title: "Valve saturation",
    symptoms: Object.freeze(["The valve remains near 0% or 100%.", "Error continues accumulating.", "Recovery is delayed after leaving saturation."]),
    suggestion: "Reduce aggressive gains and inspect integral windup.",
  },
  {
    title: "Noisy valve command",
    symptoms: Object.freeze(["Rapid small valve movements occur.", "PV itself does not justify each movement."]),
    suggestion: "Reduce Kd or apply derivative filtering.",
  },
]);

export const LOOP_EXPLANATIONS = Object.freeze({
  total: Object.freeze<LoopExplanation>({
    title: "Total level / oil valve loop",
    paragraphs: Object.freeze([
      "The total-liquid-level controller manipulates the oil outlet valve.",
      "When total liquid level rises above its setpoint, the controller should open the oil valve further to remove more liquid.",
      "When total level falls below its setpoint, it should reduce the oil outlet.",
      "The controlled variable is total liquid level. The manipulated variable is oil-valve opening.",
      "A larger valve opening should reduce total liquid level, although the effect is delayed by the separator dynamics.",
    ]),
    caution: "The process response is not instantaneous. Increasing the gain because nothing happens immediately can produce overshoot once the delayed response becomes visible.",
  }),
  interface: Object.freeze<LoopExplanation>({
    title: "Oil/water interface / water valve loop",
    paragraphs: Object.freeze([
      "The interface controller manipulates the water outlet valve.",
      "When the oil/water interface rises above its setpoint, the controller should open the water valve further.",
      "When the interface falls below its setpoint, it should reduce the water outlet.",
      "The controlled variable is oil/water interface level. The manipulated variable is water-valve opening.",
      "The interface loop may respond differently from the total-level loop because phase inflows, vessel geometry and outlet capacities are not identical.",
    ]),
    caution: "Do not assume both loops require the same PID gains.",
  }),
});

export const PID_EDUCATION_CONTENT = Object.freeze({
  theory: Object.freeze({
    title: "PID theory",
    parallelFormula: "u(t) = Kp · e(t) + Ki · ∫e(t)dt + Kd · de(t)/dt",
    errorDefinition: "e(t) = SP − PV, where SP is the setpoint and PV is the process variable.",
    parallelGainsNote: "This simulator uses parallel gains Kp, Ki and Kd. Do not mix these values with proportional band, reset time or derivative time without explicit conversion.",
    reverseActionConvention: "The theory uses e = SP − PV. This simulator applies reverse process action for outlet valves: a level above setpoint opens the relevant outlet further because a larger outlet opening lowers that level.",
  }),
  gains: Object.freeze({
    kp: Object.freeze<GainHelpContent>({
      friendlyName: "Response strength",
      technicalName: "Proportional gain — Kp",
      summary: "Higher Kp → faster response, but lower stability margin.",
      description: "Kp determines how strongly the controller reacts to the current error. A larger Kp produces a larger valve-command change for the same deviation from setpoint.",
      increaseWhen: Object.freeze(["The response is clearly too slow.", "A disturbance produces a large error but little corrective action.", "The process takes too long to begin recovering."]),
      tooMuchCanCause: Object.freeze(["Overshoot.", "Repeated crossings of the setpoint.", "Sustained oscillation.", "Excessive valve travel.", "Actuator saturation."]),
      reduceWhen: Object.freeze(["The process repeatedly crosses the setpoint.", "Each correction generates another correction in the opposite direction.", "Valve motion is unnecessarily aggressive."]),
      importantNote: "Proportional control alone may leave a persistent offset after a disturbance.",
    }),
    ki: Object.freeze<GainHelpContent>({
      friendlyName: "Offset removal",
      technicalName: "Integral gain — Ki",
      summary: "Higher Ki → less persistent offset, but more overshoot and windup risk.",
      description: "Ki accumulates error over time. Even a small persistent error continues increasing the integral contribution until the controller removes the offset.",
      increaseWhen: Object.freeze(["The process settles away from the setpoint.", "A small error remains for a long time.", "Proportional action recovers most of the disturbance but does not fully return to target."]),
      tooMuchCanCause: Object.freeze(["Overshoot.", "Slow repeated oscillation.", "Integral windup.", "Long recovery after actuator saturation.", "Excessive valve movement."]),
      reduceWhen: Object.freeze(["The controller keeps hunting around the setpoint.", "The valve remains saturated.", "The process overshoots and takes a long time to recover."]),
      importantNote: "Integral action should usually be added only after obtaining a reasonable response with Kp.",
    }),
    kd: Object.freeze<GainHelpContent>({
      friendlyName: "Damping and anticipation",
      technicalName: "Derivative gain — Kd",
      summary: "Higher Kd → more damping, but more sensitivity to noise.",
      description: "Kd reacts to how quickly the error is changing. It can add damping and reduce overshoot by opposing rapid changes.",
      increaseWhen: Object.freeze(["Proportional and integral tuning already work reasonably well.", "Overshoot remains excessive.", "The response needs additional damping."]),
      tooMuchCanCause: Object.freeze(["Sensitivity to measurement noise.", "Erratic valve commands.", "Unnecessary actuator movement.", "Derivative kick if implemented directly on setpoint error."]),
      reduceWhen: Object.freeze(["Measurement noise causes rapid valve movement.", "Derivative action does not improve the complete response."]),
      importantNote: "Keep Kd at zero during the first tuning steps. For noisy industrial measurements, PI control is often preferable to a full PID.",
    }),
  }),
  repeatableExperimentGoldenRule: "Change one parameter at a time and repeat the same deterministic scenario. Otherwise, you cannot know which change improved or degraded the response.",
  piNote: "Level-control loops are often implemented as PI controllers rather than full PID controllers. Derivative action is not automatically beneficial. Level measurements may be noisy and separator dynamics are often slow, so derivative action should only be added when the simulation shows a clear benefit.",
  antiWindupNote: "Integral windup occurs when the controller keeps accumulating error while the valve is already at its physical limit. Anti-windup prevents this stored integral action from delaying recovery.",
  derivativeNoiseNote: "Derivative action amplifies high-frequency measurement noise. Industrial PID implementations normally filter the derivative term.",
  classicalTuning: Object.freeze({
    title: "Classical tuning methods",
    body: "Methods such as Ziegler–Nichols, Cohen–Coon, relay autotuning and model-based tuning can provide initial controller parameters. They are not universal optimal solutions. Some classical settings are deliberately aggressive and may produce substantial overshoot. For this simulator, manual tuning and metric-based comparison are preferred because the educational goal is to understand the response rather than copy a formula.",
  }),
});

export const MANUAL_TUNING_STEPS = freezeItems<TuningStep>([
  {
    title: "Establish a repeatable experiment",
    body: Object.freeze(["Choose one disturbance scenario and keep the deterministic seed unchanged.", "Use the same initial levels, feed conditions, duration and playback settings for every comparison."]),
  },
  {
    title: "Disable integral and derivative action",
    body: Object.freeze(["Set Ki = 0 and Kd = 0.", "Begin by tuning proportional action only."]),
  },
  {
    title: "Increase Kp gradually",
    body: Object.freeze(["Start with a low Kp.", "Run the complete scenario.", "Increase Kp in small increments until the loop responds promptly.", "Stop increasing Kp before sustained oscillation or excessive valve saturation appears.", "Do not tune based only on the first seconds. Wait long enough to observe the complete recovery."]),
  },
  {
    title: "Add integral action",
    body: Object.freeze(["Once Kp gives a stable and reasonably fast response, add a small Ki.", "Increase Ki gradually until persistent offset disappears.", "Stop increasing Ki if overshoot, slow oscillation or actuator saturation becomes significant."]),
  },
  {
    title: "Add derivative only if justified",
    body: Object.freeze(["If the PI controller remains too underdamped, add a small Kd.", "Compare the result against the same scenario.", "Keep Kd only if it reduces overshoot or settling time without increasing noise-driven valve movement."]),
  },
]);

export const MANUAL_TUNING_GOLDEN_RULE = Object.freeze({
  order: "Kp → Ki → Kd",
  reminder: "One parameter at a time. Same scenario. Same seed. Compare the complete response.",
});
