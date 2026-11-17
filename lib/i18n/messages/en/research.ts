/**
 * Research Lab copy (English, canonical).
 *
 * Every number quoted here comes from the eng_dacs report and is re-derived
 * from the published data on the page (lib/research/catalog.ts claims). Keep
 * statements tied to a report section; do not add numbers the data cannot back.
 */

import type { CatalogueEntryId, ControllerKey, ExperimentId } from "@/lib/research/catalog";

export interface ExperimentCopy {
  title: string;
  question: string;
  comparing: string;
  summary: string;
  comparisonLabels: Record<string, string>;
  demonstrate: readonly string[];
  watch: readonly string[];
  questions: readonly { q: string; a: string }[];
  conclusion: readonly string[];
  idealVsReal: readonly string[];
}

const experiments: Record<ExperimentId, ExperimentCopy> = {
  "c2-lic103-simc": {
    title: "Deployed PID versus a SIMC tuning on the interface loop",
    question:
      "Does one literature tuning (SIMC, τc 120 s, with a 10 s PV filter) settle LIC-103 interface setpoint steps faster than the deployed PID, on new seeds and scenarios?",
    comparing:
      "LIC-103 under the deployed PID and under the SIMC design, same scenario and seed, +5 % interface setpoint step, 900 s window.",
    summary:
      "Confirmatory replication with frozen criteria and three new seeds. The design settles fast in 21 of 24 steps; at the low-water-flow scenario pi_1p5 it is classed saturated, because LCV-103 works almost on its seat.",
    comparisonLabels: {
      center: "Center scenario",
      pi_1p5: "pi_1p5 (low water flow: the exception)",
    },
    demonstrate: [
      "A PI tuning derived from an identified process gain (SIMC, Skogestad 2003) recovers the interface steps that the deployed PID settles slowly or not at all.",
      "A classification is only as good as its context: the one non-fast case is a valve-sizing frontier, not a tuning failure.",
    ],
    watch: [
      "The setpoint step at the start of the step phase: the interface setpoint rises by 5 points (40 % to 45 %).",
      "How long each interface curve needs to stay inside the settling band around 45 %. The settled marker comes from the eng_dacs evaluation.",
      "LCV-103: the dashed line is the PLC command, the solid line is the modelled stem.",
      "Switch to pi_1p5: the water valve works below 1 % opening and touches its seat.",
    ],
    questions: [
      {
        q: "Why is the SIMC design fast at center but classed saturated at pi_1p5?",
        a: "At pi_1p5 so little water arrives that LCV-103 works at a mean opening of 0.3 to 0.8 % in the steady window. Any controller sits near the seat. The design spends 20.4 % of the step window there against a frozen 20 % criterion, and still settles in 165 to 167 s. The report attributes it to the stage-1 rangeability frontier (an oversized valve), not to the tuning.",
      },
      {
        q: "Does settling faster cost valve wear?",
        a: "Not here. The report gives about 170 to 190 %/h of steady-window travel for the design against 640 to 690 %/h for the deployed PID on LIC-103, and an overshoot of at most 0.07 of the step against up to 0.78.",
      },
      {
        q: "Is this evidence that machine learning or another controller structure is needed?",
        a: "No. One PI tuning recovers every case where the deployed PID falls short. The report's conclusion is the opposite: no level-loop case in these scenarios is evidence for a different structure.",
      },
    ],
    conclusion: [
      "On the interface loop, the SIMC design was fast in every scenario where the deployed PID was slow or did not settle within 900 s, on three seeds that never generated the hypothesis.",
      "The pi_1p5 exception is honest bookkeeping: the frozen saturation criterion was crossed by 0.4 points while the step still settled. The cause is where the valve has to work, not how the loop is tuned.",
    ],
    idealVsReal: [
      "SIMC assumes an integrating process with a known gain. The gain here was identified on the same simulator, so the match between model and plant is better than a field engineer would get.",
      "Classes are judged on the true interface, not on the noisy transmitter an operator sees.",
      "Only setpoint steps were tested in this campaign; disturbances and faults come in the other two experiments.",
    ],
  },
  "c2-lcv102-actuator-lag": {
    title: "A 20 s actuator lag on LCV-102, four hours",
    question:
      "With a 20 s first-order lag on the oil dump valve LCV-102, does the loop stay in band over 4 h under M6 B and under the C2 designs (c2simc)?",
    comparing:
      "M6 B against c2simc at the high_rate scenario, seed 7100, LCV-102 actuator lag 20 s armed at the start of a 4 h hold.",
    summary:
      "Exploratory, one seed, uncalibrated simulator. M6 B leaves the total-level band 12,415 s into the hold (3.4 h); c2simc stays in band for the 4 h with a damped oscillation.",
    comparisonLabels: { high_rate: "high_rate scenario" },
    demonstrate: [
      "A slowly growing oscillation can look harmless for an hour. The 1 h pilot could not tell the two controllers apart; the 4 h follow-up could.",
      "The difference between a command and a valve that follows it late is visible: the stem trails the PLC output.",
    ],
    watch: [
      "LCV-102: the dashed command leads, the solid stem follows about 20 s later.",
      "The total-level swing under M6 B: compare the first half hour with the last.",
      "Leave the stop-before-events option on: playback pauses 30 s before M6 B leaves the band.",
    ],
    questions: [
      {
        q: "Why did the 1 h hold not separate the two controllers?",
        a: "At 1 h both were in band and still changing. Over 4 h the M6 B swing grows from 0.29 % to 5.41 % peak to peak per half hour at high_rate, while c2simc settles near 0.3 %. Only the longer horizon shows which oscillation decays.",
      },
      {
        q: "What does the lag do to the loop?",
        a: "It delays the valve's answer to the controller. A common reading is that a strong integral action relative to the delay erodes the stability margin: M6 B has an integral time Kc/Ki of about 20 s on this loop, c2simc about 120 s. The study did not compute margins, so treat this as the textbook explanation, not as a measured result.",
      },
      {
        q: "Is c2simc proven robust to actuator lag?",
        a: "No. One seed, one lag value (20 s), a synthetic uncalibrated case and no stability margins. The report lists all four as open.",
      },
    ],
    conclusion: [
      "Under a 20 s lag on LCV-102 at high_rate, M6 B leaves the ±2 % total-level band 12,415 s into the hold; c2simc stays in band for the full 4 h.",
      "The result is exploratory: it motivates a confirmatory campaign with more seeds and a lag sweep; it does not establish robustness.",
    ],
    idealVsReal: [
      "The lag is a clean first-order lag added by the simulator's valve-fault block. Real actuators add dead band, stiction and nonlinear stroke speeds on top.",
      "One seed of instrument noise; synthetic well conditions.",
    ],
  },
  "c2-lcv102-stiction": {
    title: "Stiction on LCV-102: tuning attenuates, it does not repair",
    question:
      "With stiction on LCV-102 (S 3 %, J 1 %, Choudhury et al. 2005), how do the deployed PID, M6 B and c2simc behave over a 1 h hold?",
    comparing:
      "The deployed PID, M6 B and c2simc at the center scenario, seed 7100, LCV-102 stiction armed at the start of the hold.",
    summary:
      "Exploratory, one seed. The deployed PID leaves the band; M6 B stays in band with a sustained stick-slip cycle; c2simc keeps the cycle smallest. No tuning removes it.",
    comparisonLabels: { center: "Center scenario" },
    demonstrate: [
      "A sticky valve turns integral action into a limit cycle: the output ramps until the stem slips, overshoots, sticks again.",
      "Tuning changes the size of the cycle, not its existence. The remedy is the valve (maintenance) or a stiction compensator.",
    ],
    watch: [
      "LCV-102 in the technical view or the valve chart: the solid stem stays flat while the dashed command keeps moving, then jumps.",
      "The sawtooth on the total level under each controller.",
      "The deployed PID: playback stops 30 s before it leaves the band.",
    ],
    questions: [
      {
        q: "Why does integral action make stiction worse?",
        a: "While the stem is stuck, the level error persists, so the integral term keeps ramping the command. When the command finally exceeds the friction band the stem slips past the needed position, the error changes sign, and the cycle restarts.",
      },
      {
        q: "Why is the cycle smaller under c2simc?",
        a: "The report offers a candidate explanation and marks it untested: proportional action moves the output across the stiction band at a level deviation of about S/Kc, so a higher Kc slips the valve at a smaller error. c2simc has Kc 8.42 on this loop, M6 B 2.03.",
      },
      {
        q: "So is a high gain the fix?",
        a: "No. The cycle persists under every tuning; the report states that no PI removes it. Stiction is a mechanical fault.",
      },
    ],
    conclusion: [
      "The deployed PID leaves the total-level band during the hold; M6 B and c2simc stay inside it, with c2simc showing the smallest peak-to-peak swing over the second half of the hold.",
      "The cycle never disappears. Tuning can make a sticky valve tolerable for a while; it cannot make it a good valve.",
    ],
    idealVsReal: [
      "The stiction model is the two-parameter S/J model of Choudhury, Shah and Thornhill (2005). Real valves add wear and variable friction.",
      "The report notes that its tail window (300 s) can be shorter than the cycle; the peak-to-peak shown here uses the second half of the hold, as the report's table does.",
    ],
  },
};

const entries: Record<CatalogueEntryId, { title: string; question: string; comparing: string }> = {
  "c2-lic103-simc": {
    title: experiments["c2-lic103-simc"].title,
    question: experiments["c2-lic103-simc"].question,
    comparing: experiments["c2-lic103-simc"].comparing,
  },
  "c2-lcv102-actuator-lag": {
    title: experiments["c2-lcv102-actuator-lag"].title,
    question: experiments["c2-lcv102-actuator-lag"].question,
    comparing: experiments["c2-lcv102-actuator-lag"].comparing,
  },
  "c2-lcv102-stiction": {
    title: experiments["c2-lcv102-stiction"].title,
    question: experiments["c2-lcv102-stiction"].question,
    comparing: experiments["c2-lcv102-stiction"].comparing,
  },
  "operating-envelope": {
    title: "Operating envelope of the nominal plant",
    question: "Under which operating conditions does the nominal installation work, and which constraint bounds each frontier?",
    comparing: "40 simulated scenarios of the stage-1 pilot (center, one-at-a-time and Latin hypercube), each with its outcome and dominant constraint.",
  },
  "campaign-d-trajectories": {
    title: "Time-evolving wells (campaign D)",
    question: "How do the controllers handle a declining reservoir pressure, a rising water cut or a rising GOR over a 2 h hold?",
    comparing: "Four controllers under three prescribed trajectories. The dataset exists locally but is not yet listed in the publication policy.",
  },
  "field-calibrated-cases": {
    title: "Field-calibrated well cases",
    question: "Do the conclusions hold on wells calibrated against field measurements?",
    comparing: "No field-calibrated case exists in the study: every scenario is synthetic. The field operating points behind the well presets are not published.",
  },
};

export const research = {
  meta: { title: "Research Lab" },
  bridge: {
    eyebrow: "After the course",
    title: "See the same ideas in real research runs",
    body: "The Research Lab replays recorded runs of a research simulator: a setpoint step settled by a better tuning, an actuator lag that only shows its effect after hours, and a sticky valve that no tuning repairs. Each experiment says what to watch and links back to the lesson behind it.",
    link: "Open the Research Lab",
  },
  landingCta: "Research Lab",
  nav: {
    lab: "Research Lab",
    backToLab: "Back to the Research Lab",
    training: "Training course",
    home: "Home",
    envelope: "Envelope explorer",
  },
  page: {
    eyebrow: "Research Lab",
    title: "Replay real research runs",
    intro:
      "Recorded runs from eng_dacs, a separate research simulator, replayed in your browser. Nothing is simulated here: every frame comes from a published, verified trace.",
    disclaimerTitle: "Not a validated industrial control system",
    disclaimer:
      "These are results of a research simulator with synthetic, uncalibrated well cases. They are not field data and must not be used for operation, design or safety decisions.",
    independenceTitle: "Two different simulators",
    independence:
      "The training course and the challenge run this site's educational engine. The Research Lab only replays eng_dacs records. The two use different equations and parameters and are not physically equivalent; nothing here is recomputed with the educational engine.",
    attribution: "Research and simulator: Marcos Esteban Soto (eng_dacs, doctoral research). Replays exported offline under a publication policy.",
    trainingLink: "New to separator control? Start with the training course",
  },
  catalogue: {
    heading: "Experiments",
    availability: {
      loaded: "Data published",
      pending: "Pending",
      not_publishable: "Not publishable",
    },
    availabilityHelp: {
      loaded: "The runs are published and verified.",
      pending: "Not exported yet: no trajectory is shown in its place.",
      not_publishable: "This material cannot be published.",
    },
    open: "Open experiment",
    openEnvelope: "Open the explorer",
    runs: (count: number, size: string) => `${count} runs, ${size}`,
    question: "Question",
    comparing: "Compared",
    sources: "Source and method",
    privateSource: "private repository",
    loadingIndex: "Reading the published index…",
    indexFailed: "The published index could not be read.",
  },
  evidence: {
    stage: { confirmatory: "Confirmatory", exploratory: "Exploratory" },
    stageHelp: {
      confirmatory: "Criteria frozen by hash before the runs; hypotheses pre-registered.",
      exploratory: "Criteria not frozen; a look that motivates, not one that confirms.",
    },
    seeds: (count: number) => (count === 1 ? "1 seed" : `${count} seeds`),
    synthetic: "Synthetic, uncalibrated",
    syntheticHelp: "Model results on synthetic well cases, not field data.",
    stageNotDeclared: "stage not declared by the campaign (stage-1 pilot)",
  },
  player: {
    play: "Play",
    pause: "Pause",
    reset: "Restart",
    speed: "Playback speed",
    speedOption: (speed: number) => `×${speed}`,
    speedNote: "Speed changes how fast the recording is read, never the recorded values.",
    seek: "Simulated time",
    time: "Time",
    duration: "Window",
    stopBefore: "Pause 30 s before failures",
    pausedBefore: (label: string) => `Paused 30 s of simulated time before: ${label}`,
    events: "Events",
    jumpBefore: (label: string) => `Go to 30 s before ${label}`,
    noEvents: "No events in this window.",
    relativeTo: (phase: string) => `seconds from the start of phase “${phase}”`,
    phase: "Phase",
    frame: {
      observed: "Recorded tick",
      interpolated: "Between ticks: continuous signals interpolated, registers held",
      missing: "No recorded data at this instant",
    },
    frameHelp:
      "Levels, pressure and flows (physical states) are drawn on a straight line between two recorded ticks. Commands, setpoints, alarms and stem positions are held at the last recorded value.",
    integrity: {
      checking: "Checking integrity…",
      verified: (count: number) => `${count} signals verified bit for bit (SHA-256)`,
      mismatch: (keys: string) => `Integrity check failed: ${keys}`,
      unavailable: "Integrity not checked (Web Crypto unavailable)",
    },
    loading: "Loading recorded runs…",
    loadFailed: "The recorded runs could not be loaded.",
    retry: "Retry",
    keyboardHint: "Space plays or pauses; arrow keys move the slider.",
  },
  views: {
    label: "View",
    scene: "3D",
    technical: "Technical (P&ID)",
    focusRun: "Shown in the view",
    sceneUnavailable: "The 3D view is unavailable on this device; the technical view shows the same recorded values.",
    schematicNote:
      "Schematic vessel. Levels are drawn as the recorded percent of diameter; the drawn vessel is not to scale (eng_dacs vessel 1.017 m × 3.0 m).",
    illustrative: "Pipe pulses only illustrate the recorded flow; their speed is not to scale.",
    gasNote: "The 3D model has no gas line: PCV-101 and the pressure are shown in the readout and the technical view.",
    valveLabel: (tag: string) => tag,
    command: "CMD",
    stem: "STEM",
    readout: "Recorded values",
  },
  pid: {
    title: "Technical view, PV-WT-001",
    ariaLabel: (summary: string) => `Piping and instrumentation view. ${summary}`,
    pv: "PV",
    sp: "SP",
    op: "OP",
    stem: "Stem",
    mode: "Mode",
    plant: "Plant",
    well: "Well",
    alarms: "Alarms",
    none: "none",
    gas: "Gas",
    oil: "Oil",
    water: "Water",
    feed: "Well stream",
    summary: (pressure: string, total: string, interfaceLevel: string) =>
      `Pressure ${pressure}, total level ${total}, interface ${interfaceLevel}.`,
  },
  charts: {
    heading: "Synchronized trends",
    pressure: "Separator pressure and setpoint",
    total: "Total liquid level and setpoint (LIC-102)",
    interface: "Oil/water interface and setpoint (LIC-103)",
    valveOil: "LCV-102: command and stem",
    valveWater: "LCV-103: command and stem",
    events: "Events",
    setpoint: "SP",
    band: (value: string) => `band ±${value}`,
    command: "command",
    stem: "stem",
    limits: "0 / 100 % limits",
    cursor: "Cursor",
    zoom: { label: "Window", full: "Whole run", phase: (phase: string) => `Phase “${phase}”` },
    decimationNote: "Long runs are drawn with every local minimum and maximum kept; the readout uses the recorded samples.",
    readoutAt: (time: string) => `At ${time}`,
    unit: (unit: string) => unit,
  },
  compare: {
    heading: "Controllers compared",
    set: "Comparison",
    anchor: "Align on",
    aligned: (phase: string) => `Curves aligned on the start of phase “${phase}” in each run.`,
    shift: (run: string, start: string, shift: string) => `${run}: phase starts at ${start} s of its run (shift ${shift} s).`,
    noShift: "Every run starts this phase at the same tick: no shift.",
    paired: (scenario: string, seed: number) => `Paired runs: scenario ${scenario}, seed ${seed}. They differ only by the controller.`,
    notPaired: "These runs do not share scenario and seed: differences are not attributable to the controller alone.",
    missingAnchor: (runs: string) => `Not aligned (phase absent): ${runs}`,
  },
  metrics: {
    heading: "Metrics",
    note: "Copied from the eng_dacs evaluation of each run (run.json); thresholds from the frozen campaign criteria.",
    controller: "Controller",
    gains: "Gains (Kc, Ki 1/s, PV filter)",
    holdClass: "Hold class",
    firstExit: "First band exit",
    stepClass: "Step class",
    settling: "Settling time",
    overshoot: "Overshoot",
    saturated: "Time saturated",
    travel: "Valve travel, hold",
    p2pTail: "Level p2p, last 300 s",
    p2pHalf: "Level p2p, 2nd half of hold",
    outcome: "Stage-1 outcome",
    criterion: "Criterion",
    none: "none",
    notApplicable: "n/a",
    secondsFromPhase: (value: string, phase: string) => `${value} s after ${phase} start`,
    computedHere: "computed on this page from the published trace",
    classes: {
      sustains: "sustains",
      loses_band: "loses band",
      apparent_equilibrium: "apparent equilibrium",
      trip: "trip",
      not_reached: "not reached",
      fast: "fast",
      slow: "slow",
      saturated: "saturated",
      not_within_horizon: "not within horizon",
      persistent_oscillation: "persistent oscillation",
      inadmissible: "inadmissible",
      not_tested: "not tested",
    } as Record<string, string>,
  },
  claims: {
    heading: "Documented results, re-derived from the data",
    note: "Each statement quotes the eng_dacs report. The page recomputes it from the published files and shows whether they agree.",
    documented: "Report",
    computed: "From the published data",
    section: (section: string) => `section ${section}`,
    status: { consistent: "agrees", inconsistent: "differs", unavailable: "data not loaded" },
    units: { steps: "steps", runs: "runs", s: "s", "%": "%", "% p2p": "% p2p", "%/h": "%/h", "fraction of the step window": "of the step window", "s from the hold start": "s from the hold start" } as Record<string, string>,
    statements: {
      simcFast: "The SIMC design is fast in 21 of the 24 interface steps (8 scenarios × 3 seeds).",
      simcSaturated: "The 3 remaining steps are pi_1p5, classed saturated.",
      nominalSlow: "The deployed PID: slow 15, not within 900 s 6, fast 3 (all fast ones at pi_1p5).",
      centerSettling: "At center the design settles in 179 to 181 s on the three seeds.",
      piSaturationMax: "At pi_1p5 the design's output sits on the seat for up to 0.204 of the step window (criterion 0.20).",
      piSaturationEverySeed: "That fraction is above the 0.20 criterion on every seed.",
      piSettling: "It still settles, in 165 to 167 s.",
      piOpening: "At pi_1p5 LCV-103 works at a mean opening of 0.3 to 0.8 % in the steady window (both controllers).",
      replayCenterSettling: "The center run loaded here (seed 7200) settles within that range.",
      m6bExit: "M6 B leaves the total-level band 12,415 s into the hold.",
      c2simcSustains: "c2simc sustains the 4 h hold.",
      m6bWindows: "M6 B total-level p2p in hold windows 0–0.5, 1–1.5, 2–2.5 and 3.5–4 h: 0.29, 1.07, 2.26, 5.41 %.",
      c2simcWindows: "c2simc in the same windows: 0.28, 0.64, 0.34, 0.32 %.",
      deployedLosesBand: "Under LCV-102 stiction the deployed PID loses the band.",
      deployedP2P: "Deployed PID total-level p2p, second half of the hold: 4.0 to 4.2 % across the three scenarios (center loaded here).",
      m6bP2P: "M6 B: 2.5 to 2.6 % across the three scenarios.",
      c2simcP2P: "c2simc: 0.6 to 1.0 % across the three scenarios.",
      c2simcTravel: "Under stiction c2simc moves LCV-102 at most 240 %/h.",
      outcomes: "Outcomes of the 40 scenarios: 9 marginal, 29 inadmissible, 1 inconclusive, 1 outside the model, 0 admissible.",
      erosion: "Flow-iron erosion dominates 14 runs (high-rate frontier).",
      gasRangeability: "PCV-101 rangeability dominates 9 runs (low-gas frontier).",
      noFlow: "No flow dominates 3 runs (kick-off criterion).",
      oilTracking: "LIC-102 setpoint tracking dominates 2 runs (low oil throughput).",
    } as Record<string, string>,
  },
  learning: {
    heading: "Learn from this experiment",
    demonstrate: "What it demonstrates",
    watch: "What to watch while it plays",
    questions: "Questions",
    reveal: "Show the evidence-based answer",
    conclusion: "Conclusion, from the evidence",
    idealVsReal: "Idealized behaviour versus real limits",
    limitations: "Model limitations stated by the campaign",
    relatedLessons: "Related lessons in the course",
    sources: "Report and method",
    sourceAccess: "eng_dacs is a private repository; the reference identifies the source for reviewers with access.",
  },
  provenance: {
    heading: "Provenance",
    dataset: "Dataset",
    campaign: "Campaign",
    run: "Run",
    scenario: "Scenario",
    seed: "Seed",
    code: "eng_dacs commit",
    dirty: (count: number) => (count === 0 ? "clean tree" : `${count} uncommitted file(s) at run time`),
    config: "Campaign config SHA-256",
    digest: "Run digest",
    reproduced: "Reproduced",
    reproducedYes: (at: string) => `identical on ${at}`,
    exported: "Exported",
    policy: "Publication policy",
    withheld: "Withheld from publication",
    trace: "Trace file SHA-256",
  },
  controllers: {
    deployed: "Deployed PID",
    simc: "SIMC design",
    m6b: "M6 B",
    c2simc: "c2simc",
  } satisfies Record<ControllerKey, string>,
  controllerHelp: {
    deployed: "The virtual PLC's default tuning (POC 07), model-derived.",
    simc: "SIMC τc 120 s on campaign A's identified gain, plus a 10 s PV filter (Skogestad 2003).",
    m6b: "The POC 07 M6 B tuning, model-derived.",
    c2simc: "Both C2 SIMC designs together: LIC-102 Kc 8.42 with a 15 s filter, LIC-103 Kc 5.36 with a 10 s filter.",
  } satisfies Record<ControllerKey, string>,
  events: {
    kinds: {
      command: "PLC command",
      fault: "Fault armed",
      setpoint_change: "Setpoint change",
      alarm_on: "Alarm",
      alarm_off: "Alarm cleared",
      trip: "Trip",
      plant_state: "Plant state",
      well_state: "Well state",
      band_exit: "Leaves the band",
      settled: "Settled",
      oil_pad_lost: "Oil pad lost",
    } as Record<string, string>,
    origin: { recorded: "recorded", evaluation: "eng_dacs evaluation" },
    verified: "verified against the trace",
    describe: {
      command: (command: string, result: string) => `${command} (${result})`,
      fault: (valve: string, detail: string) => `${valve} fault armed: ${detail}`,
      setpoint: (controller: string, from: string, to: string) => `${controller} setpoint ${from} → ${to}`,
      alarm: (alarm: string, on: boolean) => `${alarm} ${on ? "on" : "cleared"}`,
      trip: "Plant trip",
      plant: (from: string, to: string) => `Plant ${from} → ${to}`,
      well: (from: string, to: string) => `Well ${from} → ${to}`,
      bandExit: (controller: string, band: string, seconds: string, phase: string) =>
        `${controller} leaves its ±${band} band (${seconds} s after ${phase} start)`,
      settled: (controller: string, seconds: string, cls: string) => `${controller} settles ${seconds} s after the step (${cls})`,
      oilPad: "Oil pad lost",
    },
    faultParts: {
      actuator_tau_s: (v: string) => `actuator lag ${v} s`,
      stiction_s_pct: (v: string) => `stiction S ${v} %`,
      stiction_j_pct: (v: string) => `J ${v} %`,
      deadband_pct: (v: string) => `dead band ${v} %`,
      leakage_pct: (v: string) => `leakage ${v} %`,
      wear_rate_per_h: (v: string) => `wear ${v} /h`,
    } as Record<string, (value: string) => string>,
    alarms: {
      pah: "PAH (pressure high)",
      lah: "LAH (level high)",
      high_water_level: "High water level",
      oil_overflow: "Oil overflow",
      liquid_carryover: "Liquid carry-over",
    } as Record<string, string>,
  },
  envelope: {
    title: "Operating envelope explorer",
    intro:
      "Each point is one scenario that eng_dacs simulated and evaluated in the stage-1 pilot. Choose two physical axes; select a point to see its outcome, the constraint that dominated it and, where published, its replay.",
    noFrontier:
      "No frontier is drawn. With 40 points and one seed a boundary between classes is not a measured result. The frontiers the report states are listed below with the constraint and method behind each.",
    xAxis: "Horizontal axis",
    yAxis: "Vertical axis",
    logScale: "logarithmic",
    designRange: "design range",
    outcomes: {
      outside_model: "Outside the model",
      inadmissible: "Inadmissible",
      inconclusive: "Inconclusive",
      marginal: "Marginal",
      admissible: "Admissible",
    } as Record<string, string>,
    outcomeHelp: {
      outside_model: "A model-validity constraint is violated: the model is not applicable here.",
      inadmissible: "A physical, control or metrological constraint is violated.",
      inconclusive: "No steady state was reached.",
      marginal: "A warning, or a limit at 80 % or more of its threshold.",
      admissible: "No violation and no limit near its threshold. None of the 40 runs qualifies.",
    } as Record<string, string>,
    filter: "Show",
    notPlotted: (count: number) =>
      count === 1
        ? "1 run has no value on these axes (no flowing operating point) and is not plotted."
        : `${count} runs have no value on these axes (no flowing operating point) and are not plotted.`,
    selectPrompt: "Select a point to see its result.",
    overlap: (count: number) => `${count} runs share these coordinates on the chosen axes (they differ in another factor):`,
    selected: "Selected run",
    dominant: "Dominant constraint",
    closest: "Closest limit not yet active",
    utilization: (value: string) => `at ${value} of its threshold`,
    active: "Active constraints",
    category: "Category",
    noDominant: "none (no violation)",
    openReplay: "Open the replay",
    replayNotPublished: "Replay not published for this run (only representative runs are exported).",
    factorAxis: "design factor",
    operatingAxis: "measured operating point (steady-window mean)",
    frontiersHeading: "Frontiers stated by the report",
    frontiers: {
      erosion: "High rate: erosional ratio above 1 on the 3 in flow iron (API RP 14E, C = 100). The ratio scales as 1/C, so the frontier moves with the C-factor.",
      gasRangeability: "Low gas: PCV-101 below its Kv/R (about 1,770 Sm3/h at 48 bar). Modelled valve equations; one seed.",
      waterRangeability: "Low water: LCV-103 below its Kv/R at 5 % water cut.",
      noFlow: "No flow: the static kick-off criterion of the nodal coupling (model-dependent).",
      oilTracking: "Oil-level tracking: the nominal LIC-102 does not settle a +5 % step in 240 s at low oil throughput.",
      model: "Model: gas-liquid ratio below the choke model's envelope (GLR < 10).",
    } as Record<string, string>,
    axisLabels: {
      f_reservoir_pressure_bar: "Reservoir pressure",
      f_productivity_index_m3_d_bar: "Productivity index",
      f_water_cut_pct: "Water cut",
      f_gor_sm3_sm3: "GOR",
      f_bean_64th: "Choke bean",
      f_pressure_setpoint_bar: "Pressure setpoint (PIC-101)",
      op_inlet_liquid_truth_m3_h: "Liquid rate",
      op_oil_flow_truth_m3_h: "Oil rate",
      op_water_flow_truth_m3_h: "Water rate",
      op_gas_std_flow_truth_sm3_h: "Gas rate (standard)",
      op_nodal_whp_bar: "Flowing wellhead pressure",
      op_separator_pressure_truth_bar: "Separator pressure",
    } as Record<string, string>,
    chartLabel: (x: string, y: string, count: number) => `Scatter of ${count} scenarios: ${y} against ${x}.`,
    pointLabel: (run: string, outcome: string) => `${run}: ${outcome}`,
    loading: "Loading the envelope map…",
    failed: "The envelope map could not be loaded.",
  },
  entries,
  experiments,
  codes: {
    RUNNING: "running",
    STARTING: "starting",
    STOPPED: "stopped",
    STOPPING: "stopping",
    TRIPPED: "tripped",
    PRESTART_CHECK: "pre-start check",
    RESET_PENDING: "reset pending",
    CONVERGED: "flowing",
    SHUT_IN: "shut in",
    NO_FLOW: "no flow",
    OFF: "off",
    AUTO: "AUTO",
    MANUAL: "MANUAL",
  } as Record<string, string>,
  signals: {
    "pressure.truth": "Separator pressure",
    "level.total.truth": "Total level",
    "level.interface.truth": "Interface",
    "loop.gas.sp": "PIC-101 SP",
    "loop.oil.sp": "LIC-102 SP",
    "loop.water.sp": "LIC-103 SP",
    "flow.inlet_liquid.truth": "Inlet liquid",
    "flow.oil.truth": "Oil out",
    "flow.water.truth": "Water out",
    "flow.gas_std.truth": "Gas out",
  } as Record<string, string>,
};

export type ResearchMessages = typeof research;
