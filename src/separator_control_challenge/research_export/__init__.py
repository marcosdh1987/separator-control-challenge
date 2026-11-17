"""Offline exporter from eng_dacs experiment datasets to static Research Lab files.

The Research Lab at ``/research`` replays experiments that were run in a
different simulator (eng_dacs). This package turns selected runs of an eng_dacs
dataset into versioned, read-only JSON documents (``ResearchReplayV1`` and
companions) that the browser can load from a CDN. It never imports eng_dacs,
never runs a simulation, and only publishes what the publication policy lists.

See ``docs/research-lab.md`` for the contract and the export procedure.
"""

from separator_control_challenge.research_export.contract import (
    CONTRACT_VERSION,
    SCHEMA_CAMPAIGN,
    SCHEMA_ENVELOPE,
    SCHEMA_INDEX,
    SCHEMA_REPLAY,
    SCHEMA_VERSION,
)

__all__ = [
    "CONTRACT_VERSION",
    "SCHEMA_CAMPAIGN",
    "SCHEMA_ENVELOPE",
    "SCHEMA_INDEX",
    "SCHEMA_REPLAY",
    "SCHEMA_VERSION",
]
