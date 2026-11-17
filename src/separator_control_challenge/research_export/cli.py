"""Command line: ``python -m separator_control_challenge.research_export``.

Subcommands:

* ``export``: build the published files from local eng_dacs datasets.
* ``verify``: check published files against the index and the contract.
* ``check-identity``: compare every exported sample with the source traces.
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

from separator_control_challenge.research_export.export import export_all, stale_files
from separator_control_challenge.research_export.policy import load_policy
from separator_control_challenge.research_export.verify import (
    check_identity,
    verify_published,
)

DEFAULT_POLICY = Path("research/publication-policy.json")
DEFAULT_OUT = Path("public/research/v1")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="research_export", description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    export = commands.add_parser("export", help="export the files the policy lists")
    export.add_argument(
        "--runs-root", type=Path, required=True, help="eng_dacs .../runs folder"
    )
    export.add_argument("--policy", type=Path, default=DEFAULT_POLICY)
    export.add_argument("--out", type=Path, default=DEFAULT_OUT)
    export.add_argument(
        "--generated-at", default=None, help="ISO time to stamp (default: now)"
    )
    export.add_argument(
        "--prune", action="store_true", help="delete files the index drops"
    )

    verify = commands.add_parser("verify", help="check published files")
    verify.add_argument("--out", type=Path, default=DEFAULT_OUT)

    identity = commands.add_parser(
        "check-identity", help="compare with the source traces"
    )
    identity.add_argument("--runs-root", type=Path, required=True)
    identity.add_argument("--out", type=Path, default=DEFAULT_OUT)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if args.command == "export":
        policy = load_policy(args.policy)
        generated_at = (
            args.generated_at or datetime.now(UTC).replace(microsecond=0).isoformat()
        )
        result = export_all(args.runs_root, policy, args.out, generated_at)
        for entry in result.files:
            print(f"wrote {entry['path']} ({entry['bytes'] / 1e6:.2f} MB)")
        for item in result.pending:
            print(f"PENDING {item['type']} {item['id']}: {item['reason']}")
        for path in stale_files(args.out, result):
            if args.prune:
                path.unlink()
                print(f"pruned {path}")
            else:
                print(f"stale (not in index, kept; use --prune): {path}")
        problems = verify_published(args.out)
        for problem in problems:
            print(f"INVALID {problem}")
        return 1 if problems else 0
    if args.command == "verify":
        problems = verify_published(args.out)
        for problem in problems:
            print(f"INVALID {problem}")
        print("ok" if not problems else f"{len(problems)} problem(s)")
        return 1 if problems else 0
    report = check_identity(args.runs_root, args.out)
    print(
        f"{report['replays']} replays, {report['signals']} signals, "
        f"{report['samples']} samples compared; {len(report['mismatches'])} mismatches"
    )
    for item in report["mismatches"]:
        print(f"MISMATCH {item}")
    return 1 if report["mismatches"] else 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
