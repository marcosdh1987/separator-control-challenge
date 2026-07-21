# Current context

> Living snapshot of where the project is right now. Update at the start and end of
> a working session. Keep it short — archive stale items to `learnings.md` or delete.

## Project

- Separator Control Challenge is a standalone educational browser game for PID
  level-control tuning. The Python package remains repository governance only.

## Active focus

- The first release is implemented and passing the full local CI gate.
- An approved design now scopes a cinematic Three.js hero, separate oil and water
  inventories, and two scored PID loops.
- A self-reviewed implementation plan is ready; implementation has not started.

## Constraints & decisions in force

- Physics runs at a fixed 0.05-second step inside a Web Worker; playback speed never
  changes the trajectory. See `docs/adr/0002-run-simulation-in-a-web-worker.md`.
- The application has no backend, authentication, telemetry, or runtime network I/O.
- Model parameters are generic and educational, not suitable for field use.

## Open threads / next steps

- Execute `docs/superpowers/plans/2026-07-20-oil-water-digital-twin.md`, then run
  the complete frontend and repository quality gates.
- Keep all work unstaged and create commits manually when ready.
