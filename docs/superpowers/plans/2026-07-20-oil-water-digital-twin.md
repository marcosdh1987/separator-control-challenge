# Oil-Water Digital Twin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cinematic Three.js separator hero backed by deterministic oil and water inventories, two scored PID loops, six coupled scenarios, and an accessible 2D control HUD.

**Architecture:** Keep fixed-step physics and scoring in pure TypeScript modules executed by the existing Web Worker. Publish one explicit dual-loop sample contract to React; the semantic HUD and charts render that contract directly, and React Three Fiber only interpolates it for display. Isolate WebGL behind a client-only boundary with a complete SVG fallback.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Web Workers, Three.js, React Three Fiber, Drei, React Three Postprocessing, Tailwind CSS 4, Recharts, Vitest, Testing Library, and Playwright.

---

## Repository execution rule

The repository forbids automatic staging and commits. This rule overrides the
generic commit steps in the planning skill. Every task ends with a read-only
checkpoint:

```bash
git diff --check
git status --short
```

Leave every file unstaged. The user will create commits manually.

## Final file map

### Simulation domain

- Modify `lib/simulation/types.ts`: public dual-loop, phase-flow, safety, metric,
  score, and Worker contracts.
- Modify `lib/simulation/geometry.ts`: retain horizontal-cylinder conversion and
  remove the obsolete single-liquid outlet law.
- Create `lib/simulation/phase-hydraulics.ts`: feed split, hydrostatic head,
  phase outlet flow, and bounded inventory integration.
- Modify `lib/simulation/scenarios.ts`: six deterministic oil/water disturbances.
- Modify `lib/simulation/validation.ts`: sanitize two PID configurations and the
  expanded simulation configuration.
- Modify `lib/simulation/engine.ts`: own two inventories, controllers, sensors,
  actuators, and safety state.
- Modify `lib/simulation/metrics.ts`: calculate loop and actuator metrics.
- Modify `lib/simulation/scoring.ts`: combine both loops into the approved score.
- Modify `lib/simulation/worker-runtime.ts`: initialize and run the dual engine.
- Modify `workers/simulation.worker.ts`: preserve the typed Worker boundary.
- Modify tests beside each domain module and regenerate
  `lib/simulation/__fixtures__/golden-runs.json`.

### Presentation mapping and Three.js

- Create `lib/visualization/scene-model.ts`: pure mapping from a simulation sample
  to render positions, flow animation parameters, and alarm presentation.
- Create `lib/visualization/scene-model.test.ts`: deterministic presentation tests.
- Create `components/process-hero.tsx`: client-only WebGL boundary and SVG fallback.
- Modify `components/process-visualization.tsx`: accessible gas/oil/water fallback.
- Create `components/scene/separator-scene.tsx`: Canvas, camera, lights, quality
  tier, and post-processing.
- Create `components/scene/separator-vessel.tsx`: shell, cutaway, heads, nozzles,
  flanges, legs, and nameplate.
- Create `components/scene/phase-volumes.tsx`: clipped water/oil volumes, surfaces,
  and bounded gas haze.
- Create `components/scene/process-pipe.tsx`: pipe geometry and flow pulses.
- Create `components/scene/control-valve.tsx`: animated oil and water valves.
- Create `components/scene/alarm-beacon.tsx`: safe, alarm, and trip lighting.
- Create `components/scene/scene-error-boundary.tsx`: context-failure recovery.
- Create `components/scene/use-scene-quality.ts`: reduced-motion and quality policy.

### HUD and product surface

- Modify `hooks/use-simulation.ts`: dual PID initialization and dual samples.
- Modify `components/pid-controls.tsx`: one reusable loop instrument dock.
- Create `components/dual-pid-controls.tsx`: coordinate both PID docks and shared
  transport controls.
- Modify `components/game-dashboard.tsx`: immersive process-bay composition,
  combined live metrics, and safety announcements.
- Modify `components/trend-charts.tsx`: four synchronized dual-phase charts.
- Modify `components/result-panel.tsx`: per-loop and per-actuator results.
- Modify `components/scenario-selector.tsx`: new scenario identifiers and copy.
- Modify `app/globals.css`: cinematic art direction, responsive layout, focus,
  fallback, reduced motion, and alarm states.

### Verification and documentation

- Modify component tests and `tests/e2e/game.spec.ts`.
- Modify `PLAN.md`, `README.md`, `docs/physical-model.md`, and `docs/scoring.md`.
- Create `docs/adr/0003-separate-deterministic-physics-from-webgl-rendering.md`.
- Update `memory/context.md` and add concise durable findings to
  `memory/learnings.md`.

## Task 1: Install the Three.js runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Record the green frontend baseline**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected: all four commands exit `0`; Vitest reports the existing 43 tests as
passing before the feature changes.

- [ ] **Step 2: Install exact local dependencies**

Run:

```bash
npm install --save-exact three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing
npm install --save-dev --save-exact @types/three
```

Expected: npm updates only `package.json` and `package-lock.json`, resolves React
19 peer dependencies, and reports zero audit vulnerabilities.

- [ ] **Step 3: Verify dependency resolution**

Run:

```bash
npm ls three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing
npm run typecheck
```

Expected: npm prints one resolved dependency tree without `invalid` or `unmet`,
and TypeScript exits `0`.

- [ ] **Step 4: Checkpoint the unstaged dependency change**

Run `git diff --check && git status --short`. Expected: no whitespace errors;
`package.json` and `package-lock.json` remain unstaged.

## Task 2: Define and validate the dual-loop contracts

**Files:**
- Modify: `lib/simulation/types.ts`
- Modify: `lib/simulation/validation.ts`
- Modify: `lib/simulation/validation.test.ts`

Tasks 2-12 use a short-lived compatibility bridge so every checkpoint still
typechecks against the current Worker and UI. New nested contracts coexist with
the old flat total-level aliases, all marked `@deprecated`. Task 8 removes the
old engine entry points, Task 9 removes old scenario IDs, and Task 13 removes the
last flat sample, configuration, and metric aliases.

- [ ] **Step 1: Write failing validation tests**

Add cases that sanitize each PID independently and clamp every new physical
threshold:

```ts
it("sanitizes both PID loops independently", () => {
  const result = sanitizeDualPidConfig({
    total: { ...DEFAULT_PID, kp: 99, ki: -1 },
    interface: { ...DEFAULT_PID, kd: 99, integralLimit: 999 },
  });

  expect(result.total.kp).toBe(10);
  expect(result.total.ki).toBe(0);
  expect(result.interface.kd).toBe(30);
  expect(result.interface.integralLimit).toBe(40);
});

it("keeps the safety envelope ordered", () => {
  const result = sanitizeSimulationConfig({
    ...DEFAULT_SIMULATION,
    totalLowLowPct: 30,
    totalLowAlarmPct: 20,
    interfaceHighAlarmPct: 50,
    interfaceHighHighPct: 40,
  });

  expect(result.totalLowLowPct).toBeLessThan(result.totalLowAlarmPct);
  expect(result.interfaceHighAlarmPct).toBeLessThan(result.interfaceHighHighPct);
});
```

- [ ] **Step 2: Run the tests and confirm the missing contract**

Run `npm run test -- lib/simulation/validation.test.ts`.

Expected: FAIL because `sanitizeDualPidConfig`, the dual configuration fields,
and their defaults do not exist.

- [ ] **Step 3: Add the public types and defaults**

Define these exact new shapes in `types.ts`:

```ts
export type LoopId = "total" | "interface";
export type PhaseId = "oil" | "water";
export type TripKind =
  | "TOTAL_LL"
  | "TOTAL_HH"
  | "INTERFACE_LL"
  | "INTERFACE_HH"
  | "OIL_LAYER_LL"
  | "LL"
  | "HH"
  | null;

export interface DualPidConfig {
  total: PidConfig;
  interface: PidConfig;
}

export interface PhaseFlows {
  totalInletM3H: number;
  waterCutFraction: number;
  oilInletM3H: number;
  waterInletM3H: number;
  oilOutletM3H: number;
  waterOutletM3H: number;
}

export interface LoopSample {
  processValuePct: number;
  measuredValuePct: number;
  setpointPct: number;
  errorPct: number;
  valveCommandPct: number;
  valvePositionPct: number;
  proportionalTerm: number;
  integralTerm: number;
  derivativeTerm: number;
}

export interface SafetyState {
  severity: "safe" | "alarm" | "trip";
  source:
    | "total"
    | "interface"
    | "oil-layer"
    | null;
  label: string;
  trip: TripKind;
}

export interface SimulationSample {
  timeS: number;
  total?: LoopSample;
  interface?: LoopSample;
  oilVolumeM3?: number;
  waterVolumeM3?: number;
  oilLayerPct?: number;
  flows?: PhaseFlows;
  disturbance: string;
  safety?: SafetyState;
  /** @deprecated Remove in Task 13 after all consumers use `total`. */
  levelPct: number;
  measuredLevelPct: number;
  setpointPct: number;
  inletFlowM3H: number;
  outletFlowM3H: number;
  valveCommandPct: number;
  valvePositionPct: number;
  errorPct: number;
  proportionalTerm: number;
  integralTerm: number;
  derivativeTerm: number;
}
```

The optional nested fields form the Task 2 bridge for the old engine. Task 5
makes them required when `makeSample` starts populating every field. Task 6
removes legacy `LL` and `HH` trip values after metrics and scoring use the new
trip identifiers.

Expand `SimulationConfig` with the approved fields but retain the old generic
density, setpoint, band, and alarm fields through Task 12. Add these exact defaults:

```ts
export const DEFAULT_DUAL_PID: DualPidConfig = {
  total: { ...DEFAULT_PID },
  interface: { ...DEFAULT_PID },
};

export const DEFAULT_SIMULATION: SimulationConfig = {
  dtS: 0.05,
  durationS: 180,
  chartSampleS: 0.2,
  diameterM: 1.2,
  lengthM: 3,
  oilDensityKgM3: 850,
  waterDensityKgM3: 1_000,
  totalSetpointPct: 50,
  interfaceSetpointPct: 20,
  totalTargetBandPct: 5,
  interfaceTargetBandPct: 3,
  totalLowLowPct: 10,
  totalLowAlarmPct: 25,
  totalHighAlarmPct: 75,
  totalHighHighPct: 90,
  interfaceLowLowPct: 3,
  interfaceLowAlarmPct: 8,
  interfaceHighAlarmPct: 35,
  interfaceHighHighPct: 45,
  oilLayerLowLowPct: 5,
  oilRatedFlowM3H: 70,
  waterRatedFlowM3H: 30,
  actuatorTauS: 3,
  actuatorStrokeRatePctS: 20,
  densityKgM3: 850,
  setpointPct: 50,
  targetBandPct: 5,
  lowLowPct: 10,
  lowAlarmPct: 25,
  highAlarmPct: 75,
  highHighPct: 90,
};
```

Mark the final seven fields as deprecated in `SimulationConfig`; Task 13 removes
them after every UI consumer uses the phase-specific names.

- [ ] **Step 4: Implement explicit clamping**

Add:

```ts
export function sanitizeDualPidConfig(config: DualPidConfig): DualPidConfig {
  return {
    total: sanitizePidConfig(config.total),
    interface: sanitizePidConfig(config.interface),
  };
}
```

Clamp finite physical values first, then force each ordered threshold sequence to
retain at least `0.1` percentage point between adjacent values. Preserve the
existing `sanitizePidConfig` public API for focused PID tests.

- [ ] **Step 5: Run targeted and type checks**

Run:

```bash
npm run test -- lib/simulation/validation.test.ts
npm run typecheck
```

Expected: both commands pass.

- [ ] **Step 6: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 3: Implement phase hydraulics and inventory conservation

**Files:**
- Create: `lib/simulation/phase-hydraulics.ts`
- Create: `lib/simulation/phase-hydraulics.test.ts`
- Modify: `lib/simulation/geometry.ts`
- Modify: `lib/simulation/geometry.test.ts`

- [ ] **Step 1: Write failing equilibrium and conservation tests**

```ts
it("starts both phase outlets at material-balance equilibrium", () => {
  const flows = calculatePhaseOutletFlows({
    totalLevelPct: 50,
    interfaceLevelPct: 20,
    oilValvePct: 50,
    waterValvePct: 50,
    oilCapacityFactor: 1,
    waterCapacityFactor: 1,
    config: DEFAULT_SIMULATION,
  });

  expect(flows.oilOutletM3H).toBeCloseTo(35, 10);
  expect(flows.waterOutletM3H).toBeCloseTo(15, 10);
});

it("conserves each inventory independently", () => {
  const next = integratePhaseInventories({
    oilVolumeM3: 0.8,
    waterVolumeM3: 0.4,
    oilInletM3H: 35,
    waterInletM3H: 15,
    oilOutletM3H: 20,
    waterOutletM3H: 10,
    dtS: 0.05,
    fullVolumeM3: 4,
  });

  expect(next.oilVolumeM3).toBeCloseTo(0.8 + 15 * 0.05 / 3600, 12);
  expect(next.waterVolumeM3).toBeCloseTo(0.4 + 5 * 0.05 / 3600, 12);
});
```

Also test zero inventory, requested outflow above available inventory, water cut at
`0` and `1`, and finite output at `0%` and `100%` levels.

- [ ] **Step 2: Confirm the module is absent**

Run `npm run test -- lib/simulation/phase-hydraulics.test.ts`.

Expected: FAIL because `phase-hydraulics.ts` does not exist.

- [ ] **Step 3: Implement the pure hydraulic functions**

Export these functions:

```ts
export function splitFeed(totalInletM3H: number, waterCutFraction: number) {
  const total = Math.max(0, totalInletM3H);
  const waterCut = Math.max(0, Math.min(1, waterCutFraction));
  return {
    oilInletM3H: total * (1 - waterCut),
    waterInletM3H: total * waterCut,
  };
}

export function calculatePhaseOutletFlows(
  input: PhaseOutletFlowInput,
): Pick<PhaseFlows, "oilOutletM3H" | "waterOutletM3H">;

export function integratePhaseInventories(
  input: InventoryStepInput,
): PhaseInventories;
```

Use `deltaP0 = 100_000 Pa`, the approved oil and water head equations, and
setpoint-normalized square roots. Limit actual phase outflow to the inventory that
can leave during the step. Preserve mass when a defensive full-volume bound is
needed by rejecting excess inlet in the returned `accepted*InletM3H` fields.

- [ ] **Step 4: Remove the obsolete single-liquid outlet function**

Mark `outletFlow` as deprecated but retain it through Task 7 so the old engine
remains green during the migration. Task 8 deletes it after the dual engine owns
all outlet behavior. Keep circular-segment area, volume, inverse-level, and
full-volume functions unchanged.

- [ ] **Step 5: Run the hydraulic and geometry tests**

Run:

```bash
npm run test -- lib/simulation/phase-hydraulics.test.ts lib/simulation/geometry.test.ts
npm run typecheck
```

Expected: all tests pass and TypeScript reports no error.

- [ ] **Step 6: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 4: Adapt the six deterministic scenarios

**Files:**
- Modify: `lib/simulation/scenarios.ts`
- Modify: `lib/simulation/scenarios.test.ts`
- Modify: `lib/simulation/types.ts`

- [ ] **Step 1: Replace scenario expectations with the approved disturbances**

Add exact assertions for each boundary:

```ts
expect(scenarioAt("feed-step", 29.95).totalInletM3H).toBe(50);
expect(scenarioAt("feed-step", 30).totalInletM3H).toBe(70);

const peak = scenarioAt("water-rich-slug", 45);
expect(peak.totalInletM3H).toBeCloseTo(110, 10);
expect(peak.waterCutFraction).toBeCloseTo(0.65, 10);

expect(scenarioAt("oil-outlet-restriction", 45).oilCapacityFactor).toBe(0.6);
expect(scenarioAt("slow-water-dump", 30).waterActuatorTauS).toBe(12);
expect(scenarioAt("slow-water-dump", 30).waterCutFraction).toBe(0.5);
expect(scenarioAt("noisy-interface", 0).interfaceSensorNoisePct).toBe(1.5);
expect(scenarioAt("noisy-interface", 0).interfaceSensorSampleS).toBe(0.5);
```

- [ ] **Step 2: Run the scenario test and observe old IDs**

Run `npm run test -- lib/simulation/scenarios.test.ts`.

Expected: FAIL because the current scenario IDs and state shape describe one
liquid and one actuator.

- [ ] **Step 3: Replace the scenario union and state**

Add these IDs and retain the five renamed legacy IDs through Task 8:

```ts
export type ScenarioId =
  | "normal"
  | "feed-step"
  | "water-rich-slug"
  | "oil-outlet-restriction"
  | "slow-water-dump"
  | "noisy-interface"
  | "inlet-step"
  | "liquid-slug"
  | "reduced-capacity"
  | "valve-delay"
  | "noisy-transmitter";
```

Define `ScenarioState` with total feed, water cut, two capacity factors, two
actuator lags, two sensor noise amplitudes, two sensor sample periods, and one
disturbance label:

```ts
export interface ScenarioState {
  totalInletM3H: number;
  waterCutFraction: number;
  oilCapacityFactor: number;
  waterCapacityFactor: number;
  oilActuatorTauS: number;
  waterActuatorTauS: number;
  totalSensorNoisePct: number;
  interfaceSensorNoisePct: number;
  totalSensorSampleS: number;
  interfaceSensorSampleS: number;
  disturbance: string;
  /** @deprecated Flat aliases removed in Task 9. */
  inletFlowM3H: number;
  capacityFactor: number;
  actuatorTauS: number;
  sensorNoisePct: number;
  sensorSampleS: number;
}
```

Map legacy IDs to their new disturbance during the bridge. Task 9 removes those
aliases after updating the selector and dashboard default. Preserve seeds
`1001-1006`. Compute the slug with
`phase = Math.PI * (timeS - 35) / 20` only inside the `35 <= timeS < 55` window.

- [ ] **Step 4: Run scenario and type checks**

Run:

```bash
npm run test -- lib/simulation/scenarios.test.ts
npm run typecheck
```

Expected: scenario tests and typecheck pass because the bridge retains the old
engine fields and IDs.

- [ ] **Step 5: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 5: Convert the fixed-step engine to two coupled loops

**Files:**
- Modify: `lib/simulation/engine.ts`
- Modify: `lib/simulation/engine.test.ts`
- Modify: `lib/simulation/types.ts`

- [ ] **Step 1: Write the dual-engine behavior tests**

Cover equilibrium, phase coupling, sensor truth separation, every trip kind, and
sample shape:

```ts
it("holds the approved dual-inventory equilibrium", () => {
  let engine = createEngine(
    DEFAULT_SIMULATION,
    DEFAULT_DUAL_PID,
    "normal",
    1001,
  );
  for (let index = 0; index < 2_000; index += 1) engine = stepEngine(engine);

  expect(engine.totalLevelPct).toBeCloseTo(50, 8);
  expect(engine.interfaceLevelPct).toBeCloseTo(20, 8);
  expect(engine.controllers.total.valvePositionPct).toBeCloseTo(50, 8);
  expect(engine.controllers.interface.valvePositionPct).toBeCloseTo(50, 8);
});

it("couples water discharge into total level", () => {
  const engine = createEngine(DEFAULT_SIMULATION, DEFAULT_DUAL_PID, "normal", 1001);
  const disturbed = {
    ...engine,
    controllers: {
      ...engine.controllers,
      interface: {
        ...engine.controllers.interface,
        commandPct: 100,
        valvePositionPct: 100,
      },
    },
  };
  const next = stepEngine(disturbed);
  expect(next.interfaceLevelPct).toBeLessThan(engine.interfaceLevelPct);
  expect(next.totalLevelPct).toBeLessThan(engine.totalLevelPct);
});
```

Force each safety threshold with a constructed engine state and assert the exact
`TripKind` string and `tripped` status.

- [ ] **Step 2: Run the engine tests and confirm the old model fails**

Run `npm run test -- lib/simulation/engine.test.ts`.

Expected: FAIL because `createEngine` accepts one PID and owns one inventory.

- [ ] **Step 3: Define the nested controller runtime**

Use one focused internal shape:

```ts
interface ControllerRuntime {
  measuredValuePct: number;
  commandPct: number;
  valvePositionPct: number;
  pidState: PidState;
  pidTerms: PidTerms;
  controllerElapsedS: number;
  sensorElapsedS: number;
}

export interface EngineState {
  config: SimulationConfig;
  pidConfig: DualPidConfig;
  scenarioId: ScenarioId;
  rngState: number;
  status: SimulationStatus;
  trip: TripKind;
  timeS: number;
  controllers: Record<LoopId, ControllerRuntime>;
  oilVolumeM3: number;
  waterVolumeM3: number;
  totalLevelPct: number;
  interfaceLevelPct: number;
  oilLayerPct: number;
  flows: PhaseFlows;
  sampleElapsedS: number;
  samples: SimulationSample[];
}
```

Through Task 7, accept `PidConfig | DualPidConfig` in `createEngine` and normalize
a legacy single PID into two copies. This keeps the existing Worker green until
Task 8 changes its protocol. Emit both nested loop values and the deprecated flat
total-level aliases through Task 12. Make `total`, `interface`, phase volumes,
`oilLayerPct`, `flows`, and `safety` required `SimulationSample` fields in this
task.

- [ ] **Step 4: Initialize exact phase equilibrium**

Calculate water volume from `20%`, total volume from `50%`, and oil volume from
their difference. Initialize both measured values at truth, both commands and
positions at `50%`, and both PID states with `createPidState()`. Create the first
sample through the same `makeSample` function used for subsequent samples.

- [ ] **Step 5: Implement one deterministic engine step**

Perform operations in this order:

1. Advance fixed simulation time.
2. Read scenario state.
3. Sample total and interface sensors from consecutive seeded PRNG draws.
4. Step each PID when its `0.2 s` controller clock expires.
5. Step the oil and water actuators independently.
6. Split feed and calculate phase outlet flows.
7. Integrate oil and water inventories.
8. Convert inventories to interface, total, and oil-layer levels.
9. Evaluate trips in the documented order: total HH, total LL, interface HH,
   interface LL, then oil-layer LL.
10. Emit a chart sample every `0.2 s` and retain at most 900.

Keep the current `runToEnd` and `finishEngine` public functions. Change their PID
argument to `DualPidConfig`.

- [ ] **Step 6: Run engine, PID, actuator, and type checks**

Run:

```bash
npm run test -- lib/simulation/engine.test.ts lib/simulation/pid.test.ts lib/simulation/actuator.test.ts
npm run typecheck
```

Expected: all commands pass; the model remains finite and deterministic.

- [ ] **Step 7: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 6: Calculate dual-loop metrics and score

**Files:**
- Modify: `lib/simulation/metrics.ts`
- Modify: `lib/simulation/metrics.test.ts`
- Modify: `lib/simulation/scoring.ts`
- Modify: `lib/simulation/scoring.test.ts`
- Modify: `lib/simulation/types.ts`

- [ ] **Step 1: Write failing metric tests**

Define fixture samples with known total/interface errors and valve changes. Assert:

```ts
expect(metrics.loops.total.mae).toBeCloseTo(5, 8);
expect(metrics.loops.interface.mae).toBeCloseTo(2, 8);
expect(metrics.actuators.oil.travelPct).toBe(40);
expect(metrics.actuators.water.travelPct).toBe(20);
expect(metrics.alarmTimeS).toBe(0.4);
expect(metrics.recoveryTimeS).toBe(12);
```

Add a joint-recovery case in which total enters band first but the timer starts
only when both loops remain in band for 10 seconds. Add a case proving overlapping
alarms count once per sample.

- [ ] **Step 2: Write failing score tests**

Create exact `RunMetrics` objects and assert the approved formulas:

```ts
expect(calculateScore(perfectMetrics).total).toBe(100);
expect(calculateScore(interfaceTripMetrics).total).toBeLessThanOrEqual(35);
expect(calculateScore(twoOscillatingLoops).modifiers).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ id: "total-oscillation", points: -5 }),
    expect.objectContaining({ id: "interface-oscillation", points: -5 }),
  ]),
);
```

- [ ] **Step 3: Run both suites and confirm the single-loop shape fails**

Run:

```bash
npm run test -- lib/simulation/metrics.test.ts lib/simulation/scoring.test.ts
```

Expected: FAIL because metrics and scoring still read flat single-loop fields.

- [ ] **Step 4: Implement nested metrics**

Define:

```ts
export interface LoopMetrics {
  mae: number;
  maximumPct: number;
  minimumPct: number;
  targetBandTimeOutsideS: number;
  stabilityStdDev: number;
  oscillationCrossings: number;
  oscillationPeakToPeakPct: number;
}

export interface ActuatorMetrics {
  travelPct: number;
  saturationTimeS: number;
  integralLimitTimeS: number;
}

export interface PhaseRunTotals {
  oilInletM3: number;
  waterInletM3: number;
  oilOutletM3: number;
  waterOutletM3: number;
  finalOilVolumeM3: number;
  finalWaterVolumeM3: number;
}

export interface RunMetrics {
  alarmTimeS: number;
  recoveryTimeS: number;
  settled: boolean;
  minimumOilLayerPct: number;
  loops: Record<LoopId, LoopMetrics>;
  actuators: Record<PhaseId, ActuatorMetrics>;
  phaseTotals: PhaseRunTotals;
  trip: TripKind;
  /** @deprecated Flat total-loop aliases removed in Task 13. */
  mae: number;
  maximumLevelPct: number;
  minimumLevelPct: number;
  targetBandTimeOutsideS: number;
  stabilityStdDev: number;
  oscillationCrossings: number;
  oscillationPeakToPeakPct: number;
  overshootPct: number;
  valveTravelPct: number;
  saturationTimeS: number;
  integralLimitTimeS: number;
}
```

Compute loop statistics with one shared helper. Use true values for all process
metrics and actual positions for travel. Integrate each phase flow over sample
time for `PhaseRunTotals`. Evaluate the last 60 seconds for stability and
oscillation. Populate the deprecated aliases from the total loop and oil actuator
through Task 12 so the old result surface remains functional.

- [ ] **Step 5: Implement the approved combined score**

Use the exact formulas from the design specification. Emit per-loop modifier IDs:

```ts
type ScoreModifierId =
  | "trip"
  | "total-oscillation"
  | "interface-oscillation"
  | "oil-saturation"
  | "water-saturation"
  | "oil-travel"
  | "water-travel"
  | "total-windup"
  | "interface-windup";
```

Select diagnosis by trip, active modifier, or largest normalized base loss. Name
the controlling loop or actuator in both diagnosis and suggestion. Remove legacy
`LL` and `HH` values from `TripKind`; no engine or score path may emit them now.

- [ ] **Step 6: Run metric, score, and engine tests**

Run:

```bash
npm run test -- lib/simulation/metrics.test.ts lib/simulation/scoring.test.ts lib/simulation/engine.test.ts
npm run typecheck
```

Expected: all commands pass.

- [ ] **Step 7: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 7: Regenerate deterministic golden runs

**Files:**
- Modify: `lib/simulation/__fixtures__/golden-runs.json`
- Modify: `lib/simulation/engine.test.ts`
- Modify: `lib/simulation/scenarios.test.ts`

- [ ] **Step 1: Add a golden-run serializer test**

For each scenario, serialize seed, final time, status, trip, both final levels,
both valve positions, both MAEs, both travel totals, and score. Round stored
floating-point values to six decimals.

```ts
const summary = {
  scenarioId,
  seed: scenario.seed,
  status: run.status,
  trip: run.result.metrics.trip,
  finalTotalLevelPct: round6(finalSample.total.processValuePct),
  finalInterfaceLevelPct: round6(finalSample.interface.processValuePct),
  finalOilValvePct: round6(finalSample.total.valvePositionPct),
  finalWaterValvePct: round6(finalSample.interface.valvePositionPct),
  totalMae: round6(run.result.metrics.loops.total.mae),
  interfaceMae: round6(run.result.metrics.loops.interface.mae),
  score: run.result.score.total,
};
```

- [ ] **Step 2: Run the golden test against the old fixture**

Run `npm run test -- lib/simulation/engine.test.ts`.

Expected: FAIL with a fixture mismatch for all six migrated scenarios.

- [ ] **Step 3: Regenerate the fixture through the tested engine**

Use the existing fixture-generation path in the engine test. If it is inline,
extract a deterministic `goldenSummary` helper inside the test file, run Vitest
once with its documented update environment variable, and inspect every changed
value before retaining the JSON.

Run:

```bash
UPDATE_GOLDEN=1 npm run test -- lib/simulation/engine.test.ts
npm run test -- lib/simulation/engine.test.ts lib/simulation/scenarios.test.ts
```

Expected: the first command rewrites only `golden-runs.json`; the second passes
without rewriting it.

- [ ] **Step 4: Prove replay-speed invariance at the runtime boundary**

Add a runtime test that completes the same seeded run at `0.5x`, `1x`, `2x`, and
`4x`, then compares the final sample and full result with `toEqual`. Add a second
test comparing one `tick(5)` call with 100 `tick(0.05)` calls to cover tab-delay
catch-up without changing physical state.

- [ ] **Step 5: Run the deterministic suites**

Run:

```bash
npm run test -- lib/simulation/engine.test.ts lib/simulation/scenarios.test.ts lib/simulation/worker-runtime.test.ts
```

Expected: every scenario and speed produces an identical replay for its seed.

- [ ] **Step 6: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 8: Migrate the Worker protocol and React simulation hook

**Files:**
- Modify: `lib/simulation/types.ts`
- Modify: `lib/simulation/worker-runtime.ts`
- Modify: `lib/simulation/worker-runtime.test.ts`
- Modify: `workers/simulation.worker.ts`
- Modify: `hooks/use-simulation.ts`
- Modify: `components/game-dashboard.tsx`
- Modify: `components/game-dashboard.test.tsx`

- [ ] **Step 1: Update Worker tests first**

Initialize with `DEFAULT_DUAL_PID`, assert the ready sample contains `total`,
`interface`, `flows`, and `oilLayerPct`, and keep stale-run, pause, reset, and
speed assertions. Add:

```ts
expect(ready.sample.total.processValuePct).toBe(50);
expect(ready.sample.interface.processValuePct).toBe(20);
expect(ready.sample.flows.oilOutletM3H).toBe(35);
expect(ready.sample.flows.waterOutletM3H).toBe(15);
```

- [ ] **Step 2: Run the Worker tests and confirm the protocol mismatch**

Run `npm run test -- lib/simulation/worker-runtime.test.ts`.

Expected: FAIL because `initialize.pid` still accepts one `PidConfig`.

- [ ] **Step 3: Change the typed protocol**

Change only `initialize`:

```ts
type WorkerRequest =
  | {
      type: "initialize";
      runId: string;
      config: SimulationConfig;
      pid: DualPidConfig;
      scenarioId: ScenarioId;
      seed: number;
    }
  | { type: "start"; runId: string }
  | { type: "pause"; runId: string }
  | { type: "reset"; runId: string }
  | { type: "set-speed"; runId: string; speed: number };
```

Keep Worker events and run-ID filtering structurally unchanged; their sample and
result payloads inherit the new domain types. Remove the temporary
`PidConfig | DualPidConfig` engine input, require `DualPidConfig`, and delete the
deprecated single-liquid `outletFlow` function after the Worker compiles against
the new engine.

- [ ] **Step 4: Update `useSimulation`**

Accept `DualPidConfig`, sanitize it before posting, and replace the manual
single-liquid `INITIAL_SAMPLE` with a complete dual sample matching the approved
equilibrium. Keep Start disabled until the Worker emits `ready`. Continue to cap
React history at 900 samples. As a compile-safe bridge, change the dashboard state
to `DEFAULT_DUAL_PID`, pass `pid.total` to the old single dock, update only
`pid.total` from that dock, and pass the full dual configuration to
`useSimulation`. Task 9 replaces this temporary dock with both controls.

- [ ] **Step 5: Run hook consumers, Worker tests, and typecheck**

Run:

```bash
npm run test -- lib/simulation/worker-runtime.test.ts components/game-dashboard.test.tsx
npm run typecheck
```

Expected: Worker tests, dashboard tests, and typecheck pass. Deprecated flat
sample properties keep the old visual consumers working through Task 12.

- [ ] **Step 6: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 9: Build the accessible dual-loop control deck

**Files:**
- Modify: `components/pid-controls.tsx`
- Modify: `components/pid-controls.test.tsx`
- Create: `components/dual-pid-controls.tsx`
- Create: `components/dual-pid-controls.test.tsx`
- Modify: `components/scenario-selector.tsx`
- Modify: `components/scenario-selector.test.tsx`

- [ ] **Step 1: Write component tests for independent tuning**

Render both docks and change total Kp without changing interface Kp:

```tsx
await user.clear(screen.getByLabelText("Total level proportional gain"));
await user.type(screen.getByLabelText("Total level proportional gain"), "6");

expect(onChange).toHaveBeenLastCalledWith({
  total: expect.objectContaining({ kp: 6 }),
  interface: DEFAULT_DUAL_PID.interface,
});
```

Assert all six gain controls lock during running and paused states, transport
buttons retain their current state rules, and each field has a visible loop name,
unit, range, and focusable label.

- [ ] **Step 2: Run tests and observe the single-loop component**

Run:

```bash
npm run test -- components/pid-controls.test.tsx components/dual-pid-controls.test.tsx
```

Expected: FAIL because the dual coordinator does not exist.

- [ ] **Step 3: Make `PidControls` a reusable instrument dock**

Give it this public interface:

```ts
interface PidControlsProps {
  loopId: LoopId;
  title: string;
  tag: string;
  accent: "oil" | "water";
  config: PidConfig;
  sample: LoopSample;
  locked: boolean;
  onChange: (config: PidConfig) => void;
}
```

Keep gain inputs and advanced controls in semantic fieldsets. Remove global
Start/Pause/Reset/speed controls from this component.

- [ ] **Step 4: Add `DualPidControls`**

Accept a `hero: ReactNode` slot, render one shared transport row, then render the
total dock, hero slot, and interface dock inside `process-bay`. Update one nested
PID value immutably:

```ts
const updateLoop = (loop: LoopId, next: PidConfig) => {
  onChange({ ...config, [loop]: next });
};
```

Use `LIC-101` for total level/oil valve and `IIC-101` for interface/water valve.

- [ ] **Step 5: Update scenario copy and tests**

Replace the old IDs and describe the affected phase, sensor, or actuator. Keep the
selector disabled after an attempt starts. Change the dashboard default to
`water-rich-slug`, then remove the five deprecated scenario IDs and their mapping
branches from `types.ts` and `scenarios.ts`.

- [ ] **Step 6: Run component and type checks**

Run:

```bash
npm run test -- components/pid-controls.test.tsx components/dual-pid-controls.test.tsx components/scenario-selector.test.tsx
npm run typecheck
```

Expected: all commands pass after temporary dashboard call sites adopt the new
component signature.

- [ ] **Step 7: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 10: Create the pure scene model and SVG fallback

**Files:**
- Create: `lib/visualization/scene-model.ts`
- Create: `lib/visualization/scene-model.test.ts`
- Modify: `components/process-visualization.tsx`
- Modify: `components/process-visualization.test.tsx`
- Create: `components/process-hero.tsx`
- Create: `components/scene/scene-error-boundary.tsx`

- [ ] **Step 1: Write scene-mapping tests**

```ts
it("maps process percentages to vessel coordinates", () => {
  const model = createSceneModel(sampleAt({ total: 50, interface: 20 }));
  expect(model.totalSurfaceY).toBeCloseTo(0, 10);
  expect(model.interfaceSurfaceY).toBeCloseTo(-0.36, 10);
  expect(model.oilLayerHeightM).toBeCloseTo(0.36, 10);
});

it("uses true flow and valve values for animation", () => {
  const model = createSceneModel(sampleAt({ oilFlow: 70, waterValve: 42 }));
  expect(model.oilFlow.speed).toBeGreaterThan(0);
  expect(model.waterValve.openFraction).toBeCloseTo(0.42, 10);
});
```

Test every trip mapping, zero flow, maximum flow, and clamped out-of-range input.

- [ ] **Step 2: Run the scene-model test and confirm it fails**

Run `npm run test -- lib/visualization/scene-model.test.ts`.

Expected: FAIL because the mapping module does not exist.

- [ ] **Step 3: Implement `createSceneModel`**

Map percentage to a vessel centered at `y = 0`:

```ts
const levelToY = (levelPct: number) =>
  -VESSEL_RADIUS_M + 2 * VESSEL_RADIUS_M * clamp(levelPct / 100, 0, 1);

const chordAtY = (yM: number) =>
  2 * Math.sqrt(Math.max(0, VESSEL_RADIUS_M ** 2 - yM ** 2));

const flowMotion = (flowM3H: number) => {
  const normalized = clamp(Math.abs(flowM3H) / 110, 0, 1);
  return {
    direction: Math.sign(flowM3H),
    speed: normalized < 0.001 ? 0 : 0.08 + 0.32 * normalized,
    visibleFraction: normalized,
  };
};
```

Return water/oil surface positions, chord widths, oil thickness, gas height, three
flow pulse directions and normalized speeds, two valve fractions, and an alarm
presentation with `severity`, `source`, `label`, and `motionEnabled`. Keep the
module free of React and Three.js imports.

- [ ] **Step 4: Upgrade the SVG fallback first**

Render gas, oil, and water regions clipped to the horizontal vessel. Show true and
measured total/interface values, oil and water flow arrows, both valve positions,
the active alarm label, and the educational fallback note. Its root remains a
semantic `section`; the SVG retains a complete generated `aria-label`.

- [ ] **Step 5: Add the client-only hero boundary**

Use `next/dynamic` inside the client component:

```ts
const SeparatorScene = dynamic(
  () => import("./scene/separator-scene").then((module) => module.SeparatorScene),
  { ssr: false },
);
```

Detect WebGL with a temporary canvas before mounting the scene. Render
`ProcessVisualization` when detection fails or `SceneErrorBoundary` catches a
canvas error. Keep the same accessible process summary outside either visual.

- [ ] **Step 6: Run mapping and fallback tests**

Run:

```bash
npm run test -- lib/visualization/scene-model.test.ts components/process-visualization.test.tsx
npm run typecheck
```

Expected: tests pass without requiring a WebGL context in jsdom.

- [ ] **Step 7: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 11: Build the cinematic separator vessel and phase volumes

**Files:**
- Create: `components/scene/use-scene-quality.ts`
- Create: `components/scene/separator-scene.tsx`
- Create: `components/scene/separator-vessel.tsx`
- Create: `components/scene/phase-volumes.tsx`
- Create: `components/scene/alarm-beacon.tsx`
- Modify: `components/process-hero.tsx`

- [ ] **Step 1: Add testable quality-policy functions**

Export a pure selector from `use-scene-quality.ts` and test it through
`scene-model.test.ts`:

```ts
expect(selectSceneQuality({ width: 390, dpr: 3, reducedMotion: false })).toEqual({
  tier: "low",
  dpr: 1,
  shadows: false,
  postprocessing: false,
  animateAmbient: true,
});

expect(selectSceneQuality({ width: 1440, dpr: 2, reducedMotion: true }).animateAmbient)
  .toBe(false);
```

Select `low` below `720px` or above `2.5` device pixel ratio, `medium` below
`1280px`, and `high` otherwise. Cap render DPR at `1`, `1.25`, and `1.5` for low,
medium, and high. Reduced motion overrides `animateAmbient` without hiding current
state.

- [ ] **Step 2: Build the Canvas shell**

Configure:

```tsx
<Canvas
  camera={{ position: [4.8, 2.4, 5.8], fov: 36, near: 0.1, far: 50 }}
  dpr={quality.dpr}
  gl={{ antialias: quality.tier !== "low", alpha: true, powerPreference: "high-performance" }}
  shadows={quality.shadows}
>
```

Use ACES filmic tone mapping, a graphite fog, a cool rectangular key, warm fill,
cyan rim, and locally generated room environment. Constrain `OrbitControls` and
expose a DOM reset-view button through `ProcessHero`. Use distance limits `4.5-8`,
polar limits `0.85-1.75` radians, and azimuth limits `-0.9-0.9` radians around the
designed camera target.

- [ ] **Step 3: Model the procedural vessel**

Assemble cylinder sections, spherical or ellipsoidal heads, ring flanges, nozzles,
legs, base plates, weld rings, and nameplate. Orient the vessel along the X axis.
Use `MeshStandardMaterial` for painted structure and `MeshPhysicalMaterial` for
brushed shell and inspection glass. Keep geometry memoized and dispose custom
resources on unmount.

- [ ] **Step 4: Render real phase boundaries**

Use two inner cylinder meshes with local clipping planes and explicit horizontal
surface meshes. Update surface Y positions and chord widths from `SceneModel`.
Apply amber oil and deep-cyan water materials with distinct roughness, opacity,
Fresnel, and depth colors. Bound the gas haze to the region above total liquid.

Drive surface-normal distortion from a decaying amplitude based on level-rate and
feed disturbance. Set amplitude to zero when reduced motion is active or the run
is paused. Never offset the actual phase height.

- [ ] **Step 5: Add restrained post-processing**

Enable `EffectComposer`, thresholded `Bloom`, and a subtle `Vignette` only for the
medium and high tiers. Keep luminance threshold high enough that steel and text do
not bloom. Load no remote HDR, model, font, or texture.

- [ ] **Step 6: Verify build and scene mount**

Run:

```bash
npm run typecheck
npm run build
```

Expected: the static build succeeds without `window`, WebGL, or hydration errors.

- [ ] **Step 7: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 12: Animate pipes, valves, and alarm feedback

**Files:**
- Create: `components/scene/process-pipe.tsx`
- Create: `components/scene/control-valve.tsx`
- Modify: `components/scene/alarm-beacon.tsx`
- Modify: `components/scene/separator-scene.tsx`
- Modify: `lib/visualization/scene-model.ts`
- Modify: `lib/visualization/scene-model.test.ts`

- [ ] **Step 1: Extend presentation tests with flow direction and alarms**

Assert inlet pulses move toward the vessel, outlets move away, zero flow stops,
larger flow increases speed, pause freezes pulse phase, alarm preserves source
text, trip stops the beacon, and reduced motion removes pulsing without hiding
state.

- [ ] **Step 2: Implement procedural pipe paths**

Create memoized `CatmullRomCurve3` paths for feed, oil outlet, and water outlet.
Render each with `TubeGeometry`. Move a fixed-size instanced pool of emissive pulse
markers along normalized curve distance:

```ts
const distance = paused
  ? frozenDistance.current
  : (clock.elapsedTime * flow.speed + instanceOffset) % 1;
const point = curve.getPointAt(flow.direction > 0 ? distance : 1 - distance);
```

Scale visible pulse count by normalized flow; do not allocate objects inside
`useFrame`.

- [ ] **Step 3: Implement both control valves**

Build a valve body, disk, stem, and actuator. Rotate the disk and translate the
stem from the clamped actual position, not the command. Label valves `LV-101` and
`WV-101` through sparse DOM labels.

- [ ] **Step 4: Implement layered alarm feedback**

Map safe, alarm, and trip states to beacon material, scene rim-light intensity,
phase marker, and DOM status. Use a slow pulse below 2 Hz for alarm. On trip, hold
the beacon at a constant bright state and freeze process motion. The HUD live
region must announce the same source and severity.

- [ ] **Step 5: Run mapping tests and production build**

Run:

```bash
npm run test -- lib/visualization/scene-model.test.ts
npm run typecheck
npm run build
```

Expected: all commands pass.

- [ ] **Step 6: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 13: Integrate the premium HUD, metrics, charts, and results

**Files:**
- Modify: `components/game-dashboard.tsx`
- Modify: `components/game-dashboard.test.tsx`
- Modify: `components/trend-charts.tsx`
- Modify: `components/result-panel.tsx`
- Modify: `components/result-panel.test.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Write the dashboard and result expectations**

Assert the page exposes both loop values, both valve values, one active alarm
message, all transport controls, and the four chart headings. For results, assert
both loop MAEs, both actuator travels, the exact trip label, modifiers, and the
deterministic recommendation.

- [ ] **Step 2: Run component tests and confirm flat-field failures**

Run:

```bash
npm run test -- components/game-dashboard.test.tsx components/result-panel.test.tsx
```

Expected: FAIL where the old components read `levelPct`, one valve, and flat
metrics.

- [ ] **Step 3: Compose the process bay**

Replace the old two-column dashboard grid with:

```tsx
<DualPidControls
  config={pid}
  sample={sample}
  hero={<ProcessHero sample={sample} status={simulation.status} />}
  locked={locked}
  ready={simulation.ready}
  speed={simulation.speed}
  status={simulation.status}
  onChange={setPid}
  onPause={simulation.pause}
  onReset={simulation.reset}
  onResume={simulation.resume}
  onSpeedChange={simulation.setSpeed}
  onStart={simulation.start}
/>
```

Keep scenario and transport controls above the process bay. Derive live values
with one memoized pass through the retained sample history. Announce only safety
severity transitions through `aria-live`, not every numeric update.

- [ ] **Step 4: Replace the four synchronized charts**

Render these headings and series:

1. `Total liquid level`: truth, measurement, setpoint, alarms, and trips.
2. `Oil/water interface`: truth, measurement, setpoint, alarms, and trips.
3. `Phase flows`: total feed, oil inlet/outlet, water inlet/outlet, and water cut
   on a percentage axis.
4. `Valve response`: both commands and both actual positions.

Use shared time-domain synchronization, visible legends, units, and color plus
dash-pattern distinctions.

- [ ] **Step 5: Expand results and coaching**

Show the five base categories, per-loop tracking/stability, per-actuator effort,
every applied modifier, rank, diagnosis, and suggestion. The primary diagnosis
must identify total level, interface, oil valve, or water valve.

- [ ] **Step 6: Apply the industrial cinematic CSS system**

Define semantic custom properties for graphite surfaces, steel rules, oil amber,
water cyan, safe, warning, alarm, and text. Use a three-column process bay at
large widths, two PID columns under the scene at medium widths, and one vertical
flow below `720px`. Give the scene the largest minimum height, keep DOM controls
opaque enough to read, and avoid stacking translucent cards over the vessel.

Provide visible focus, `44px` minimum interactive dimensions, high-contrast
disabled states, tabular numerals, and explicit `prefers-reduced-motion` rules.

- [ ] **Step 7: Remove the compatibility bridge**

Delete deprecated flat fields from `SimulationSample`, `SimulationConfig`,
`ScenarioState`, and `RunMetrics`. Delete every assignment that populated those
fields. Search production and tests for the removed identifiers and convert the
last call sites to `sample.total`, `sample.interface`, `sample.flows`, nested
metrics, and phase-specific configuration.

- [ ] **Step 8: Run all component tests and build**

Run:

```bash
npm run test -- components
npm run typecheck
npm run build
```

Expected: component tests pass; the production build succeeds.

- [ ] **Step 9: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 14: Add end-to-end coverage and visual-browser verification

**Files:**
- Modify: `tests/e2e/game.spec.ts`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Update the primary Playwright flow**

Test this exact sequence against `http://localhost:3000`:

1. Select `Water-rich slug`.
2. Set total Kp to `5` and interface Kp to `3`.
3. Start and verify both docks lock.
4. Pause and verify simulation time stops.
5. Resume at `4x` and verify time advances.
6. Reset and verify both levels return to `50%` and `20%`.
7. Complete a deterministic run and inspect both result sections.

- [ ] **Step 2: Add total and interface trip flows**

Extend the existing `interceptSimulationConfig` Worker proxy. For the total trip,
set `durationS: 5`, `totalHighAlarmPct: 40`, and `totalHighHighPct: 49.99`. For the
interface trip, set `durationS: 5`, `interfaceHighAlarmPct: 19`, and
`interfaceHighHighPct: 19.99`. Start at `4x` and assert `TOTAL_HH` or
`INTERFACE_HH`, terminal status, the trip modifier, and a score no greater than
35. Do not add a production query parameter or hidden control.

- [ ] **Step 3: Add WebGL fallback coverage**

Inject this before page code:

```ts
await page.addInitScript(() => {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    if (type === "webgl" || type === "webgl2") return null;
    return original.call(this, type, options);
  } as typeof original;
});
```

Assert the SVG fallback, both PID docks, Start, and trends remain available.

- [ ] **Step 4: Add responsive and reduced-motion checks**

At `390x844`, assert the hero appears before both PID docks in reading order,
controls fit without horizontal page overflow, and all transport buttons remain
visible. Emulate reduced motion and assert the canvas exposes the static-motion
state through a stable data attribute while process values still update.

Add a WebGL context-loss case in the desktop Chromium project. Acquire
`WEBGL_lose_context`, call `loseContext()`, and assert the semantic HUD, Worker
time, Pause, and Reset remain usable. Call `restoreContext()` when the extension
supports it and assert either the recovered canvas or the functional SVG fallback
is visible; the run ID and process time must not reset.

- [ ] **Step 5: Run Playwright**

Run:

```bash
npm run test:e2e
```

Expected: every existing and new scenario, trip, fallback, and responsive test
passes. The intentional trip-completion incompatibility remains represented as a
single documented skip only if the existing suite still needs it.

- [ ] **Step 6: Inspect the running app in a real browser**

Run `npm run dev`, open `http://localhost:3000`, and inspect desktop, tablet, and
mobile widths. Confirm phase boundaries, clipped fluids, valve travel, flow
direction, alarm source, camera limits, reset view, pause, reduced motion, text
contrast, and absence of runtime network requests.

- [ ] **Step 7: Checkpoint**

Run `git diff --check && git status --short`; leave all files unstaged.

## Task 15: Update model, scoring, architecture, and project documentation

**Files:**
- Modify: `PLAN.md`
- Modify: `README.md`
- Modify: `docs/physical-model.md`
- Modify: `docs/scoring.md`
- Create: `docs/adr/0003-separate-deterministic-physics-from-webgl-rendering.md`
- Modify: `memory/context.md`
- Modify: `memory/learnings.md`

- [ ] **Step 1: Replace obsolete single-liquid statements**

Search first:

```bash
rg -n "single liquid|one equivalent|no oil/water|interface excluded|liquid-slug|reduced-capacity|valve-delay|noisy-transmitter" README.md PLAN.md docs memory lib components tests
```

Update every user-facing and canonical reference to the approved dual-inventory
model and scenario names. Historical design records may retain old text only when
their status clearly marks it as superseded.

- [ ] **Step 2: Document exact equations and limits**

In `docs/physical-model.md`, include circular-segment inventory, feed split, both
head equations, both phase balances, PID defaults, actuator limits, safety
thresholds, scenario functions, and every explicit exclusion.

- [ ] **Step 3: Document exact score calculation**

In `docs/scoring.md`, include both normalization denominators, joint recovery,
union alarm time, per-loop oscillation thresholds, per-actuator modifiers, trip
cap, rank bands, and diagnosis selection.

- [ ] **Step 4: Record the architecture decision**

The ADR must state:

- Context: deterministic educational outcomes and a cinematic WebGL scene have
  different timing and failure modes.
- Decision: physics remains in the Worker; React receives immutable samples;
  Three.js consumes a one-way interpolated presentation model.
- Consequences: frame rate cannot alter score, WebGL can fail independently, the
  SVG fallback remains functional, and render code cannot import engine mutation
  functions.

- [ ] **Step 5: Update durable memory**

Set the active focus to final verification. Add only non-obvious implementation
findings to `memory/learnings.md`, one dated entry per finding.

- [ ] **Step 6: Check prose and repository references**

Run:

```bash
rg -n "T[B]D|T[O]DO|F[I]XME|e[n]g_dacs|/U[s]ers/|single equivalent liquid" README.md PLAN.md docs/physical-model.md docs/scoring.md docs/adr lib components tests/e2e
git diff --check
```

Expected: no placeholder, private path, private repository reference, obsolete
runtime claim, or whitespace error.

- [ ] **Step 7: Checkpoint**

Run `git status --short`; leave all documentation unstaged.

## Task 16: Run the complete quality gate and review the finished experience

**Files:**
- Modify only files required to correct failures found by this task.

- [ ] **Step 1: Run focused frontend gates**

Run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

Expected: every command exits `0`; no command rewrites tracked files.

- [ ] **Step 2: Run repository governance gates**

Run:

```bash
make check
make ci
```

Expected: Python governance tests, sync checks, security checks, frontend lint,
typecheck, Vitest, production build, and Playwright all pass.

- [ ] **Step 3: Audit boundaries and generated output**

Run:

```bash
rg -n "fetch\(|axios|XMLHttpRequest|WebSocket" app components hooks lib workers
rg -n "e[n]g_dacs|/U[s]ers/|api[_-]?key" app components hooks lib workers tests/e2e README.md PLAN.md docs/physical-model.md docs/scoring.md docs/adr
npm audit --audit-level=high
git diff --check
git status --short
```

Expected: no runtime network call, private repository dependency, private path,
credential, high-severity npm advisory, or whitespace error. Expected local
WebSocket mentions in tooling documentation must not appear in application
runtime code.

- [ ] **Step 4: Perform the acceptance pass**

Verify these outcomes in the browser:

- The separator dominates the composition and reads as an industrial object.
- Gas, oil, and water remain distinct at all safe levels.
- Both PID docks stay readable while the scene moves.
- Pipe direction, valve position, alarms, and trips match HUD numbers.
- Pause and reduced motion behave as documented.
- Mobile layout has no horizontal page overflow.
- WebGL failure leaves a complete playable simulator.
- The result explains both loops and names the largest loss.

- [ ] **Step 5: Finish the working-tree handoff**

Run `git status --short` and summarize changed files, test results, known visual
trade-offs, and manual review points. Do not run `git add`, `git commit`,
`git push`, or any branch-integration command.
