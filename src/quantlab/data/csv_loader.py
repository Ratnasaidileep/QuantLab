from pathlib import Path

import pandas as pd

from quantlab.data.models import Bar
from quantlab.data.validation import validate_bar

REQUIRED_COLUMNS = {
    "timestamp",
    "open",
    "high",
    "low",
    "close",
    "volume",
}


def load_bars_from_csv(path: str | Path) -> list[Bar]:
    """Load and validate OHLCV bars from a CSV file."""
    dataframe = pd.read_csv(path)

    missing_columns = REQUIRED_COLUMNS - set(dataframe.columns)
    if missing_columns:
        raise ValueError(
            f"CSV is missing required columns: {sorted(missing_columns)}"
        )

    bars: list[Bar] = []

    for row in dataframe.itertuples(index=False):
        bar = Bar(
            timestamp=pd.to_datetime(row.timestamp).to_pydatetime(),
            open=float(row.open),
            high=float(row.high),
            low=float(row.low),
            close=float(row.close),
            volume=float(row.volume),
        )

        validate_bar(bar)
        bars.append(bar)

    return bars