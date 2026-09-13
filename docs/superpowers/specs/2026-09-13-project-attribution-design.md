# Project attribution and shared footer design

## Outcome

Present Separator Control Challenge as an independent educational project with
clear authorship, while preserving the existing industrial control-room identity
and keeping the training experience primary.

The project remains bilingual. Attribution copy follows the active locale rather
than showing both languages at once.

## Scope

### Landing page

Add a complete About section after the existing challenge briefing. It will be a
quiet editorial continuation of the briefing, not a commercial CTA or portfolio
card. The section will communicate:

- independent educational project by Marcos Esteban Soto;
- connection between well testing, industrial process control, and intelligent
  industrial systems;
- AI-assisted engineering with GPT-5.6 and Codex;
- human engineering judgment over process assumptions, physical simplifications,
  control behavior, and educational content;
- an invitation to discuss industrial AI, process control, research, or educational
  use.

It will provide localized links to the author portfolio, LinkedIn, ORCID, and the
GitHub profile/repository. External links open in a new tab with `rel="noreferrer"`.

### Internal pages

Add a compact author reference to the training index, lesson pages, and challenge.
The author name links to the portfolio and GitHub links to the repository. The
challenge's existing technical footer remains intact, including fixed simulation
step, client-side physics, educational use, and no runtime AI.

Lesson pages omit the author reference while Presentation Mode is active so
projection remains focused on the lesson content.

## Design and architecture

Create one presentational component, `ProjectAttribution`, with two variants:

- `about`: full landing section;
- `compact`: small internal-page reference.

The component reads localized copy through the existing `useMessages` provider and
does not import simulation, training, or challenge logic. This keeps authorship
presentation separate from the domain and application layers and avoids duplicating
URLs or link markup.

Add About copy to the landing message namespace. Add compact footer copy to the
common message namespace so training and challenge can reuse the same contract.
Use the existing CSS variables, typography, spacing, dark palette, focus states,
and responsive breakpoints. On narrow screens, the About layout stacks and its
links wrap into comfortable touch targets.

## Files in scope

- `components/project-attribution.tsx`
- `components/landing-page.tsx`
- `components/landing-page.test.tsx`
- `components/landing-page.isolation.test.ts`
- `components/training/lesson-index.tsx`
- `components/training/lesson-player.tsx`
- `components/training/lesson-player.test.tsx`
- `components/game-dashboard.tsx`
- `components/game-dashboard.test.tsx`
- `lib/i18n/messages/en/landing.ts`
- `lib/i18n/messages/es/landing.ts`
- `lib/i18n/messages/en/common.ts`
- `lib/i18n/messages/es/common.ts`
- `app/globals.css`
- `README.md`

No simulation, scoring, PID, lesson definitions, scenario, worker, or physics
files are in scope.

## Acceptance criteria

1. The landing renders the About section after the existing briefing in English
   and Spanish according to the active locale.
2. Portfolio, LinkedIn, ORCID, GitHub profile, and repository URLs are exact.
3. Training index and challenge render the compact attribution without removing
   their existing content.
4. Lesson pages render compact attribution in standard mode and hide it in
   Presentation Mode.
5. The challenge retains all existing technical footer information.
6. Desktop and mobile layouts use the existing visual system and preserve usable
   focus and touch targets.
7. README explains that the project started during OpenAI Build Week and continued
   as an independent educational project, retains the GPT-5.6/Codex section, adds
   Author links, and keeps the educational disclaimer.
8. Relevant frontend tests pass, followed by `make check`.

## Test plan

- Extend landing tests for section visibility, exact external URLs, and Spanish
  copy.
- Add component tests for both attribution variants and their link targets.
- Extend training index and challenge tests for compact attribution.
- Extend lesson-player tests to assert standard-mode visibility and
  Presentation-Mode absence.
- Preserve the landing isolation test to ensure the new section does not introduce
  simulation runtime dependencies.
- Run the relevant Vitest tests, then the repository quality gate with `make check`.

## Risks and mitigations

- Long Spanish labels may crowd small screens. Use wrapping flex links and the
  existing mobile breakpoints, then inspect the built layout at desktop and mobile
  widths if the local browser environment permits.
- Adding the compact attribution to the challenge could compete with the technical
  footer. Keep it visually subordinate and place it as a separate author line
  without changing the technical labels.
- Locale hydration must follow the existing provider/store pattern. The component
  will render from `useMessages` and introduce no new locale state.
