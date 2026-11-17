"""Checks on the files committed under public/research/v1.

The first test runs everywhere (CI included): the committed files must match
their index and the contract. The others need the private eng_dacs datasets
and run only when ``ENG_DACS_RUNS_ROOT`` points at them (``make research-verify``).
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

import pytest

from separator_control_challenge.research_export.contract import CODE_TABLES
from separator_control_challenge.research_export.export import read_gzip_json
from separator_control_challenge.research_export.policy import load_policy
from separator_control_challenge.research_export.verify import (
    check_identity,
    verify_published,
)
from tests.research_export.conftest import REPO_ROOT

PUBLISHED = REPO_ROOT / "public" / "research" / "v1"
POLICY = REPO_ROOT / "research" / "publication-policy.json"
RUNS_ROOT = os.environ.get("ENG_DACS_RUNS_ROOT")
needs_source = pytest.mark.skipif(
    not RUNS_ROOT or not Path(RUNS_ROOT).is_dir(),
    reason="ENG_DACS_RUNS_ROOT not set: the private eng_dacs datasets are not available",
)


def test_committed_files_match_their_index_and_the_contract() -> None:
    assert verify_published(PUBLISHED) == []


def test_committed_files_are_exactly_what_the_policy_lists() -> None:
    policy = load_policy(POLICY)
    index = json.loads((PUBLISHED / "index.json").read_text())
    assert index["policySha256"] == policy.sha256, "re-export after editing the policy"
    published = {f["id"] for f in index["files"] if f["type"] == "replay"}
    pending = {p["id"] for p in index["pending"] if p["type"] == "replay"}
    listed = {f"{r.dataset}/{r.run}" for r in policy.replays}
    assert published | pending == listed


def test_every_published_replay_is_labelled_synthetic_and_uncalibrated() -> None:
    index = json.loads((PUBLISHED / "index.json").read_text())
    for entry in index["files"]:
        doc = read_gzip_json(PUBLISHED / entry["path"])
        assert doc["evidence"]["calibration"] == "synthetic_uncalibrated"
        assert "not a validated industrial control system" in doc["disclaimer"]


@needs_source
def test_every_published_sample_equals_the_source_trace() -> None:
    report = check_identity(Path(str(RUNS_ROOT)), PUBLISHED)
    assert report["replays"] > 0
    assert report["mismatches"] == []


@needs_source
def test_code_tables_match_the_eng_dacs_enums() -> None:
    src = Path(str(RUNS_ROOT)).parents[2] / "src" / "dacs" / "core"
    sources = {
        "plant.state": (src / "virtual_plc" / "types.py", "PlantState"),
        "plant.shut_in_status": (src / "virtual_plc" / "types.py", "ShutInStatus"),
        "well.nodal_status": (src / "nodal_coupling.py", "CouplingStatus"),
        "well.no_flow_reason": (src / "nodal_coupling.py", "NoFlowReason"),
        "plant.trip_causes": (src / "virtual_plc" / "types.py", "TripCause"),
    }
    for key, (path, enum) in sources.items():
        text = path.read_text()
        body = text.split(f"class {enum}(IntEnum):", 1)[1].split("\nclass ", 1)[0]
        members = dict(re.findall(r"^\s{4}([A-Z_]+) = (\d+)", body, flags=re.MULTILINE))
        table = CODE_TABLES[key].get("codes") or CODE_TABLES[key]["bits"]
        assert {v: k for k, v in members.items()} == table, key
