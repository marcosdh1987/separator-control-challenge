"""The publication policy: the only list of what may leave eng_dacs.

eng_dacs is a private repository and this site is public. Nothing is
exported by default. The policy file (``research/publication-policy.json``)
names every dataset, run, signal, factor and plant constant that may be
published, and documents what is withheld and why. The exporter refuses any
request outside it.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from separator_control_challenge.research_export.contract import SIGNALS_BY_KEY

if TYPE_CHECKING:
    from pathlib import Path


class PolicyError(ValueError):
    """The policy file is malformed or asks for something it may not."""


@dataclass(frozen=True)
class DocReference:
    path: str
    section: str | None
    access: str

    def to_json(self) -> dict[str, Any]:
        return {"path": self.path, "section": self.section, "access": self.access}


@dataclass(frozen=True)
class ReplayRequest:
    dataset: str
    run: str
    documentation: tuple[DocReference, ...]


@dataclass(frozen=True)
class DatasetRequest:
    dataset: str
    documentation: tuple[DocReference, ...]
    replay_runs: tuple[str, ...] = ()


@dataclass(frozen=True)
class PublicationPolicy:
    policy_id: str
    sha256: str
    signals: tuple[str, ...]
    factors: tuple[str, ...]
    plant_constants: tuple[str, ...]
    withheld: tuple[dict[str, str], ...]
    replays: tuple[ReplayRequest, ...]
    campaign_summaries: tuple[DatasetRequest, ...]
    envelope_maps: tuple[DatasetRequest, ...]
    not_publishable: tuple[dict[str, str], ...]

    def privacy_block(self) -> dict[str, Any]:
        return {
            "policyId": self.policy_id,
            "policySha256": self.sha256,
            "withheld": [dict(item) for item in self.withheld],
        }


def _docs(raw: Any, where: str) -> tuple[DocReference, ...]:
    if not isinstance(raw, list):
        raise PolicyError(f"{where}: documentation must be a list")
    refs = []
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str):
            raise PolicyError(f"{where}: each documentation entry needs a path")
        refs.append(
            DocReference(
                path=item["path"],
                section=item.get("section"),
                access=str(item.get("access", "private")),
            )
        )
    return tuple(refs)


def _strings(raw: Any, where: str) -> tuple[str, ...]:
    if not isinstance(raw, list) or not all(isinstance(v, str) for v in raw):
        raise PolicyError(f"{where} must be a list of strings")
    return tuple(raw)


def parse_policy(raw: dict[str, Any], sha256: str) -> PublicationPolicy:
    if raw.get("defaultDecision") != "deny":
        raise PolicyError(
            "defaultDecision must be 'deny': nothing is public by default"
        )
    policy_id = raw.get("policyId")
    if not isinstance(policy_id, str) or not policy_id:
        raise PolicyError("policyId is required")
    signals = _strings(raw.get("signals"), "signals")
    unknown = [key for key in signals if key not in SIGNALS_BY_KEY]
    if unknown:
        raise PolicyError(f"unknown signal keys: {unknown}")
    replays = tuple(
        ReplayRequest(
            dataset=str(item["dataset"]),
            run=str(item["run"]),
            documentation=_docs(
                item.get("documentation", []), f"replay {item.get('run')}"
            ),
        )
        for item in raw.get("replays", [])
    )
    keys = [(r.dataset, r.run) for r in replays]
    if len(keys) != len(set(keys)):
        raise PolicyError("a replay is listed twice")

    def datasets(name: str) -> tuple[DatasetRequest, ...]:
        return tuple(
            DatasetRequest(
                dataset=str(item["dataset"]),
                documentation=_docs(item.get("documentation", []), name),
                replay_runs=_strings(item.get("replayRuns", []), f"{name}.replayRuns"),
            )
            for item in raw.get(name, [])
        )

    return PublicationPolicy(
        policy_id=policy_id,
        sha256=sha256,
        signals=signals,
        factors=_strings(raw.get("factors", []), "factors"),
        plant_constants=_strings(raw.get("plantConstants", []), "plantConstants"),
        withheld=tuple(
            {"field": str(w["field"]), "reason": str(w["reason"])}
            for w in raw.get("withheld", [])
        ),
        replays=replays,
        campaign_summaries=datasets("campaignSummaries"),
        envelope_maps=datasets("envelopeMaps"),
        not_publishable=tuple(
            {"id": str(n["id"]), "reason": str(n["reason"])}
            for n in raw.get("notPublishable", [])
        ),
    )


def load_policy(path: Path) -> PublicationPolicy:
    data = path.read_bytes()
    try:
        raw = json.loads(data)
    except json.JSONDecodeError as error:
        raise PolicyError(f"{path}: invalid JSON ({error})") from error
    if not isinstance(raw, dict):
        raise PolicyError(f"{path}: the policy must be a JSON object")
    return parse_policy(raw, hashlib.sha256(data).hexdigest())
