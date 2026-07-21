# ADR-0002: Run the simulation in a Web Worker

- **Status:** Accepted
- **Date:** 2026-07-20
- **Deciders:** Project owner and implementation team
- **Related:** [Implementation plan](../../PLAN.md), [physical model](../physical-model.md)

## Context

The game must integrate a deterministic process model at a fixed 0.05-second step
while React renders controls, a process mimic, metrics, and four trend charts. The
playback speed may change, but it must never change the physical trajectory. The
application must also remain standalone, with no backend or private runtime
dependency.

## Decision

We will keep geometry, PID, actuator, scenarios, metrics, and scoring as pure
TypeScript modules under `lib/simulation/`. A dedicated Web Worker will own the
mutable engine state and fixed-step playback budget. React will communicate with
the Worker through typed messages carrying run identifiers, and it will ignore
events from obsolete attempts.

## Consequences

Process integration cannot block the UI thread, and deterministic tests can execute
the same engine without a browser. Playback speed remains separate from physics.
The UI must wait for Worker readiness before enabling Start, and browser tests must
exercise the Worker bundle rather than replacing it with a page-thread simulator.
There is no server-side persistence or shared leaderboard.

## Alternatives considered

- **Run the engine in React state** — rejected because render scheduling would be
  coupled to physics and could make playback nondeterministic or unresponsive.
- **Run the simulation on a backend** — rejected because it adds deployment,
  latency, privacy, and availability concerns without benefiting this standalone
  educational challenge.
- **Use variable-step integration tied to animation frames** — rejected because
  device performance and playback speed would change the scored trajectory.
