"""Checks on published files: contract, hashes, digests, identity with the source."""

from __future__ import annotations

import hashlib
import json
import math
from typing import TYPE_CHECKING, Any

from separator_control_challenge.research_export.contract import (
    SCHEMA_INDEX,
    decode_signal,
    forbidden_tokens,
    validate_campaign,
    validate_envelope,
    validate_replay,
)
from separator_control_challenge.research_export.dataset import Dataset
from separator_control_challenge.research_export.encode import float64_digest
from separator_control_challenge.research_export.export import read_gzip_json

if TYPE_CHECKING:
    from pathlib import Path

_VALIDATORS = {
    "replay": validate_replay,
    "campaign": validate_campaign,
    "envelope": validate_envelope,
}


def verify_published(out: Path) -> list[str]:
    """Every file in the index exists, matches its SHA-256 and the contract."""
    problems: list[str] = []
    index_path = out / "index.json"
    if not index_path.is_file():
        return [f"{index_path} is missing"]
    index = json.loads(index_path.read_text(encoding="utf-8"))
    if index.get("schema") != SCHEMA_INDEX:
        problems.append("index.json: wrong schema")
    for entry in index.get("files", []):
        path = out / entry["path"]
        if not path.is_file():
            problems.append(f"{entry['path']}: listed but absent")
            continue
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != entry["sha256"]:
            problems.append(f"{entry['path']}: SHA-256 differs from the index")
        doc = read_gzip_json(path)
        problems.extend(
            f"{entry['path']}: {e}" for e in _VALIDATORS[entry["type"]](doc)
        )
        problems.extend(
            f"{entry['path']}: forbidden text {token!r}"
            for token in forbidden_tokens(doc)
        )
        if entry["type"] == "replay":
            count = doc["time"]["count"]
            for signal in doc["signals"]:
                if float64_digest(decode_signal(signal, count)) != signal["digest"]:
                    problems.append(f"{entry['path']}: {signal['key']} digest mismatch")
    return problems


def _same(a: float, b: float) -> bool:
    return (math.isnan(a) and math.isnan(b)) or a == b


def check_identity(runs_root: Path, out: Path) -> dict[str, Any]:
    """Compare every exported sample with the eng_dacs Parquet trace, exactly."""
    index = json.loads((out / "index.json").read_text(encoding="utf-8"))
    report: dict[str, Any] = {
        "replays": 0,
        "signals": 0,
        "samples": 0,
        "mismatches": [],
    }
    for entry in index.get("files", []):
        if entry["type"] != "replay":
            continue
        doc = read_gzip_json(out / entry["path"])
        dataset = Dataset(runs_root / entry["datasetId"])
        columns = [signal["originalName"] for signal in doc["signals"]] + ["step"]
        trace = dataset.trace(entry["runId"], columns)
        steps = trace.column("step")
        if [float(s) for s in steps] != [
            doc["time"]["startS"] + i * doc["time"]["sampleIntervalS"]
            for i in range(doc["time"]["count"])
        ]:
            report["mismatches"].append(
                f"{entry['id']}: time axis differs from step column"
            )
        report["replays"] += 1
        for signal in doc["signals"]:
            exported = decode_signal(signal, doc["time"]["count"])
            original = [
                math.nan if v is None else float(v)
                for v in trace.column(signal["originalName"])
            ]
            report["signals"] += 1
            report["samples"] += len(original)
            if len(exported) != len(original) or not all(
                _same(a, b) for a, b in zip(exported, original, strict=False)
            ):
                report["mismatches"].append(f"{entry['id']}: {signal['key']}")
    return report
