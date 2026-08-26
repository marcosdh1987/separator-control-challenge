import type { LoopId } from "@/lib/simulation/types";

/**
 * Language-free structure of the PID teaching material. Everything a reader sees
 * lives in `lib/i18n/messages/*\/education.ts`; what stays here is the vocabulary of
 * identifiers, the presentation order, and the bibliographic facts that are the
 * same in every language.
 */

export type GainId = "kp" | "ki" | "kd";

/** Presentation order of the gain help: proportional first, derivative last. */
export const GAIN_IDS = ["kp", "ki", "kd"] as const satisfies readonly GainId[];

export type ManualTuningStepId =
  | "repeatable-experiment"
  | "disable-integral-derivative"
  | "increase-proportional"
  | "add-integral"
  | "add-derivative";

/** The procedure only makes sense in order, so the order is data, not layout. */
export const MANUAL_TUNING_STEP_IDS = [
  "repeatable-experiment",
  "disable-integral-derivative",
  "increase-proportional",
  "add-integral",
  "add-derivative",
] as const satisfies readonly ManualTuningStepId[];

/**
 * Every loop the material explains, in dashboard order. The pressure loop only
 * applies when the gas cap is enabled, so the panel is told which ones to show.
 */
export const LOOP_EXPLANATION_IDS = ["total", "interface", "pressure"] as const satisfies readonly LoopId[];

/** The loops present when the gas cap is switched off. */
export const LIQUID_LOOP_EXPLANATION_IDS = ["total", "interface"] as const satisfies readonly LoopId[];

export type ReferenceId =
  | "feedback-systems"
  | "control-tutorials-pid"
  | "mathworks-pid-tuning"
  | "controlguru-pid"
  | "pid-controllers-theory-design-tuning"
  | "advanced-pid-control"
  | "practical-guide-pid-implementation"
  | "process-dynamics-and-control";

/**
 * A citation. Title, authors and publisher are quoted as published and are never
 * translated; only the `description` of each entry is localised copy.
 */
export interface Reference {
  id: ReferenceId;
  title: string;
  authors?: string;
  publisher?: string;
  url?: string;
}

const REFERENCE_ENTRIES: readonly Reference[] = [
  {
    id: "feedback-systems",
    title: "Feedback Systems: An Introduction for Scientists and Engineers",
    authors: "Karl J. Åström and Richard M. Murray",
    url: "https://fbsbook.org/",
  },
  {
    id: "control-tutorials-pid",
    title: "Control Tutorials for MATLAB and Simulink — PID",
    url: "https://ctms.engin.umich.edu/CTMS/index.php?example=Introduction&section=ControlPID",
  },
  {
    id: "mathworks-pid-tuning",
    title: "MathWorks — PID Controller Tuning",
    url: "https://www.mathworks.com/help/control/pid-controller-design.html",
  },
  {
    id: "controlguru-pid",
    title: "ControlGuru — PID Control",
    url: "https://controlguru.com/",
  },
  {
    id: "pid-controllers-theory-design-tuning",
    title: "PID Controllers: Theory, Design, and Tuning",
    authors: "Karl J. Åström and Tore Hägglund",
  },
  {
    id: "advanced-pid-control",
    title: "Advanced PID Control",
    authors: "Karl J. Åström and Tore Hägglund",
    publisher: "ISA",
    url: "https://www.isa.org/products/advanced-pid-control",
  },
  {
    id: "practical-guide-pid-implementation",
    title: "A Practical Guide to PID Controller Implementation",
    authors: "E. Sundström, M. Bauer, J. L. Guzmán, T. Hägglund and K. Soltesz",
    url: "https://arxiv.org/abs/2604.15918",
  },
  {
    id: "process-dynamics-and-control",
    title: "Process Dynamics and Control",
    authors: "Dale E. Seborg, Thomas F. Edgar, Duncan A. Mellichamp and Francis J. Doyle III",
  },
];

export const REFERENCES: ReadonlyArray<Readonly<Reference>> = Object.freeze(
  REFERENCE_ENTRIES.map((reference) => Object.freeze(reference)),
);

/** Notation rather than prose: the formula reads the same in every language. */
export const PID_PARALLEL_FORMULA =
  "u(t) = bias + Kp · (PV − SP) + Ki · ∫(PV − SP)dt + Kd · filtered(dPV/dt)";

/** The tuning order, written with the gain symbols so it needs no translation. */
export const MANUAL_TUNING_ORDER = "Kp → Ki → Kd";
