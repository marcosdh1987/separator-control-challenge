"""Operating-envelope map: one point per evaluated scenario, no interpolation.

Each point is a run that eng_dacs simulated and evaluated. The document holds
no frontier: a boundary between classes is not a measured result, and with
one seed and a few dozen points it is not even well defined. Frontiers that
the source report states are curated in the site, with their method.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Any

from separator_control_challenge.research_export.contract import (
    CONTRACT_VERSION,
    DISCLAIMER,
    ENVELOPE_OUTCOMES,
    EXPORTER_NAME,
    EXPORTER_VERSION,
    SCHEMA_ENVELOPE,
    SCHEMA_VERSION,
    assert_valid,
    validate_envelope,
)
from separator_control_challenge.research_export.provenance import (
    criteria_block,
    evidence_block,
    source_block,
)
from separator_control_challenge.research_export.replay import replay_id

if TYPE_CHECKING:
    from separator_control_challenge.research_export.dataset import Dataset
    from separator_control_challenge.research_export.policy import (
        DatasetRequest,
        PublicationPolicy,
    )

#: Unit of a factor, read from the suffix of its eng_dacs name (no guessing).
_FACTOR_SUFFIX_UNITS = (
    ("_m3_d_bar", "m3/d/bar"),
    ("_sm3_sm3", "Sm3/Sm3"),
    ("_64th", "1/64 in"),
    ("_pct", "%"),
    ("_bar", "bar"),
)

#: Operating-point columns (steady-window means) and the trace column behind each.
OPERATING_POINT_AXES = (
    "op_inlet_liquid_truth_m3_h",
    "op_oil_flow_truth_m3_h",
    "op_water_flow_truth_m3_h",
    "op_gas_std_flow_truth_sm3_h",
    "op_nodal_whp_bar",
    "op_separator_pressure_truth_bar",
)

#: Outcome definitions, eng_dacs docs/simulation/operating_envelope.md section 5.
OUTCOME_DEFINITIONS = {
    "outside_model": "a model-validity constraint is violated",
    "inadmissible": "a physical, control or metrological constraint is violated",
    "inconclusive": "no steady state was reached",
    "marginal": "a non-advisory warning, or a limit at 0.8 or more of its threshold",
    "admissible": "no violation, no warning, no limit near its threshold",
}


def _factor_unit(name: str) -> str:
    for suffix, unit in _FACTOR_SUFFIX_UNITS:
        if name.endswith(suffix):
            return unit
    return "-"


def _number(value: Any) -> float | None:
    if value is None:
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def _axes(
    dataset: Dataset, policy: PublicationPolicy, runs: dict[str, list[Any]]
) -> list[Any]:
    factors = dataset.resolved_config.get("factors", {})
    axes: list[dict[str, Any]] = []
    for name in policy.factors:
        column = f"f_{name}"
        if column not in runs:
            continue
        spec = factors.get(name, {})
        axes.append(
            {
                "key": column,
                "factor": name,
                "kind": "factor",
                "unit": _factor_unit(name),
                "scale": spec.get("scale", "linear"),
                "designRange": [spec.get("low"), spec.get("high")],
                "provenance": "design factor of the campaign (boundary condition)",
            }
        )
    for column in OPERATING_POINT_AXES:
        if column not in runs:
            continue
        meta = dataset.trace_columns.get(column.removeprefix("op_"), {})
        axes.append(
            {
                "key": column,
                "factor": column.removeprefix("op_"),
                "kind": "operating_point",
                "unit": str(meta.get("unit", "-")),
                "scale": "linear",
                "designRange": None,
                "provenance": "steady-window mean of the recorded trace (eng_dacs evaluation)",
            }
        )
    return axes


def build_envelope_map(
    dataset: Dataset,
    request: DatasetRequest,
    policy: PublicationPolicy,
    generated_at: str,
) -> dict[str, Any]:
    runs = dataset.result_table("runs")
    axes = _axes(dataset, policy, runs)
    published_replays = set(request.replay_runs)
    referenced: set[str] = set()
    points = []
    for index, run_id in enumerate(runs["run_id"]):
        active = runs.get("active_constraints", [None] * len(runs["run_id"]))[index]
        active_list = [c for c in str(active).split(";") if c] if active else []
        dominant = runs["dominant_constraint"][index]
        closest = runs["closest_constraint"][index]
        referenced.update(active_list)
        referenced.update(c for c in (dominant, closest) if c)
        points.append(
            {
                "runId": run_id,
                "scenarioId": runs["scenario_id"][index],
                "block": runs["block"][index],
                "values": {
                    axis["key"]: _number(runs[axis["key"]][index]) for axis in axes
                },
                "outcome": runs["outcome"][index],
                "dominantConstraint": dominant,
                "dominantCategory": runs["dominant_category"][index],
                "closestConstraint": closest,
                "closestUtilization": _number(runs["closest_utilization"][index]),
                "activeConstraints": active_list,
                "nViolations": int(runs["n_violations"][index]),
                "nWarnings": int(runs["n_warnings"][index]),
                "startupOutcome": runs["startup_outcome"][index],
                "digest": runs["digest"][index],
                "replayId": replay_id(dataset.dataset_id, run_id)
                if run_id in published_replays
                else None,
            }
        )
    catalogue = dataset.constraint_catalogue
    # The catalogue "basis" cites internal register ids and modules: withheld.
    keep = ("id", "category", "title", "status")
    doc: dict[str, Any] = {
        "schema": SCHEMA_ENVELOPE,
        "schemaVersion": SCHEMA_VERSION,
        "contractVersion": CONTRACT_VERSION,
        "mapId": dataset.dataset_id,
        "generatedAt": generated_at,
        "exporter": {
            "name": EXPORTER_NAME,
            "version": EXPORTER_VERSION,
            "policyId": policy.policy_id,
        },
        "source": source_block(
            dataset,
            request.documentation,
            None,
            policy.descriptions.get(dataset.dataset_id),
        ),
        "evidence": evidence_block(dataset, policy.verbatim_fields),
        "axes": axes,
        "points": points,
        "outcomes": [
            {"id": o, "definition": OUTCOME_DEFINITIONS[o]} for o in ENVELOPE_OUTCOMES
        ],
        "constraints": [
            {k: catalogue[c].get(k) for k in keep}
            for c in sorted(referenced)
            if c in catalogue
        ],
        "interpolation": "none: every point is one simulated, evaluated run",
        "criteria": criteria_block(dataset),
        "privacy": policy.privacy_block(),
        "disclaimer": DISCLAIMER,
    }
    assert_valid(validate_envelope(doc), dataset.dataset_id)
    return doc
