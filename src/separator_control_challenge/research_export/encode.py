"""Lossless signal encoding and the per-signal identity digest.

Every exported value decodes to the exact float64 eng_dacs stored:

* ``f64``: written with Python's shortest round-trip ``repr``; ``JSON.parse``
  yields the same double.
* ``f32``: chosen only when every value of the column is exactly a float32
  (register values are); written with the shortest float32 text, and decoded
  with ``Math.fround`` / ``numpy.float32``, which restores the same double.
* ``int``: codes, bits and booleans.

The digest is SHA-256 over the decoded column as little-endian float64, with
NaN canonicalised, so the browser can prove bit-exact identity without the
Parquet file.
"""

from __future__ import annotations

import hashlib
import math
import struct
from typing import TYPE_CHECKING, Any

import numpy as np

if TYPE_CHECKING:
    from collections.abc import Sequence

    from separator_control_challenge.research_export.contract import (
        NumberFormat,
        SignalSpec,
    )

_CANONICAL_NAN = struct.pack("<Q", 0x7FF8000000000000)


class EncodingError(ValueError):
    """A column cannot be exported without loss."""


def float64_digest(values: Sequence[float]) -> str:
    """SHA-256 of a float64 column (little-endian, canonical NaN)."""
    digest = hashlib.sha256()
    for value in values:
        digest.update(_CANONICAL_NAN if math.isnan(value) else struct.pack("<d", value))
    return "sha256:" + digest.hexdigest()


def _float32_exact(array: np.ndarray) -> bool:
    finite = array[~np.isnan(array)]
    return bool(np.all(finite.astype(np.float32).astype(np.float64) == finite))


def _json_number(value: float, fmt: NumberFormat) -> float | int | None:
    if math.isnan(value):
        return None
    if fmt == "int":
        return int(value)
    if fmt == "f32":
        # numpy prints the shortest text that round-trips as float32.
        return float(str(np.float32(value)))
    return float(value)


def number_format(spec: SignalSpec, array: np.ndarray) -> NumberFormat:
    if spec.number == "int":
        finite = array[~np.isnan(array)]
        if not np.all(finite == np.round(finite)):
            raise EncodingError(
                f"{spec.column}: integer signal holds fractional values"
            )
        return "int"
    return "f32" if _float32_exact(array) else "f64"


def encode_column(spec: SignalSpec, raw: Sequence[Any]) -> dict[str, Any]:
    """Encode one trace column; refuse infinities rather than altering them."""
    array = np.asarray(
        [math.nan if v is None else float(v) for v in raw],
        dtype=np.float64,
    )
    if np.isinf(array).any():
        raise EncodingError(f"{spec.column}: infinite values cannot be exported")
    fmt = number_format(spec, array)
    decoded = [
        math.nan
        if math.isnan(v)
        else float(np.float32(v))
        if fmt == "f32"
        else float(v)
        for v in array
    ]
    if fmt == "f32" and any(
        not (math.isnan(a) and math.isnan(b)) and a != b
        for a, b in zip(decoded, array.tolist(), strict=True)
    ):  # pragma: no cover - guarded by _float32_exact
        raise EncodingError(f"{spec.column}: float32 encoding would lose precision")

    payload: dict[str, Any] = {
        "numberFormat": fmt,
        "nullCount": int(np.isnan(array).sum()),
        "digest": float64_digest(array.tolist()),
    }
    if spec.encoding == "dense":
        payload["encoding"] = "dense"
        payload["values"] = [_json_number(v, fmt) for v in array.tolist()]
    else:
        changes: list[list[Any]] = []
        previous: float | None = None
        for index, value in enumerate(array.tolist()):
            same = previous is not None and (
                value == previous or (math.isnan(value) and math.isnan(previous))
            )
            if not same:
                changes.append([index, _json_number(value, fmt)])
            previous = value
        payload["encoding"] = "changes"
        payload["changes"] = changes
    return payload
