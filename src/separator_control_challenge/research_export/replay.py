"""Build one ResearchReplayV1 document from one eng_dacs run."""

from __future__ import annotations

import math
from itertools import pairwise
from typing import TYPE_CHECKING, Any

from separator_control_challenge.research_export.contract import (
    CODE_TABLES,
    CONTRACT_VERSION,
    DISCLAIMER,
    EXPORTER_NAME,
    EXPORTER_VERSION,
    INSTRUMENTATION,
    LOOP_TRUTH_KEY,
    SAMPLE_INTERVAL_S,
    SCHEMA_REPLAY,
    SCHEMA_VERSION,
    SIGNALS_BY_KEY,
    assert_valid,
    validate_replay,
)
from separator_control_challenge.research_export.dataset import DatasetError
from separator_control_challenge.research_export.encode import encode_column
from separator_control_challenge.research_export.provenance import (
    criteria_block,
    evidence_block,
    source_block,
    variant_block,
)

if TYPE_CHECKING:
    from separator_control_challenge.research_export.dataset import Dataset, Trace
    from separator_control_challenge.research_export.policy import (
        PublicationPolicy,
        ReplayRequest,
    )

PLANT_STATE_TRIPPED = 5
#: Metric groups of run.json copied verbatim (all are model results).
METRIC_GROUPS = ("control", "steps", "loops", "valves", "startup", "operating_point")


def replay_id(dataset_id: str, run_id: str) -> str:
    return f"{dataset_id}/{run_id}"


def replay_file_name(dataset_id: str, run_id: str) -> str:
    return f"replays/{dataset_id}/{run_id}.json.gz"


def _phases(trace: Trace, times: list[float]) -> list[dict[str, Any]]:
    """Contiguous runs of the recorded ``phase`` column."""
    names = trace.column("phase")
    phases: list[dict[str, Any]] = []
    for index, name in enumerate(names):
        if phases and phases[-1]["name"] == name:
            phases[-1]["endS"] = times[index]
            phases[-1]["endIndex"] = index
        else:
            phases.append(
                {
                    "name": str(name),
                    "startS": times[index],
                    "endS": times[index],
                    "startIndex": index,
                    "endIndex": index,
                }
            )
    return phases


def _phase_origin_tick(
    phases: list[dict[str, Any]], name: str, steps: list[int]
) -> int | None:
    """eng_dacs counts phase-relative seconds from the tick before the phase."""
    for phase in phases:
        if phase["name"] == name:
            return steps[phase["startIndex"]] - 1
    return None


def _event(
    events: list[dict[str, Any]],
    *,
    t: float,
    kind: str,
    origin: str,
    source: str,
    detail: dict[str, Any],
    severity: str = "info",
    verified: bool | None = None,
) -> None:
    event = {
        "id": f"e{len(events):03d}",
        "tS": t,
        "kind": kind,
        "severity": severity,
        "origin": origin,
        "source": source,
        "detail": detail,
    }
    if verified is not None:
        event["verified"] = verified
    events.append(event)


def _recorded_events(
    record: dict[str, Any], trace: Trace, steps: list[int], events: list[dict[str, Any]]
) -> None:
    for position, item in enumerate(record.get("events", [])):
        _event(
            events,
            t=float(item["step"]) * SAMPLE_INTERVAL_S,
            kind="command",
            origin="recorded",
            source=f"run.json events[{position}]",
            detail={
                "command": item.get("command"),
                "argument": item.get("argument"),
                "result": item.get("result"),
                "phase": item.get("phase"),
            },
        )
    for position, modifier in enumerate(
        record.get("protocol", {}).get("modifiers", [])
    ):
        for record_item in modifier.get("records", []):
            if record_item.get("event") != "armed":
                continue
            _event(
                events,
                t=float(record_item["step"]) * SAMPLE_INTERVAL_S,
                kind="fault",
                origin="recorded",
                source=f"run.json protocol.modifiers[{position}].records",
                severity="warning",
                detail={
                    "modifier": modifier.get("name"),
                    "valve": record_item.get("valve"),
                    "parameters": record_item.get("parameters"),
                    "accepted": record_item.get("accepted"),
                },
            )
    # Setpoint changes, alarms and plant-state transitions as recorded per tick.
    for loop in ("gas", "oil", "water"):
        column = f"{loop}_loop_sp"
        if not trace.has(column):
            continue
        values = trace.column(column)
        for index in range(1, len(values)):
            if values[index] != values[index - 1]:
                _event(
                    events,
                    t=float(steps[index]) * SAMPLE_INTERVAL_S,
                    kind="setpoint_change",
                    origin="recorded",
                    source=f"trace {column}",
                    detail={
                        "loop": loop,
                        "controller": INSTRUMENTATION[loop]["controller"],
                        "from": values[index - 1],
                        "to": values[index],
                    },
                )
    for key, spec in SIGNALS_BY_KEY.items():
        if spec.group != "alarm" or not trace.has(spec.column):
            continue
        values = trace.column(spec.column)
        for index in range(1, len(values)):
            if bool(values[index]) != bool(values[index - 1]):
                _event(
                    events,
                    t=float(steps[index]) * SAMPLE_INTERVAL_S,
                    kind="alarm_on" if values[index] else "alarm_off",
                    origin="recorded",
                    source=f"trace {spec.column}",
                    severity="warning" if values[index] else "info",
                    detail={"alarm": key.split(".", 1)[1]},
                )
    if trace.has("plant_state"):
        states = trace.column("plant_state")
        codes = CODE_TABLES["plant.state"]["codes"]
        for index in range(1, len(states)):
            if states[index] != states[index - 1]:
                tripped = states[index] == PLANT_STATE_TRIPPED
                detail: dict[str, Any] = {
                    "from": codes.get(str(states[index - 1]), str(states[index - 1])),
                    "to": codes.get(str(states[index]), str(states[index])),
                }
                if tripped and trace.has("first_out"):
                    detail["firstOut"] = trace.column("first_out")[index]
                _event(
                    events,
                    t=float(steps[index]) * SAMPLE_INTERVAL_S,
                    kind="trip" if tripped else "plant_state",
                    origin="recorded",
                    source="trace plant_state",
                    severity="critical" if tripped else "info",
                    detail=detail,
                )
    if trace.has("nodal_status"):
        statuses = trace.column("nodal_status")
        codes = CODE_TABLES["well.nodal_status"]["codes"]
        for index in range(1, len(statuses)):
            if statuses[index] != statuses[index - 1]:
                _event(
                    events,
                    t=float(steps[index]) * SAMPLE_INTERVAL_S,
                    kind="well_state",
                    origin="recorded",
                    source="trace nodal_status",
                    severity="warning" if statuses[index] == 2 else "info",
                    detail={
                        "from": codes.get(
                            str(statuses[index - 1]), str(statuses[index - 1])
                        ),
                        "to": codes.get(str(statuses[index]), str(statuses[index])),
                    },
                )


def _verify_band_exit(
    trace: Trace,
    steps: list[int],
    phases: list[dict[str, Any]],
    loop: str,
    exit_tick: int,
    sp_ref: float,
    band: float,
) -> bool:
    """The exit tick is the first hold tick whose truth PV leaves the band."""
    column = SIGNALS_BY_KEY[LOOP_TRUTH_KEY[loop]].column
    hold = next(p for p in phases if p["name"] == "hold")
    values = trace.column(column)
    for index in range(hold["startIndex"], hold["endIndex"] + 1):
        if abs(values[index] - sp_ref) > band:
            return steps[index] == exit_tick
    return False


def _evaluation_events(
    record: dict[str, Any],
    trace: Trace,
    steps: list[int],
    phases: list[dict[str, Any]],
    events: list[dict[str, Any]],
) -> None:
    control = record.get("evaluation", {}).get("metrics", {}).get("control") or {}
    hold = control.get("hold") or {}
    origin_tick = _phase_origin_tick(phases, "hold", steps)
    if hold and origin_tick is not None:
        first_exit = hold.get("first_exit_s")
        loop = hold.get("first_exit_loop")
        if first_exit is not None and loop in LOOP_TRUTH_KEY:
            loop_metrics = hold["loops"][loop]
            exit_tick = origin_tick + int(first_exit)
            verified = _verify_band_exit(
                trace,
                steps,
                phases,
                loop,
                exit_tick,
                float(loop_metrics["sp_ref"]),
                float(loop_metrics["band"]),
            )
            if not verified:
                raise DatasetError(
                    f"{record['run_id']}: hold.first_exit_s does not match the trace"
                )
            _event(
                events,
                t=float(exit_tick) * SAMPLE_INTERVAL_S,
                kind="band_exit",
                origin="evaluation",
                source="run.json evaluation.metrics.control.hold.first_exit_s",
                severity="critical",
                verified=True,
                detail={
                    "loop": loop,
                    "controller": INSTRUMENTATION[loop]["controller"],
                    "secondsFromPhaseStart": first_exit,
                    "phase": "hold",
                    "band": loop_metrics["band"],
                    "spRef": loop_metrics["sp_ref"],
                },
            )
        pad_lost = hold.get("oil_pad_lost_s")
        if pad_lost is not None:
            _event(
                events,
                t=float(origin_tick + int(pad_lost)) * SAMPLE_INTERVAL_S,
                kind="oil_pad_lost",
                origin="evaluation",
                source="run.json evaluation.metrics.control.hold.oil_pad_lost_s",
                severity="critical",
                verified=False,
                detail={"secondsFromPhaseStart": pad_lost, "phase": "hold"},
            )
    for step in control.get("steps") or []:
        settling = step.get("settling_s")
        phase_name = f"step_{step.get('loop')}"
        step_origin = _phase_origin_tick(phases, phase_name, steps)
        if settling is None or step_origin is None or not math.isfinite(settling):
            continue
        _event(
            events,
            t=float(step_origin + int(settling)) * SAMPLE_INTERVAL_S,
            kind="settled",
            origin="evaluation",
            source="run.json evaluation.metrics.control.steps[].settling_s",
            verified=False,
            detail={
                "loop": step.get("loop"),
                "controller": INSTRUMENTATION.get(str(step.get("loop")), {}).get(
                    "controller"
                ),
                "secondsFromPhaseStart": settling,
                "phase": phase_name,
                "class": step.get("class"),
                "settlingBand": step.get("settling_band"),
            },
        )


def _signals(
    dataset: Dataset, trace: Trace, policy: PublicationPolicy
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    signals: list[dict[str, Any]] = []
    missing: list[dict[str, Any]] = []
    for key in policy.signals:
        spec = SIGNALS_BY_KEY[key]
        meta = dataset.trace_columns.get(spec.column)
        if not trace.has(spec.column) or meta is None:
            missing.append(
                {
                    "key": key,
                    "originalName": spec.column,
                    "reason": "column absent from this dataset's trace or column dictionary",
                }
            )
            continue
        signal = {
            "key": key,
            "originalName": spec.column,
            "unit": str(meta.get("unit", "")),
            "kind": str(meta.get("kind", "")),
            "source": str(meta.get("source", "")),
            "description": str(meta.get("description", "")),
            "role": spec.role,
            "interpolation": spec.interpolation,
            "group": spec.group,
            "loop": spec.loop,
        }
        signal.update(encode_column(spec, trace.column(spec.column)))
        signals.append(signal)
    return signals, missing


def _constraints(evaluation: dict[str, Any]) -> list[dict[str, Any]]:
    closest = evaluation.get("closest")
    keep = (
        "id",
        "category",
        "severity",
        "value",
        "threshold",
        "utilization",
        "attributed_to",
    )
    return [
        {k: c.get(k) for k in keep}
        for c in evaluation.get("constraints", [])
        if c.get("severity") != "info" or c.get("id") == closest
    ]


def _metrics(evaluation: dict[str, Any]) -> dict[str, Any]:
    metrics = evaluation.get("metrics", {})
    return {group: metrics[group] for group in METRIC_GROUPS if group in metrics}


def _variant(dataset: Dataset, variant_id: str) -> dict[str, Any]:
    variants = dataset.manifest.get("variants") or [
        dataset.manifest.get("variant") or {}
    ]
    for variant in variants:
        if variant.get("variant_id") == variant_id:
            return variant
    return {}


def build_replay(
    dataset: Dataset,
    request: ReplayRequest,
    policy: PublicationPolicy,
    generated_at: str,
) -> dict[str, Any]:
    record = dataset.run_record(request.run)
    columns = ["step", "phase"] + [SIGNALS_BY_KEY[k].column for k in policy.signals]
    trace = dataset.trace(request.run, list(dict.fromkeys(columns)))
    steps = [int(s) for s in trace.column("step")]
    if any(b - a != 1 for a, b in pairwise(steps)):
        raise DatasetError(f"{request.run}: ticks are not consecutive")
    if len(steps) != int(record.get("ticks", len(steps))):
        raise DatasetError(f"{request.run}: trace length differs from run.json ticks")
    times = [float(s) * SAMPLE_INTERVAL_S for s in steps]
    phases = _phases(trace, times)

    events: list[dict[str, Any]] = []
    _recorded_events(record, trace, steps, events)
    _evaluation_events(record, trace, steps, phases, events)
    events.sort(key=lambda e: (e["tS"], e["kind"]))
    for position, event in enumerate(events):
        event["id"] = f"e{position:03d}"

    signals, missing = _signals(dataset, trace, policy)
    evaluation = record.get("evaluation", {})
    protocol = record.get("protocol", {})
    controller = (evaluation.get("metrics", {}).get("control") or {}).get(
        "controller"
    ) or (protocol.get("controller") or {})
    factors = record.get("factors", {})
    constants = protocol.get("plant_constants", {})

    doc: dict[str, Any] = {
        "schema": SCHEMA_REPLAY,
        "schemaVersion": SCHEMA_VERSION,
        "contractVersion": CONTRACT_VERSION,
        "replayId": replay_id(dataset.dataset_id, request.run),
        "generatedAt": generated_at,
        "exporter": {
            "name": EXPORTER_NAME,
            "version": EXPORTER_VERSION,
            "policyId": policy.policy_id,
        },
        "source": source_block(dataset, request.documentation, request.run),
        "evidence": evidence_block(dataset),
        "run": {
            "runId": request.run,
            "scenarioId": record.get("scenario_id"),
            "variantId": record.get("variant_id"),
            "seed": int(record.get("seed", 0)),
            "block": record.get("block"),
            "variant": variant_block(_variant(dataset, str(record.get("variant_id")))),
            "controller": {
                "policy": controller.get("policy") or controller.get("name"),
                "params": controller.get("params"),
                "valid": controller.get("valid"),
                "records": [
                    {
                        "loop": item.get("loop"),
                        "event": item.get("event"),
                        "requested": item.get("requested"),
                        "running": item.get("running"),
                        "accepted": item.get("accepted"),
                        "tS": float(item["step"]) * SAMPLE_INTERVAL_S
                        if item.get("step") is not None
                        else None,
                    }
                    for item in controller.get("records") or []
                ],
            },
            "setpointSteps": protocol.get("setpoint_steps") or [],
            "factors": {k: factors[k] for k in policy.factors if k in factors},
            "plantConstants": {
                k: constants[k] for k in policy.plant_constants if k in constants
            },
            "outcome": evaluation.get("outcome"),
            "dominantConstraint": evaluation.get("dominant"),
            "closestConstraint": evaluation.get("closest"),
            "closestUtilization": evaluation.get("closest_utilization"),
            "tripped": bool(protocol.get("tripped", False)),
        },
        "instrumentation": INSTRUMENTATION,
        "codeTables": CODE_TABLES,
        "time": {
            "unit": "s",
            "origin": "plant boot; tick k is the plant state after k seconds",
            "sampleIntervalS": SAMPLE_INTERVAL_S,
            "intervalSource": "trace_columns.json: step = tick index since boot (1 s per tick)",
            "startS": times[0],
            "endS": times[-1],
            "count": len(times),
        },
        "phases": [
            {"name": p["name"], "startS": p["startS"], "endS": p["endS"]}
            for p in phases
        ],
        "events": events,
        "signals": signals,
        "missingSignals": missing,
        "metrics": _metrics(evaluation),
        "metricsSource": "run.json evaluation.metrics (eng_dacs evaluation and control_evaluation)",
        "constraints": _constraints(evaluation),
        "criteria": criteria_block(dataset),
        "privacy": policy.privacy_block(),
        "disclaimer": DISCLAIMER,
    }
    assert_valid(validate_replay(doc), doc["replayId"])
    return doc
