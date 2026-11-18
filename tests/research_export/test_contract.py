"""The validator rejects documents that break the contract."""

from __future__ import annotations

import copy
from typing import TYPE_CHECKING

import pytest

from separator_control_challenge.research_export.contract import (
    validate_campaign,
    validate_envelope,
    validate_replay,
)
from separator_control_challenge.research_export.export import (
    export_all,
    read_gzip_json,
)
from separator_control_challenge.research_export.policy import load_policy
from tests.research_export.conftest import DATASET_ID

if TYPE_CHECKING:
    from pathlib import Path


@pytest.fixture
def replay(runs_root: Path, policy_path: Path, tmp_path: Path) -> dict:
    out = tmp_path / "out"
    export_all(runs_root, load_policy(policy_path), out, "2026-01-03T00:00:00+00:00")
    return read_gzip_json(
        out / "replays" / DATASET_ID / "center__nominal__s7100.json.gz"
    )


def _signal(doc: dict, key: str) -> dict:
    return next(s for s in doc["signals"] if s["key"] == key)


def test_a_valid_replay_has_no_errors(replay) -> None:
    assert validate_replay(replay) == []


@pytest.mark.parametrize(
    ("mutate", "message"),
    [
        (lambda d: d.update(schema="other"), "schema"),
        (lambda d: d.update(schemaVersion=2), "schemaVersion"),
        (lambda d: d.update(contractVersion="2.0.0"), "contractVersion"),
        (lambda d: d["time"].update(count=d["time"]["count"] + 1), "dense values"),
        (lambda d: d["time"].update(endS=d["time"]["endS"] + 5), "endS"),
        (lambda d: d["phases"][1].update(startS=d["phases"][0]["startS"]), "overlap"),
        (lambda d: d["events"][0].update(tS=-1), "outside the recorded time"),
        (lambda d: d["events"][0].update(kind="guess"), "event kind"),
        (
            lambda d: _signal(d, "level.total.truth").update(interpolation="hold"),
            "interpolation",
        ),
        (
            lambda d: _signal(d, "loop.oil.sp").update(interpolation="linear"),
            "interpolation",
        ),
        (
            lambda d: _signal(d, "level.total.truth").update(key="made.up"),
            "unknown key",
        ),
        (
            lambda d: _signal(d, "level.total.truth").update(originalName="x"),
            "originalName",
        ),
        (
            lambda d: _signal(d, "level.total.truth")["values"].__setitem__(0, "1.0"),
            "numbers",
        ),
        (lambda d: _signal(d, "loop.water.sp")["changes"].reverse(), "increase"),
        (
            lambda d: _signal(d, "loop.water.sp")["changes"].__setitem__(0, [3, 40.0]),
            "first change",
        ),
        (lambda d: d["evidence"].update(stage="maybe"), "stage"),
        (lambda d: d["source"].update(configSha256Raw="xyz"), "SHA-256"),
        (
            lambda d: d["missingSignals"].append({"key": "level.total.truth"}),
            "both present",
        ),
        (lambda d: d["signals"].append(copy.deepcopy(d["signals"][0])), "duplicated"),
    ],
)
def test_invalid_replays_are_rejected(replay, mutate, message) -> None:
    doc = copy.deepcopy(replay)
    mutate(doc)
    errors = validate_replay(doc)
    assert any(message in e for e in errors), errors


def test_non_objects_are_rejected() -> None:
    assert validate_replay([]) == ["document must be an object"]
    assert validate_campaign("x") == ["document must be an object"]
    assert validate_envelope(None) == ["document must be an object"]


def test_envelope_points_must_use_declared_axes() -> None:
    doc = {
        "schema": "scc.research-envelope-map",
        "schemaVersion": 1,
        "contractVersion": "1.0.0",
        "generatedAt": "x",
        "disclaimer": "x",
        "source": {
            "simulator": "s",
            "datasetId": "d",
            "campaignId": "c",
            "gitSha": "g",
        },
        "evidence": {
            "stage": "exploratory",
            "calibration": "synthetic_uncalibrated",
            "campaignSeeds": [1],
        },
        "axes": [{"key": "a"}, {"key": "b"}],
        "points": [
            {"runId": "r", "outcome": "marginal", "values": {"a": 1.0, "z": 2.0}}
        ],
    }
    assert any("unknown axis" in e for e in validate_envelope(doc))
    doc["points"][0]["values"] = {"a": 1.0, "b": None}
    assert validate_envelope(doc) == []
    doc["points"][0]["outcome"] = "good"
    assert any("outcome" in e for e in validate_envelope(doc))
