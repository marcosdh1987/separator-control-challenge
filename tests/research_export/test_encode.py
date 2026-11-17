"""Lossless encoding and the identity digest."""

from __future__ import annotations

import math

import numpy as np
import pytest

from separator_control_challenge.research_export.contract import (
    SIGNALS_BY_KEY,
    decode_signal,
)
from separator_control_challenge.research_export.encode import (
    EncodingError,
    encode_column,
    float64_digest,
)

FLOAT_SPEC = SIGNALS_BY_KEY["valve.oil.command"]  # dense, float, held
TRUTH_SPEC = SIGNALS_BY_KEY["level.total.truth"]  # dense, float, linear
CHANGE_SPEC = SIGNALS_BY_KEY["loop.oil.sp"]  # change points, float
INT_SPEC = SIGNALS_BY_KEY["plant.state"]  # change points, int


def _round_trip(spec, values):
    signal = encode_column(spec, values)
    return signal, decode_signal(signal, len(values))


def test_float32_register_values_round_trip_exactly() -> None:
    values = [float(np.float32(v)) for v in (49.854446, 0.1, 1e-7, 123456.78, -3.25)]
    signal, decoded = _round_trip(FLOAT_SPEC, values)
    assert signal["numberFormat"] == "f32"
    assert decoded == values
    # The text is the short float32 form, not 17 digits.
    assert signal["values"][0] == 49.854446


def test_float64_values_are_kept_as_float64() -> None:
    values = [49.600968, 1 / 3, 50.000000000001]
    signal, decoded = _round_trip(TRUTH_SPEC, values)
    assert signal["numberFormat"] == "f64"
    assert decoded == values


def test_missing_values_become_null_and_decode_to_nan() -> None:
    signal, decoded = _round_trip(FLOAT_SPEC, [1.0, None, 2.0])
    assert signal["values"][1] is None
    assert signal["nullCount"] == 1
    assert math.isnan(decoded[1])


def test_infinite_values_are_refused_rather_than_altered() -> None:
    with pytest.raises(EncodingError, match="infinite"):
        encode_column(TRUTH_SPEC, [1.0, math.inf])


def test_integer_signal_with_fractions_is_refused() -> None:
    with pytest.raises(EncodingError, match="fractional"):
        encode_column(INT_SPEC, [0, 1.5])


def test_change_points_hold_values_between_changes() -> None:
    values = [50.0, 50.0, 55.0, 55.0, 55.0, 50.0]
    signal, decoded = _round_trip(CHANGE_SPEC, values)
    assert signal["encoding"] == "changes"
    assert signal["changes"] == [[0, 50.0], [2, 55.0], [5, 50.0]]
    assert decoded == values


def test_digest_is_canonical_for_nan_and_sensitive_to_one_bit() -> None:
    assert float64_digest([math.nan]) == float64_digest([float(np.float64("nan"))])
    a = float64_digest([1.0, 2.0])
    b = float64_digest([1.0, np.nextafter(2.0, 3.0)])
    assert a != b


def test_digest_of_encoded_signal_matches_original_column() -> None:
    values = [float(np.float32(v)) for v in np.linspace(0, 100, 50)]
    signal = encode_column(FLOAT_SPEC, values)
    assert signal["digest"] == float64_digest(values)
    assert float64_digest(decode_signal(signal, len(values))) == signal["digest"]
