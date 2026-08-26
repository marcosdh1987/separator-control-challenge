# Current context

> Living snapshot of where the project is right now. Update at the start and end of
> a working session. Keep it short — archive stale items to `learnings.md` or delete.

## Project

- Separator Control Challenge is a standalone educational browser game for two-phase
  PID level-control tuning. The Python package remains governance only.

## Active focus

- The two-phase release is implemented and merged: oil and water inventories, two PID
  loops (LIC-101 total level, IIC-101 interface), six scenarios, scored runs, and a
  Three.js hero with an SVG fallback.
- An approved eight-phase plan turns the game into a bilingual open-source teaching
  resource for well-testing courses: F0 hardening, F1 Spanish/English i18n, F2 gas cap
  plus a pressure loop, F3 P&ID mimic, F4 field-operator UX, F5 run analysis and a
  deterministic coach, F6 guided lessons and instructor mode, F7 public release.
- Phase 0 is done: scene robustness, one source of truth for scene geometry and
  scenario difficulty, and doc rewrites.
- Phase 1 is done: the app is bilingual. The simulation engine now reports structured
  codes instead of English prose, and all visible text comes from typed message
  catalogues. See `docs/i18n.md`.
- Phases 3 to 7 are done: an ISA-5.1 P&ID view switchable with the 3D scene, a
  field-operator layer (PB/Ti/Td notation, level in millimetres, residence time),
  post-run analysis with a deterministic coach and a tuning debrief, a seven-lesson
  course at `/training` with instructor presentation mode, and an Apache-2.0 release
  with a model card and an optional static export.
- Phase 2 is done: gas cap and pressure loop fully implemented. Separator now models
  a compressible gas phase with real-gas thermodynamics (Dranchuk & Abou-Kassem 1975),
  semi-implicit molar balance with 10 sub-steps per 0.05 s physics step, and a third
  PID loop for pressure control via proportional backpressure valve. New scenario
  `gor-surge` tests pressure disturbance isolation. Six golden runs (original two-loop
  model) remain bit-for-bit unchanged. Documentation updated: `docs/physical-model.md`
  has new gas section, `docs/scoring.md` reflects pressure loop in tracking/stability
  budget, ADR-0003 explains protocol versioning and optional gas config.
- **Cold-start and live well control** implemented: simulator now begins with empty vessel,
  shut-in well, and ramped feed opening (15 s default); well can be toggled live via
  `set-well` command (protocol version 3). Low-side protections arm when each signal first
  reaches its normal range, staying armed for the run (standard field practice). Scoring
  begins when total level enters target band (`establishedAtS`). Gas cap initializes
  blanketted at header pressure (2 bar abs); working pressure builds during fill. Scenario
  perturbations re-timed: feed-step at 180 s, slug 185–205 s, restriction at 195 s,
  slow-water-dump at 180 s, gor-surge at 190 s. Default `durationS` now 300 s (was 180 s);
  `feedRampS` default 15 s. Golden runs regenerated as new physics baseline. Lection 1
  now teaches full cold-start sequence. Documentation updated: physical model cold-start
  section, scoring establishment window, model-card fidelity table, Spanish instructor guide.

## Constraints & decisions in force

- Physics runs at a fixed 0.05-second step inside a Web Worker; playback speed never
  changes the trajectory. See `docs/adr/0002-run-simulation-in-a-web-worker.md`.
- The application has no backend, authentication, telemetry, or runtime network I/O,
  and uses no AI at runtime. The planned coach is deterministic for the same reason.
- Model parameters are generic and educational, not suitable for field use.
- Explicit exclusions: gas phase, coalescence, compressibility, temperature, and relief
  devices. See `docs/physical-model.md` for the full list.
- Golden runs are the determinism contract. Only the gas-loop phase may regenerate them,
  and only for newly added gas-enabled runs.

## Open threads / next steps

- Finish Phase 0, then start Phase 1 (i18n) before writing any new user-facing prose,
  so nothing has to be translated twice.
- Keep all work unstaged and create commits manually when ready.
