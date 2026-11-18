"""A small synthetic dataset laid out exactly like an eng_dacs envelope dataset.

CI has no access to eng_dacs (a private repository), so the exporter is tested
on a dataset built here with the same files and columns. The values are made
up and only serve the tests; they are never published.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
import pytest

from separator_control_challenge.research_export.contract import SIGNALS

REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET_ID = "synthetic-campaign-20260101"
TICKS = 120
HOLD_START = 41  # first hold tick
EXIT_TICK = 90  # first hold tick outside the oil band


def _phase(step: int) -> str:
    if step <= 4:
        return "boot"
    if step <= 20:
        return "startup"
    if step < HOLD_START:
        return "steady"
    if step <= 115:
        return "hold"
    return "stop"


def _trace(fault: bool) -> dict[str, list[Any]]:
    steps = list(range(1, TICKS + 1))
    rng = np.random.default_rng(7)
    level = [50.0 + 0.01 * math.sin(s / 3.0) for s in steps]
    for index, step in enumerate(steps):
        if step >= EXIT_TICK:
            level[index] = 52.5 + 0.001 * step  # outside the 2 % band
    columns: dict[str, list[Any]] = {
        "step": steps,
        "phase": [_phase(s) for s in steps],
    }
    for spec in SIGNALS:
        if spec.number == "int":
            columns[spec.column] = [0] * TICKS
        elif spec.role == "continuous":
            columns[spec.column] = [float(v) for v in 10.0 + rng.normal(size=TICKS)]
        else:  # register values are float32 in eng_dacs
            columns[spec.column] = [
                float(np.float32(v)) for v in 40.0 + rng.normal(size=TICKS)
            ]
    columns["total_level_truth_pct"] = level
    columns["oil_loop_sp"] = [50.0] * TICKS
    columns["water_loop_sp"] = [40.0 if s < 60 else 45.0 for s in steps]
    columns["plant_state"] = [
        0 if s < 6 else 3 if s < 100 or not fault else 5 for s in steps
    ]
    columns["lah"] = [1 if 95 <= s <= 97 else 0 for s in steps]
    columns["nodal_status"] = [3 if s < 8 else 1 for s in steps]
    columns["whp_effective_bar"][3] = None  # one missing register value
    return columns


def _run_record(run_id: str, variant: str, first_exit_s: int | None) -> dict[str, Any]:
    hold_loops = {
        "oil": {"sp_ref": 50.0, "band": 2.0},
        "water": {"sp_ref": 40.0, "band": 2.0},
        "gas": {"sp_ref": 48.0, "band": 0.48},
    }
    return {
        "run_id": run_id,
        "scenario_id": "center",
        "variant_id": variant,
        "seed": 7100,
        "block": "center",
        "ticks": TICKS,
        "digest": "d" * 64,
        "spec_hash": "e" * 64,
        "factors": {
            "water_cut_pct": 20.0,
            "gor_sm3_sm3": 199.0,
            "salinity_ppm": 120000.0,
        },
        "events": [
            {"step": 9, "command": "START", "argument": 0, "result": "ACCEPTED"}
        ],
        "load_plan": {"steps": [{"address": 40921}]},
        "evaluation": {
            "outcome": "marginal",
            "dominant": None,
            "closest": "P.flowline_erosion",
            "closest_utilization": 0.9,
            "constraints": [
                {
                    "id": "P.flowline_erosion",
                    "category": "physical",
                    "severity": "info",
                },
                {"id": "C.tracking.oil", "category": "control", "severity": "warning"},
            ],
            "metrics": {
                "control": {
                    "hold": {
                        "class": "loses_band" if first_exit_s else "sustains",
                        "first_exit_s": first_exit_s,
                        "first_exit_loop": "oil" if first_exit_s else None,
                        "loops": hold_loops,
                        "oil_pad_lost_s": None,
                    },
                    "steps": [],
                    "controller": {
                        "policy": "plc_pid_nominal",
                        "params": {},
                        "valid": True,
                    },
                },
                "loops": {"oil": {"offset": 0.01}},
            },
        },
        "protocol": {
            "modifiers": [
                {
                    "name": "valve_fault",
                    "records": [
                        {
                            "event": "armed",
                            "step": HOLD_START,
                            "valve": "LCV-102",
                            "parameters": {"stiction_s_pct": 3.0},
                            "accepted": True,
                        }
                    ],
                }
            ],
            "plant_constants": {"vessel_diameter_m": 1.0168, "plc_config_crc": 1234},
            "setpoint_steps": [],
            "tripped": False,
        },
    }


def build_dataset(root: Path, *, tamper_exit: bool = False) -> Path:
    """Write the synthetic dataset under ``root`` and return its folder."""
    folder = root / DATASET_ID
    runs = [
        ("center__nominal__s7100", "nominal", EXIT_TICK - (HOLD_START - 1)),
        ("center__tuned__s7100", "tuned", None),
    ]
    trace_columns = [
        {
            "name": "step",
            "kind": "meta",
            "unit": "-",
            "source": "harness",
            "description": "tick",
        },
        {
            "name": "phase",
            "kind": "meta",
            "unit": "-",
            "source": "harness",
            "description": "phase",
        },
    ] + [
        {
            "name": spec.column,
            "kind": "truth" if spec.role == "continuous" else "plc",
            "unit": "%",
            "source": "synthetic",
            "description": f"synthetic {spec.column}",
        }
        for spec in SIGNALS
        if spec.column != "liquid_carryover"  # absent column: must stay missing
    ]
    manifest_runs = []
    for run_id, variant, first_exit in runs:
        run_dir = folder / "runs" / run_id
        run_dir.mkdir(parents=True)
        exit_s = first_exit + 1 if (tamper_exit and first_exit) else first_exit
        (run_dir / "run.json").write_text(
            json.dumps(_run_record(run_id, variant, exit_s))
        )
        columns = _trace(fault=False)
        columns.pop("liquid_carryover")
        pq.write_table(pa.table(columns), run_dir / "trace.parquet")
        manifest_runs.append(
            {
                "run_id": run_id,
                "scenario_id": "center",
                "variant_id": variant,
                "seed": 7100,
                "digest": "d" * 64,
                "spec_hash": "e" * 64,
            }
        )
    manifest = {
        "campaign_id": "synthetic-campaign",
        "contract_version": "envelope-1.0",
        "description": "Synthetic campaign for exporter tests.",
        "generated_at": "2026-01-01T00:00:00+00:00",
        "seeds": [7100],
        "config": {
            "sha256_raw": "a" * 64,
            "resolved_sha256": "b" * 64,
            "raw": "baseline:\n  water_cut_pct: 20.0  # field_hp_secret\n",
            "resolved": {
                "stage": "exploratory",
                "thresholds": {"level_band_pct": 2.0, "pressure_band_frac": 0.01},
                "control_criteria": {"horizons_s": [900]},
                "baseline_provenance": {
                    "water_cut_pct": "given: preset field_hp_secret"
                },
                "scenario_provenance": {
                    "basis": "field_hp_secret preset",
                    "evidence": "exploratory_synthetic",
                    "uncertainties": ["No solution gas."],
                },
                "factors": {"water_cut_pct": {"low": 0.0, "high": 90.0}},
            },
        },
        "provenance": {
            "git_sha": "c" * 40,
            "git_branch": "main",
            "git_dirty": ["src/private_module.py"],
            "platform": "macOS-26-arm64",
            "packages": {"numpy": "2.0"},
            "source_sha256": {"src/private_module.py": "f" * 64},
        },
        "variants": [
            {
                "variant_id": "nominal",
                "policy": "plc_pid_nominal",
                "calibration_id": "uncalibrated-synthetic",
            },
            {
                "variant_id": "tuned",
                "policy": "plc_pid_gains",
                "calibration_id": "uncalibrated-synthetic",
                # Free text as eng_dacs writes it: must not reach public files.
                "basis": "POC07 candidate from experiments/poc07/tuning.json",
                "references": [
                    "Skogestad S. (2003) Simple analytic rules.",
                    "docs/adr/0009 (private decision record)",
                ],
            },
        ],
        "runs": manifest_runs,
        "reproductions": [
            {"at": "2026-01-02T00:00:00+00:00", "identical": {runs[0][0]: True}}
        ],
        "outputs_sha256": {},
    }
    (folder / "manifest.json").write_text(json.dumps(manifest))
    (folder / "trace_columns.json").write_text(json.dumps(trace_columns))
    (folder / "constraint_catalogue.json").write_text(
        json.dumps(
            [
                {
                    "id": "P.flowline_erosion",
                    "category": "physical",
                    "title": "Erosion",
                    "basis": "API RP 14E",
                    "status": "modeled",
                },
                {
                    "id": "C.tracking.oil",
                    "category": "control",
                    "title": "Tracking",
                    "basis": "step",
                    "status": "modeled",
                },
            ]
        )
    )
    results = folder / "results"
    results.mkdir()
    pq.write_table(
        pa.table(
            {
                "run_id": [r[0] for r in runs],
                "scenario_id": ["center", "center"],
                "variant_id": [r[1] for r in runs],
                "seed": [7100, 7100],
                "block": ["center", "center"],
                "outcome": ["marginal", "inadmissible"],
                "dominant_constraint": [None, "C.tracking.oil"],
                "dominant_category": [None, "control"],
                "closest_constraint": ["P.flowline_erosion", "P.flowline_erosion"],
                "closest_utilization": [0.9, 0.95],
                "active_constraints": ["C.tracking.oil", "C.tracking.oil"],
                "n_violations": [0, 1],
                "n_warnings": [1, 0],
                "startup_outcome": ["RUNNING", "RUNNING"],
                "digest": ["d" * 64, "d" * 64],
                "f_water_cut_pct": [20.0, 30.0],
                "f_gor_sm3_sm3": [199.0, 150.0],
                "f_salinity_ppm": [120000.0, 120000.0],
                "op_inlet_liquid_truth_m3_h": [29.0, float("nan")],
            }
        ),
        results / "runs.parquet",
    )
    pq.write_table(
        pa.table(
            {
                "run_id": [runs[0][0]],
                "scenario_id": ["center"],
                "variant_id": ["nominal"],
                "seed": [7100],
                "loop": ["water"],
                "class": ["slow"],
                "settling_s": [float("nan")],
                "overshoot_frac": [0.3],
            }
        ),
        results / "control_steps.parquet",
    )
    return folder


def write_policy(path: Path, **overrides: Any) -> Path:
    policy: dict[str, Any] = {
        "policyId": "test-policy",
        "defaultDecision": "deny",
        "signals": [spec.key for spec in SIGNALS],
        "factors": ["water_cut_pct", "gor_sm3_sm3"],
        "plantConstants": ["vessel_diameter_m"],
        "withheld": [{"field": "config.raw", "reason": "test"}],
        "replays": [
            {
                "dataset": DATASET_ID,
                "run": "center__nominal__s7100",
                "documentation": [],
            },
            {"dataset": DATASET_ID, "run": "center__tuned__s7100", "documentation": []},
        ],
        "campaignSummaries": [{"dataset": DATASET_ID, "documentation": []}],
        "envelopeMaps": [
            {
                "dataset": DATASET_ID,
                "documentation": [],
                "replayRuns": ["center__nominal__s7100"],
            }
        ],
        "notPublishable": [],
        "datasetDescriptions": {DATASET_ID: "Curated synthetic campaign."},
        "allowedReferences": ["Skogestad S. (2003) Simple analytic rules."],
        "verbatimFields": ["evidence.modelUncertainties"],
    }
    policy.update(overrides)
    path.write_text(json.dumps(policy))
    return path


@pytest.fixture
def runs_root(tmp_path: Path) -> Path:
    root = tmp_path / "runs"
    build_dataset(root)
    return root


@pytest.fixture
def policy_path(tmp_path: Path) -> Path:
    return write_policy(tmp_path / "policy.json")
