# Collapsible Lesson Theory Implementation Plan

> **For agentic workers, including Luna:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lesson theory compact on tablets and phones while keeping a persistent, lesson-specific visual anchor and accessible access to the full text.

**Architecture:** Add visual identity to the non-localized lesson contract and accessible visual text to the bilingual message catalogues. A focused `LessonTheory` component owns responsive disclosure state, and a focused `LessonVisual` component renders one deterministic inline SVG whose detail changes with the disclosure state.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, inline SVG, CSS media queries, `useSyncExternalStore`, Vitest, and Testing Library.

**Repository rule:** Do not stage, commit, push, create a branch, or integrate branches. Leave every change unstaged for manual review.

**Approved design:** `docs/superpowers/specs/2026-09-12-collapsible-lesson-theory-design.md`

---

## File map

- `lib/training/types.ts`: define the closed visual-kind contract and add it to `Lesson`.
- `lib/training/lessons.ts`: assign one visual kind to each curriculum entry.
- `lib/i18n/messages/en/training.ts`: add canonical visual descriptions and disclosure labels.
- `lib/i18n/messages/es/training.ts`: add Spanish visual descriptions and disclosure labels.
- `lib/training/grading.test.ts`: verify complete curriculum and locale metadata.
- `components/training/lesson-visual.tsx`: render the seven deterministic SVG concepts.
- `components/training/lesson-visual.test.tsx`: verify every visual kind has one accessible image.
- `components/training/lesson-theory.tsx`: own responsive disclosure behavior and semantic markup.
- `components/training/lesson-theory.test.tsx`: verify responsive defaults, manual override, accessibility, and presentation behavior.
- `components/training/lesson-player.tsx`: replace inline theory markup with `LessonTheory`.
- `components/training/lesson-player.test.tsx`: verify presentation mode opens theory through the real parent integration.
- `app/globals.css`: style compact and expanded layouts at the existing 760-pixel boundary.

## Task 1: Extend the curriculum and bilingual copy contracts

**Files:**

- Modify: `lib/training/types.ts`
- Modify: `lib/training/lessons.ts`
- Modify: `lib/i18n/messages/en/training.ts`
- Modify: `lib/i18n/messages/es/training.ts`
- Modify: `lib/training/grading.test.ts`

- [x] **Step 1: Write the failing metadata test**

Add imports for `MESSAGES` and `LESSON_VISUAL_KINDS`, then add this test to the curriculum contract suite in `lib/training/grading.test.ts`:

```ts
it("provides a visual kind and localized accessible text for every lesson", () => {
  const supportedKinds = new Set<string>(LESSON_VISUAL_KINDS);

  for (const lesson of LESSON_LIST) {
    expect(supportedKinds.has(lesson.visualKind)).toBe(true);
    expect(MESSAGES.en.training.lesson[lesson.id].visualAlt.trim()).not.toBe("");
    expect(MESSAGES.es.training.lesson[lesson.id].visualAlt.trim()).not.toBe("");
  }
});
```

- [x] **Step 2: Run the test and confirm RED**

Run:

```bash
npm run test -- lib/training/grading.test.ts
```

Expected: FAIL at TypeScript transformation because `LESSON_VISUAL_KINDS`, `visualKind`, and `visualAlt` do not exist.

- [x] **Step 3: Add the closed visual-kind contract**

Add this contract near `LessonLevel` in `lib/training/types.ts`:

```ts
export const LESSON_VISUAL_KINDS = [
  "separator",
  "proportional-action",
  "integral-windup",
  "interface-noise",
  "slug-feedback",
  "pressure-loop",
  "systematic-tuning",
] as const;

export type LessonVisualKind = (typeof LESSON_VISUAL_KINDS)[number];
```

Add `visualKind: LessonVisualKind` to `Lesson`. Assign these values in `lib/training/lessons.ts`:

```ts
const LESSON_VISUAL_BY_ID = {
  "what-is-a-separator": "separator",
  "level-and-proportional-action": "proportional-action",
  "integral-action-and-windup": "integral-windup",
  "interface-noise-and-derivative": "interface-noise",
  "slugs-and-the-limits-of-feedback": "slug-feedback",
  "the-third-loop-pressure": "pressure-loop",
  "systematic-tuning": "systematic-tuning",
} as const satisfies Record<LessonId, LessonVisualKind>;
```

Each lesson object must set `visualKind` from its exact key in `LESSON_VISUAL_BY_ID`. Keep visual identity outside the message catalogues.

- [x] **Step 4: Add localized accessible copy**

Add `visualAlt: string` to `LessonCopy`. Add `readTheory` and `hideTheory` to each `player` catalogue.

Use these exact English labels:

```ts
readTheory: "Read theory",
hideTheory: "Hide theory",
```

Use these exact Spanish labels:

```ts
readTheory: "Leer teoría",
hideTheory: "Ocultar teoría",
```

Add these exact visual descriptions to the matching lesson objects:

| Visual kind | English `visualAlt` | Spanish `visualAlt` |
| --- | --- | --- |
| `separator` | Diagram of a horizontal separator showing gas above oil and water, with inlet and outlet valves. | Diagrama de un separador horizontal con gas sobre petróleo y agua, con válvulas de entrada y salida. |
| `proportional-action` | Response chart showing proportional control settling below the setpoint after a feed step. | Gráfico de respuesta donde el control proporcional se estabiliza por debajo del setpoint después de un escalón de alimentación. |
| `integral-windup` | Diagram of the integral term accumulating while an outlet valve remains saturated. | Diagrama del término integral acumulándose mientras una válvula de salida permanece saturada. |
| `interface-noise` | A noisy oil-water interface signal driving rapid movement of the water valve. | Una señal ruidosa de la interfase petróleo-agua que provoca movimientos rápidos de la válvula de agua. |
| `slug-feedback` | A liquid slug entering the separator and consuming the available surge volume. | Un slug de líquido entrando al separador y consumiendo el volumen de amortiguación disponible. |
| `pressure-loop` | Gas-cap pressure acting on the gas outlet valve above the liquid levels. | La presión del domo de gas actuando sobre la válvula de salida de gas por encima de los niveles de líquido. |
| `systematic-tuning` | A tuning sequence from proportional to integral to optional derivative action, ending in a stable response. | Una secuencia de sintonía desde la acción proporcional hasta la integral y la derivativa opcional, que termina en una respuesta estable. |

Reuse each lesson's existing `summary` in the compact row. Do not add a second summary field.

- [x] **Step 5: Verify the contract is GREEN**

Run:

```bash
npm run test -- lib/training/grading.test.ts
npm run typecheck
```

Expected: both commands PASS.

## Task 2: Build the deterministic lesson illustrations

**Files:**

- Create: `components/training/lesson-visual.tsx`
- Create: `components/training/lesson-visual.test.tsx`
- Modify: `app/globals.css`

- [x] **Step 1: Write the failing visual contract test**

Create `components/training/lesson-visual.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LESSON_VISUAL_KINDS } from "@/lib/training/types";

import { LessonVisual } from "./lesson-visual";

describe("LessonVisual", () => {
  it("renders one accessible SVG for every supported concept", () => {
    for (const kind of LESSON_VISUAL_KINDS) {
      const label = `Accessible ${kind}`;
      const { unmount } = render(
        <LessonVisual alt={label} kind={kind} variant="thumbnail" />,
      );

      const visual = screen.getByRole("img", { name: label });
      expect(visual).toHaveAttribute("data-visual-kind", kind);
      expect(visual).toHaveAttribute("data-visual-variant", "thumbnail");
      expect(screen.getAllByRole("img")).toHaveLength(1);
      unmount();
    }
  });
});
```

- [x] **Step 2: Run the test and confirm RED**

Run:

```bash
npm run test -- components/training/lesson-visual.test.tsx
```

Expected: FAIL because `LessonVisual` does not exist.

- [x] **Step 3: Implement the shared accessible SVG shell**

Create this public contract in `components/training/lesson-visual.tsx`:

```tsx
import { useId, type ReactNode } from "react";

import type { LessonVisualKind } from "@/lib/training/types";

interface LessonVisualProps {
  alt: string;
  kind: LessonVisualKind;
  variant: "thumbnail" | "detail";
}

export function LessonVisual({ alt, kind, variant }: LessonVisualProps) {
  const titleId = useId();
  return (
    <svg
      aria-labelledby={titleId}
      className="lesson-visual"
      data-visual-kind={kind}
      data-visual-variant={variant}
      role="img"
      viewBox="0 0 320 180"
    >
      <title id={titleId}>{alt}</title>
      <rect className="lesson-visual__backdrop" height="178" rx="16" width="318" x="1" y="1" />
      {renderVisual(kind)}
    </svg>
  );
}
```

Implement `renderVisual(kind): ReactNode` as an exhaustive switch. The default branch must assign `kind` to `never` before returning, so a new visual kind cannot compile without a drawing.

- [x] **Step 4: Draw the seven concepts with stable SVG primitives**

Keep every drawing inside the common `320 × 180` view box. Use the existing CSS palette through class names, not hard-coded per-component colors.

- `separator`: rounded vessel from `(52, 38)` to `(268, 142)`, gas/oil/water bands, one inlet, three outlets, and two valve symbols.
- `proportional-action`: axes from `(42, 28)` to `(42, 148)` and `(286, 148)`, a dashed setpoint at `y=62`, a feed step marker at `x=112`, and a response settling at `y=82` to show offset.
- `integral-windup`: a valve at the right-hand limit, a 100% saturation marker, and stacked integral blocks growing toward the valve command.
- `interface-noise`: a vessel interface around `y=104`, a jagged measured trace, and alternating water-valve positions connected by a dashed signal line.
- `slug-feedback`: a thick inlet slug entering from the left, a rising liquid band, and a hatched surge-volume region above the operating level.
- `pressure-loop`: a gas-cap band, a pressure instrument bubble, and a gas outlet valve connected by a dashed control signal.
- `systematic-tuning`: three ordered stages labeled `Kp`, `Ki`, and `Kd?`, followed by a response trace settling on its dashed setpoint.

Use short technical labels only (`SP`, `PV`, `Kp`, `Ki`, `Kd?`, `100%`). Keep descriptive language in `visualAlt`, where it is localized. Put secondary annotations inside groups with `className="lesson-visual__detail"`; thumbnail mode will hide those groups. Add `aria-hidden="true"` to purely decorative nested groups only if needed; the outer SVG remains the single image announced to assistive technology.

- [x] **Step 5: Add visual color hooks**

Add only the reusable SVG hooks to `app/globals.css` during this task:

```css
.lesson-visual { display: block; width: 100%; height: auto; }
.lesson-visual__backdrop { fill: rgb(5 15 18 / 76%); stroke: rgb(120 232 220 / 18%); }
.lesson-visual__vessel { fill: rgb(20 48 56 / 92%); stroke: var(--muted-2); stroke-width: 2; }
.lesson-visual__gas { fill: #16303a; }
.lesson-visual__oil { fill: rgb(196 128 47 / 88%); }
.lesson-visual__water { fill: rgb(28 143 168 / 88%); }
.lesson-visual__control { fill: none; stroke: var(--cyan-bright); stroke-width: 2; }
.lesson-visual__signal { fill: none; stroke: var(--cyan-bright); stroke-dasharray: 6 5; stroke-width: 1.5; }
.lesson-visual__accent { fill: none; stroke: var(--amber); stroke-width: 2; }
.lesson-visual__muted { fill: none; stroke: var(--muted-2); stroke-width: 1.5; }
.lesson-visual__label { fill: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; font-weight: 700; }
.lesson-visual[data-visual-variant="thumbnail"] .lesson-visual__detail { display: none; }
```

- [x] **Step 6: Verify the visual contract is GREEN**

Run:

```bash
npm run test -- components/training/lesson-visual.test.tsx
npm run typecheck
```

Expected: both commands PASS.

## Task 3: Build the responsive theory disclosure

**Files:**

- Create: `components/training/lesson-theory.tsx`
- Create: `components/training/lesson-theory.test.tsx`

- [x] **Step 1: Create a controllable `matchMedia` test helper**

In `components/training/lesson-theory.test.tsx`, define a helper that returns `setMatches` and notifies registered change listeners:

```ts
function installWideViewport(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  const media = {
    get matches() { return matches; },
    media: "(min-width: 761px)",
    onchange: null,
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => true,
  } as MediaQueryList;

  vi.stubGlobal("matchMedia", vi.fn(() => media));
  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
}
```

Call `vi.unstubAllGlobals()` in `afterEach`.

Define the shared test props explicitly:

```ts
const lesson = getLesson("what-is-a-separator");
const training = MESSAGES.en.training;
const lessonCopy = training.lesson[lesson.id];
const props = {
  copy: lessonCopy,
  fieldNoteHeading: training.player.fieldNoteHeading,
  heading: training.player.theoryHeading,
  hideLabel: training.player.hideTheory,
  presenting: false,
  readLabel: training.player.readTheory,
  visualKind: lesson.visualKind,
};
```

- [x] **Step 2: Write failing compact, wide, and override tests**

Use `MESSAGES.en.training`, `getLesson("what-is-a-separator")`, `renderWithLocale`, and `userEvent`. Assert these behaviors in separate tests:

```tsx
installWideViewport(false);
renderWithLocale(<LessonTheory {...props} />);
expect(screen.getByRole("button", { name: "Read theory" })).toHaveAttribute("aria-expanded", "false");
expect(screen.getByRole("img", { name: lessonCopy.visualAlt })).toHaveAttribute("data-visual-variant", "thumbnail");
expect(screen.getByText(lessonCopy.theory[0])).not.toBeVisible();
```

```tsx
installWideViewport(true);
renderWithLocale(<LessonTheory {...props} />);
expect(screen.getByRole("button", { name: "Hide theory" })).toHaveAttribute("aria-expanded", "true");
expect(screen.getByText(lessonCopy.theory[0])).toBeVisible();
```

```tsx
const viewport = installWideViewport(false);
renderWithLocale(<LessonTheory {...props} />);
await user.click(screen.getByRole("button", { name: "Read theory" }));
act(() => viewport.setMatches(true));
act(() => viewport.setMatches(false));
expect(screen.getByRole("button", { name: "Hide theory" })).toHaveAttribute("aria-expanded", "true");
```

The shared `props` must pass the heading, labels, field-note heading, lesson copy, visual kind, and `presenting={false}`. Add a fourth test with `presenting` set to `true` on a compact viewport; it must start expanded and remain collapsible.

- [x] **Step 3: Run the tests and confirm RED**

Run:

```bash
npm run test -- components/training/lesson-theory.test.tsx
```

Expected: FAIL because `LessonTheory` does not exist.

- [x] **Step 4: Implement the viewport snapshot and disclosure state**

Mark `lesson-theory.tsx` with `"use client";`. Import `useId`, `useState`, and `useSyncExternalStore`. Define stable module-level store functions:

```ts
const WIDE_VIEWPORT_QUERY = "(min-width: 761px)";

function wideViewportSnapshot(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia(WIDE_VIEWPORT_QUERY).matches;
}

function serverWideViewportSnapshot(): boolean {
  return false;
}

function subscribeWideViewport(onStoreChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => undefined;
  const media = window.matchMedia(WIDE_VIEWPORT_QUERY);
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}
```

Inside `LessonTheory`, derive state exactly as follows:

```ts
const isWideViewport = useSyncExternalStore(
  subscribeWideViewport,
  wideViewportSnapshot,
  serverWideViewportSnapshot,
);
const [userOverride, setUserOverride] = useState<boolean | null>(null);
const expanded = userOverride ?? (presenting || isWideViewport);
```

The toggle must call `setUserOverride(!expanded)`. This preserves the learner's explicit choice across later viewport changes.

Use this explicit component contract:

```ts
interface LessonTheoryProps {
  copy: LessonCopy;
  fieldNoteHeading: string;
  heading: string;
  hideLabel: string;
  presenting: boolean;
  readLabel: string;
  visualKind: LessonVisualKind;
}
```

- [x] **Step 5: Implement semantic markup with one visual**

Use `useId()` to create the heading and content IDs. Render this structure:

```tsx
<section
  aria-labelledby={headingId}
  className="lesson-theory"
  data-expanded={expanded ? "true" : "false"}
>
  <div className="lesson-theory__heading">
    <h2 id={headingId}><BookOpen aria-hidden="true" /> {heading}</h2>
    <p>{copy.summary}</p>
  </div>
  <div className="lesson-theory__visual">
    <LessonVisual
      alt={copy.visualAlt}
      kind={visualKind}
      variant={expanded ? "detail" : "thumbnail"}
    />
  </div>
  <button
    aria-controls={contentId}
    aria-expanded={expanded}
    className="lesson-theory__toggle"
    onClick={() => setUserOverride(!expanded)}
    type="button"
  >
    {expanded ? hideLabel : readLabel}
    <ChevronDown aria-hidden="true" />
  </button>
  <div className="lesson-theory__body" hidden={!expanded} id={contentId}>
    {copy.theory.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
    {copy.fieldNote ? (
      <aside className="lesson-field-note">
        <strong><HardHat aria-hidden="true" /> {fieldNoteHeading}</strong>
        <p>{copy.fieldNote}</p>
      </aside>
    ) : null}
  </div>
</section>
```

Accept explicit props for `copy`, `fieldNoteHeading`, `heading`, `hideLabel`, `presenting`, `readLabel`, and `visualKind`. Import the canonical `LessonCopy` type and `LessonVisualKind`; do not import the message singleton into the component.

- [x] **Step 6: Verify the disclosure is GREEN**

Run:

```bash
npm run test -- components/training/lesson-theory.test.tsx
npm run typecheck
```

Expected: both commands PASS.

## Task 4: Integrate the disclosure and responsive layout

**Files:**

- Modify: `components/training/lesson-player.tsx`
- Create: `components/training/lesson-player.test.tsx`
- Modify: `app/globals.css`

- [x] **Step 1: Write the failing parent integration test**

Mock `LessonRunner` so the test does not start the simulator. Render the first lesson on a compact viewport, verify its first theory paragraph is hidden, enter presentation mode, and verify the paragraph becomes visible:

```tsx
vi.mock("./lesson-runner", () => ({
  LessonRunner: () => <div data-testid="lesson-runner" />,
}));

it("opens compact theory when presentation mode starts", async () => {
  const user = userEvent.setup();
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  renderWithLocale(<LessonPlayer lessonId="what-is-a-separator" />);

  const paragraph = MESSAGES.en.training.lesson["what-is-a-separator"].theory[0];
  expect(screen.getByText(paragraph)).not.toBeVisible();
  await user.click(screen.getByRole("button", { name: "Presentation mode" }));
  expect(screen.getByText(paragraph)).toBeVisible();
});
```

Clean up the stub with `vi.unstubAllGlobals()`.

- [x] **Step 2: Run the parent test and confirm RED**

Run:

```bash
npm run test -- components/training/lesson-player.test.tsx
```

Expected: FAIL because the current theory is always visible and lacks the responsive disclosure.

- [x] **Step 3: Replace inline theory rendering**

Remove the inline theory section and its now-unused `BookOpen` and `HardHat` imports from `lesson-player.tsx`. Add:

```tsx
<LessonTheory
  key={`${lessonId}:${presenting ? "presentation" : "standard"}`}
  copy={lessonCopy}
  fieldNoteHeading={copy.player.fieldNoteHeading}
  heading={copy.player.theoryHeading}
  hideLabel={copy.player.hideTheory}
  presenting={presenting}
  readLabel={copy.player.readTheory}
  visualKind={lesson.visualKind}
/>
```

The key intentionally remounts only the theory disclosure when presentation mode changes. Entering presentation mode therefore starts expanded; leaving it restores the viewport default. Lesson routes already remount `LessonPlayer`, so a new lesson also receives a fresh default.

- [x] **Step 4: Implement the compact and expanded CSS grids**

Replace the old `.lesson-theory` heading/body assumptions with grid areas. Preserve the current border, radius, surface color, paragraph measure, and field-note treatment.

```css
.lesson-theory {
  display: grid;
  grid-template-areas: "visual heading toggle";
  grid-template-columns: 96px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 16px;
}

.lesson-theory[data-expanded="true"] {
  grid-template-areas:
    "heading toggle"
    "body visual";
  grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
  align-items: start;
  padding: 22px;
}

.lesson-theory__heading { grid-area: heading; min-width: 0; }
.lesson-theory__heading h2 { margin: 0; }
.lesson-theory__heading p { margin: 6px 0 0; color: var(--muted); font-size: 13px; line-height: 1.5; }
.lesson-theory__visual { grid-area: visual; min-width: 0; }
.lesson-theory__body { grid-area: body; min-width: 0; }
.lesson-theory__body > p { max-width: 74ch; margin: 0 0 12px; line-height: 1.68; }
.lesson-theory__toggle {
  grid-area: toggle;
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-self: end;
  gap: 6px;
  padding: 8px 10px;
  border: 0;
  background: transparent;
  color: var(--cyan-bright);
  cursor: pointer;
}
.lesson-theory__toggle svg { width: 16px; transition: transform 180ms ease; }
.lesson-theory__toggle[aria-expanded="true"] svg { transform: rotate(180deg); }
.lesson-theory__toggle:focus-visible { outline: 2px solid var(--cyan-bright); outline-offset: 2px; }
```

At the existing `@media (max-width: 760px)` boundary, use:

```css
.lesson-theory {
  grid-template-columns: 80px minmax(0, 1fr) auto;
  gap: 12px;
  padding: 14px;
}

.lesson-theory[data-expanded="true"] {
  grid-template-areas:
    "heading toggle"
    "visual visual"
    "body body";
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 16px;
}
```

Keep the existing global `prefers-reduced-motion` rule. It already reduces the chevron transition to near zero. Ensure the compact row does not overflow at 390 pixels and the expanded paragraph measure stays readable at 768 and 1280 pixels.

- [x] **Step 5: Verify integration is GREEN**

Run:

```bash
npm run test -- components/training/lesson-player.test.tsx components/training/lesson-theory.test.tsx components/training/lesson-visual.test.tsx
npm run lint
npm run typecheck
```

Expected: every command PASS with no warnings.

## Task 5: Validate the complete change

**Files:**

- Verify all modified and created files above.

- [x] **Step 1: Run all frontend tests**

Run:

```bash
npm run test
```

Expected: the full Vitest suite PASS.

- [x] **Step 2: Perform the responsive manual matrix**

Start the app with `make web-dev` and inspect one short and one long lesson in English and Spanish.

| Width | Expected initial state | Required checks |
| --- | --- | --- |
| 390 px | Collapsed | thumbnail, title, summary, and toggle fit without horizontal overflow |
| 768 px | Expanded | theory is readable and the detail visual does not crowd the text |
| 1280 px | Expanded | two-column theory and visual composition remains balanced |

At every width, open and close the theory, tab to the toggle, verify the focus ring, and confirm the SVG remains visible when collapsed. At 390 pixels, enter presentation mode and confirm the theory opens; then collapse it once to confirm the instructor retains control.

- [x] **Step 3: Run the repository quality gate**

Stop the development server, then run:

```bash
make check
git diff --check
```

Expected: both commands exit `0`. `make check` must pass Python format, lint, security, typing, and tests, plus frontend lint, typing, tests, and production build.

- [x] **Step 4: Review the unstaged handoff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only the approved specification, this plan, the implementation files, and the pre-existing `.superpowers/` brainstorming mockup appear. Leave all files unstaged and uncommitted for the user's manual review.
