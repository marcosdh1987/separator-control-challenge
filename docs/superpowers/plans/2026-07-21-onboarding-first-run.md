# Separator Control Challenge Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game understandable in 30 seconds through a public landing page, optional training, and first-run guidance while preserving its deterministic simulation.

**Architecture:** App Router separates `/`, `/training`, and `/challenge`. A small SSR-safe onboarding hook owns only progress preferences; `useSimulation`, `ProcessHero`, scenarios, metrics, Worker, and scoring remain the only simulation implementation. The phases ship independently: first-run clarity, tour, then training.

**Tech Stack:** Next.js App Router, React, TypeScript, existing React Three Fiber hero and SVG fallback, localStorage, Vitest, Testing Library, Playwright.

**Repository rule:** Do not stage, commit, push, or create a branch.

---

## File map

- `app/page.tsx`: `LandingPage` route.
- `app/challenge/page.tsx`: `GameDashboard` route.
- `app/training/page.tsx`: `TrainingExperience` route.
- `components/landing-page.tsx`: public mission and static visual hero.
- `components/onboarding/*`: persistence, modal, tour, badge, and preset controls.
- `components/training/*`: three UI-only lessons that reuse the existing hook.
- `components/game-dashboard.tsx`: quick start, score wording, and tour integration.
- `components/scenario-selector.tsx`, `components/pid-controls.tsx`, `components/dual-pid-controls.tsx`: guidance and stable tour anchors.
- `app/globals.css`: responsive onboarding and training styling.
- `tests/e2e/game.spec.ts`: cross-route browser flow.

## Phase A — Landing and first-run clarity

### Task 1: Add isolated onboarding state and valid presets

**Files:**
- Create: `lib/onboarding/types.ts`, `lib/onboarding/presets.ts`, `hooks/use-onboarding.ts`
- Test: `lib/onboarding/presets.test.ts`, `hooks/use-onboarding.test.tsx`

- [ ] **Step 1: Write failing tests**

```ts
expect(PID_PRESETS.balanced.config).toEqual(DEFAULT_DUAL_PID);
expect(PID_PRESETS.conservative.config.total.kp).toBeLessThan(PID_PRESETS.balanced.config.total.kp);
expect(PID_PRESETS.aggressive.config.total.kp).toBeGreaterThan(PID_PRESETS.balanced.config.total.kp);
```

```tsx
const { result } = renderHook(() => useOnboarding());
act(() => result.current.dismissQuickStart(true));
expect(window.localStorage.getItem(ONBOARDING_STORAGE_KEY)).toContain("quickStartDismissed");
```

- [ ] **Step 2: Run the failing tests**

Run: `npm run test -- lib/onboarding/presets.test.ts hooks/use-onboarding.test.tsx`  
Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement the pure boundary**

```ts
export const DEFAULT_ONBOARDING_STATE = Object.freeze({
  quickStartDismissed: false,
  guidedTourDismissed: false,
  trainingCompleted: false,
});
```

Define Balanced, Conservative, and Aggressive `DualPidConfig` presets, each
validated by `sanitizeDualPidConfig`. Read storage in an effect, catch storage
errors, and write only after user actions. Do not import simulation hooks or
Worker code.

- [ ] **Step 4: Verify the new boundary**

Run: `npm run test -- lib/onboarding/presets.test.ts hooks/use-onboarding.test.tsx`  
Expected: PASS.

### Task 2: Split routes and create a lazy landing hero

**Files:**
- Modify: `app/page.tsx`, `components/process-hero.tsx`, `app/globals.css`
- Create: `app/challenge/page.tsx`, `app/training/page.tsx`, `components/landing-page.tsx`
- Test: `components/landing-page.test.tsx`

- [ ] **Step 1: Write failing landing checks**

```tsx
render(<LandingPage />);
expect(screen.getByRole("heading", { name: "Separator Control Challenge" })).toBeVisible();
expect(screen.getByRole("link", { name: "Start guided training" })).toHaveAttribute("href", "/training");
expect(screen.getByRole("link", { name: "Enter control room" })).toHaveAttribute("href", "/challenge");
```

- [ ] **Step 2: Confirm failure**

Run: `npm run test -- components/landing-page.test.tsx`  
Expected: FAIL because the component and routes are absent.

- [ ] **Step 3: Implement routes and the visual-only hero mode**

```tsx
// app/page.tsx
export default function HomePage() { return <LandingPage />; }

// app/challenge/page.tsx
export default function ChallengePage() { return <GameDashboard />; }
```

The landing renders the approved copy, CTAs, Tune/Survive/Score, valve mapping,
50%/20% targets, and the educational disclaimer. Add an `idle` ProcessHero mode
that receives a static equilibrium sample, lazy-loads WebGL, honors reduced
motion, and preserves SVG fallback. It must not call `useSimulation`, create a
Worker, retain history, or initialize scoring/dashboard state.

- [ ] **Step 4: Verify landing and visual fallback**

Run: `npm run test -- components/landing-page.test.tsx components/process-hero.test.tsx`  
Expected: PASS.

### Task 3: Make challenge setup teachable

**Files:**
- Create: `components/onboarding/difficulty-badge.tsx`, `components/onboarding/pid-preset-selector.tsx`
- Test: `components/onboarding/pid-preset-selector.test.tsx`
- Modify: `components/scenario-selector.tsx`, `components/scenario-selector.test.tsx`, `components/pid-controls.tsx`, `components/pid-controls.test.tsx`, `components/dual-pid-controls.tsx`, `components/game-dashboard.tsx`, `components/game-dashboard.test.tsx`, `app/globals.css`

- [ ] **Step 1: Write failing guidance tests**

```tsx
expect(screen.getByText("Beginner")).toBeVisible();
expect(screen.getByText("Start here")).toBeVisible();
expect(screen.getByText("More valve opening → more oil out → lower total level")).toBeVisible();
await user.click(screen.getByRole("button", { name: "Balanced preset" }));
expect(onChange).toHaveBeenCalledWith(PID_PRESETS.balanced.config);
```

- [ ] **Step 2: Confirm failure**

Run: `npm run test -- components/scenario-selector.test.tsx components/pid-controls.test.tsx components/onboarding/pid-preset-selector.test.tsx`  
Expected: FAIL before guidance exists.

- [ ] **Step 3: Implement scenario grouping and controls**

Map Normal and feed step to Beginner, slow water dump and oil restriction to
Intermediate, and slug and noisy interface to Advanced. Render `Start here`
only on `feed-step`. Add the approved causal sentence to each PID dock. Place
the preset selector before the docks, set only existing PID state, and disable it
when gains lock. State clearly that gains lock when an attempt begins.

- [ ] **Step 4: Correct score wording**

Render `Not started` while idle. While running or paused, render `Final
deterministic score calculated when the attempt ends`. Show a numeric score only
after `simulation.result` exists.

- [ ] **Step 5: Verify components**

Run: `npm run test -- components`  
Expected: PASS.

### Task 4: Add quick start and stable anchors

**Files:**
- Create: `components/onboarding/mission-summary.tsx`, `components/onboarding/quick-start-modal.tsx`
- Test: `components/onboarding/quick-start-modal.test.tsx`
- Modify: `components/game-dashboard.tsx`, `components/scenario-selector.tsx`, `components/pid-controls.tsx`, `components/dual-pid-controls.tsx`, `components/process-hero.tsx`, `components/trend-charts.tsx`, `components/result-panel.tsx`

- [ ] **Step 1: Write a failing first-visit test**

```tsx
render(<GameDashboard />);
expect(await screen.findByRole("dialog", { name: "Your mission" })).toBeVisible();
await user.click(screen.getByRole("button", { name: "Skip and play" }));
expect(screen.queryByRole("dialog", { name: "Your mission" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Confirm failure**

Run: `npm run test -- components/onboarding/quick-start-modal.test.tsx components/game-dashboard.test.tsx`  
Expected: FAIL because onboarding is absent.

- [ ] **Step 3: Implement the accessible mission dialog**

Use `role="dialog"`, `aria-modal="true"`, labelled heading, Escape dismissal,
and focus restoration. Include the approved mission, valve mapping, gain locking,
and five play steps. Provide exactly `Start guided tour`, `Skip and play`, and
`Don't show again`; only the last persists dismissal.

- [ ] **Step 4: Add required stable anchors**

```tsx
data-tour="scenario-selector"
data-tour="total-pid"
data-tour="interface-pid"
data-tour="start-attempt"
data-tour="process-view"
data-tour="live-trends"
data-tour="score-safety"
```

Attach these to structural wrappers. Later code may query only these attributes,
never visible text or fragile CSS selectors.

- [ ] **Step 5: Run the Phase-A gate**

Run: `npm run lint && npm run typecheck && npm run test -- components && npm run build && git diff --check`  
Expected: every command exits `0`.

## Phase B — Guided control-room tour

### Task 5: Build the accessible internal tour

**Files:**
- Create: `components/onboarding/guided-tour.tsx`, `components/onboarding/guided-tour.test.tsx`
- Modify: `components/game-dashboard.tsx`, `app/globals.css`

- [ ] **Step 1: Write keyboard-first failures**

```tsx
render(<GuidedTour active onComplete={onComplete} onSkip={onSkip} />);
expect(screen.getByRole("dialog", { name: "Scenario selector" })).toBeVisible();
await user.keyboard("{ArrowRight}");
expect(screen.getByRole("dialog", { name: "Total-level PID" })).toBeVisible();
await user.keyboard("{Escape}");
expect(onSkip).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Confirm failure**

Run: `npm run test -- components/onboarding/guided-tour.test.tsx`  
Expected: FAIL because the tour does not exist.

- [ ] **Step 3: Implement the seven stable steps**

```ts
const TOUR_STEPS = [
  "scenario-selector", "total-pid", "interface-pid", "start-attempt",
  "process-view", "live-trends", "score-safety",
] as const;
```

For each key, query `[data-tour="${key}"]`, position the spotlight from that
target's rect, and render the approved short explanation. Support Back, Next,
Skip, Finish, Escape, focus trapping, restored trigger focus, and screen-reader
step count. Skip a missing target instead of throwing.

- [ ] **Step 4: Persist and verify**

Connect Skip and Finish to `dismissGuidedTour`; test an unavailable target, all
keyboard controls, and persistence.

Run: `npm run test -- components/onboarding/guided-tour.test.tsx components/game-dashboard.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Run the Phase-B gate**

Run: `npm run lint && npm run typecheck && npm run test -- components && npm run build && git diff --check`  
Expected: every command exits `0`.

## Phase C — Interactive training

### Task 6: Create lesson contracts that reuse final metrics

**Files:**
- Create: `lib/onboarding/training.ts`, `lib/onboarding/training.test.ts`
- Create: `components/training/training-experience.tsx`, `components/training/training-experience.test.tsx`
- Modify: `app/training/page.tsx`

- [ ] **Step 1: Write pass-criteria failures**

```ts
expect(LESSON_TWO_PASS_CRITERIA).toEqual({
  maximumTotalMaePct: 4,
  maximumTotalOutsideBandS: 20,
  maximumOilSaturationS: 10,
});
expect(passesLessonTwo(resultWithNullTripAndBoundaryMetrics)).toBe(true);
expect(passesLessonTwo(resultWithTotalTrip)).toBe(false);
```

- [ ] **Step 2: Confirm failure**

Run: `npm run test -- lib/onboarding/training.test.ts components/training/training-experience.test.tsx`  
Expected: FAIL because training modules are absent.

- [ ] **Step 3: Implement named criteria and pure evaluation**

`passesLessonTwo(result: RunResult)` returns false on any trip; otherwise reads
only `result.metrics.loops.total.mae`,
`result.metrics.loops.total.targetBandTimeOutsideS`, and
`result.metrics.actuators.oil.saturationTimeS`. Do not reproduce metrics or
score calculations.

- [ ] **Step 4: Implement the three UI-restricted lessons**

`TrainingExperience` calls the existing `useSimulation(pid, scenarioId)` once
and renders existing `ProcessHero`, PID components, scenarios, and result data.
Lesson 1 uses Normal with a stable observation preset. Lesson 2 uses feed step
and permits only total `Kp`/`Ki`; total `Kd` and every interface gain remain
fixed and disabled. Lesson 3 unlocks both loops and explains coupling, travel,
and saturation. No training-specific Worker, physics, scoring, or randomness is
allowed.

- [ ] **Step 5: Verify focused training tests**

Run: `npm run test -- lib/onboarding/training.test.ts components/training/training-experience.test.tsx`  
Expected: PASS.

### Task 7: Finish progression and completion

**Files:**
- Modify: `components/training/training-experience.tsx`, `components/pid-controls.tsx`, `components/dual-pid-controls.tsx`, `app/globals.css`

- [ ] **Step 1: Write progression failures**

```tsx
render(<TrainingExperience />);
expect(screen.getByText("Step 1 of 3")).toBeVisible();
await user.click(screen.getByRole("button", { name: "Continue to tuning" }));
expect(screen.getByText("Step 2 of 3")).toBeVisible();
expect(screen.getByLabelText("Total derivative gain")).toBeDisabled();
expect(screen.getByLabelText("Interface proportional gain")).toBeDisabled();
```

- [ ] **Step 2: Confirm failure**

Run: `npm run test -- components/training/training-experience.test.tsx`  
Expected: FAIL before lesson controls exist.

- [ ] **Step 3: Implement passing and completion**

Show a balanced starting range and short Kp/Ki guidance in lesson 2. After a
finished run, render pass/fail from `passesLessonTwo`; failure retains tuning and
offers retry, while pass unlocks lesson 3. `Enter full challenge` calls
`completeTraining()` before navigation to `/challenge`.

- [ ] **Step 4: Run the Phase-C gate**

Run: `npm run lint && npm run typecheck && npm run test -- components lib/onboarding && npm run build && git diff --check`  
Expected: every command exits `0`.

## Task 8: Verify routes in Playwright and browser

**Files:**
- Modify: `tests/e2e/game.spec.ts`
- Modify: `playwright.config.ts` only if a documented real-WebGL serial timeout is necessary.

- [ ] **Step 1: Add the cross-route E2E journey**

```ts
await page.goto("/");
await page.getByRole("link", { name: "Start guided training" }).click();
await expect(page).toHaveURL(/\/training$/);
await page.getByRole("button", { name: "Enter full challenge" }).click();
await expect(page).toHaveURL(/\/challenge$/);
await page.getByLabel("Oil/water feed step").check();
await page.getByRole("button", { name: "Balanced preset" }).click();
await page.getByRole("button", { name: "Start attempt" }).click();
await expect(page.getByRole("button", { name: "Pause attempt" })).toBeVisible();
```

- [ ] **Step 2: Add first-run persistence coverage**

Clear storage, assert `Your mission` at `/challenge`, launch the tour, advance
with the keyboard, skip it, reload, and assert the dialog/tour remain dismissed.
Use only `[data-tour]` target attributes in the test.

- [ ] **Step 3: Run full browser and quality gates**

Run: `npm run test:e2e && npm run lint && npm run typecheck && npm run test && npm run build && make check && git diff --check`  
Expected: every active test and gate exits `0`.

- [ ] **Step 4: Inspect desktop, tablet, and 390px routes**

Inspect `/`, `/training`, and `/challenge`. Confirm the landing never starts the
Worker, the hero remains lazy with reduced-motion/SVG fallback, controls stay
visible, no route overflows horizontally, and challenge behavior remains intact.
