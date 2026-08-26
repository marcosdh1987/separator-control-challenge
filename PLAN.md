# Separator Control Challenge Implementation Plan

## 1. Relevant engineering concepts

Use liquid inventory conservation, horizontal-vessel geometry, a monotonic
liquid-valve relationship, reverse-acting PID control, output saturation,
anti-windup, actuator dynamics, sampled measurement noise, and repeatable
disturbance scenarios. All equations and constants are independently expressed
for this educational application.

## 2. Reduced-order physical model

Integrate two-phase inventory `dV_oil/dt = Q_oil_in - Q_oil_out` and
`dV_water/dt = Q_water_in - Q_water_out` at fixed 0.05 s steps in SI units.
Convert volumes to total level and interface level with circular-segment geometry
for a 1.2 m diameter, 3.0 m long horizontal vessel. Two outlet valves (oil and water)
account for opening, reference pressure differential, and hydrostatic heads of both
phases. First-order actuators apply finite lag (default 3 s, configurable per valve)
and stroke rate limits (default 20 %/s).

## 3. Simplifications and limitations

Model two immiscible incompressible liquids (oil and water) with constant densities.
Exclude gas phase, phase coalescence (rag layers), emulsification, compressibility,
flashing, VLE, heat or mass transfer, variable fluid properties, piping networks,
relief systems, real valve sizing, and sensor hysteresis. Never claim field, safety,
or control-system suitability.

## 4. Frontend architecture

Build a standalone Next.js/TypeScript application. Keep the simulation domain in
pure modules, run the stateful fixed-step engine in a Web Worker, and render only
sample batches in React. Use Tailwind CSS, Recharts, Vitest, Testing Library, and
Playwright. No backend, database, authentication, telemetry, or runtime LLM.

## 5. Game mechanics

Players choose one of six seeded scenarios, configure dual PID gains (total level and
interface), and start a 180 s attempt. Gains lock while an attempt runs. Pause, resume,
reset, and 0.5x–4x playback preserve the exact simulated trajectory. Crossing any
low-low or high-high alarm on total level, interface, or oil layer terminates the attempt.

Six scenarios with increasing difficulty:

1. **Normal**: Steady oil and water feed; nominal sensors and outlet valves.
2. **Feed step**: Total inlet rises from 50 to 70 m³/h at 30 s.
3. **Water-rich slug**: Inlet feed rises and water cut increases smoothly from 35 to 55 s.
4. **Oil outlet restriction**: Oil valve capacity falls to 60% at 45 s.
5. **Slow water dump**: Water valve actuator time constant increases to 12 s; water cut
   steps from 30% to 50% at 30 s.
6. **Noisy interface**: Interface sensor adds ±1.5% noise with 0.5 s sample hold.

## 6. Scoring system

Score safety (35), tracking (25), stability (15), recovery (15), and valve
efficiency (10). Apply explicit penalties for trips, sustained oscillation,
prolonged saturation, excessive valve travel, and integral limiting. See
`docs/scoring.md` for the complete reproducible formula.

## 7. Testing strategy

Use test-first unit coverage for geometry, PID, actuator, scenarios, engine,
metrics, and scoring. Add deterministic trajectory fixtures, accessible component
tests, and Playwright flows for run controls, completion, trip, and responsive UI.
The repository gate runs both Python governance and frontend checks.

## 8. MVP milestones

1. Bootstrap and document the standalone project.
2. Implement and verify the deterministic simulation core.
3. Add scenarios, metrics, scoring, and Worker protocol.
4. Build the responsive process dashboard and results experience.
5. Complete unit, component, E2E, privacy, and production-build verification.
