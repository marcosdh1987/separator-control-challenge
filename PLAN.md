# Separator Control Challenge Implementation Plan

## 1. Relevant engineering concepts

Use liquid inventory conservation, horizontal-vessel geometry, a monotonic
liquid-valve relationship, reverse-acting PID control, output saturation,
anti-windup, actuator dynamics, sampled measurement noise, and repeatable
disturbance scenarios. All equations and constants are independently expressed
for this educational application.

## 2. Reduced-order physical model

Integrate `dV/dt = Qin - Qout` at a fixed 0.05 s step in SI units. Convert volume
to level with circular-segment geometry for a generic 1.2 m diameter, 3.0 m long
horizontal vessel. The outlet valve uses opening, constant pressure differential,
and hydrostatic head. A first-order actuator applies finite lag and stroke rate.

## 3. Simplifications and limitations

Model one equivalent incompressible liquid with constant density. Exclude phase
separation, gas-cap dynamics, oil/water interface, heat or mass transfer, variable
fluid properties, piping networks, relief systems, and equipment sizing. Never
claim field, safety, or control-system suitability.

## 4. Frontend architecture

Build a standalone Next.js/TypeScript application. Keep the simulation domain in
pure modules, run the stateful fixed-step engine in a Web Worker, and render only
sample batches in React. Use Tailwind CSS, Recharts, Vitest, Testing Library, and
Playwright. No backend, database, authentication, telemetry, or runtime LLM.

## 5. Game mechanics

Players choose one of six seeded scenarios, configure PID gains, and start a
180 s attempt. Gains lock while an attempt runs. Pause, resume, reset, and
0.5x-4x playback preserve the exact simulated trajectory. Crossing LL or HH
terminates the attempt.

The valve-delay scenario combines its 12 s actuator time constant with the same
50-to-70 m3/h inlet step used by the nominal comparison, making lag observable.

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
