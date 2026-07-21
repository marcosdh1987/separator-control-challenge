# Separator Control Challenge Onboarding Design

**Status:** Approved in conversation on 2026-07-21  
**Scope:** Add a public entry point, guided training, first-run onboarding, and
progressive gameplay guidance without changing simulation physics, scoring, or
the Three.js process scene.

## 1. Purpose

The challenge should explain its mission within 30 seconds, then let a new
player learn the two control loops in under three minutes. Experienced players
must still reach the complete control room immediately.

## 2. Routes and ownership

- `/` renders `LandingPage`, a compact public introduction with an adapted,
  decorative separator hero.
- `/training` renders `TrainingExperience`, a three-step guided flow built on
  the existing deterministic simulation.
- `/challenge` renders `GameDashboard`, the existing full simulator.

Routing owns navigation only. A separate, client-only onboarding store owns
`quickStartDismissed`, `guidedTourDismissed`, and `trainingCompleted`. It reads
and writes `localStorage` only after hydration, so server rendering remains
safe. Simulation state remains entirely in `useSimulation` and its Worker.

## 3. Landing experience

The landing page fits its core message above the first scroll:

- Title: `Separator Control Challenge`.
- Headline: `Can you keep a three-phase separator stable?`
- Description: `Tune two PID control loops, survive realistic well-testing
  disturbances, and keep the process inside its safe operating envelope.`
- Primary CTA to `/training`: `Start guided training`.
- Secondary CTA to `/challenge`: `Enter control room`.

It also shows the three actions—Tune, Survive, Score—the valve-to-variable
mapping, the 50% total-level and 20% interface targets, and the existing
educational disclaimer. The Three.js/SVG presentation is reused as a cinematic
hero; it does not start a simulation or create a second process state.

## 4. Guided training

Training uses one isolated `TrainingExperience` shell with a persistent step
index. It exposes only the controls relevant to each lesson.

1. **Understand the process.** Normal operation runs in observation mode with
   stable controllers. Brief annotations identify total level, interface, both
   outlet valves, setpoints, and the safe envelope.
2. **Tune one loop.** A deterministic oil/water feed step permits edits only to
   total-level `Kp` and `Ki`; `Kd` and the interface controller stay at stable
   values. The lesson gives a balanced starting configuration and short causal
   warnings. A run passes only when it does not trip, its total-level MAE is
   below an explicit threshold, and its time outside band is acceptable.
3. **Full challenge introduction.** Both loops unlock. The lesson explains
   coupling, valve effects, saturation, and valve travel, then offers
   `Enter full challenge`.

Completion sets `trainingCompleted`. Training remains optional: direct entry to
`/challenge` always works.

## 5. Challenge onboarding

On first entry to `/challenge`, a compact `QuickStartModal` states the mission,
the 50%/20% targets, valve responsibilities, the pre-run locking rule, and five
short play steps. It offers `Start guided tour`, `Skip and play`, and `Don't
show again`.

`GuidedTour` is a small internal, accessible spotlight component rather than a
large dependency. It targets scenario selection, total PID, interface PID,
Start, the process view, trends, and score/safety. It supports Back, Next,
Skip, Finish, Escape, focus management, and screen-reader labels. It never
blocks the reset or fallback path if a target is unavailable.

## 6. Progressive disclosure and guidance

Scenario selection groups existing scenarios without locking them:

| Difficulty | Scenarios |
| --- | --- |
| Beginner | Normal operation; Oil/water feed step |
| Intermediate | Slow water-dump actuator; Oil outlet restriction |
| Advanced | Water-rich liquid slug; Noisy interface sensor |

The beginner feed step receives `Start here`. A reusable `DifficultyBadge`
expresses this with text, not color alone.

PID docks add concise causal labels:

- `More valve opening → more oil out → lower total level`
- `More valve opening → more water out → lower interface`

`PidPresetSelector` supplies deterministic, valid Balanced, Conservative, and
Aggressive dual-loop configurations. Presets only populate existing controls;
they neither run a simulation nor promise a score. A pre-run message states
that gains lock once the attempt starts.

The status rail says `Not started` before a run. During a run it says that the
final deterministic score is calculated at completion, optionally with a clearly
labelled provisional performance state. It never calls that value the current
final score.

## 7. Constraints and error handling

- No simulation equations, seeds, Worker protocol, physical step, or score
  formula changes.
- No runtime AI, network call, telemetry, or large tour dependency.
- Preserve the real WebGL hero, its SVG fallback, reduced-motion behavior, and
  existing challenge controls.
- If `localStorage` is unavailable, onboarding falls back to first-visit UI for
  that session without failing navigation or simulation.
- Explanations remain action-oriented; this is not a documentation page.

## 8. Validation

Unit/component tests cover route CTAs, onboarding persistence, quick-start
dismissal, training steps and pass criteria, presets, difficulty labels, and
keyboard tour controls. Playwright covers landing → training → challenge →
beginner scenario → preset → running attempt, alongside existing challenge,
fallback, reduced-motion, and trip coverage.

## 9. Review

This scope adds onboarding state and UI boundaries only. It does not introduce
an alternative simulator or a compatibility bridge. The route split makes the
product easier to understand while retaining the existing challenge unchanged
at `/challenge`.
