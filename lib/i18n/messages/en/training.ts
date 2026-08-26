import type { LessonId, LessonLevel } from "@/lib/training/types";

export interface LessonCopy {
  title: string;
  /** One line shown on the lesson card. */
  summary: string;
  /** Read before the exercise. Each entry is a paragraph. */
  theory: readonly string[];
  /** A short field note: something a reader would hear from an experienced hand. */
  fieldNote?: string;
  /** What to do in the simulator, as concrete steps. */
  briefing: readonly string[];
  /** Shown after a passing attempt. */
  debriefPassed: readonly string[];
  /** Shown after a failed attempt, without giving the answer away. */
  debriefFailed: readonly string[];
}

const LESSON_COPY: Record<LessonId, LessonCopy> = {
  "what-is-a-separator": {
    title: "What a three-phase separator does",
    summary: "Residence time, the two interfaces, and the two ways separation fails.",
    theory: [
      "A separator is a pressure vessel whose only job is to hold the well stream still long enough for gravity to do the work. Gas rises, oil floats, water settles. Everything else in the vessel exists to protect that.",
      "The controlling quantity is residence time: how long fluid stays inside, which is simply volume divided by flow. Light crude in a warm vessel may need three to five minutes; heavy, cold crude can need twenty to thirty. Raise the inlet flow and residence time falls, the dispersed droplets never reach their own phase, and separation efficiency drops sharply.",
      "Between oil and water there is rarely a clean line. Fine solids, surfactants and emulsions can build a stable layer between them — a rag layer — that does not obey the settling laws and can grow until it blocks the internal weirs.",
      "Separation fails in two directions, and both are level problems. Let the liquid climb too high and the gas leaving the top drags droplets with it: liquid carry-over. Let it fall too low and gas escapes through the liquid outlet instead: gas carry-under. Level control exists to keep the vessel between those two failures.",
    ],
    fieldNote:
      "The level controller is not there to hit a number. It is there to protect residence time and keep a liquid seal on the outlet. The number is just how we ask for that.",
    briefing: [
      "Start the run and watch it for a while. Nothing is disturbing this separator.",
      "Find the total level and the oil/water interface in the readouts, and follow them on the trends.",
      "Notice that both valves sit near mid-travel: that is a vessel in balance, not a vessel doing nothing.",
    ],
    debriefPassed: [
      "That is what a settled separator looks like: levels flat, valves steady, both loops with authority in hand.",
      "From here on, something will always be pushing the vessel away from this state. Every lesson is about what you do when it does.",
    ],
    debriefFailed: [
      "The vessel left its safety envelope. With no disturbance acting, that means the gains are moving the valves harder than the process needs.",
      "Reset and start again, and watch which level moves first.",
    ],
  },

  "level-and-proportional-action": {
    title: "Proportional action, and the offset it leaves",
    summary: "The feed steps up. Proportional-only control answers — but never all the way.",
    theory: [
      "Proportional action moves the valve in proportion to the error right now. Twice the error, twice the correction. It is fast and it is honest, and it is what you feel first when you turn up a controller.",
      "It also cannot finish the job. A proportional controller only produces a correction while an error exists, so the moment the level returns to setpoint the extra valve opening disappears. If the feed is permanently higher than before, the valve must sit permanently further open — and the only way this controller holds it there is to keep a permanent error.",
      "That standing error is called offset. It is not a defect in your tuning. It is what proportional-only control is.",
      "Turning Kp up shrinks the offset without removing it, and buys the reduction with a more violent valve. That trade is the whole reason the next lesson exists.",
    ],
    briefing: [
      "Integral and derivative are locked off for this lesson; only Kp is yours.",
      "Run the feed step and watch where the total level settles after the disturbance.",
      "Try a higher Kp and run it again. Compare where the level settles, and what the valve did to get there.",
    ],
    debriefPassed: [
      "The level settled — but not at setpoint. That gap is the offset, and no value of Kp will close it.",
      "Look at what raising Kp actually bought you: a smaller gap, and a busier valve. Hold on to that trade; it comes back in every lesson.",
    ],
    debriefFailed: [
      "The run ended before it could show the effect. Either the vessel tripped, or the level never settled long enough to read the offset.",
      "A very high Kp will make the level oscillate instead of settling. Bring it down until the response is calm, then look for the gap.",
    ],
  },

  "integral-action-and-windup": {
    title: "Integral action, and how it gets stuck",
    summary: "Removing the offset — without paying for it in overshoot.",
    theory: [
      "Integral action accumulates error over time. However small the remaining gap is, the integrator keeps adding to the valve command until the gap is gone. That is what removes the offset proportional action leaves behind.",
      "It buys that with time. The integrator only knows where the process has been, not where it is going, so it keeps pushing after the level is already on its way back. Too much integral action and the level sails past setpoint and has to be pulled back: overshoot.",
      "There is a worse failure. If the valve reaches its limit and the error persists, the integrator keeps accumulating against a valve that cannot move any further. When the process finally turns around, that stored-up command has to be unwound before the valve responds at all — the controller is briefly deaf. That is integral windup.",
      "This simulator limits the integrator to keep windup survivable, and holds it in place while the valve is saturated. Real controllers do the same thing, and for the same reason.",
      "The order that works is Kp first, then Ki, then Kd if it earns its place. Tune Kp until the response is fast but calm, then add just enough integral to close the offset.",
    ],
    briefing: [
      "You now have Kp and Ki. Derivative is still locked off.",
      "Start from the proportional tuning you found in the last lesson and add integral action gradually.",
      "Your target is a level that returns to setpoint with no standing offset and without a large overshoot.",
    ],
    debriefPassed: [
      "The offset is gone and the level came back without sailing past. That balance between Kp and Ki is what most loops in the field are actually running.",
      "Notice how little integral action it took. Ki is the gain people most often overuse.",
    ],
    debriefFailed: [
      "Either the offset is still there, or removing it cost too much overshoot.",
      "If the level swings past setpoint and comes back repeatedly, Ki is too high. If it creeps toward setpoint and never quite arrives, Ki is too low. Change one gain at a time.",
    ],
  },

  "interface-noise-and-derivative": {
    title: "A noisy interface, and what derivative does to it",
    summary: "Derivative predicts. On a noisy measurement it mostly invents.",
    theory: [
      "The oil/water interface is the hardest measurement on the vessel. The boundary is not a clean line, and the instrument sees a band rather than a level.",
      "Derivative action responds to how fast the measurement is changing, which lets it start correcting before the error grows. On a clean measurement that is genuinely useful.",
      "On a noisy one it is close to poison. Noise is, by definition, fast change. Derivative amplifies exactly that and turns sensor noise into valve movement, so the valve works continuously while the actual interface goes nowhere. The wear is real; the control is not.",
      "This is why the derivative term here acts on a filtered measurement rather than the raw one, and why the honest answer on a noisy loop is usually a small derivative gain, or none at all.",
    ],
    fieldNote:
      "If the valve is moving and the process is not, believe the process. A busy valve is a cost, not an achievement.",
    briefing: [
      "The interface transmitter has ±1.5% noise and holds each sample for half a second.",
      "Tune the interface loop to track its setpoint without letting the water valve chatter.",
      "Try raising Kd and watch the valve travel figure, then decide whether it was worth it.",
    ],
    debriefPassed: [
      "You held the interface without spending the valve to do it. On a noisy loop that restraint is the skill.",
      "Compare your valve travel with what a large Kd produced. The tracking barely improved; the movement did not.",
    ],
    debriefFailed: [
      "Either the interface wandered too far from setpoint, or holding it cost more valve travel than the lesson allows.",
      "If the valve is constantly moving in small steps, the controller is chasing noise. Reduce Kd first, then look at Kp.",
    ],
  },

  "slugs-and-the-limits-of-feedback": {
    title: "Slugs, and the limits of feedback",
    summary: "A reactive controller always arrives late. Learn what to do about that.",
    theory: [
      "A slug is a body of liquid that arrives all at once, from the pipeline rather than from the well's average rate. Total feed jumps and the water fraction jumps with it.",
      "Feedback control cannot anticipate. A PID only acts on error that has already appeared, so by the time the level has risen enough to command the valve open, the slug is already inside the vessel. A reactive controller is always late to a slug — not because it is badly tuned, but because of what feedback is.",
      "What decides the outcome is whether the vessel has the surge volume to absorb what arrived, and whether the valve has the capacity to pass it before the level reaches its trip. Tuning changes how gracefully you use that room. It does not create more of it.",
      "There is a genuine choice here. Holding the level tightly passes the slug straight downstream; letting the level move absorbs it and protects whatever is next in the train. Field practice often prefers the second — the vessel is used as a buffer rather than a set point. It is called averaging level control, and it is the right answer more often than trainees expect.",
    ],
    briefing: [
      "The slug arrives at 35 seconds and lasts about twenty.",
      "Get through it without tripping. A perfect flat level is not available; do not chase it.",
      "Watch the oil valve during the slug: if it saturates, the vessel is absorbing the difference, not the controller.",
    ],
    debriefPassed: [
      "You survived the slug. That is the pass mark, and in the field it is the pass mark too.",
      "Look back at the level trace: it moved, and it was supposed to. Using the vessel volume is what kept the trip away.",
    ],
    debriefFailed: [
      "The vessel tripped. Either the level was already high when the slug landed, or the loop was tuned so tightly that it ran out of valve early.",
      "Try leaving more room before the slug arrives, and let the level move during it rather than fighting every centimetre.",
    ],
  },

  "the-third-loop-pressure": {
    title: "The third loop: pressure, and how loops interact",
    summary: "Pressure moves in seconds. Level moves in minutes. They share a vessel.",
    theory: [
      "Switch the gas cap on and a third controller appears: pressure, acting on the gas outlet valve. Gas released by the feed collects above the liquid and raises pressure; opening the valve vents it away.",
      "The first thing to know is the timescale. Pressure responds in seconds where level takes minutes. Gains that feel gentle on a level loop are violent here, which is why this loop starts with a smaller Kp and no derivative at all.",
      "The second thing is that the three loops are not independent. The gas cap is whatever volume the liquid leaves behind, so draining liquid enlarges the gas space and drops the pressure, and a pressure excursion pushes back on how easily the liquid outlets can discharge. Three separate single-loop controllers are each solving part of one coupled problem.",
      "There is a process reason to keep pressure steady beyond the equipment rating. A sharp pressure drop makes gas break out of the liquid inside the vessel — flashing — which stirs the liquid and corrupts the volumetric measurements the whole well test depends on.",
    ],
    fieldNote:
      "A well test is a measurement. Pressure that will not sit still does not just stress the vessel; it makes the numbers you came for untrustworthy.",
    briefing: [
      "The gas cap is enabled and the well starts making far more gas per cubic metre of oil at 40 seconds.",
      "Hold pressure through the surge without tripping on pressure high-high.",
      "Watch the level loops while you do it. If pressure swings, look at whether the liquid levels moved with it.",
    ],
    debriefPassed: [
      "You held pressure through the surge. Look at the gas valve: it had to open considerably, and it had the capacity to do so because it is correctly sized.",
      "Now look at the level traces during the surge. The coupling is visible — and it is why an operator watches all three loops, not the one that is alarming.",
    ],
    debriefFailed: [
      "Pressure got away. Either the loop was too slow to open the valve as the gas arrived, or it was so aggressive that it oscillated and lost the setpoint anyway.",
      "Remember the timescale: this loop needs less proportional gain than a level loop, not more. Derivative here will usually make it worse.",
    ],
  },

  "systematic-tuning": {
    title: "Tuning from scratch, systematically",
    summary: "No presets. A repeatable procedure, and a trade-off to defend.",
    theory: [
      "Everything so far has been one idea at a time. This is the whole job: an untuned loop, a disturbance you did not choose, and a result you have to justify.",
      "Use a procedure rather than intuition. Establish a repeatable experiment so two runs can be compared at all. Set Ki and Kd to zero. Raise Kp until the response is fast but still calm. Add just enough Ki to remove the offset. Add Kd only if the measurement is clean and the response genuinely needs damping.",
      "Judge the result on more than error. A controller that tracks beautifully by moving the valve constantly is not better; it is trading equipment life for a prettier trace. Read tracking error and valve travel together, and be able to say which one you chose to favour and why.",
      "Published tuning rules — Ziegler-Nichols, Cohen-Coon, relay autotuning — give you a starting point from a measured response, not a final answer. They are opening bids.",
    ],
    briefing: [
      "Both loops start with proportional action only, and a low gain.",
      "The oil valve loses 40% of its capacity at 45 seconds. You are not told this during the run; the level will tell you.",
      "Tune both loops to hold their setpoints through the restriction, without spending the valves to do it.",
    ],
    debriefPassed: [
      "You tuned from scratch, absorbed a capacity loss, and kept the valve movement reasonable. That is the job.",
      "Write down the gains you finished with and why. The ability to defend a tuning is worth more than the tuning.",
    ],
    debriefFailed: [
      "The result missed on tracking, on valve travel, or on both.",
      "Work in order: Kp until the response is fast but calm, then Ki for the offset, then Kd only if it earns its place. Change one gain per run so you can tell what each one did.",
    ],
  },
};

export const training = {
  index: {
    eyebrow: "Guided training",
    title: "Learn separator control by running one",
    intro:
      "Seven short lessons. Each one isolates a single idea, gives you a separator that shows it, and tells you what to look for. Nothing you do here can break anything.",
    progress: (completed: number, total: number) => `${completed} of ${total} lessons passed`,
    estimatedMinutes: (minutes: number) => `about ${minutes} min`,
    start: "Start lesson",
    review: "Review lesson",
    locked: "Finish the previous lesson first",
    passed: "Passed",
    backToIndex: "All lessons",
    exportProgress: "Export progress",
    importProgress: "Import progress",
    exportHint:
      "Progress is stored only in this browser and is never sent anywhere. Export it if an instructor asks for your results.",
    importFailed: "That file is not a progress export from this course.",
    resetProgress: "Reset progress",
  },

  level: {
    foundation: "Foundation",
    practice: "Practice",
    advanced: "Advanced",
  } satisfies Record<LessonLevel, string>,

  player: {
    theoryHeading: "Before you start",
    briefingHeading: "Your task",
    fieldNoteHeading: "From the field",
    runHeading: "The separator",
    debriefHeading: "Debrief",
    checksHeading: "What was measured",
    nextLesson: "Next lesson",
    retry: "Try again",
    attempt: (attempts: number) => `Attempt ${attempts}`,
    notAttempted: "Run the exercise to see how you did.",
    passedBanner: "Lesson passed",
    failedBanner: "Not yet — read the debrief and try again",
  },

  check: {
    "no-trip": "Vessel stayed inside its safety envelope",
    "expected-trip": "Reached the failure this lesson is about",
    "total-iae": "Total level tracking error",
    "interface-iae": "Interface tracking error",
    "pressure-iae": "Pressure tracking error",
    "overshoot": "Peak overshoot",
    "settling-time": "Settling time",
    "valve-travel": "Total valve travel",
    "score": "Score",
    "steady-state-offset": "A standing offset remained, as expected",
  },

  instructor: {
    enter: "Presentation mode",
    exit: "Leave presentation mode",
    hint: "Large type, no chrome. Use the arrow keys to move between lessons.",
    revealTask: "Reveal the task",
    hideTask: "Hide the task",
  },

  lesson: LESSON_COPY,
};

export type TrainingMessages = typeof training;
