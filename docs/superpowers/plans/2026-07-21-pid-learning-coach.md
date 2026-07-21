# PID Learning Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach reproducible manual PID tuning through contextual help, validated educational presets, diagnosis, debriefs, and technical references without changing deterministic physics.

**Architecture:** Centralized education data feeds compact dock help, accordions, drawers, the tour, coach, and debrief. Pure simulation analysis supplements existing `RunResult` metrics only where needed; the UI never recomputes physics. Benchmarks invoke the existing engine with fixed scenarios and seeds.

**Tech Stack:** Next.js, React, TypeScript, existing simulation engine/Worker, Vitest, Testing Library, Playwright.

**Repository rule:** Do not stage, commit, push, or create a branch.

---

## Phase 1 — Trustworthy controller foundation and centralized teaching copy

### Task 1: Document and extend PID behavior tests

**Files:**
- Modify: `lib/simulation/pid.ts`, `lib/simulation/pid.test.ts`
- Create: `lib/education/pid-content.ts`

- [ ] **Step 1: Add failing controller tests**

```ts
expect(stepPid(state, saturatedHigh, highLevel).state.integralTerm).toBe(0);
expect(stepPid(woundState, recoveringConfig, lowLevel).state.integralTerm).toBeLessThan(woundState.integralTerm);
expect(noisyFiltered.derivative).toBeLessThan(noisyUnfiltered.derivative);
```

- [ ] **Step 2: Confirm the tests fail where coverage is absent**

Run: `npm run test -- lib/simulation/pid.test.ts`  
Expected: FAIL for missing low-saturation/unwind/noise cases.

- [ ] **Step 3: Make the strategy explicit without changing response semantics**

Document conditional integration above `stepPid`: output clamps to `0–100%`; the
integrator freezes only when error drives farther into saturation and can unwind
when error reverses. Retain derivative-on-measurement and its first-order filter.
Add high/low saturation, unwind, setpoint-step-no-kick, clean/noisy, and filtered
derivative tests.

- [ ] **Step 4: Centralize teaching content**

Export immutable English content for parallel PID theory, reverse outlet action,
Kp/Ki/Kd tooltips, loop explanations, tuning checklist, diagnosis patterns,
anti-windup, PI note, classical methods, and references. Keep external URLs in
one `REFERENCES` array.

- [ ] **Step 5: Verify Phase 1**

Run: `npm run test -- lib/simulation/pid.test.ts lib/education && npm run lint && npm run typecheck && git diff --check`  
Expected: all pass.

## Phase 2 — Contextual learning UI and expanded tour

### Task 2: Add PID help, theory, diagnostics, and references

**Files:**
- Create: `components/education/pid-help.tsx`, `components/education/pid-learning-panel.tsx`
- Test: `components/education/pid-help.test.tsx`, `components/education/pid-learning-panel.test.tsx`
- Modify: `components/pid-controls.tsx`, `components/game-dashboard.tsx`, `app/globals.css`

- [ ] **Step 1: Write failing component tests**

```tsx
await user.click(screen.getByRole("button", { name: "Help with Response strength" }));
expect(screen.getByText("Higher Kp → faster response, but lower stability margin.")).toBeVisible();
expect(screen.getByText("PID theory")).toBeVisible();
expect(screen.getByText("Change one parameter at a time and repeat the same deterministic scenario.")).toBeVisible();
```

- [ ] **Step 2: Implement compact disclosure**

Render a help icon per gain, with friendly name before technical name. Use compact
popover/accordion on desktop and accessible dialog/drawer on narrow screens.
Render loop-specific explanations, `PID theory`, `How do I diagnose the response?`,
`Learn more`, PI and classical-method notes from centralized data. Links use
`target="_blank" rel="noreferrer"`.

- [ ] **Step 3: Extend the guided tour**

Add a `Manual PID tuning` step after controller discovery. It states repeatable
scenario/seed, Ki/Kd zero, Kp then Ki then Kd, and visually presents
`Kp → Ki → Kd`. Keep existing seven data-tour target steps and keyboard behavior.

- [ ] **Step 4: Verify Phase 2**

Run: `npm run test -- components/education components/onboarding/guided-tour.test.tsx components/pid-controls.test.tsx && npm run lint && npm run build && git diff --check`  
Expected: all pass.

## Phase 3 — Educational presets and reproducible analysis

### Task 3: Add analysis metrics and preset benchmark

**Files:**
- Create: `lib/simulation/analysis.ts`, `lib/simulation/analysis.test.ts`, `scripts/benchmark-presets.ts`
- Modify: `lib/simulation/types.ts`, `lib/onboarding/presets.ts`
- Test: `lib/onboarding/presets.test.ts`

- [ ] **Step 1: Write deterministic analysis failures**

```ts
expect(analyzeAttempt(samples).itae).toBeGreaterThan(0);
expect(analyzeAttempt(samples).oilSaturationHighS).toBeGreaterThanOrEqual(0);
expect(compareCompatibleAttempts(current, prior)).toEqual(expect.objectContaining({ comparable: true }));
```

- [ ] **Step 2: Implement pure analysis**

Derive IAE, ISE, ITAE, overshoot, settling, warning/safety time, travel,
saturation, and crossings from existing samples/results. Preserve current score.
Compatibility requires same scenario and seed.

- [ ] **Step 3: Replace public presets**

Expose Training default, Conservative, Aggressive, Untuned P-only. Training
default has `Kd: 0`, distinct loop gains, and safe deliberately slow behavior.
Choose values by running the benchmark across all six public scenarios; no public
Optimal preset is allowed.

- [ ] **Step 4: Verify Phase 3**

Run: `npm run test -- lib/simulation/analysis.test.ts lib/onboarding/presets.test.ts && npm run benchmark:presets && npm run lint && npm run typecheck && git diff --check`  
Expected: reproducible report and passing tests.

## Phase 4 — Control Coach, debrief, comparison, and browser validation

### Task 4: Add post-attempt learning feedback

**Files:**
- Create: `components/education/control-coach.tsx`, `components/education/tuning-debrief.tsx`
- Test: `components/education/control-coach.test.tsx`, `components/education/tuning-debrief.test.tsx`
- Modify: `components/result-panel.tsx`, `components/game-dashboard.tsx`, `app/globals.css`

- [ ] **Step 1: Write diagnosis failures**

```tsx
expect(screen.getByText("Recovery is stable but slow. Try increasing proportional gain slightly.")).toBeVisible();
expect(screen.getByText("Stable but too slow.")).toBeVisible();
expect(screen.getByText("Compared with your previous attempt")).toBeVisible();
```

- [ ] **Step 2: Implement cautious feedback**

Classify slow recovery, offset, overshoot, oscillation, saturation, travel, and
noise from analysis. Show one conceptual coach hint, final score, safety,
overshoot, settling, ITAE, travel, saturation, and compatible prior-attempt
comparison. Store only the last summarized attempt locally; never store a seed
change or recommend exact gains unless advanced help is explicitly opened.

- [ ] **Step 3: Add browser flow and final gates**

Run landing → challenge → Training default → deterministic repeat → result
comparison in Playwright, including mobile education disclosure. Then run:

`npm run lint && npm run typecheck && npm run test && npm run build && npm run test:e2e && make check && git diff --check`

Expected: every gate passes and all files remain unstaged.
