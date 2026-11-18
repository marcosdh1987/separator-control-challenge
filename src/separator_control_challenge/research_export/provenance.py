"""Source, evidence and criteria blocks shared by every exported document."""

from __future__ import annotations

import hashlib
import json
from typing import TYPE_CHECKING, Any

from separator_control_challenge.research_export.contract import STAGES

if TYPE_CHECKING:
    from separator_control_challenge.research_export.dataset import Dataset
    from separator_control_challenge.research_export.policy import DocReference

SIMULATOR = "eng_dacs"
SIMULATOR_DESCRIPTION = (
    "DACS digital twin and virtual PLC of the well-testing separator PV-WT-001, "
    "run headless by the eng_dacs operating-envelope laboratory"
)
REPOSITORY = "marcosdh1987/eng_dacs"

#: Criteria keys copied verbatim from the campaign configuration. They are the
#: thresholds that turned the traces into classes, so a reader can check them.
THRESHOLD_KEYS = (
    "pressure_band_frac",
    "level_band_pct",
    "saturation_fraction",
    "oscillation_alternations_per_h",
    "tracking_overshoot_frac",
    "valve_travel_pct_per_h",
    "near_fraction",
    "retention_time_min_s",
)


def _canonical_digest(value: Any) -> str | None:
    if not value:
        return None
    text = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def source_block(
    dataset: Dataset,
    documentation: tuple[DocReference, ...],
    run_id: str | None = None,
    description: str | None = None,
) -> dict[str, Any]:
    """Where the numbers come from, without leaking private paths or hosts.

    Kept: git SHA and branch, dirty-file count, config hashes, run digest and
    spec hash, file hashes, reproduction checks. Withheld: the verbatim YAML,
    the per-file source map (only its digest is kept), packages and platform.
    """
    manifest = dataset.manifest
    provenance = manifest.get("provenance", {})
    config = manifest.get("config", {})
    block: dict[str, Any] = {
        "simulator": SIMULATOR,
        "simulatorDescription": SIMULATOR_DESCRIPTION,
        "repository": REPOSITORY,
        "repositoryAccess": "private",
        "datasetId": dataset.dataset_id,
        "campaignId": str(manifest.get("campaign_id", "")),
        # The eng_dacs description is free text from a private code base; only a
        # curated description from the publication policy is published.
        "campaignDescription": description,
        "datasetContractVersion": str(manifest.get("contract_version", "")),
        "datasetGeneratedAt": manifest.get("generated_at"),
        "gitSha": str(provenance.get("git_sha", "")),
        "gitBranch": provenance.get("git_branch"),
        "gitDirtyFileCount": len(provenance.get("git_dirty") or []),
        "configSha256Raw": config.get("sha256_raw"),
        "configSha256Resolved": config.get("resolved_sha256"),
        "sourceCodeDigest": _canonical_digest(provenance.get("source_sha256")),
        "documentation": [ref.to_json() for ref in documentation],
    }
    if run_id is not None:
        entry = dataset.run_index[run_id]
        block.update(
            {
                "runDigest": entry.get("digest"),
                "specHash": entry.get("spec_hash"),
                "traceFileSha256": dataset.output_sha256(
                    f"runs/{run_id}/trace.parquet"
                ),
                "runRecordSha256": dataset.output_sha256(f"runs/{run_id}/run.json"),
                "reproductions": [
                    {"at": item.get("at"), "identical": item["identical"][run_id]}
                    for item in manifest.get("reproductions", [])
                    if run_id in item.get("identical", {})
                ],
            }
        )
    return block


def evidence_block(
    dataset: Dataset, verbatim_fields: tuple[str, ...] = ()
) -> dict[str, Any]:
    """Stage (confirmatory or exploratory) and calibration status.

    ``stage`` comes from the campaign configuration. A stage-1 campaign that
    declares none is exploratory by eng_dacs' own reading (one seed, criteria
    not frozen), and the block says the stage was not declared.
    """
    resolved = dataset.resolved_config
    declared = resolved.get("stage")
    stage = declared if declared in STAGES else "exploratory"
    variants = dataset.manifest.get("variants") or [
        dataset.manifest.get("variant") or {}
    ]
    calibration_ids = {str(v.get("calibration_id", "")) for v in variants if v}
    calibrated = bool(calibration_ids) and all(
        cid and "uncalibrated" not in cid and "synthetic" not in cid
        for cid in calibration_ids
    )
    # scenario_provenance also carries a free-text basis naming the private
    # well-case preset; only the evidence class and the model uncertainties leave.
    scenario = resolved.get("scenario_provenance")
    scenario = scenario if isinstance(scenario, dict) else {}
    return {
        "stage": stage,
        "stageDeclared": declared in STAGES,
        "calibration": "calibrated" if calibrated else "synthetic_uncalibrated",
        "calibrationIds": sorted(calibration_ids),
        "scenarioEvidence": str(scenario.get("evidence") or "exploratory_synthetic"),
        "modelUncertainties": [str(u) for u in scenario.get("uncertainties") or []]
        if "evidence.modelUncertainties" in verbatim_fields
        else [],
        "campaignSeeds": [int(s) for s in dataset.manifest.get("seeds", [])],
        "frozenCriteriaSha256": resolved.get("frozen_criteria_sha256"),
    }


def criteria_block(dataset: Dataset) -> dict[str, Any]:
    resolved = dataset.resolved_config
    thresholds = resolved.get("thresholds") or {}
    return {
        "thresholds": {k: thresholds[k] for k in THRESHOLD_KEYS if k in thresholds},
        "controlCriteria": resolved.get("control_criteria"),
        "reportKind": resolved.get("report_kind"),
    }


def variant_block(
    variant: dict[str, Any], allowed_references: tuple[str, ...] = ()
) -> dict[str, Any]:
    """Structured controller data only.

    The free-text ``basis`` is withheld (it names internal studies and paths);
    references are kept only when the policy lists them (literature citations).
    """
    return {
        "variantId": variant.get("variant_id"),
        "policy": variant.get("policy"),
        "params": variant.get("policy_params") or {},
        "basis": None,
        "provenance": variant.get("provenance"),
        "references": [
            ref for ref in variant.get("references") or [] if ref in allowed_references
        ],
        "modifiers": list(variant.get("modifiers") or []),
    }
