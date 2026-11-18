"""Campaign summary: every run's classes and step results, without traces.

A replay shows a few runs; the summary shows the whole campaign so that a
claim such as "fast in 21 of 24 steps" can be checked against every seed and
scenario, including the exceptions.
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING, Any

from separator_control_challenge.research_export.contract import (
    CONTRACT_VERSION,
    DISCLAIMER,
    EXPORTER_NAME,
    EXPORTER_VERSION,
    SCHEMA_CAMPAIGN,
    SCHEMA_VERSION,
    assert_valid,
    validate_campaign,
)
from separator_control_challenge.research_export.provenance import (
    criteria_block,
    evidence_block,
    source_block,
    variant_block,
)

if TYPE_CHECKING:
    from separator_control_challenge.research_export.dataset import Dataset
    from separator_control_challenge.research_export.policy import (
        DatasetRequest,
        PublicationPolicy,
    )

#: control_steps.parquet columns and their units, from eng_dacs
#: docs/simulation/controllability_campaigns.md section 5.
STEP_COLUMNS: dict[str, str] = {
    "run_id": "-",
    "scenario_id": "-",
    "variant_id": "-",
    "seed": "-",
    "loop": "-",
    "class": "-",
    "reason": "-",
    "window_s": "s",
    "delta": "loop unit",
    "settling_band": "loop unit",
    "settling_s": "s from the step",
    "overshoot_frac": "fraction of the step",
    "overshoot_excess": "flag",
    "fraction_saturated": "fraction of the step window",
    "tail_alternations": "count",
    "decay_ratio_q4_q3": "-",
    "trip": "flag",
    "iae": "loop unit x s",
    "final_offset": "loop unit",
}

#: runs.parquet columns kept per run (stage-1 outcome and valve windows).
RUN_COLUMNS: dict[str, str] = {
    "run_id": "-",
    "scenario_id": "-",
    "variant_id": "-",
    "seed": "-",
    "outcome": "-",
    "dominant_constraint": "-",
    "digest": "-",
    "oil_valve_mean_pct": "% (steady window)",
    "water_valve_mean_pct": "% (steady window)",
    "gas_valve_mean_pct": "% (steady window)",
    "oil_valve_travel_pct_per_h": "%/h (steady window)",
    "water_valve_travel_pct_per_h": "%/h (steady window)",
    "water_fraction_seat_closed": "fraction (steady window)",
    "oil_fraction_seat_closed": "fraction (steady window)",
    "hold_class": "-",
    "hold_observed_s": "s",
    "hold_first_exit_s": "s from the hold start",
    "hold_first_exit_loop": "-",
    "hold_oil_pv_p2p_tail": "% (last drift window of the hold)",
    "hold_water_pv_p2p_tail": "% (last drift window of the hold)",
    "hold_oil_output_travel_pct_per_h": "%/h (hold)",
    "hold_water_output_travel_pct_per_h": "%/h (hold)",
}


def _cell(value: Any) -> Any:
    if isinstance(value, float) and not math.isfinite(value):
        return None
    return value


def _table(source: dict[str, list[Any]], columns: dict[str, str]) -> dict[str, Any]:
    present = [c for c in columns if c in source]
    rows = [
        [_cell(source[c][i]) for c in present]
        for i in range(len(source[present[0]]) if present else 0)
    ]
    return {"columns": present, "units": {c: columns[c] for c in present}, "rows": rows}


def build_campaign_summary(
    dataset: Dataset,
    request: DatasetRequest,
    policy: PublicationPolicy,
    generated_at: str,
) -> dict[str, Any]:
    variants = dataset.manifest.get("variants") or [
        dataset.manifest.get("variant") or {}
    ]
    doc: dict[str, Any] = {
        "schema": SCHEMA_CAMPAIGN,
        "schemaVersion": SCHEMA_VERSION,
        "contractVersion": CONTRACT_VERSION,
        "summaryId": dataset.dataset_id,
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
        "variants": [
            variant_block(v, policy.allowed_references) for v in variants if v
        ],
        "runs": _table(dataset.result_table("runs"), RUN_COLUMNS),
        "criteria": criteria_block(dataset),
        "privacy": policy.privacy_block(),
        "disclaimer": DISCLAIMER,
    }
    steps_path = dataset.root / "results" / "control_steps.parquet"
    if steps_path.is_file():
        doc["controlSteps"] = _table(
            dataset.result_table("control_steps"), STEP_COLUMNS
        )
    assert_valid(validate_campaign(doc), dataset.dataset_id)
    return doc
