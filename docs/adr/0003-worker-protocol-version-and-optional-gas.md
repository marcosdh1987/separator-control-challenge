# ADR-0003: Version the Worker protocol and keep the gas cap optional

- **Status:** Accepted
- **Date:** 2026-08-26
- **Deciders:** Project owner and implementation team
- **Related:** [ADR-0002](0002-run-simulation-in-a-web-worker.md), [physical model](../physical-model.md)

## Context

Adding the gas cap gave the simulator a third control loop. Two things changed at
once, and each carried a risk that only shows up later.

The first is the message contract. The Web Worker boundary from ADR-0002 is a
structured-clone channel with no schema: whatever the page posts, the runtime reads.
`SimulationConfig` gained a `gas` block, `DualPidConfig` gained a `pressure`
controller, and `SimulationSample` gained pressure and gas readings. A page and a
worker built from different revisions would not fail loudly — the worker would read
a message it half understands and run a simulation nobody asked for.

The second is the existing model. Six golden runs pin the two-loop liquid simulator
to exact final volumes, tracking errors and scores. They are the project's
determinism contract, and the early lessons in the course are built on that
behaviour. A gas phase that changed those trajectories would invalidate both.

## Decision

**Version the protocol explicitly.** `WORKER_PROTOCOL_VERSION` in
`lib/simulation/types.ts` names the revision of the request and event shapes.
`initialize` carries an optional `protocolVersion`; `SimulationRuntime` rejects a
value it does not recognise with an error event rather than proceeding. The field is
optional so that a caller that predates versioning still works, but any caller that
states a version must state the right one. Bump the constant whenever a request or
event shape changes.

**Make the gas cap an optional block, defaulting to absent.** `SimulationConfig.gas`
and `DualPidConfig.pressure` are optional. With no gas block the engine never
constructs a pressure controller, never integrates a gas balance, and never emits
pressure samples or pressure metrics. Scenario state carries a `gorFactor` that only
the gas model reads, so a gas disturbance is inert in a two-loop run.

This follows the DACS convention that every realism parameter has a no-op default,
which is what lets a course add one mechanism at a time.

## Consequences

The six original golden runs are unchanged, byte for byte, and were re-verified as
such after the gas work landed. The seventh (`gor-surge`) was added without touching
them. A lesson can therefore teach two-loop level control on exactly the model the
earlier lessons described, and enable the third loop only when it is the subject.

Types express the option rather than a flag: code that reads `sample.pressure` must
handle its absence, so a run without gas cannot silently read a zero. `RunMetrics`
follows the same shape with `pressureLoop` and `gasActuator`.

The cost is a permanent branch in the engine and in scoring. It is a branch the
product wants — the two-loop model is a teaching configuration, not dead code — but
it is two paths to keep tested, which is why `gas-engine.test.ts` asserts both.

A stale page paired with a fresh worker now fails visibly instead of producing a
plausible wrong run. The failure surfaces as the existing worker error banner, which
already offers a retry.

## Alternatives considered

**Infer the revision from the message shape.** Rejected: it guesses. The absence of a
`gas` block is a legitimate configuration, not evidence of an old client, so shape
cannot distinguish "two-loop run" from "client that does not know about gas".

**Fill in defaults for anything missing.** Rejected for the same reason, and worse:
defaulting an absent `gas` block to the standard gas configuration would silently
turn every two-loop run into a three-loop one and break the golden runs.

**Make gas always present and disabled by a boolean.** Rejected: an `enabled: false`
block still has to be carried, sanitised and reasoned about everywhere, and it invites
code that reads the gas fields without checking the flag. Optionality is checked by
the compiler; a boolean is not.

**Negotiate the version between page and worker on start-up.** Rejected as
disproportionate. Both sides ship from the same build; the version check exists to
catch a stale cached page, and for that a rejection is enough.
