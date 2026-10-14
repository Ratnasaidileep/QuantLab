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


def normalize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize common OHLCV column name variations to lowercase standard."""
    col_map = {}
    for col in df.columns:
        clean = str(col).strip().lower()
        if clean in ("date", "datetime", "time"):
            col_map[col] = "timestamp"
        elif clean in ("open", "high", "low", "close", "volume"):
            col_map[col] = clean
        elif clean in ("adj close", "adj_close"):
            col_map[col] = "adj_close"
        else:
            col_map[col] = clean
    return df.rename(columns=col_map)


def load_bars_from_csv(path: str | Path) -> list[Bar]:
    """Load, normalize, and validate OHLCV bars from a CSV file."""
    dataframe = pd.read_csv(path)
    dataframe = normalize_dataframe_columns(dataframe)

    missing_columns = REQUIRED_COLUMNS - set(dataframe.columns)
    if missing_columns:
        raise ValueError(
            f"CSV is missing required columns: {sorted(missing_columns)}"
        )

    # Ensure chronological ascending order
    dataframe["timestamp"] = pd.to_datetime(dataframe["timestamp"])
    dataframe = dataframe.sort_values(by="timestamp").reset_index(drop=True)
    dataframe = dataframe.drop_duplicates(subset=["timestamp"], keep="last")

    bars: list[Bar] = []

    for row in dataframe.itertuples(index=False):
        ts = row.timestamp.to_pydatetime()
        if ts.tzinfo is not None:
            ts = ts.replace(tzinfo=None)

        bar = Bar(
            timestamp=ts,
            open=float(row.open),
            high=float(row.high),
            low=float(row.low),
            close=float(row.close),
            volume=float(row.volume),
        )

        validate_bar(bar)
        bars.append(bar)

    return bars


def save_bars_to_csv(bars: list[Bar], path: str | Path) -> None:
    """Save a sequence of validated bars to a standard QuantLab CSV file."""
    target_path = Path(path)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    data = [
        {
            "timestamp": bar.timestamp.isoformat(),
            "open": round(bar.open, 4),
            "high": round(bar.high, 4),
            "low": round(bar.low, 4),
            "close": round(bar.close, 4),
            "volume": round(bar.volume, 2),
        }
        for bar in bars
    ]
    df = pd.DataFrame(data)
    df.to_csv(target_path, index=False)


def fetch_ohlcv_from_yfinance(symbol: str, period: str = "2y") -> list[Bar]:
    """Fetch historical daily OHLCV bars using yfinance."""
    import yfinance as yf

    clean_symbol = symbol.strip().upper()
    ticker = yf.Ticker(clean_symbol)
    try:
        df = ticker.history(period=period)
    except Exception as e:
        raise ValueError(f"Failed to fetch data for symbol '{clean_symbol}': {e}") from e

    if df is None or df.empty:
        raise ValueError(
            f"No market data returned for symbol '{clean_symbol}' (period: {period})."
        )

    df = df.reset_index()
    df = normalize_dataframe_columns(df)
    missing_columns = REQUIRED_COLUMNS - set(df.columns)
    if missing_columns:
        raise ValueError(
            f"Fetched data missing required columns: {sorted(missing_columns)}"
        )

    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df = df.sort_values(by="timestamp").reset_index(drop=True)
    df = df.drop_duplicates(subset=["timestamp"], keep="last")
    df = df.dropna(subset=["open", "high", "low", "close", "volume"])

    bars: list[Bar] = []
    for row in df.itertuples(index=False):
        ts = row.timestamp.to_pydatetime()
        if ts.tzinfo is not None:
            ts = ts.replace(tzinfo=None)
        bar = Bar(
            timestamp=ts,
            open=float(row.open),
            high=float(row.high),
            low=float(row.low),
            close=float(row.close),
            volume=float(row.volume),
        )
        validate_bar(bar)
        bars.append(bar)

    if not bars:
        raise ValueError(f"No valid bars found for symbol '{clean_symbol}'.")

    return bars