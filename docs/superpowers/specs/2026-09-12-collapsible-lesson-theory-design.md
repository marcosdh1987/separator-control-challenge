# Collapsible Lesson Theory Design

## Status

Approved direction: compact persistent thumbnail with responsive disclosure.

## Goal

Reduce visual overload at the start of a lesson without hiding the educational context. The “Before you start” section must remain easy to reopen, and each lesson must show a visual explanation of its main concept.

## User experience

The theory section becomes a compact disclosure placed before the task and simulator.

The collapsed state contains:

- a small schematic thumbnail;
- the “Before you start” heading;
- a one-line lesson summary;
- a button labeled “Read theory”.

The expanded state keeps the same header and reveals the full theory, the field note when present, and a larger version of the lesson illustration. The close action is labeled “Hide theory”. The illustration remains visible in the collapsed state so the learner retains a visual anchor after reducing the text.

The initial state uses the existing 760-pixel responsive boundary:

- viewports wider than 760 pixels: expanded;
- viewports 760 pixels wide or narrower: collapsed.

The state resets when a new lesson opens. It is not persisted between lessons, because the default state is an intentional presentation choice rather than a learner preference. A manual choice overrides later viewport changes for the rest of that lesson. Entering presentation mode opens the theory, after which the instructor may collapse it again. The disclosure must support keyboard activation, visible focus, screen readers, and reduced-motion preferences.

## Visual system

Lesson visuals will be deterministic, inline SVG illustrations rendered by a reusable `LessonVisual` component. They will use the existing simulator palette and visual language: cyan for measurements and control, amber for oil and valves, and blue for water.

The curriculum will define one visual kind per lesson:

| Lesson | Visual kind | Main teaching cue |
| --- | --- | --- |
| What a three-phase separator does | `separator` | vessel phases, residence volume, and outlet valves |
| Proportional action | `proportional-action` | persistent error after a feed step |
| Integral action and windup | `integral-windup` | accumulation against a saturated valve |
| Noisy interface and derivative | `interface-noise` | noisy measurement and valve chatter |
| Slugs and feedback limits | `slug-feedback` | sudden inlet volume and surge capacity |
| The third loop: pressure | `pressure-loop` | gas cap, pressure response, and gas valve |
| Systematic tuning | `systematic-tuning` | ordered Kp, Ki, and Kd tuning |

Every visual will receive localized accessible text from the English and Spanish training catalogues. No external images, runtime network requests, or new asset dependencies are required.

## Components and data flow

`LessonPlayer` will delegate theory rendering to a focused `LessonTheory` component. `LessonTheory` will receive the localized lesson copy, the lesson visual kind, and presentation-mode state. It will own the learner's open/closed override. `LessonVisual` will receive the visual kind, accessible label, and display variant (`thumbnail` or `detail`).

The non-localized `Lesson` contract will gain `visualKind`, defined as a finite union so every curriculum entry is checked at compile time. The localized `LessonCopy` contract will gain only `visualAlt`; it will reuse the existing `summary` for the collapsed row. The English catalogue remains canonical, and the Spanish catalogue must satisfy the same shape.

The responsive default will use the repository's external-store pattern for browser state. The server snapshot renders the compact state safely during prerendering. The client snapshot reports whether the viewport is wider than 760 pixels. `LessonTheory` derives visibility as `userOverride ?? (presenting || isWideViewport)`, so presentation mode starts open and resizing follows the responsive default only until the learner toggles the disclosure. Neither the viewport store nor the disclosure affects simulation or lesson progress state.

## Styling and interaction

The expanded content will use a two-column layout on wide screens, with readable theory text and a larger illustration. At tablet and mobile widths it will become a single column, keep the thumbnail in the disclosure header, and avoid increasing the vertical footprint until the learner requests the theory.

The toggle will have a stable hit area of at least 44 by 44 pixels, a visible focus ring, `aria-controls`, and an `aria-expanded` state tied to the revealed content. One SVG image will change size and detail between collapsed and expanded layouts; the component will not render duplicate accessible images. The illustration will not be the only way to identify a concept: the heading, summary, and accessible label will carry the meaning in text.

## Testing

Add focused component tests for:

1. the wide-screen default being expanded;
2. the compact-screen default being collapsed;
3. toggling the disclosure and updating `aria-expanded`;
4. keeping the thumbnail and accessible visual label present when collapsed;
5. rendering the field note and detail visual when expanded;
6. preserving a learner's manual choice across viewport changes;
7. opening the theory when presentation mode starts while keeping the toggle available;
8. providing a visual kind for every lesson and accessible text in both locales.

Check the responsive layout manually at 390, 768, and 1280 pixels. Run focused Vitest tests during development, then finish with the repository's read-only `make check` gate, which includes frontend lint, typecheck, tests, and the production build.

## Scope boundaries

This change does not alter lesson copy, lesson grading, simulator behavior, training progress, presentation mode semantics, or the lesson index. It does not add a media library, remote image hosting, image uploads, or user-configurable display preferences.
