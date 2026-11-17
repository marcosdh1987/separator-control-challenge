"""End-to-end export on the synthetic dataset."""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

import pytest

from separator_control_challenge.research_export.cli import main
from separator_control_challenge.research_export.contract import ContractError
from separator_control_challenge.research_export.dataset import DatasetError
from separator_control_challenge.research_export.export import (
    export_all,
    read_gzip_json,
)
from separator_control_challenge.research_export.policy import PolicyError, load_policy
from separator_control_challenge.research_export.verify import (
    check_identity,
    verify_published,
)
from tests.research_export.conftest import (
    DATASET_ID,
    EXIT_TICK,
    build_dataset,
    write_policy,
)

if TYPE_CHECKING:
    from pathlib import Path

STAMP = "2026-01-03T00:00:00+00:00"


def _export(runs_root: Path, policy_path: Path, out: Path):
    return export_all(runs_root, load_policy(policy_path), out, STAMP)


def _replay(out: Path, run: str = "center__nominal__s7100") -> dict:
    return read_gzip_json(out / "replays" / DATASET_ID / f"{run}.json.gz")


def test_export_writes_valid_files_listed_in_the_index(
    runs_root, policy_path, tmp_path
) -> None:
    out = tmp_path / "out"
    result = _export(runs_root, policy_path, out)
    assert {f["type"] for f in result.files} == {"replay", "campaign", "envelope"}
    assert result.pending == []
    assert verify_published(out) == []
    index = json.loads((out / "index.json").read_text())
    assert index["policyId"] == "test-policy"
    assert len(index["files"]) == 4


def test_exported_values_are_identical_to_the_source_trace(
    runs_root, policy_path, tmp_path
) -> None:
    out = tmp_path / "out"
    _export(runs_root, policy_path, out)
    report = check_identity(runs_root, out)
    assert report["replays"] == 2
    assert report["mismatches"] == []
    assert report["samples"] > 0


def test_export_is_byte_for_byte_reproducible(runs_root, policy_path, tmp_path) -> None:
    first, second = tmp_path / "a", tmp_path / "b"
    _export(runs_root, policy_path, first)
    _export(runs_root, policy_path, second)
    for path in first.rglob("*.json.gz"):
        assert path.read_bytes() == (second / path.relative_to(first)).read_bytes()


def test_absent_column_is_reported_missing_not_fabricated(
    runs_root, policy_path, tmp_path
) -> None:
    out = tmp_path / "out"
    _export(runs_root, policy_path, out)
    replay = _replay(out)
    keys = {s["key"] for s in replay["signals"]}
    assert "alarm.liquid_carryover" not in keys
    assert replay["missingSignals"] == [
        {
            "key": "alarm.liquid_carryover",
            "originalName": "liquid_carryover",
            "reason": "column absent from this dataset's trace or column dictionary",
        }
    ]


def test_units_and_sources_come_from_the_column_dictionary(
    runs_root, policy_path, tmp_path
) -> None:
    out = tmp_path / "out"
    _export(runs_root, policy_path, out)
    signal = next(s for s in _replay(out)["signals"] if s["key"] == "level.total.truth")
    assert signal["source"] == "synthetic"
    assert signal["description"] == "synthetic total_level_truth_pct"
    assert signal["interpolation"] == "linear"
    sp = next(s for s in _replay(out)["signals"] if s["key"] == "loop.oil.sp")
    assert sp["interpolation"] == "hold"


def test_events_are_recorded_or_verified_evaluation_results(
    runs_root, policy_path, tmp_path
) -> None:
    out = tmp_path / "out"
    _export(runs_root, policy_path, out)
    events = _replay(out)["events"]
    kinds = [(e["kind"], e["tS"]) for e in events]
    assert ("command", 9.0) in kinds
    assert ("setpoint_change", 60.0) in kinds
    assert ("alarm_on", 95.0) in kinds and ("alarm_off", 98.0) in kinds
    assert ("fault", 41.0) in kinds
    exit_event = next(e for e in events if e["kind"] == "band_exit")
    assert exit_event["tS"] == float(EXIT_TICK)
    assert exit_event["origin"] == "evaluation" and exit_event["verified"] is True
    assert [e["tS"] for e in events] == sorted(e["tS"] for e in events)


def test_a_band_exit_that_disagrees_with_the_trace_stops_the_export(
    tmp_path, policy_path
) -> None:
    root = tmp_path / "tampered"
    build_dataset(root, tamper_exit=True)
    with pytest.raises(DatasetError, match="first_exit_s"):
        _export(root, policy_path, tmp_path / "out")


def test_private_material_is_not_exported(runs_root, policy_path, tmp_path) -> None:
    out = tmp_path / "out"
    _export(runs_root, policy_path, out)
    for path in out.rglob("*.json.gz"):
        doc = read_gzip_json(path)
        doc.pop("privacy")
        text = json.dumps(doc)
        for token in (
            "field_hp_secret",
            "macOS",
            "private_module",
            '"raw"',
            "salinity",
            "40921",
        ):
            assert token not in text, (path.name, token)
    replay = _replay(out)
    assert replay["source"]["gitDirtyFileCount"] == 1
    assert len(replay["source"]["sourceCodeDigest"]) == 64
    assert replay["run"]["factors"] == {"water_cut_pct": 20.0, "gor_sm3_sm3": 199.0}
    assert replay["run"]["plantConstants"] == {"vessel_diameter_m": 1.0168}
    assert replay["evidence"]["modelUncertainties"] == ["No solution gas."]


def test_unavailable_runs_are_pending_not_invented(runs_root, tmp_path) -> None:
    policy = write_policy(
        tmp_path / "p.json",
        replays=[
            {
                "dataset": DATASET_ID,
                "run": "center__nominal__s7100",
                "documentation": [],
            },
            {"dataset": DATASET_ID, "run": "absent__run__s1", "documentation": []},
            {"dataset": "absent-dataset", "run": "x", "documentation": []},
        ],
        campaignSummaries=[],
        envelopeMaps=[],
    )
    out = tmp_path / "out"
    result = _export(runs_root, policy, out)
    assert [p["id"] for p in result.pending] == [
        f"{DATASET_ID}/absent__run__s1",
        "absent-dataset/x",
    ]
    assert not (out / "replays" / "absent-dataset").exists()
    assert json.loads((out / "index.json").read_text())["pending"] == result.pending


def test_policy_must_deny_by_default_and_know_every_signal(tmp_path) -> None:
    with pytest.raises(PolicyError, match="deny"):
        load_policy(write_policy(tmp_path / "a.json", defaultDecision="allow"))
    with pytest.raises(PolicyError, match="unknown signal"):
        load_policy(
            write_policy(tmp_path / "b.json", signals=["level.total.truth", "made.up"])
        )


def test_forbidden_text_is_refused_at_write_time(
    runs_root, tmp_path, monkeypatch
) -> None:
    from separator_control_challenge.research_export import provenance

    monkeypatch.setattr(
        provenance, "SIMULATOR_DESCRIPTION", "built on /Users/someone/eng_dacs"
    )
    policy = write_policy(tmp_path / "p.json", campaignSummaries=[], envelopeMaps=[])
    with pytest.raises(ContractError, match="forbidden"):
        _export(runs_root, policy, tmp_path / "out")


def test_envelope_map_has_points_and_no_interpolated_frontier(
    runs_root, policy_path, tmp_path
) -> None:
    out = tmp_path / "out"
    _export(runs_root, policy_path, out)
    doc = read_gzip_json(out / "envelope" / f"{DATASET_ID}.json.gz")
    assert [a["key"] for a in doc["axes"]] == [
        "f_water_cut_pct",
        "f_gor_sm3_sm3",
        "op_inlet_liquid_truth_m3_h",
    ]
    assert doc["axes"][0]["unit"] == "%"
    assert doc["points"][1]["values"]["op_inlet_liquid_truth_m3_h"] is None
    assert doc["points"][0]["replayId"] == f"{DATASET_ID}/center__nominal__s7100"
    assert doc["points"][1]["replayId"] is None
    assert doc["interpolation"].startswith("none")
    assert "frontier" not in json.dumps(doc["points"])


def test_campaign_summary_keeps_nan_as_null(runs_root, policy_path, tmp_path) -> None:
    out = tmp_path / "out"
    _export(runs_root, policy_path, out)
    doc = read_gzip_json(out / "campaigns" / f"{DATASET_ID}.json.gz")
    steps = doc["controlSteps"]
    row = dict(zip(steps["columns"], steps["rows"][0], strict=True))
    assert row["settling_s"] is None
    assert steps["units"]["settling_s"] == "s from the step"


def test_cli_export_and_verify(runs_root, policy_path, tmp_path, capsys) -> None:
    out = tmp_path / "out"
    code = main(
        [
            "export",
            "--runs-root",
            str(runs_root),
            "--policy",
            str(policy_path),
            "--out",
            str(out),
            "--generated-at",
            STAMP,
        ]
    )
    assert code == 0
    assert main(["verify", "--out", str(out)]) == 0
    assert (
        main(["check-identity", "--runs-root", str(runs_root), "--out", str(out)]) == 0
    )
    assert "0 mismatches" in capsys.readouterr().out


def test_cli_prunes_files_dropped_from_the_index(
    runs_root, policy_path, tmp_path
) -> None:
    out = tmp_path / "out"
    stale = out / "replays" / "old" / "gone.json.gz"
    stale.parent.mkdir(parents=True)
    stale.write_bytes(b"x")
    args = ["export", "--runs-root", str(runs_root), "--policy", str(policy_path)]
    assert main([*args, "--out", str(out), "--generated-at", STAMP]) == 0
    assert stale.exists()
    assert main([*args, "--out", str(out), "--generated-at", STAMP, "--prune"]) == 0
    assert not stale.exists()
