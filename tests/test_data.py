from datetime import UTC, datetime

import pandas as pd
import pytest

from quantlab.data.csv_loader import load_bars_from_csv
from quantlab.data.models import Bar
from quantlab.data.validation import validate_bar


def make_bar(**overrides) -> Bar:
    values = {
        "timestamp": datetime.now(UTC),
        "open": 100.0,
        "high": 105.0,
        "low": 98.0,
        "close": 103.0,
        "volume": 1000.0,
    }
    values.update(overrides)
    return Bar(**values)


def test_valid_bar():
    validate_bar(make_bar())


@pytest.mark.parametrize("field", ["open", "high", "low", "close"])
def test_non_positive_price_is_rejected(field):
    with pytest.raises(ValueError):
        validate_bar(make_bar(**{field: 0.0}))


def test_negative_volume_is_rejected():
    with pytest.raises(ValueError):
        validate_bar(make_bar(volume=-1.0))


def test_high_below_open_is_rejected():
    with pytest.raises(ValueError):
        validate_bar(make_bar(high=99.0))


def test_high_below_close_is_rejected():
    with pytest.raises(ValueError):
        validate_bar(make_bar(high=102.0))


def test_low_above_open_is_rejected():
    with pytest.raises(ValueError):
        validate_bar(make_bar(low=101.0))


def test_low_above_close_is_rejected():
    with pytest.raises(ValueError):
        validate_bar(make_bar(low=104.0))


def test_zero_volume_is_allowed():
    validate_bar(make_bar(volume=0.0))

def test_load_bars_from_csv(tmp_path):
    csv_file = tmp_path / "prices.csv"

    pd.DataFrame(
        {
            "timestamp": [
                "2026-01-01T00:00:00+00:00",
                "2026-01-01T00:01:00+00:00",
            ],
            "open": [100.0, 101.0],
            "high": [102.0, 103.0],
            "low": [99.0, 100.0],
            "close": [101.0, 102.0],
            "volume": [1000.0, 1200.0],
        }
    ).to_csv(csv_file, index=False)

    bars = load_bars_from_csv(csv_file)

    assert len(bars) == 2
    assert bars[0].open == 100.0
    assert bars[0].close == 101.0
    assert bars[1].volume == 1200.0

def test_load_bars_from_csv_rejects_missing_columns(tmp_path):
    csv_file = tmp_path / "prices.csv"

    pd.DataFrame(
        {
            "timestamp": ["2026-01-01T00:00:00+00:00"],
            "open": [100.0],
            "high": [102.0],
            "low": [99.0],
            "close": [101.0],
        }
    ).to_csv(csv_file, index=False)

    with pytest.raises(ValueError, match="missing required columns"):
        load_bars_from_csv(csv_file)


def test_load_bars_from_csv_rejects_invalid_price(tmp_path):
    csv_file = tmp_path / "prices.csv"

    pd.DataFrame(
        {
            "timestamp": ["2026-01-01T00:00:00+00:00"],
            "open": [-100.0],
            "high": [102.0],
            "low": [99.0],
            "close": [101.0],
            "volume": [1000.0],
        }
    ).to_csv(csv_file, index=False)

    with pytest.raises(ValueError, match="Open price must be positive"):
        load_bars_from_csv(csv_file)


def test_load_bars_from_csv_rejects_negative_volume(tmp_path):
    csv_file = tmp_path / "prices.csv"

    pd.DataFrame(
        {
            "timestamp": ["2026-01-01T00:00:00+00:00"],
            "open": [100.0],
            "high": [102.0],
            "low": [99.0],
            "close": [101.0],
            "volume": [-1000.0],
        }
    ).to_csv(csv_file, index=False)

    with pytest.raises(ValueError, match="Volume cannot be negative"):
        load_bars_from_csv(csv_file)