# PID Learning Coach Design

**Status:** Approved in conversation on 2026-07-21  
**Scope:** Add practical PID learning, contextual diagnosis, educational presets,
and reproducible debriefs to the existing onboarding and challenge UI.

## Purpose

Players should learn to observe a response, change one parameter, repeat the
same deterministic scenario, and compare the full result. The feature must keep
the industrial visual language, the central 3D separator, and the current
simulation engine intact.

## Verified controller behavior

The current controller is a parallel-gain PID evaluated every `0.2 s`:

```text
u = bias + Kp(PV - SP) + Ki ∫(PV - SP)dt + Kd filtered(dPV/dt)
```

The sign is reverse acting because larger oil or water outlet opening lowers the
corresponding level. Educational material may define `e = SP - PV`, but must
state that this simulator uses reverse process action for outlet valves. The
implementation already clamps output to `0–100%`, limits integral contribution,
uses conditional integration anti-windup, calculates derivative on measurement,
and filters it with a first-order time constant. Actuators add first-order lag
and a stroke-rate limit.

## Experience

The primary screen remains concise. Long content lives in expandable education
components and opens in a mobile drawer or modal. All new visible prose is in
English and comes from centralized data.

- Each PID dock provides a short loop explanation and compact Kp/Ki/Kd help.
- `PID theory` explains the parallel form and warns against mixing it with
  proportional band, reset time, or derivative time without conversion.
- `Manual PID tuning` extends the existing guided tour: repeat one scenario and
  seed, set Ki/Kd to zero, tune Kp, add Ki, then add Kd only if justified.
- `How do I diagnose the response?` maps sluggish response, offset, overshoot,
  oscillation, hunting, saturation, and noise to cautious conceptual actions.
- A `Control Coach` and `Tuning debrief` read metrics, never reveal an optimal
  gain, and compare only compatible attempts with the same scenario and seed.
- `Learn more` centralizes the approved technical references and external links.

## Educational presets and benchmarks

The public presets are `Training default`, `Conservative`, `Aggressive`, and
`Untuned P-only`. Training default is deliberately safe and slow, uses `Kd = 0`,
and remains improvable. A reproducible benchmark runs all presets over the six
existing scenarios and evaluates safety, tracking, ITAE, overshoot, settling,
saturation, travel, and crossings. It chooses educational behavior, not a single
public optimum. A separate internal reference is allowed for tests only.

## Boundaries

- Reuse `useSimulation`, scenarios, Worker results, and existing metrics.
- Add analysis metrics in pure simulation modules only when a required value is
  not already available; do not duplicate the engine in UI code.
- Do not change seeds, fixed physical time step, scoring determinism, or the
  existing safety-first score semantics.
- Extend PID tests for high/low saturation, unwind recovery, derivative noise,
  and derivative filtering. Document the anti-windup strategy in code.
- Do not expose an “Optimal” preset, automatic tuning, or a formula claimed to
  be universally correct.

## Validation

Unit tests cover controller behavior, preset benchmark reproducibility, coach
classification, and attempt-compatibility comparison. Component tests cover
help, theory, diagnosis, debrief, mobile disclosure, and tour steps. Playwright
checks the existing onboarding flow plus a deterministic repeat-and-compare
attempt. Each independently shippable phase runs lint, typecheck, tests, build,
and repository gates.
