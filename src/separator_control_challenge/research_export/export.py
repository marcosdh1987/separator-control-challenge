"""Export orchestration: policy in, static files and an index out.

Output layout (served as static files, e.g. ``public/research/v1``)::

    index.json                                  what is published, with SHA-256
    replays/<dataset>/<run>.json.gz             ResearchReplayV1
    campaigns/<dataset>.json.gz                 ResearchCampaignSummaryV1
    envelope/<dataset>.json.gz                  ResearchEnvelopeMapV1

Files are gzip with a zero timestamp, so the same inputs give the same bytes.
A request whose dataset or run is not available locally is recorded as
pending in the index; nothing is fabricated in its place.
"""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import math
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from separator_control_challenge.research_export.campaign import build_campaign_summary
from separator_control_challenge.research_export.contract import (
    CONTRACT_VERSION,
    EXPORTER_NAME,
    EXPORTER_VERSION,
    SCHEMA_INDEX,
    SCHEMA_VERSION,
    ContractError,
    forbidden_tokens,
)
from separator_control_challenge.research_export.dataset import (
    Dataset,
    MissingDataError,
)
from separator_control_challenge.research_export.envelope import build_envelope_map
from separator_control_challenge.research_export.replay import (
    build_replay,
    replay_file_name,
    replay_id,
)

if TYPE_CHECKING:
    from pathlib import Path

    from separator_control_challenge.research_export.policy import PublicationPolicy


def sanitize(value: Any) -> Any:
    """Replace non-finite floats by null: JSON has no NaN, and none is invented."""
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, dict):
        return {str(k): sanitize(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [sanitize(v) for v in value]
    return value


def gzip_json(doc: dict[str, Any]) -> bytes:
    text = json.dumps(
        sanitize(doc), separators=(",", ":"), ensure_ascii=False, allow_nan=False
    )
    buffer = io.BytesIO()
    with gzip.GzipFile(
        fileobj=buffer, mode="wb", compresslevel=9, mtime=0, filename=""
    ) as gz:
        gz.write(text.encode("utf-8"))
    return buffer.getvalue()


def read_gzip_json(path: Path) -> Any:
    return json.loads(gzip.decompress(path.read_bytes()).decode("utf-8"))


@dataclass
class ExportResult:
    files: list[dict[str, Any]] = field(default_factory=list)
    pending: list[dict[str, str]] = field(default_factory=list)

    def index(self, policy: PublicationPolicy, generated_at: str) -> dict[str, Any]:
        return {
            "schema": SCHEMA_INDEX,
            "schemaVersion": SCHEMA_VERSION,
            "contractVersion": CONTRACT_VERSION,
            "generatedAt": generated_at,
            "exporter": {"name": EXPORTER_NAME, "version": EXPORTER_VERSION},
            "policyId": policy.policy_id,
            "policySha256": policy.sha256,
            "files": sorted(self.files, key=lambda f: f["path"]),
            "pending": self.pending,
            "notPublishable": [dict(item) for item in policy.not_publishable],
        }


def _write(out: Path, relative: str, doc: dict[str, Any]) -> dict[str, Any]:
    leaked = forbidden_tokens(doc)
    if leaked:
        raise ContractError(f"{relative}: refusing to publish forbidden text {leaked}")
    data = gzip_json(doc)
    target = out / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    return {
        "path": relative,
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def export_all(
    runs_root: Path,
    policy: PublicationPolicy,
    out: Path,
    generated_at: str,
) -> ExportResult:
    result = ExportResult()
    datasets: dict[str, Dataset] = {}

    def dataset(name: str) -> Dataset:
        if name not in datasets:
            datasets[name] = Dataset(runs_root / name)
        return datasets[name]

    for request in policy.replays:
        identifier = replay_id(request.dataset, request.run)
        try:
            doc = build_replay(dataset(request.dataset), request, policy, generated_at)
        except MissingDataError as error:
            result.pending.append(
                {"id": identifier, "type": "replay", "reason": str(error)}
            )
            continue
        entry = _write(out, replay_file_name(request.dataset, request.run), doc)
        run = doc["run"]
        entry.update(
            {
                "id": identifier,
                "type": "replay",
                "datasetId": request.dataset,
                "runId": request.run,
                "scenarioId": run["scenarioId"],
                "variantId": run["variantId"],
                "seed": run["seed"],
                "stage": doc["evidence"]["stage"],
                "durationS": doc["time"]["endS"] - doc["time"]["startS"],
                "samples": doc["time"]["count"],
            }
        )
        result.files.append(entry)

    for summary in policy.campaign_summaries:
        try:
            doc = build_campaign_summary(
                dataset(summary.dataset), summary, policy, generated_at
            )
        except MissingDataError as error:
            result.pending.append(
                {"id": summary.dataset, "type": "campaign", "reason": str(error)}
            )
            continue
        entry = _write(out, f"campaigns/{summary.dataset}.json.gz", doc)
        entry.update(
            {
                "id": summary.dataset,
                "type": "campaign",
                "datasetId": summary.dataset,
                "stage": doc["evidence"]["stage"],
            }
        )
        result.files.append(entry)

    for envelope in policy.envelope_maps:
        try:
            doc = build_envelope_map(
                dataset(envelope.dataset), envelope, policy, generated_at
            )
        except MissingDataError as error:
            result.pending.append(
                {"id": envelope.dataset, "type": "envelope", "reason": str(error)}
            )
            continue
        entry = _write(out, f"envelope/{envelope.dataset}.json.gz", doc)
        entry.update(
            {
                "id": envelope.dataset,
                "type": "envelope",
                "datasetId": envelope.dataset,
                "stage": doc["evidence"]["stage"],
                "points": len(doc["points"]),
            }
        )
        result.files.append(entry)

    out.mkdir(parents=True, exist_ok=True)
    index = result.index(policy, generated_at)
    (out / "index.json").write_text(
        json.dumps(index, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return result


def stale_files(out: Path, result: ExportResult) -> list[Path]:
    """Data files on disk that the new index does not list."""
    listed = {out / entry["path"] for entry in result.files}
    return sorted(
        path
        for folder in ("replays", "campaigns", "envelope")
        if (out / folder).is_dir()
        for path in (out / folder).rglob("*.json.gz")
        if path not in listed
    )
