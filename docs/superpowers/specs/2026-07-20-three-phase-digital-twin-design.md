# Oil-Water Separator Digital Twin Hero Design

**Status:** Approved in conversation on 2026-07-20  
**Scope:** Replace the single-liquid process mimic with a real-time Three.js hero
scene and extend the educational model to independent oil and water inventories
controlled by two PID loops.

## 1. Purpose

This release should make Separator Control Challenge feel like a premium,
cinematic digital twin without weakening its engineering value. A large 3D
separator will become the visual anchor. The control surface, trends, alarms, and
results will remain accessible 2D interface elements.

The scene must visualize real simulation values. Oil and water levels, inlet and
outlet flows, valve positions, disturbances, and alarms must come from the Web
Worker. Cosmetic motion may make those values easier to read, but it must never
alter the physics or imply an unmodeled process variable.

## 2. Goals and non-goals

### Goals

- Render a real Three.js separator with industrial materials, deliberate
  lighting, restrained post-processing, and a strong three-quarter composition.
- Simulate and score separate oil and water inventories.
- Give the player two adjustable PID loops: total liquid level and oil/water
  interface.
- Show gas, oil, and water as distinct visual regions inside the vessel.
- Animate pipe flow and valve movement from true simulated values.
- Strengthen alarm feedback without relying on color or disruptive flashing.
- Preserve deterministic fixed-step physics at every playback speed and frame
  rate.
- Keep the experience usable with a keyboard, reduced motion, narrow screens,
  modest GPUs, or no WebGL support.

### Non-goals

- Computational fluid dynamics, multiphase transport, droplet settling,
  coalescence, emulsions, foaming, or entrainment.
- Dynamic gas pressure, compressibility, relief behavior, or pressure control.
- Thermodynamics, heat or mass transfer, chemistry, variable properties, or
  equipment sizing.
- A field-ready digital twin, operator training system, control-system emulator,
  or safety analysis.
- Free-flight camera controls, decorative gauges with no engineering meaning,
  runtime network calls, telemetry, or audio effects.

The application must retain an explicit educational-use disclaimer. The phrase
"digital twin" describes the presentation, not fidelity suitable for a facility.

## 3. Chosen experience

### 3.1 Composition

The desktop control room uses an immersive process-bay composition:

1. A compact status rail presents safety state, time remaining, score, active
   disturbance, and deterministic seed.
2. A transport bar holds scenario selection and Start, Pause, Resume, Reset, and
   playback-speed controls.
3. The hero region places the 3D separator in the center, the total-level PID
   instrument dock on the left, and the interface PID dock on the right.
4. Live engineering metrics and synchronized trends form one analysis deck below
   the hero.
5. The result panel identifies losses by loop and recommends a deterministic
   tuning change.

The central vessel receives the greatest area and contrast. Instrument docks use
straight edges, fine rules, compact typography, and aligned values instead of a
grid of floating cards. At medium widths, the PID docks move below the canvas in
two columns. On small screens, the scene, transport controls, PID docks, metrics,
and trends form one vertical flow.

### 3.2 Art direction

The approved direction is industrial cinematic. The palette uses graphite and
gunmetal for the plant, warm amber for oil, deep cyan for water, soft blue-white
for instrumentation, and orange/red only for safety states. Materials should
look engineered rather than ornamental: brushed steel, dark painted supports,
glass inspection surfaces, restrained roughness variation, and visible flanges
and weld seams.

The camera starts at a slightly low three-quarter angle. A small initial settle
and slow idle parallax add depth. Limited orbit controls permit inspection but
constrain azimuth, elevation, and distance. A visible reset-view control restores
the designed composition.

## 4. Educational process model

### 4.1 Vessel geometry and inventories

The vessel remains a horizontal cylinder with diameter `D = 1.2 m` and length
`L = 3.0 m`. For radius `r = D / 2` and height `h`, the circular-segment area is:

```text
A(h) = r^2 acos((r - h) / r) - (r - h) sqrt(2 r h - h^2)
V(h) = L A(h)
```

The engine stores two nonnegative volumes:

- `waterVolumeM3`
- `oilVolumeM3`

It derives the interface height from `waterVolumeM3` and the total liquid height
from `waterVolumeM3 + oilVolumeM3` through the existing bounded inverse geometry.
The oil-layer thickness is the difference between those heights. These
relationships guarantee `interfaceLevelPct <= totalLevelPct` while both
inventories remain nonnegative.

The initial state is:

- total liquid level and setpoint: `50%`
- water interface and setpoint: `20%`
- oil-layer thickness: `30 percentage points`
- total inlet flow: `50 m3/h`
- inlet water cut: `30%`
- oil density: `850 kg/m3`
- water density: `1000 kg/m3`

The feed splits into phase flows:

```text
Qin_water = Qin_total * waterCut
Qin_oil = Qin_total * (1 - waterCut)
```

Each inventory advances at `dt = 0.05 s`:

```text
Vp(k + 1) = Vp(k) + (Qin_p - Qout_p) dt / 3600
```

The engine bounds requested outlet flow by available phase inventory. Normal runs
trip before either phase reaches a geometric boundary. Defensive bounds prevent
negative inventory or total volume above vessel capacity without creating NaN or
infinite values.

### 4.2 Outlet flows

Each phase has a separate valve. Both use a normalized educational flow law with
`deltaP0 = 1 bar` and `g = 9.80665 m/s2`:

```text
Qout_p = capacityFactor_p * ratedFlow_p * (xv_p / 100)
         * sqrt(head_p / head_p_at_setpoint)

head_oil = deltaP0 + rho_oil g oilLayerHeight
head_water = deltaP0
             + g (rho_water interfaceHeight
                  + rho_oil oilLayerHeight)
```

The nominal rated flows are `70 m3/h` for oil and `30 m3/h` for water. At the
initial condition, 50% opening therefore discharges `35 m3/h` of oil and
`15 m3/h` of water. The initial state is an exact material-balance equilibrium.
The flow law is a stable game mechanic, not a sizing equation.

Each actuator applies an exact first-order lag, a `20 percentage points/s` stroke
limit, and a `0-100%` position clamp. Nominal lag is `3 s`.

### 4.3 Controllers and sensors

The total-level controller drives the oil outlet valve. The interface controller
drives the water outlet valve. Raising either valve position increases discharge,
so both controllers use the same reverse-process-action convention as the current
game. The loops interact through total inventory and hydrostatic head.

Each PID retains these limits:

- `Kp`: `0-10`
- `Ki`: `0-0.3 s^-1`
- `Kd`: `0-30 s`
- default: `Kp 4`, `Ki 0.08 s^-1`, `Kd 8 s`
- controller sample time: `0.2 s`
- output: `0-100%`
- integral contribution: `-40` to `40` output points

Both controllers use filtered derivative on measurement and conditional
anti-windup. The player may tune the controllers independently before a run.
Both configurations lock when the run starts.

The engine keeps true and measured values for both controlled variables. The PID
reads measured values; metrics and trips read true values. Seeded sensor noise is
sampled and held at the scenario-defined interval.

## 5. Scenarios

All scenarios last `180 s`, use public stable seeds, and start from the same
equilibrium. The default challenge is the water-rich slug.

| ID | Seed | Disturbance |
| --- | ---: | --- |
| `normal` | 1001 | `50 m3/h` feed and `30%` water cut for the full run. |
| `feed-step` | 1002 | Total feed steps from `50` to `70 m3/h` at `30 s`; water cut remains `30%`. |
| `water-rich-slug` | 1003 | From `35-55 s`, with `phase = pi * (timeS - 35) / 20`, total feed follows `50 + 60 sin^2(phase) m3/h` and water cut follows `0.30 + 0.35 sin^2(phase)`. |
| `oil-outlet-restriction` | 1004 | Oil outlet capacity falls from `1.0` to `0.6` at `45 s`; the water outlet remains nominal. |
| `slow-water-dump` | 1005 | Water-valve lag is `12 s`; water cut steps from `30%` to `50%` at `30 s` to expose the lag. |
| `noisy-interface` | 1006 | Interface measurement receives seeded uniform `+/-1.5 percentage point` noise with a `0.5 s` sample-and-hold. |

Scenario labels must state the affected phase, measurement, or actuator. The
active-disturbance label must distinguish steady conditions from a disturbance
that has started or ended.

## 6. Safety and scoring

### 6.1 Safety envelope

Total liquid protections retain the existing thresholds:

- low/high alarms: `25%` and `75%`
- low-low/high-high trips: `10%` and `90%`

Water-interface protections are:

- low/high alarms: `8%` and `35%`
- low-low/high-high trips: `3%` and `45%`

An oil-layer thickness below `5 percentage points` also trips the run. This
condition represents water approaching the oil outlet region. Any trip ends the
attempt. The trip identifier records the controlled variable and direction:
`TOTAL_LL`, `TOTAL_HH`, `INTERFACE_LL`, `INTERFACE_HH`, or `OIL_LAYER_LL`.

### 6.2 Metrics

The engine calculates the following metrics from true process values:

- MAE, extrema, time outside target band, standard deviation, setpoint
  crossings, and recovery for both total level and interface.
- Time in any alarm state and the alarm source.
- Oil- and water-valve travel, command saturation, and integral-limit time.
- Oil-layer minimum, total phase inflows and outflows, and final phase inventory.

The total-level target band is `+/-5 percentage points`. The interface target
band is `+/-3 percentage points`. Recovery occurs when both controlled variables
remain inside their bands for `10 continuous seconds` after the disturbance ends.
A run that never achieves joint recovery uses `90 s` for the recovery loss.

Sustained oscillation is evaluated per loop over the final 60 seconds. It requires
at least six setpoint crossings and peak-to-peak error of at least `8 percentage
points` for total level or `6 percentage points` for interface.

### 6.3 Score

The score preserves the current five categories and 100-point maximum:

```text
Safety = trip ? 0 : 35 * (1 - min(anyAlarmSeconds / 45, 1))

TrackingLoss = 0.5 * min(totalMAE / 15, 1)
             + 0.5 * min(interfaceMAE / 10, 1)
Tracking = 25 * (1 - TrackingLoss)

StabilityLoss = 0.5 * min(totalStdDev / 8, 1)
              + 0.5 * min(interfaceStdDev / 5, 1)
Stability = 15 * (1 - StabilityLoss)

Recovery = 15 * (1 - min(jointRecoverySeconds / 90, 1))

TravelLoss = average(
  min(oilValveTravel / 300, 1),
  min(waterValveTravel / 300, 1)
)
SaturationLoss = average(
  min(oilValveSaturationSeconds / 45, 1),
  min(waterValveSaturationSeconds / 45, 1)
)
Valve = 6 * (1 - TravelLoss) + 4 * (1 - SaturationLoss)
```

Modifiers preserve the existing maximum loss but identify the responsible loop:

- trip: cap final score at `35`
- sustained oscillation: `-5` per oscillating loop, up to `-10`
- saturation above `30 s`: `-4` per actuator, up to `-8`
- travel above `300 percentage points`: `-2.5` per actuator, up to `-5`
- integral at limit above `10 s`: `-2.5` per controller, up to `-5`

The engine rounds the final result and clamps it to `0-100`. Existing rank bands
remain unchanged. Diagnosis first reports a trip or active modifier. Otherwise,
it selects the largest normalized loss and names the loop that contributed most.

## 7. Simulation contracts and data flow

The domain remains under `lib/simulation/`. Pure geometry, valve, actuator, PID,
scenario, metric, and scoring functions remain independent of React and Three.js.
Only the engine and Worker runtime own mutable simulation state.

Public contracts will represent both loops explicitly:

- `LoopId = "total" | "interface"`
- `DualPidConfig` with `total` and `interface` `PidConfig` values
- `PhaseFlows` with total feed, water cut, oil inlet/outlet, and water inlet/outlet
- `LoopSample` with true value, measured value, setpoint, error, PID terms,
  command, and valve position
- `SimulationSample` with both loop samples, phase inventories, oil-layer
  thickness, flow data, disturbance text, and safety state
- `LoopMetrics`, `RunMetrics`, `ScoreBreakdown`, and the expanded `TripKind`

The Worker request state machine remains:

```text
idle -> running <-> paused -> completed | tripped
```

`initialize` receives both sanitized PID configurations. `start`, `pause`,
`reset`, and `set-speed` retain their current meanings. Run identifiers continue
to discard stale events. React stores no more than 900 chart samples per run.

The data path is:

```text
PID settings + scenario
        -> validation
        -> Web Worker fixed-step engine
        -> batched deterministic samples
        -> React controller state
        -> 2D HUD, charts, and interpolated 3D presentation
```

The render loop may interpolate the last two samples. It may not extrapolate
process truth or send data back to the simulation.

## 8. Three.js scene design

### 8.1 Scene components

The scene uses React Three Fiber with procedural geometry:

- `SeparatorScene`: canvas setup, camera, quality settings, lights, and scene
  composition.
- `SeparatorVessel`: cylindrical shell, cutaway, heads, nozzles, flanges,
  supports, and nameplate.
- `PhaseVolumes`: clipped inner-cylinder meshes plus explicit water and oil
  surfaces driven by interface and total height.
- `ProcessPipes`: inlet, oil outlet, and water outlet tube paths.
- `FlowPulse`: instanced emissive markers that travel along each path with speed,
  direction, and density derived from flow.
- `ControlValve`: procedural valve body and actuator whose stem or disk follows
  actual valve position.
- `AlarmBeacon`: visible beacon with safe, alarm, and trip states.
- `SceneLabels`: sparse HTML labels for equipment tags and phase values; labels
  duplicate rather than replace the main HUD.

The vessel shell uses an opaque rear section and a transparent inspection
section. This cutaway exposes the phase boundaries without making the entire
vessel look like glass. Fluid meshes use physical transparency, Fresnel response,
subtle depth color, and an explicit horizontal surface. A low-amplitude shader
distorts surface normals. Its amplitude follows the absolute rate of level change
and inlet disturbance, then decays smoothly. It does not change displayed height.

The gas region uses a faint bounded haze and suspended particles. Density stays
constant; the region simply occupies the space above total liquid. No gas value
or pressure trend appears in the HUD.

### 8.2 Lighting and post-processing

The scene uses a cool area key light, a warm low fill, a cyan rim light, soft
contact shadows, and a procedural room environment generated locally. It loads
no remote HDR image or texture. Selective bloom applies only to flow pulses,
instrument accents, and the alarm beacon. Tone mapping, fog, and vignette remain
subtle enough to preserve phase colors and edge detail.

The renderer caps device pixel ratio. An automatic quality tier derived from viewport,
device pixel ratio, and reduced-motion preference may disable contact shadows,
normal distortion, particles, and post-processing. Quality changes never affect
the HUD or simulation.

### 8.3 Motion rules

The experience uses three primary motion systems:

1. Fluid surfaces respond softly to real inventory and flow changes.
2. Pipe pulses and valve mechanisms show real flow and actuator movement.
3. Alarm lighting pulses slowly and stops on trip.

Camera movement remains slow and optional. Pausing freezes process-driven scene
motion. `prefers-reduced-motion` removes idle camera motion, surface distortion,
particle drift, and pulsing light; it preserves instantaneous level, valve, flow,
and alarm state changes.

## 9. HUD and feedback

Each PID dock presents Kp, Ki, Kd, setpoint, process value, output, and compact
P/I/D terms. Locked controls remain readable and explain why they cannot change.
Oil and water use consistent color accents, but every value and alarm also has a
text label, icon, or pattern.

Alarm feedback combines:

- a persistent status-rail message naming the source and severity
- an outline and icon on the responsible PID dock
- a marker beside the affected phase or valve
- a slow beacon and controlled ambient-light change in the scene
- a textual live-region announcement when severity changes

A trip freezes process motion and opens the result summary. It does not shake the
camera or flash the screen. The summary reports the exact trip condition, both
loop trajectories, both actuator costs, the score breakdown, and one deterministic
recommendation.

Charts remain synchronized and readable without WebGL. They cover:

1. total liquid level, measurement, setpoint, alarm limits, and trip limits
2. interface level, measurement, setpoint, alarm limits, and trip limits
3. total feed, water cut, oil flow, and water flow
4. both valve commands and positions

## 10. Accessibility, resilience, and errors

The canvas has a concise accessible description generated from the latest sample.
The same values remain available in semantic HTML. All controls support keyboard
navigation, visible focus, and high contrast. Buttons, sliders, and numeric inputs
provide touch targets at least 44 by 44 CSS pixels.

If WebGL initialization fails, an error boundary replaces the canvas with an
accessible 2D cross-section showing gas, oil, water, flows, and valves. The Worker,
HUD, charts, controls, scoring, and results continue to work. If the Worker fails,
the app keeps Start disabled and shows the existing actionable error state.

The scene must dispose of geometries, materials, render targets, observers, and
animation resources on unmount. It must tolerate an empty sample history, stale
Worker messages, tab suspension, canvas resize, context loss, and restored
context without changing the run result.

## 11. Dependencies and runtime boundaries

Add only the packages needed for the procedural scene:

- `three`
- `@types/three`
- `@react-three/fiber`
- `@react-three/drei`
- `@react-three/postprocessing`
- `postprocessing`

The app remains client-only at runtime. It has no API, database, authentication,
telemetry, asset CDN, external model, private-repository dependency, or runtime
network call. Three.js code loads through a client-only dynamic boundary so the
Next.js static build never accesses browser globals during server rendering.

## 12. Testing and acceptance criteria

### Domain tests

- Circular-segment conversion remains invertible at boundaries and representative
  oil/water states.
- Oil and water mass balances conserve each phase independently.
- The initial state produces `35 m3/h` oil and `15 m3/h` water at 50% valve
  positions.
- Neither phase becomes negative, and interface never exceeds total level.
- Each PID affects only its assigned actuator, with documented physical coupling
  through the inventories.
- Scenario seeds reproduce identical phase trajectories and scores.
- Pause, resume, tab-delay catch-up, and `0.5x-4x` playback produce the same final
  state and score.

### Metric and scoring tests

- Both loops contribute equally to tracking and stability.
- Joint recovery requires ten continuous seconds inside both bands.
- Alarm time counts the union of active alarm conditions, not their sum.
- Each modifier identifies its loop or actuator and respects its maximum loss.
- Every trip kind ends the attempt and caps the score at 35.
- Golden fixtures cover all six scenarios.

### Component and end-to-end tests

- Both PID docks sanitize, lock, and expose their values accessibly.
- Alarm changes update text, icons, live regions, scene state, and result details.
- The scene mounts on a WebGL-capable browser and follows a known sample.
- WebGL failure activates the 2D fallback without disabling the game.
- Playwright covers configuration, start, pause, resume, reset, completion, a
  total-level trip, an interface trip, and responsive navigation.

### Visual and performance acceptance

- The separator is the dominant visual element at desktop and mobile widths.
- Oil, water, and gas remain distinguishable in normal, alarm, reduced-motion,
  and fallback modes.
- HUD text remains readable over every scene state and never lives only inside
  WebGL.
- The scene targets 60 FPS on a modern laptop and remains usable near 30 FPS on a
  modest integrated GPU. Physics and score remain exact at lower frame rates.
- No scene asset or effect performs runtime network I/O.
- `npm run lint`, `npm run typecheck`, Vitest, the production build, Playwright,
  `make check`, and `make ci` pass without rewriting tracked files.

## 13. Documentation changes

Implementation must update `PLAN.md`, `README.md`, `docs/physical-model.md`, and
`docs/scoring.md`. It should add an ADR for the two-inventory model and the strict
separation between deterministic physics and nondeterministic rendering. Durable
workflow discoveries belong in `memory/learnings.md`.

All changes must remain unstaged and uncommitted for manual user review.
