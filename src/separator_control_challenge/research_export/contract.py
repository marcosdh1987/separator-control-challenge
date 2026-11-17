"""The ResearchReplayV1 contract: identifiers, signal map, code tables, validation.

The browser-side twin of this module is ``lib/research/contract.ts``. Both
sides implement the same rules; ``tests/research_export`` checks the Python
side and ``lib/research/*.test.ts`` checks every committed bundle with the
TypeScript validator.

Signal semantics are fixed here, not guessed at export time:

* ``continuous`` signals are physical states of the eng_dacs plant model
  (pressure, levels, flows). Only they may be interpolated linearly between
  two recorded ticks.
* ``discrete`` signals are register values, controller outputs, setpoints,
  modes, codes and alarm bits. They are held (zero-order hold) between ticks,
  because that is what a sampled register is, and because a valve under
  stiction moves in jumps that a straight line would misrepresent.

Units, kinds and sources are never written here: they are copied from the
dataset's own ``trace_columns.json`` so the bundle states what eng_dacs
recorded.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from itertools import pairwise
from typing import Any, Literal

SCHEMA_REPLAY = "scc.research-replay"
SCHEMA_CAMPAIGN = "scc.research-campaign-summary"
SCHEMA_ENVELOPE = "scc.research-envelope-map"
SCHEMA_INDEX = "scc.research-index"
SCHEMA_VERSION = 1
CONTRACT_VERSION = "1.0.0"
EXPORTER_NAME = "separator_control_challenge.research_export"
EXPORTER_VERSION = "1.0.0"

#: eng_dacs ``trace_columns.json`` documents ``step`` as "tick index since boot
#: (1 s per tick)". The interval is that documented value, and the exporter
#: refuses a trace whose ticks are not consecutive.
SAMPLE_INTERVAL_S = 1.0

DISCLAIMER = (
    "Results of eng_dacs, a research simulator with synthetic, uncalibrated well "
    "cases. Not field data and not a validated industrial control system. The "
    "educational simulator of this site uses different, simpler equations and "
    "is not physically equivalent."
)

Role = Literal["continuous", "discrete"]
Interpolation = Literal["linear", "hold"]
Encoding = Literal["dense", "changes"]
NumberKind = Literal["float", "int"]
NumberFormat = Literal["f64", "f32", "int"]
STAGES = ("confirmatory", "exploratory")
EVENT_KINDS = (
    "command",
    "fault",
    "setpoint_change",
    "alarm_on",
    "alarm_off",
    "trip",
    "plant_state",
    "well_state",
    "band_exit",
    "settled",
    "oil_pad_lost",
)
EVENT_ORIGINS = ("recorded", "evaluation")


@dataclass(frozen=True)
class SignalSpec:
    """How one eng_dacs trace column becomes one exported signal."""

    key: str
    column: str
    role: Role
    number: NumberKind
    group: str
    loop: str | None = None

    @property
    def interpolation(self) -> Interpolation:
        return "linear" if self.role == "continuous" else "hold"

    @property
    def encoding(self) -> Encoding:
        # Registers that change at most a few times per run are stored as change
        # points; everything sampled every tick is stored densely.
        return "changes" if self.group in _CHANGE_GROUPS else "dense"


_CHANGE_GROUPS = frozenset(
    {"setpoint", "mode", "plant", "well", "alarm", "boundary", "choke"}
)

SIGNALS: tuple[SignalSpec, ...] = (
    # Physical states of the plant model (truth): the only interpolable signals.
    SignalSpec(
        "pressure.truth",
        "separator_pressure_truth_bar",
        "continuous",
        "float",
        "pressure",
        "gas",
    ),
    SignalSpec(
        "level.total.truth",
        "total_level_truth_pct",
        "continuous",
        "float",
        "level",
        "oil",
    ),
    SignalSpec(
        "level.interface.truth",
        "interface_level_truth_pct",
        "continuous",
        "float",
        "level",
        "water",
    ),
    SignalSpec(
        "flow.inlet_liquid.truth",
        "inlet_liquid_truth_m3_h",
        "continuous",
        "float",
        "flow",
    ),
    SignalSpec(
        "flow.oil.truth", "oil_flow_truth_m3_h", "continuous", "float", "flow", "oil"
    ),
    SignalSpec(
        "flow.water.truth",
        "water_flow_truth_m3_h",
        "continuous",
        "float",
        "flow",
        "water",
    ),
    SignalSpec(
        "flow.gas_std.truth",
        "gas_std_flow_truth_sm3_h",
        "continuous",
        "float",
        "flow",
        "gas",
    ),
    # Instrument readings (registers): held between ticks.
    SignalSpec(
        "pressure.measured",
        "separator_pressure_meas_bar",
        "discrete",
        "float",
        "measured",
        "gas",
    ),
    SignalSpec(
        "level.total.measured",
        "total_level_meas_pct",
        "discrete",
        "float",
        "measured",
        "oil",
    ),
    SignalSpec(
        "level.interface.measured",
        "interface_level_meas_pct",
        "discrete",
        "float",
        "measured",
        "water",
    ),
    # What each PLC loop sees, wants and commands.
    SignalSpec("loop.gas.pv", "gas_loop_pv", "discrete", "float", "loop", "gas"),
    SignalSpec("loop.oil.pv", "oil_loop_pv", "discrete", "float", "loop", "oil"),
    SignalSpec("loop.water.pv", "water_loop_pv", "discrete", "float", "loop", "water"),
    SignalSpec("loop.gas.sp", "gas_loop_sp", "discrete", "float", "setpoint", "gas"),
    SignalSpec("loop.oil.sp", "oil_loop_sp", "discrete", "float", "setpoint", "oil"),
    SignalSpec(
        "loop.water.sp", "water_loop_sp", "discrete", "float", "setpoint", "water"
    ),
    SignalSpec("loop.gas.mode", "gas_loop_mode", "discrete", "int", "mode", "gas"),
    SignalSpec("loop.oil.mode", "oil_loop_mode", "discrete", "int", "mode", "oil"),
    SignalSpec(
        "loop.water.mode", "water_loop_mode", "discrete", "int", "mode", "water"
    ),
    # Valve command in force (PLC output) versus the modelled stem position.
    SignalSpec(
        "valve.gas.command", "gas_loop_output_pct", "discrete", "float", "valve", "gas"
    ),
    SignalSpec(
        "valve.oil.command", "oil_loop_output_pct", "discrete", "float", "valve", "oil"
    ),
    SignalSpec(
        "valve.water.command",
        "water_loop_output_pct",
        "discrete",
        "float",
        "valve",
        "water",
    ),
    SignalSpec(
        "valve.gas.stem", "gas_valve_stem_pct", "discrete", "float", "valve", "gas"
    ),
    SignalSpec(
        "valve.oil.stem", "oil_valve_stem_pct", "discrete", "float", "valve", "oil"
    ),
    SignalSpec(
        "valve.water.stem",
        "water_valve_stem_pct",
        "discrete",
        "float",
        "valve",
        "water",
    ),
    # Plant and well state.
    SignalSpec("plant.state", "plant_state", "discrete", "int", "plant"),
    SignalSpec("plant.shut_in_status", "shut_in_status", "discrete", "int", "plant"),
    SignalSpec("plant.trip_causes", "trip_causes", "discrete", "int", "plant"),
    SignalSpec("plant.first_out", "first_out", "discrete", "int", "plant"),
    SignalSpec("well.nodal_status", "nodal_status", "discrete", "int", "well"),
    SignalSpec(
        "well.no_flow_reason", "nodal_no_flow_reason", "discrete", "int", "well"
    ),
    SignalSpec("well.whp", "whp_effective_bar", "discrete", "float", "wellhead"),
    SignalSpec("choke.bean", "bean_64th", "discrete", "float", "choke"),
    SignalSpec(
        "boundary.water_cut", "water_cut_boundary_pct", "discrete", "float", "boundary"
    ),
    SignalSpec("boundary.gor", "gor_boundary_sm3_sm3", "discrete", "float", "boundary"),
    # PLC alarms (DI bits).
    SignalSpec("alarm.pah", "pah", "discrete", "int", "alarm", "gas"),
    SignalSpec("alarm.lah", "lah", "discrete", "int", "alarm", "oil"),
    SignalSpec(
        "alarm.high_water_level",
        "high_water_level",
        "discrete",
        "int",
        "alarm",
        "water",
    ),
    SignalSpec("alarm.oil_overflow", "oil_overflow", "discrete", "int", "alarm", "oil"),
    SignalSpec(
        "alarm.liquid_carryover", "liquid_carryover", "discrete", "int", "alarm"
    ),
)

SIGNALS_BY_KEY: dict[str, SignalSpec] = {spec.key: spec for spec in SIGNALS}
ALARM_KEYS = tuple(spec.key for spec in SIGNALS if spec.group == "alarm")

#: The truth PV each loop's band is judged on (control_evaluation.py: "the truth PVs").
LOOP_TRUTH_KEY = {
    "gas": "pressure.truth",
    "oil": "level.total.truth",
    "water": "level.interface.truth",
}

#: Loop and valve tags of PV-WT-001. Source: eng_dacs trace_columns.json
#: ("PCV-101/LCV-102/LCV-103 modelled stem") and
#: docs/simulation/controllability_campaigns.md (LIC-102 total level,
#: LIC-103 interface, PIC-101 pressure).
INSTRUMENTATION = {
    "gas": {"controller": "PIC-101", "valve": "PCV-101", "measurement": "PT-101"},
    "oil": {"controller": "LIC-102", "valve": "LCV-102", "measurement": "LT-102"},
    "water": {"controller": "LIC-103", "valve": "LCV-103", "measurement": "LT-103"},
}

#: Code tables copied from eng_dacs enums (names and values only). The local
#: integration test re-reads the enum definitions to keep them in step.
CODE_TABLES: dict[str, dict[str, Any]] = {
    "plant.state": {
        "source": "dacs.core.virtual_plc.types.PlantState",
        "codes": {
            "0": "STOPPED",
            "1": "PRESTART_CHECK",
            "2": "STARTING",
            "3": "RUNNING",
            "4": "STOPPING",
            "5": "TRIPPED",
            "6": "RESET_PENDING",
        },
    },
    "plant.shut_in_status": {
        "source": "dacs.core.virtual_plc.types.ShutInStatus",
        "codes": {
            "0": "OPEN",
            "1": "COMMANDED",
            "2": "ACKNOWLEDGED",
            "3": "VALVES_CLOSED",
            "4": "PROCESS_CONFIRMED",
        },
    },
    "well.nodal_status": {
        "source": "dacs.core.nodal_coupling.CouplingStatus",
        "codes": {
            "0": "OFF",
            "1": "CONVERGED",
            "2": "NO_FLOW",
            "3": "SHUT_IN",
            "4": "INVALID_CONFIG",
            "5": "INCOMPATIBLE_MODE",
            "6": "UNSUPPORTED_REGIME",
            "7": "NONCONVERGED",
            "8": "STALE_INPUT",
            "9": "SOLVER_ERROR",
        },
    },
    "well.no_flow_reason": {
        "source": "dacs.core.nodal_coupling.NoFlowReason",
        "codes": {
            "0": "NONE",
            "1": "BACKPRESSURE_ABOVE_RESERVOIR",
            "2": "CANNOT_LIFT",
            "3": "CHOKE_BELOW_KICKOFF",
            "4": "WELL_SHUT_IN",
        },
    },
    "plant.trip_causes": {
        "source": "dacs.core.virtual_plc.types.TripCause (bit positions)",
        "bits": {
            "0": "PSHH",
            "1": "LSHH",
            "2": "TRANSMITTER_QUALITY",
            "3": "PROCESS_FEEDBACK_LOST",
            "4": "WHCP_HYDRAULIC_LOW",
            "5": "MANUAL_ESD",
            "6": "SCENARIO_ESD",
            "7": "TANK_HIGH_HIGH",
            "8": "START_FAILED",
            "9": "KO_DRUM_HIGH_HIGH",
        },
    },
    "loop.mode": {
        "source": "eng_dacs trace_columns.json (0 MANUAL 1 AUTO)",
        "codes": {"0": "MANUAL", "1": "AUTO"},
    },
}

_SHA256 = re.compile(r"^[0-9a-f]{64}$")


class ContractError(ValueError):
    """A document does not satisfy the contract."""


def _require(condition: bool, message: str, errors: list[str]) -> None:
    if not condition:
        errors.append(message)


def _is_number(value: Any) -> bool:
    return isinstance(value, int | float) and not isinstance(value, bool)


def _check_header(doc: dict[str, Any], schema: str, errors: list[str]) -> None:
    _require(doc.get("schema") == schema, f"schema must be {schema!r}", errors)
    _require(
        doc.get("schemaVersion") == SCHEMA_VERSION,
        f"schemaVersion must be {SCHEMA_VERSION}",
        errors,
    )
    version = str(doc.get("contractVersion", ""))
    _require(
        version.split(".")[0] == str(SCHEMA_VERSION),
        "contractVersion major must match schemaVersion",
        errors,
    )
    _require(isinstance(doc.get("generatedAt"), str), "generatedAt is required", errors)
    _require(isinstance(doc.get("disclaimer"), str), "disclaimer is required", errors)


def _check_evidence(evidence: Any, errors: list[str]) -> None:
    if not isinstance(evidence, dict):
        errors.append("evidence must be an object")
        return
    _require(evidence.get("stage") in STAGES, "evidence.stage is invalid", errors)
    _require(
        evidence.get("calibration") in ("synthetic_uncalibrated", "calibrated"),
        "evidence.calibration is invalid",
        errors,
    )
    seeds = evidence.get("campaignSeeds")
    _require(
        isinstance(seeds, list) and all(isinstance(s, int) for s in seeds),
        "evidence.campaignSeeds must list integers",
        errors,
    )


def _check_source(source: Any, errors: list[str]) -> None:
    if not isinstance(source, dict):
        errors.append("source must be an object")
        return
    for key in ("simulator", "datasetId", "campaignId", "gitSha"):
        _require(isinstance(source.get(key), str), f"source.{key} is required", errors)
    for key in ("configSha256Raw", "sourceCodeDigest"):
        value = source.get(key)
        _require(
            value is None or (isinstance(value, str) and bool(_SHA256.match(value))),
            f"source.{key} must be a SHA-256 hex digest",
            errors,
        )


def decode_signal(signal: dict[str, Any], count: int) -> list[float]:
    """Expand a signal to one float per sample (NaN for a missing value)."""
    fmt = signal["numberFormat"]

    def as_float(raw: Any) -> float:
        if raw is None:
            return math.nan
        if fmt == "f32":
            import numpy as np

            return float(np.float64(np.float32(raw)))
        return float(raw)

    if signal["encoding"] == "dense":
        return [as_float(v) for v in signal["values"]]
    out: list[float] = []
    changes = signal["changes"]
    for position, (index, raw) in enumerate(changes):
        end = changes[position + 1][0] if position + 1 < len(changes) else count
        out.extend([as_float(raw)] * (end - index))
    return out


def _check_signal(signal: Any, count: int, errors: list[str]) -> None:
    if not isinstance(signal, dict):
        errors.append("signal must be an object")
        return
    key = signal.get("key", "?")
    spec = SIGNALS_BY_KEY.get(str(key))
    _require(spec is not None, f"signal {key}: unknown key", errors)
    for field in ("originalName", "unit", "kind", "source", "description"):
        _require(
            isinstance(signal.get(field), str),
            f"signal {key}: {field} required",
            errors,
        )
    if spec is not None:
        _require(
            signal.get("originalName") == spec.column,
            f"signal {key}: originalName must be {spec.column}",
            errors,
        )
        _require(
            signal.get("interpolation") == spec.interpolation,
            f"signal {key}: interpolation must be {spec.interpolation}",
            errors,
        )
        _require(
            signal.get("role") == spec.role, f"signal {key}: role mismatch", errors
        )
    _require(
        signal.get("numberFormat") in ("f64", "f32", "int"),
        f"signal {key}: numberFormat invalid",
        errors,
    )
    _require(
        isinstance(signal.get("digest"), str)
        and str(signal.get("digest", "")).startswith("sha256:"),
        f"signal {key}: digest required",
        errors,
    )
    encoding = signal.get("encoding")
    if encoding == "dense":
        values = signal.get("values")
        _require(
            isinstance(values, list) and len(values) == count,
            f"signal {key}: dense values must have {count} entries",
            errors,
        )
        if isinstance(values, list):
            _require(
                all(v is None or _is_number(v) for v in values),
                f"signal {key}: values must be numbers or null",
                errors,
            )
    elif encoding == "changes":
        raw_changes = signal.get("changes")
        changes: list[Any] = raw_changes if isinstance(raw_changes, list) else []
        ok = len(changes) > 0
        _require(ok, f"signal {key}: changes must be a non-empty list", errors)
        if ok:
            indices = [c[0] for c in changes if isinstance(c, list) and len(c) == 2]
            _require(
                len(indices) == len(changes),
                f"signal {key}: change = [index, value]",
                errors,
            )
            _require(
                bool(indices) and indices[0] == 0,
                f"signal {key}: first change at 0",
                errors,
            )
            _require(
                all(b > a for a, b in pairwise(indices)),
                f"signal {key}: change indices must increase",
                errors,
            )
            _require(
                all(0 <= i < count for i in indices),
                f"signal {key}: change index out of range",
                errors,
            )
    else:
        errors.append(f"signal {key}: encoding must be dense or changes")


def validate_replay(doc: Any) -> list[str]:
    """Return every contract violation of a replay document (empty when valid)."""
    errors: list[str] = []
    if not isinstance(doc, dict):
        return ["document must be an object"]
    _check_header(doc, SCHEMA_REPLAY, errors)
    _require(isinstance(doc.get("replayId"), str), "replayId is required", errors)
    _check_source(doc.get("source"), errors)
    _check_evidence(doc.get("evidence"), errors)
    run = doc.get("run")
    if isinstance(run, dict):
        for key in ("runId", "scenarioId", "variantId"):
            _require(isinstance(run.get(key), str), f"run.{key} is required", errors)
        _require(
            isinstance(run.get("seed"), int), "run.seed must be an integer", errors
        )
    else:
        errors.append("run must be an object")

    time = doc.get("time")
    count = 0
    if isinstance(time, dict):
        count = int(time.get("count", 0))
        _require(time.get("unit") == "s", "time.unit must be s", errors)
        _require(
            _is_number(time.get("sampleIntervalS")) and time["sampleIntervalS"] > 0,
            "time.sampleIntervalS must be positive",
            errors,
        )
        _require(count > 1, "time.count must be above 1", errors)
        if _is_number(time.get("startS")) and _is_number(time.get("sampleIntervalS")):
            expected_end = time["startS"] + (count - 1) * time["sampleIntervalS"]
            _require(
                _is_number(time.get("endS"))
                and abs(time["endS"] - expected_end) < 1e-9,
                "time.endS must equal startS + (count - 1) x sampleIntervalS",
                errors,
            )
    else:
        errors.append("time must be an object")

    phases = doc.get("phases")
    if isinstance(phases, list) and phases:
        previous_end = None
        for phase in phases:
            start, end = phase.get("startS"), phase.get("endS")
            _require(
                _is_number(start) and _is_number(end) and end >= start,
                f"phase {phase.get('name')}: invalid range",
                errors,
            )
            if previous_end is not None and _is_number(start):
                _require(
                    start > previous_end,
                    f"phase {phase.get('name')}: phases must not overlap",
                    errors,
                )
            previous_end = end
    else:
        errors.append("phases must be a non-empty list")

    for event in doc.get("events", []):
        _require(
            event.get("kind") in EVENT_KINDS, f"event kind {event.get('kind')}", errors
        )
        _require(
            event.get("origin") in EVENT_ORIGINS,
            f"event origin {event.get('origin')}",
            errors,
        )
        if isinstance(time, dict):
            _require(
                _is_number(event.get("tS"))
                and time.get("startS", 0) <= event["tS"] <= time.get("endS", 0),
                f"event {event.get('id')}: tS outside the recorded time",
                errors,
            )

    signals = doc.get("signals")
    if isinstance(signals, list) and signals:
        seen: set[str] = set()
        for signal in signals:
            _check_signal(signal, count, errors)
            key = str(signal.get("key")) if isinstance(signal, dict) else ""
            _require(key not in seen, f"signal {key}: duplicated", errors)
            seen.add(key)
        missing = {m.get("key") for m in doc.get("missingSignals", [])}
        _require(
            not (missing & seen), "a signal cannot be both present and missing", errors
        )
    else:
        errors.append("signals must be a non-empty list")
    _require(isinstance(doc.get("metrics"), dict), "metrics must be an object", errors)
    return errors


def validate_campaign(doc: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(doc, dict):
        return ["document must be an object"]
    _check_header(doc, SCHEMA_CAMPAIGN, errors)
    _check_source(doc.get("source"), errors)
    _check_evidence(doc.get("evidence"), errors)
    table = doc.get("controlSteps")
    if table is not None:
        columns = table.get("columns", [])
        _require(
            isinstance(columns, list) and bool(columns), "controlSteps.columns", errors
        )
        _require(
            all(
                isinstance(r, list) and len(r) == len(columns)
                for r in table.get("rows", [])
            ),
            "controlSteps rows must match columns",
            errors,
        )
    return errors


ENVELOPE_OUTCOMES = (
    "outside_model",
    "inadmissible",
    "inconclusive",
    "marginal",
    "admissible",
)


def validate_envelope(doc: Any) -> list[str]:
    errors: list[str] = []
    if not isinstance(doc, dict):
        return ["document must be an object"]
    _check_header(doc, SCHEMA_ENVELOPE, errors)
    _check_source(doc.get("source"), errors)
    _check_evidence(doc.get("evidence"), errors)
    axes = {a.get("key") for a in doc.get("axes", [])}
    _require(len(axes) >= 2, "an envelope map needs at least two axes", errors)
    points = doc.get("points", [])
    _require(
        isinstance(points, list) and bool(points),
        "points must be a non-empty list",
        errors,
    )
    for point in points:
        _require(
            point.get("outcome") in ENVELOPE_OUTCOMES,
            f"point {point.get('runId')}: outcome",
            errors,
        )
        values = point.get("values", {})
        _require(
            set(values) <= axes, f"point {point.get('runId')}: unknown axis", errors
        )
        _require(
            all(v is None or _is_number(v) for v in values.values()),
            f"point {point.get('runId')}: axis values must be numbers or null",
            errors,
        )
    return errors


#: Text that must never appear in a published document (outside the privacy
#: block, which names what was withheld): private preset identifiers, local
#: paths and workstation details.
FORBIDDEN_TOKENS = (
    "field_hp_",
    "baseline_provenance",
    "/Users/",
    "/home/",
    "macOS-",
    "load_plan",
    '"packages"',
    '"platform"',
)


def forbidden_tokens(doc: dict[str, Any]) -> list[str]:
    public = {key: value for key, value in doc.items() if key != "privacy"}
    text = json.dumps(public, ensure_ascii=False)
    return [token for token in FORBIDDEN_TOKENS if token in text]


def assert_valid(errors: list[str], what: str) -> None:
    if errors:
        raise ContractError(f"{what} violates the contract: " + "; ".join(errors[:10]))
