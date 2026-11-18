# ADR-0004: Replay research runs from an offline, policy-gated static export

- **Status:** Proposed
- **Date:** 2026-11-17
- **Deciders:** Project owner
- **Related:** [Research Lab](../research-lab.md), [ADR-0002](0002-run-simulation-in-a-web-worker.md), eng_dacs ADR-0016 and ADR-0017 (private)

## Context

The Research Lab shows experiments that were run in eng_dacs, a separate research
simulator (DACS digital twin and virtual PLC). Four constraints shape how:

- **Two simulators, never mixed.** The site's educational engine and eng_dacs use
  different equations and parameters. Recomputing an eng_dacs result with the
  educational engine, or presenting the two as physically equivalent, would be wrong.
- **Public site, private source.** This repository is public (Apache-2.0) and has no
  runtime or build-time dependency on private repositories. eng_dacs is private, and
  its well presets derive from measured field operating points.
- **No backend.** The site is prerendered, runs on Vercel or as plain static files,
  and has no server code, telemetry or runtime network I/O beyond its own assets.
- **Scientific traceability.** A replay must show exactly what eng_dacs recorded,
  say which values are observed and which are drawn between samples, and quote the
  report's numbers only where the data reproduces them.

## Decision

We will publish selected eng_dacs runs as versioned static documents produced by an
offline exporter, and replay them in a read-only viewer:

1. **Exporter** (`src/separator_control_challenge/research_export/`, Python, offline):
   reads eng_dacs dataset folders without importing eng_dacs or running it, and
   writes `ResearchReplayV1`, campaign summaries, an envelope map and an index under
   `public/research/v1/` as deterministic gzip JSON.
2. **Publication policy** (`research/publication-policy.json`): deny by default. It
   lists every dataset, run, signal, factor and plant constant that may leave
   eng_dacs, and documents what is withheld. The exporter refuses anything else and
   refuses to write a document that contains private identifiers or local paths.
3. **Lossless encoding with per-signal digests.** Values decode to the exact float64
   eng_dacs stored (float32 register columns are stored as float32 text and restored
   with `Math.fround`); a SHA-256 per signal lets tests and the browser prove it.
4. **Signal semantics fixed in the contract.** Only physical states are interpolated
   between ticks; registers, commands, setpoints, codes and alarms are held. Missing
   signals are listed, never synthesised.
5. **Viewer** (`lib/research/`, `components/research/`, `/research` routes): fetches
   files on demand, validates them against the same contract, and never calls the
   educational engine. Documented claims are re-derived from the loaded data.

## Consequences

- The site keeps working without eng_dacs, a backend or a GPU; Vercel serves the data
  as static assets. Adding a run means editing the policy and re-exporting.
- Published data is a reviewed snapshot: re-running eng_dacs does not change the site
  until someone re-exports and commits. The index records the policy hash, so a policy
  edit without a re-export fails the tests.
- About 6.6 MB of compressed data enters the repository for 17 runs. Longer or more
  numerous runs will need the same per-run lazy loading (already in place) and a size
  review before committing.
- Two validators (Python and TypeScript) must stay in step; a cross-language test
  compares their signal tables, and both validate the committed files.
- The policy is a human checkpoint: the exporter cannot decide on its own that a
  field-derived value is publishable. The current policy carries a review note for
  the centre-point water cut and GOR.

## Alternatives considered

- **Run eng_dacs, or an API in front of it, behind the site.** Rejected: needs a
  permanent backend, exposes a private system and breaks the static, offline model.
- **Recompute experiments with the educational engine.** Rejected: different physics;
  the result would no longer be the experiment.
- **Ship Parquet and read it in the browser.** Rejected: adds a WASM/Arrow dependency,
  makes privacy filtering harder to review, and gains little over gzip JSON at these
  sizes.
- **Downsample traces for size.** Rejected: identity with the source is a requirement;
  charts decimate at draw time instead, keeping every extreme.
