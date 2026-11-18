# Model card: what this simulator does and does not represent

> **Language**: English (canonical technical reference).

This document exists so that nobody has to guess how far the simulator can be
trusted. It is written for the person deciding whether to use it in a course, and
for the person who later wonders whether a number it produced means anything.

The short version: **this is a teaching model, not a digital twin.** It is designed
so that the *behaviour* a trainee learns transfers to a real separator. The
*numbers* are not calibrated against any real vessel and must never be used for
field operation, equipment sizing, safety analysis, or controller commissioning.

## Intended use

- Teaching PID control on a process that behaves like a real one: coupled
  inventories, real valve authority limits, saturation, windup, sensor noise.
- Letting a trainee reach a failure — a trip, carry-over conditions, a saturated
  valve — without consequences, and see why it happened.
- Supporting a well-testing course, either instructor-led or self-paced.

## Out of scope

- Sizing, rating or specifying any vessel, valve or instrument.
- Predicting the behaviour of a specific real separator.
- Deriving or validating a tuning to be loaded into a real controller.
- Any safety-related analysis or decision.

## Fidelity by subsystem

| Subsystem | What is modelled | Basis | Confidence |
|---|---|---|---|
| Vessel geometry | Circular-segment volume of a horizontal cylinder, level recovered by bisection | Exact geometry | High |
| Liquid inventories | Two immiscible incompressible phases, explicit mass balance at a fixed 0.05 s step | First principles | High |
| Hydrostatic head | Per-phase head, with the water outlet carrying the oil column above it | First principles | High |
| Cold start | Empty vessel, shut-in well, gradual feed ramp, low-protection arming during fill | Standard field practice | High |
| Liquid valves | Opening-proportional flow with a square-root pressure-drop term | Simplified; not an ISA-75.01 Kv | Medium |
| Actuators | First-order lag with a stroke rate limit, well factor ramp on opening/closing | Standard model | Medium |
| Controllers | Parallel PID, conditional-integration anti-windup, derivative on a filtered measurement | Standard model | High |
| Sensors | Sample-and-hold with seeded uniform noise | Simplified | Medium |
| Gas cap pressure | Real-gas `P = nRTZ/V`, semi-implicit molar balance with sub-stepping, blanket at header pressure on start | First principles | Medium-high |
| Compressibility Z | Dranchuk & Abou-Kassem (1975), Sutton (1985) pseudo-criticals | Published correlation | High |
| Gas valve | IEC 60534-2-1 compressible sizing, metric Kv, with choked flow | Standard | Medium-high |
| Scoring | Weighted deduction model over tracking, stability, recovery, safety and valve effort; window opens at establishment | Invented for teaching | Not physical |

## What this simulator does not model

Each of these is a real phenomenon that a real separator has and this one does not.
Where a lesson mentions one, it is describing the world, not the model.

- **Separation efficiency.** The inlet stream is split into oil and water instantly
  and perfectly by its water cut. There is no settling, no Stokes-law dependence on
  droplet size, viscosity or temperature.
- **Emulsions and the rag layer.** No stable emulsion band forms between the phases,
  so an interface measurement here is cleaner than in the field.
- **Carry-over and carry-under.** Liquid entrainment in the gas outlet and gas
  entrainment in the liquid outlets are not simulated. Levels can reach the values
  where these would occur, and the alarms mark those regions, but the consequence is
  not modelled.
- **Flashing and vapour-liquid equilibrium.** A pressure drop does not liberate gas
  from the liquid phase. Gas enters only through the feed's gas-oil ratio.
- **Heat transfer.** Gas temperature is a constant. There is no Joule-Thomson
  cooling, no ambient loss, no heater.
- **Foam, solids, sand or scale.**
- **Vessel internals.** No weir, no mist extractor, no vortex breaker, no inlet
  device. Their effects are neither helped nor hindered.
- **Upstream and downstream.** No choke, no flowline, no pressure interaction with a
  well or a downstream header beyond a fixed discharge pressure.
- **Valve mechanical faults.** No stiction, dead band, seat leakage or trim wear.
- **Safety instrumented systems.** The trips here end the exercise. They are not a
  model of a SIS, a relief valve, or any protective function, and nothing here
  should inform one.

## Determinism

A run is fully determined by its configuration, scenario and seed. The physics step
is fixed at 0.05 s and playback speed changes only how fast the run is drawn, never
the trajectory. The well-opening ramp is deterministic: `wellFactor` advances at a fixed rate (`dtS / feedRampS` per step), so the same configuration, scenario, and seed always produce the same liquid level trajectory. Golden runs are checked into the repository and asserted on every test run; they are the contract that a change to the code did not silently change the physics.

## Where the numbers come from

Default vessel dimensions, flows and gas properties are plausible for a small
well-testing separator but are not taken from a specific unit. Where a published
correlation is used it is named in `docs/physical-model.md` with its citation. Where
a value was chosen for teaching reasons — the gas valve Kv, the alarm ladder, the
scoring weights — that is stated as such.

## Known limitations that could mislead

- **The interface looks easier than it is.** With no rag layer and no emulsion, a
  trainee may leave with more confidence in interface control than the field will
  reward.
- **Scores are not a measure of competence.** The scoring model is an invented
  teaching device. It ranks attempts against each other on this model; it does not
  measure anything about a person or a real loop.
- **Valve behaviour is simplified.** Real installed characteristics, hysteresis and
  stiction change tuning outcomes materially. A tuning that works here is a starting
  point for thinking, not a setting.

## Provenance

The gas-phase model and several helper correlations were ported from the author's
DACS research platform, which models the same equipment at higher fidelity. The
teaching material draws on the author's doctoral research notes on well testing and
separator control. Neither is a validation of this simulator: they are the source of
its structure, not evidence of its accuracy.

## The Research Lab is a different simulator

The `/research` pages replay recorded runs of eng_dacs, the author's DACS research
simulator, exported offline under a publication policy. Nothing on those pages is
computed by this simulator, and nothing in this card applies to them: eng_dacs has its
own physics, parameters, evidence classes and limitations, which each replay states.
Its well cases are synthetic and uncalibrated. See [Research Lab](research-lab.md).

