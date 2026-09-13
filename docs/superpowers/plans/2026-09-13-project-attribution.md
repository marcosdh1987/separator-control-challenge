# Project attribution and shared footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bilingual independent-project attribution to the landing page and a reusable compact author footer to internal pages without changing simulator behavior.

**Architecture:** A presentational `ProjectAttribution` component will read active-locale copy from the existing i18n provider and expose `about` and `compact` variants. The challenge keeps its technical footer and adds the compact attribution as a separate author line; lesson presentation mode omits the compact variant.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library, existing CSS variables and message catalogues.

---

### Task 1: Add failing attribution and integration tests

**Files:**
- Create: `components/project-attribution.test.tsx`
- Modify: `components/landing-page.test.tsx`
- Modify: `components/training/lesson-player.test.tsx`
- Modify: `components/game-dashboard.test.tsx`

- [x] **Step 1: Write tests for both attribution variants, exact URLs, active Spanish copy, and presentation-mode visibility.**
- [x] **Step 2: Run the focused tests and confirm they fail because the component and integrations do not exist.**

Run: `npm test -- components/project-attribution.test.tsx components/landing-page.test.tsx components/training/lesson-player.test.tsx components/game-dashboard.test.tsx`

Expected: failures for missing attribution headings/links and missing compact footer integration.

### Task 2: Implement shared copy and presentation component

**Files:**
- Create: `components/project-attribution.tsx`
- Modify: `lib/i18n/messages/en/landing.ts`
- Modify: `lib/i18n/messages/es/landing.ts`
- Modify: `lib/i18n/messages/en/common.ts`
- Modify: `lib/i18n/messages/es/common.ts`

- [x] **Step 1: Add typed English and Spanish About messages, compact footer messages, and exact external URLs.**
- [x] **Step 2: Implement `ProjectAttribution` with `about` and `compact` variants, accessible headings, external-link attributes, and no simulation imports.**
- [x] **Step 3: Run the component tests and confirm they pass.**

Run: `npm test -- components/project-attribution.test.tsx`

Expected: PASS.

### Task 3: Integrate attribution into routes and style it

**Files:**
- Modify: `components/landing-page.tsx`
- Modify: `components/training/lesson-index.tsx`
- Modify: `components/training/lesson-player.tsx`
- Modify: `components/game-dashboard.tsx`
- Modify: `app/globals.css`

- [x] **Step 1: Render the full About variant after the landing briefing.**
- [x] **Step 2: Render compact attribution on the training index, standard lesson pages, and challenge; omit it when a lesson has `presenting === true`, while preserving the challenge technical footer.**
- [x] **Step 3: Add responsive, focus-visible, dark-theme styles using the existing variables and breakpoints.**
- [x] **Step 4: Run all focused frontend tests and confirm they pass.**

Run: `npm test -- components/project-attribution.test.tsx components/landing-page.test.tsx components/training/lesson-player.test.tsx components/game-dashboard.test.tsx`

Expected: PASS.

### Task 4: Update README and verify the complete change

**Files:**
- Modify: `README.md`
- Modify: `components/landing-page.isolation.test.ts` if required by the final import graph

- [x] **Step 1: Update English and Spanish README narrative to describe the post-Build-Week independent project, add the Author links, and retain educational disclaimers and the GPT-5.6/Codex section.**
- [x] **Step 2: Review the diff for unrelated changes and confirm no physics/simulation files changed.**
- [x] **Step 3: Run `npm run lint`, `npm run typecheck`, the complete frontend test suite, `npm run build`, and `make check`.**
- [x] **Step 4: Inspect the rendered landing and internal footer at desktop and mobile widths when the local browser tooling is available.**

Expected: all checks pass; no runtime behavior changes.
