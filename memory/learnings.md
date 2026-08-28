# Learnings

> Non-obvious facts discovered while working: gotchas, why-it-is-this-way, dead ends
> to avoid. Append new entries at the top. One fact per entry.

## The reverse-acting PID already contains the start-up behaviour — 2026-08-26

Cold start needed no controller logic: with the vessel empty, the reverse-acting
error (PV − SP) saturates the output at its low limit, conditional anti-windup
holds the integrator, and the valve leaves its seat only as the level nears the
setpoint. The visible "valves stay shut while filling, then open near SP" is
emergent from the same PID the equilibrium start used.

**Why it matters:** the first instinct was to script the start-up (force valves
shut, release at a threshold), which would have created a second control path to
maintain and test.
**How to apply:** before scripting a behaviour, check whether the existing physics
already produces it from the right initial conditions.

## Lesson thresholds must be measured, not guessed — 2026-08-26

Every pass mark in `lib/training/lessons.ts` was set by sweeping tunings and reading
the result, and each one carries a comment with the numbers behind it. The first
draft used round guesses and produced two lessons that could not be passed by doing
what they taught, and one criterion that could never fail at any tuning.

**Why it matters:** a course that fails a correct answer teaches distrust, and a
criterion that cannot fail is decoration pretending to be assessment.
**How to apply:** before pinning a threshold, run the scenario at the tunings a
trainee would plausibly try, including the bad end, and check the bound separates
them. Where it does not separate anything, remove the criterion rather than keep it.

## Reading browser state belongs in an external store, not an effect — 2026-08-26

Locale, process-view preference and course progress are all read through
`useSyncExternalStore` with a server snapshot, not `useState` plus an effect. The
repo's lint rule rejects the effect form, and it is right to: the page is
prerendered, so an effect that calls setState both mismatches the server markup and
causes a cascading render.

**How to apply:** module-level store with `subscribe` / `getSnapshot` /
`getServerSnapshot`, where the server snapshot is whatever the prerendered HTML
shows. See `lib/i18n/store.ts` as the pattern.

## Playwright exit codes vanish through a pipe — 2026-08-26

`npm run test:e2e 2>&1 | tail -20` reports tail's exit status, not Playwright's. A
suite where twelve specs were failing looked green for a whole phase because of it.

**How to apply:** redirect to a file and check `$?`, or read the pass/fail counts in
the summary. Never infer an E2E result from piped output.

## Explicit semi-implicit molar balance prevents pressure collapse on wide-open valve — 2026-08-26

When the backpressure valve is wide open and gas inflow is near design duty, an
explicit forward-Euler update can overshoot past zero moles in a single 5 ms sub-step,
causing separator pressure to collapse to zero on screen. This looks like a physics
bug but is actually a numerical stability issue. Switching to semi-implicit (backward-Euler
linearized) solved it: `n_new = (n_old + inlet · dt) / (1 + outlet_per_mole · dt)`.
This stays unconditionally stable because outflow is nearly linear in held moles
(pressure tracks moles at fixed V and T), so the implicit solve has a unique stable
root. Without sub-stepping, a 0.05 s step is too coarse; with 10 sub-steps at 5 ms,
the implicit scheme relaxes smoothly to equilibrium. Gas is much stiffer than liquids
(seconds vs minutes), so explicit methods fail where implicit ones thrive.

## Keeping optional gas config bit-for-bit preserves golden runs without regeneration — 2026-08-26

Making `GasConfig` optional in `SimulationConfig` and pressure `PidConfig` optional
in `DualPidConfig` means that old scenarios (normal, feed-step, water-rich-slug,
oil-outlet-restriction, slow-water-dump, noisy-interface) run the exact same physics
when `gas` is absent. The six existing golden runs used those scenarios. By not touching
a single line of two-loop physics, we regenerate zero golden runs despite adding a
third lazo—the coupling happens only if `config.gas` is defined. This is why the
decision to version the Worker protocol mattered: old clients stay compatible, and
new clients have to opt in to gas behavior.

## Inline block comments with glob patterns close early in TypeScript — 2026-08-26

Writing a comment like `// This logs messages/*/education.ts` inside a `/* ... */`
block comment closes the comment before the text ends because `*/` terminates it.
The compiler then sees `education.ts` and beyond as code, producing a baffling syntax
error. Workaround: escape the `*` or use a different comment style. Example:
`/* ... messages /* */education.ts ... */` will still fail; use
`/* ... messages /*/education.ts ... */` or switch to `// ...` style for that line.
This caught us in the scoring.ts comment explaining the pressure loop's role; the
typo would have silently broken if we had not caught it during review.

## React Three Fiber Canvas mounts its own reconciler, breaking context crossing — 2026-08-26

The scene setup in `components/separator-scene.tsx` wraps the `<Canvas>` inside
React context providers for i18n and other state. However, React Three Fiber's
Canvas mounts its own React reconciler, so context does not cross into it. Components
inside `<Canvas>` cannot read context directly; they must pass values as props or use
a separate context provider inside the Canvas. This is not a bug—it is by design to
isolate Three.js rendering from React's scheduler. Workaround: compute derived values
outside Canvas and pass them down, or create a mirrored provider inside Canvas if the
overhead is acceptable.

## CI must provision both locked dependency environments — 2026-07-21

`make check` verifies both Python and frontend code. Its Python drift guard can
create and synchronize `.venv`, but its frontend stage deliberately fails when
`node_modules` is absent. GitHub Actions must set up a compatible Node version and
run `npm ci` before `make check`; a Python-only install cannot satisfy the complete
quality gate.

## Next.js development origins must match for Worker E2E tests — 2026-07-20

Use `http://localhost:3000` consistently for the Playwright base URL and Next.js
development server. Loading the page from `127.0.0.1` while the server advertises
`localhost` can block development resources and leave a module Worker uninitialized.
Keep Start disabled until the Worker emits its ready event so a fast first click
cannot drop initialization messages.

## Claude Code gateway model names must match native alias resolution — 2026-07-07

Claude Code reads the generated `.claude/agents/*.md` `model:` frontmatter for
subagents. To make gateway-routed Claude Code behave like direct Claude Code, use
Claude Code's native aliases in agent frontmatter (`opus`, `sonnet`, `haiku`,
`fable`) and pin them with `ANTHROPIC_DEFAULT_OPUS_MODEL`,
`ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, and
`ANTHROPIC_DEFAULT_FABLE_MODEL`. The gateway must expose the exact full model IDs
Claude Code resolves to (`claude-opus-4-8`, `claude-sonnet-5`,
`claude-haiku-4-5-20251001`, `claude-fable-5`). Nonstandard local aliases such as
`claude-opus-4.8-oauth` may work as legacy LiteLLM names, but they bypass Claude
Code's native alias/capability model and can produce misleading entitlement or
model-selection behavior.

## OpenCode gateway model ids mirror LiteLLM aliases — 2026-06-23

When LiteLLM exposes a model as `model_name: nim-*`, OpenCode should list the key
under `provider.gateway.models` without the provider prefix and select it as
`gateway/<model_name>` in `.env`. The NVIDIA API key stays in the gateway config;
the repo only needs `GATEWAY_BASE_URL` and `GATEWAY_TOKEN`.

## Antigravity skill manifest tracks generated ownership — 2026-06-29

`.agents/skills/.generated-manifest.tsv` is the skills_sync ownership list, not a
complete inventory of every local `.agents/skills/*/SKILL.md` directory. Runtime or
local-only skill dirs can sit beside generated skills; manifest/hash tests should
iterate manifest entries, not every local skill directory.

## How this template is wired for agents — 2026-06-22

The single source of truth for governance and skills lives in `.github/`; native
tool layouts (`.claude/`, `.opencode/`, `.agents/`, `.codex/`) are **generated** by
the `skills_sync` engine. Never hand-edit generated skill links or the region
between the `BEGIN/END GENERATED SKILLS` sentinels in adapter files — run
`make sync-skills` instead, and `make check-sync` to verify nothing is stale.

**Why it matters:** hand-edits to generated artifacts are silently overwritten and
break the CI drift gate.
**How to apply:** edit `.github/skills/*.md` (source) and regenerate.

## Editorial register for all user-facing copy - 2026-08-28

Spanish copy (i18n messages, lessons, instructor guide) uses neutral Latin American
Spanish in a professional technical register: tuteo imperatives, no Rioplatense
voseo, no colloquialisms. Technical terms are glossed on first use in both languages
(carry-over, rag layer, windup, slug, flashing, GOR, chattering, surge volume);
field terms said in English stay in English inside Spanish text with a Spanish
gloss. Em-dashes are banned from prose in both languages (replace with colon, comma,
or parentheses); the bare "—" missing-value placeholder in `lib/education/units.ts`
formatters is the one deliberate exception.

**Why it matters:** the audience is working industry engineers/technicians; register
and terminology carry credibility, and em-dashes read as AI-generated text.
**How to apply:** keep new copy in this register; the style notes live in the header
comments of `lib/i18n/messages/es/education.ts` and `es/onboarding.ts`. Tests assert
some literal strings (landing headline, gain technical names, score-closed banner),
so update the matching test when copy changes.

<!-- Add new learnings above this line -->
