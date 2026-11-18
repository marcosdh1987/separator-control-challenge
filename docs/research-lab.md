# Research Lab

The Research Lab (`/research`) replays experiments that were run in **eng_dacs**, a
separate research simulator (the DACS digital twin and virtual PLC of the
well-testing separator PV-WT-001). Nothing is simulated in the browser: every frame
comes from a recorded, published and verified trace. It is read-only.

What it is not:

- It is not this site's educational simulator. `/training` and `/challenge` run the
  engine in `lib/simulation`; the Research Lab never calls it. The two simulators use
  different equations and parameters and are **not physically equivalent**.
- It is not field data and not a validated industrial control system. Every published
  scenario is synthetic and uncalibrated (`exploratory_synthetic` in eng_dacs).

Decision record: [ADR-0004](adr/0004-research-lab-static-replays-from-offline-export.md).

## Run it locally (macOS)

Requirements are those of the site (Node.js 20.19+/22.13+/24+, npm, Python 3.11,
`uv`, Make). No Docker, GPU, Omniverse or eng_dacs checkout is needed to view it.

```bash
npm install
npm run dev            # or: make run-dev
open http://localhost:3000/research
```

The published data is already committed under `public/research/v1/`. To check it:

```bash
make research-verify                                   # index, hashes, contract, privacy scan
make research-verify ENG_DACS_RUNS=../../dev/eng_dacs/experiments/envelope/runs
                                                       # plus sample-by-sample identity with eng_dacs
```

## Architecture

```
eng_dacs dataset folders (private, local)                 public site (static)
  manifest.json, trace_columns.json,       offline        public/research/v1/
  runs/<id>/run.json, trace.parquet,  ──►  exporter  ──►    index.json
  results/*.parquet                        (Python,         replays/<dataset>/<run>.json.gz
                                            policy-gated)   campaigns/<dataset>.json.gz
                                                            envelope/<dataset>.json.gz
                                                                   │ fetch on demand
                                                                   ▼
                       lib/research: loaders → decode (validate, digests) → timeline
                       (sampling) → playback (clock) → alignment → claims
                       components/research: catalogue, player, 3D scene, P&ID,
                       charts, metrics, claims, learning, envelope explorer
```

- **Exporter**: `src/separator_control_challenge/research_export/` (CLI:
  `python -m separator_control_challenge.research_export export|verify|check-identity`).
  It reads dataset files with `pyarrow`; it does not import eng_dacs, run a
  simulation or modify the dataset.
- **Contract**: `contract.py` (producer) and `lib/research/contract.ts` (consumer)
  implement the same rules. `lib/research/contract.test.ts` compares their signal
  tables.
- **Viewer**: `app/research/` (catalogue, `[experimentId]`, `envelope`,
  `replay/[dataset]/[run]`), all prerendered; data is fetched at run time from the
  site's own static files, so the static export (`STATIC_EXPORT=1`) and a `BASE_PATH`
  both work.

## The ResearchReplayV1 contract

`schema: "scc.research-replay"`, `schemaVersion: 1`, `contractVersion: "1.0.0"`. A
reader refuses any other major version. One document is one eng_dacs run.

| Block | Content |
|---|---|
| `replayId` | `<datasetId>/<runId>` |
| `source` | simulator, repository (marked `private`), dataset and campaign ids, curated campaign description (from the policy), dataset contract version and date, git SHA and branch, count of uncommitted files at run time, campaign config SHA-256 (raw and resolved), one digest of the source-file hash map, run digest and spec hash, SHA-256 of `trace.parquet` and `run.json`, recorded reproductions, documentation references |
| `evidence` | `stage` (`confirmatory` or `exploratory`, from the campaign config; a stage-1 campaign that declares none is `exploratory` with `stageDeclared: false`), `calibration` (`synthetic_uncalibrated`), scenario evidence class, model uncertainties stated by the campaign, campaign seeds, frozen-criteria hash |
| `run` | run, scenario, variant ids, seed, block; controller policy, parameters, provenance class, allow-listed literature references and verified requests; modifiers (valve faults); setpoint steps; allowlisted factors and plant constants; stage-1 outcome, dominant and closest constraint |
| `instrumentation` | PIC-101/PCV-101/PT-101, LIC-102/LCV-102/LT-102, LIC-103/LCV-103/LT-103 |
| `codeTables` | plant state, shut-in status, nodal status, no-flow reason, trip-cause bits, loop mode (copied from the eng_dacs enums; a local test re-reads them) |
| `time` | `unit: "s"`, `sampleIntervalS: 1` (eng_dacs: one tick per second), `startS`, `endS`, `count`; tick *k* is the plant state after *k* seconds |
| `phases` | contiguous runs of the recorded `phase` column |
| `events` | see below |
| `signals` | see below |
| `missingSignals` | allowlisted signals absent from this dataset, with the reason. Never synthesised. |
| `metrics` | `run.json` evaluation groups copied verbatim: `control` (hold, steps, controller), `loops`, `valves`, `startup`, `operating_point` |
| `constraints` | non-informational constraints and the closest one |
| `criteria` | campaign thresholds and control criteria (bands, saturation fraction, fast settling time, ...) |
| `privacy` | policy id and hash, list of withheld fields with reasons |
| `disclaimer` | the not-field-data, not-validated statement |

### Signals

Each signal carries `key`, `originalName` (the eng_dacs column), `unit`, `kind`,
`source` and `description` copied from the dataset's `trace_columns.json`, plus:

| Field | Meaning |
|---|---|
| `role` / `interpolation` | `continuous` / `linear` for physical states of the plant model (separator pressure, total level, interface, liquid/oil/water/gas flows, all "truth"); `discrete` / `hold` for everything else: instrument registers, PLC PV/SP/output, valve stems, modes, codes, alarms, boundaries |
| `encoding` | `dense` (`values[]`, one per tick) or `changes` (`[[index, value], ...]`, first at index 0) |
| `numberFormat` | `f64`, `f32` (every value of the column is exactly a float32; stored as the shortest float32 text and restored with `Math.fround` / `numpy.float32`) or `int` |
| `nullCount` | NaN samples, stored as `null` |
| `digest` | `sha256:` over the decoded column as little-endian float64, NaN canonicalised |

Commanded versus effective valve position is real data: `valve.<loop>.command` is the
PLC output in force (`*_loop_output_pct`), `valve.<loop>.stem` the modelled stem
(`*_valve_stem_pct`). The valve-fault block of eng_dacs (stiction, actuator lag) acts
between them.

Valve stems are held, not interpolated: under stiction the stem jumps, and a straight
line between ticks would invent a ramp.

### Events

| Kind | Origin | Source |
|---|---|---|
| `command` | recorded | `run.json` events (START, STOP, choke commands) |
| `fault` | recorded | `protocol.modifiers[].records` (valve fault armed) |
| `setpoint_change`, `alarm_on/off`, `plant_state`, `trip`, `well_state` | recorded | transitions in the trace columns |
| `band_exit` | evaluation, **verified** | `hold.first_exit_s`; the exporter checks that it is the first hold tick whose truth PV leaves the band, and stops if not |
| `settled`, `oil_pad_lost` | evaluation, not re-verified | `steps[].settling_s`, `hold.oil_pad_lost_s` |

eng_dacs counts phase-relative seconds from the tick before the phase's first tick.
The exporter and the comparison axis use the same origin, so "12,415 s into the hold"
is at 12,415 s on the axis.

### Companion documents

- `scc.research-campaign-summary`: every run of a campaign without traces: the
  `control_steps` table (class, settling, overshoot, saturation, ...) and a `runs`
  table (outcome, steady-window valve means and travel, hold class and first exit),
  each with units. Claims such as "fast in 21 of 24 steps" are checked against it.
- `scc.research-envelope-map`: one point per evaluated scenario, axes with units,
  scale and design range, outcome, dominant/closest/active constraints, catalogue
  entries (id, category, title, status), and the replay id when published.
  `interpolation: "none"`.
- `scc.research-index`: every published file with type, path, size and SHA-256, the
  policy id and hash, pending items and items that are not publishable.

## Publication policy and privacy

eng_dacs is private and this site is public. `research/publication-policy.json` is
the only list of what may be exported (`defaultDecision: "deny"`):

- 40 allowlisted signals (of 112 trace columns), 6 factors (reservoir pressure,
  productivity index, water cut, GOR, bean, pressure setpoint) and 11 plant constants.
- Withheld, with reasons in the file: the verbatim campaign YAML and its baseline
  provenance notes, the register-level load plan, the fluid and completion values of
  the field-derived centre point (API gravity, salinity, temperatures, tubing),
  workstation details, the per-file source hash map (replaced by one digest),
  uncommitted file names (replaced by a count), host timing, unlisted trace columns
  and the private report files.
- Not publishable: the eng_dacs well-case preset identifiers and provenance (the
  presets derive from measured field operating points) and the private reports.
- **Free text leaves only when curated.** eng_dacs free text (campaign descriptions,
  controller "basis" notes, constraint "basis" notes, references) names internal
  studies, register ids, modules and document paths. The policy therefore supplies:
  `datasetDescriptions` (curated text per dataset), `allowedReferences` (literature
  citations kept verbatim; other references are dropped), `verbatimFields` (free text
  copied after review; currently only the campaign's model uncertainties) and
  `signalDescriptionOverrides` (curated replacements for column descriptions that cite
  internal labels; each signal records `descriptionSource`).
- Every document, and `index.json`, is scanned before it is written and again by
  `verify` (`FORBIDDEN_TOKENS`): private preset identifiers, local paths, workstation
  fields, internal study and fidelity-register ids (`POC0`, `SF-0`), module paths
  (`dacs.core`) and private decision or process documents. The exporter refuses to
  write a document that matches.

**Review note (open):** the centre scenario of each campaign uses the boundary
conditions of a representative research operating point (water cut 20 %, GOR
199 Sm3/Sm3). eng_dacs describes them as rounded, representative values, not a
field-calibrated well. Confirm that publishing these two factor values is acceptable
before merging, or before keeping `public/research/v1/` on a public branch.

## Export procedure

```bash
# 1. Edit research/publication-policy.json (datasets, runs, documentation refs).
# 2. Export: writes public/research/v1 and verifies it (non-zero exit on problems).
make research-export ENG_DACS_RUNS=/path/to/eng_dacs/experiments/envelope/runs
# 3. Identity with the source traces and the local-only tests.
make research-verify ENG_DACS_RUNS=/path/to/eng_dacs/experiments/envelope/runs
# 4. Review the diff of public/research/v1/index.json and the policy, then commit.
```

A requested dataset or run that is not available locally is recorded in
`index.json` under `pending` and nothing is written in its place; the catalogue shows
the experiment as pending. Files the new index no longer lists are reported, and
deleted with `--prune` (the Make target passes it). Output is deterministic: gzip
with a zero timestamp, so the same inputs and `--generated-at` give the same bytes.

To add an experiment: add its runs to the policy, export, then add an entry to
`EXPERIMENTS` in `lib/research/catalog.ts` (comparison sets, anchor phase, charts,
sources, related lessons, claims) and its copy to `lib/i18n/messages/{en,es}/research.ts`.
`lib/research/published.test.ts` fails until every referenced replay is published or
pending, every comparison is paired by scenario and seed, the stated stage and seed
count match the data, and every claim reproduces.

## Viewer design

**Sampling** (`lib/research/timeline.ts`). Playback asks for arbitrary instants. On a
recorded tick a value is `observed`; between ticks a continuous signal is
`interpolated` linearly only if both neighbours are recorded, a discrete signal is
`held`; outside the run or across a gap it is `missing`. The readout and the frame
badge show which applies. The stored arrays are never modified.

**Playback** (`lib/research/playback.ts`, `hooks/use-playback-clock.ts`). Speeds ×1,
×5, ×20 and ×50 scale only how fast the clock advances. With "pause before failures"
on, the clock stops 30 simulated seconds before a band exit, trip, lost oil pad,
alarm, armed fault or a well going to no flow. Space toggles playback; the slider is a
native range input.

**Comparison** (`lib/research/alignment.ts`). Paired runs share scenario, seed and
protocol but not their clock (the start-up lasts longer under some controllers). Runs
are aligned on a named phase, the shift of each run is shown, and the pairing is
checked and stated. The anchor can be changed to any phase all runs contain.

**Views.** The 3D view reuses the training scene's vessel, phase volumes and pipes
with recorded levels, flows and valve positions (the solid disk is the stem, the
ghost disk the command); its decorative surface ripple is off. The vessel is
schematic (levels as percent of diameter, eng_dacs vessel 1.017 m × 3.0 m) and the
3D model has no gas line, so PCV-101 and the pressure are shown in the readout and the
technical view. The technical (P&ID-style) view names the eng_dacs instruments and
shows PV, SP, mode, command and stem per loop. Without WebGL the technical view is
shown.

**Charts.** SVG, memoised curves with a moving cursor. A 4 h run (16,430 samples) is
drawn with min/max decimation per pixel column: every extreme survives, nothing is
averaged, gaps break the line. Readouts use the recorded samples. Bands come from the
campaign criteria; valve travel limits appear when the valve comes near them.

**Claims** (`lib/research/claims.ts`, `catalog.ts`). Each number quoted from the
eng_dacs report is stored with its section and rounding and recomputed from the
loaded data; the page shows report value, computed value and whether they agree.
Explanations are curated text; nothing is generated at run time.

**Integrity.** On load the browser recomputes every signal digest with Web Crypto and
reports "verified bit for bit", a mismatch, or that it could not check.

## Published experiments (data as of export 2026-11-16)

| Experiment | Runs (dataset) | Evidence | Size |
|---|---|---|---|
| Deployed PID vs SIMC, LIC-103 | center and pi_1p5, nominal and `simc-tc120-f10`, seed 7200 (`control-c2-water-replication-20261115`) + campaign summary (48 runs) | confirmatory, 3 seeds, frozen criteria | 1.12 MB |
| LCV-102 actuator lag 20 s, 4 h | high_rate, M6 B and `c2simc`, seed 7100 (`control-c2-lag-followup-20261116`) | exploratory, 1 seed | 2.98 MB |
| LCV-102 stiction | center, deployed PID, M6 B, `c2simc`, seed 7100 (`control-c2-robustness-e-pilot-20261116`) | exploratory, 1 seed | 1.52 MB |
| Operating envelope | 40 evaluated scenarios + 8 representative replays (`nominal-pilot-20261113T234459Z`) | exploratory, 1 seed | 1.28 MB |

Claims re-derived from the data (all agree at the report's rounding): the 21/24 fast
and 3/24 saturated steps of the SIMC design, the deployed PID's 15 slow / 6 not within
900 s / 3 fast, center settling 179–181 s, the pi_1p5 saturation of 0.204 (above 0.20
on every seed), its 165–167 s settling and the 0.3–0.8 % LCV-103 opening; M6 B leaving
the band at 12,415 s, c2simc sustaining 4 h and the half-hour peak-to-peak series of
both; the stiction second-half peak-to-peak ranges and c2simc travel under stiction;
the envelope outcome counts and the four dominant-constraint counts.

Not published: campaign D (time-evolving wells) exists locally but is not in the
policy (shown as pending); field-calibrated cases do not exist in the study and the
field operating points behind the presets are not publishable.

## Tests and quality gates

| Where | What |
|---|---|
| `tests/research_export/` (pytest, in `make check`) | lossless encoding and digests (full text round trip, sign of zero); export on a synthetic dataset with eng_dacs' layout; identity with the source; reproducible bytes; missing columns reported, not invented; band-exit verification; privacy scan and curated free text; pending runs; policy rules; validator rejections; committed files vs index and policy |
| same, with `ENG_DACS_RUNS_ROOT` set (`make research-verify ENG_DACS_RUNS=...`) | every published sample equals the eng_dacs trace (17 replays, 680 signals, 2,869,520 samples, 0 mismatches at export); code tables equal the eng_dacs enums |
| `lib/research/*.test.ts` (Vitest) | cross-language contract drift; decoding with `Math.fround`; gzip and plain JSON; interpolation, hold and gap rules; playback speeds, stop-before, end and seek; alignment shifts and pairing; decimation keeps extremes; committed bundles decode with verified digests; timestamps consistent; every documented claim reproduces; per-frame cost on the 4 h run |
| `components/research/research.test.tsx` | catalogue availability, Spanish locale, aligned comparison with the −396 s shift, metrics, play/pause/speed/seek, WebGL fallback, the pi_1p5 exception, learning links, envelope selection and unplotted runs |
| `tests/e2e/research.spec.ts` (Playwright, desktop and mobile) | catalogue; pausing 30 s before the documented band exit at ×50; technical view; metrics and claims; keyboard play/pause; envelope point opening its replay; link from `/training`; no horizontal scroll |

## Limitations

- Every result is a model result on synthetic, uncalibrated well cases, with the
  limits eng_dacs states (no solution gas, no LCV-102 flashing, no low-level trip,
  truth PVs drive the classes). The page lists the campaign's model uncertainties.
- One seed for the robustness experiments and the envelope; no stability margins.
- The 3D vessel is schematic and has no gas line; pipe pulses are illustrative.
- Settling markers and the oil-pad event are taken from the eng_dacs evaluation and
  not re-verified against the trace (the band exit is).
- The data is a snapshot: re-running eng_dacs changes nothing until it is re-exported.
- Source documents live in a private repository; references identify them for
  reviewers with access.
