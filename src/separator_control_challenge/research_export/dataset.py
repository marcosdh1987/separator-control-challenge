"""Read-only access to one eng_dacs experiment dataset.

Layout (eng_dacs ``docs/simulation/operating_envelope.md`` section 7)::

    <dataset>/manifest.json            campaign, provenance, run index, digests
    <dataset>/trace_columns.json       column dictionary (name, unit, kind, source)
    <dataset>/constraint_catalogue.json
    <dataset>/runs/<run_id>/run.json   evaluation, protocol, metrics
    <dataset>/runs/<run_id>/trace.parquet  one row per 1 s tick
    <dataset>/results/*.parquet        flat result tables

Nothing here writes to the dataset.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from functools import cached_property
from typing import TYPE_CHECKING, Any

import pyarrow.parquet as pq

if TYPE_CHECKING:
    from pathlib import Path


class DatasetError(ValueError):
    """The dataset is inconsistent: exporting it would publish a wrong claim."""


class MissingDataError(DatasetError):
    """A dataset, run or file is not available locally (the case stays pending)."""


def _load_json(path: Path) -> Any:
    if not path.is_file():
        raise MissingDataError(f"missing file: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


@dataclass(frozen=True)
class Trace:
    """Columns of one ``trace.parquet``, as plain Python lists."""

    columns: dict[str, list[Any]]

    @property
    def count(self) -> int:
        return len(next(iter(self.columns.values()))) if self.columns else 0

    def has(self, name: str) -> bool:
        return name in self.columns

    def column(self, name: str) -> list[Any]:
        if name not in self.columns:
            raise DatasetError(f"trace column absent: {name}")
        return self.columns[name]


@dataclass
class Dataset:
    root: Path
    _runs: dict[str, dict[str, Any]] = field(default_factory=dict, repr=False)

    @property
    def dataset_id(self) -> str:
        return self.root.name

    @cached_property
    def manifest(self) -> dict[str, Any]:
        manifest = _load_json(self.root / "manifest.json")
        if not isinstance(manifest, dict) or "runs" not in manifest:
            raise DatasetError(f"{self.root}: manifest.json has no run index")
        return manifest

    @cached_property
    def trace_columns(self) -> dict[str, dict[str, Any]]:
        entries = _load_json(self.root / "trace_columns.json")
        return {entry["name"]: entry for entry in entries}

    @cached_property
    def constraint_catalogue(self) -> dict[str, dict[str, Any]]:
        path = self.root / "constraint_catalogue.json"
        if not path.is_file():
            return {}
        return {entry["id"]: entry for entry in _load_json(path)}

    @property
    def resolved_config(self) -> dict[str, Any]:
        resolved = self.manifest.get("config", {}).get("resolved", {})
        return resolved if isinstance(resolved, dict) else {}

    @cached_property
    def run_index(self) -> dict[str, dict[str, Any]]:
        return {entry["run_id"]: entry for entry in self.manifest["runs"]}

    def run_record(self, run_id: str) -> dict[str, Any]:
        if run_id not in self.run_index:
            raise MissingDataError(
                f"{self.dataset_id}: run {run_id} is not in the manifest"
            )
        if run_id not in self._runs:
            record = _load_json(self.root / "runs" / run_id / "run.json")
            if record.get("run_id") != run_id:
                raise DatasetError(f"{run_id}: run.json names {record.get('run_id')}")
            self._runs[run_id] = record
        return self._runs[run_id]

    def trace(self, run_id: str, columns: list[str]) -> Trace:
        path = self.root / "runs" / run_id / "trace.parquet"
        if not path.is_file():
            raise MissingDataError(f"missing trace: {path}")
        available = set(pq.read_schema(path).names)
        wanted = [name for name in columns if name in available]
        table = pq.read_table(path, columns=wanted)
        return Trace({name: table.column(name).to_pylist() for name in wanted})

    def result_table(self, name: str) -> dict[str, list[Any]]:
        path = self.root / "results" / f"{name}.parquet"
        if not path.is_file():
            raise MissingDataError(f"missing results table: {path}")
        return pq.read_table(path).to_pydict()

    def output_sha256(self, relative: str) -> str | None:
        value = self.manifest.get("outputs_sha256", {}).get(relative)
        return value if isinstance(value, str) else None
