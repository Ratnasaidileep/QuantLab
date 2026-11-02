import re
from pathlib import Path

import pandas as pd

from quantlab.data.exceptions import (
    CorruptedDataError,
    DataConnectionError,
    DataError,
    DataProviderRateLimitError,
    InvalidSymbolError,
    SymbolNotFoundError,
)
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

VALID_PERIODS = {
    "1d",
    "5d",
    "1mo",
    "3mo",
    "6mo",
    "1y",
    "2y",
    "5y",
    "10y",
    "ytd",
    "max",
}


def normalize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize common OHLCV column name variations to lowercase standard."""
    col_map = {}
    for col in df.columns:
        clean = str(col).strip().lower()
        if clean in ("date", "datetime", "time", "index"):
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
    """Fetch historical daily OHLCV bars using yfinance with structured error classification."""
    clean_symbol = symbol.strip().upper()
    if not clean_symbol or not re.match(r"^[A-Z0-9\.\-\^_]{1,20}$", clean_symbol):
        raise InvalidSymbolError(
            f"Invalid symbol '{symbol}'. Ticker symbol must be 1-20 alphanumeric characters (e.g. 'AAPL', 'RELIANCE.NS', '^NSEI')."
        )

    clean_period = period.strip().lower()
    if clean_period not in VALID_PERIODS:
        raise DataError(
            f"Invalid period '{period}'. Supported periods are: {', '.join(sorted(VALID_PERIODS))}."
        )

    try:
        import yfinance as yf
    except ImportError as err:
        raise DataError(
            "Online data provider 'yfinance' is not installed in the Python environment."
        ) from err

    ticker = yf.Ticker(clean_symbol)
    try:
        df = ticker.history(period=clean_period)
    except Exception as err:
        err_msg = str(err)
        lower_err = err_msg.lower()
        if any(
            term in lower_err
            for term in (
                "connection",
                "gaierror",
                "failed to resolve",
                "timeout",
                "offline",
                "unreachable",
                "name resolution",
                "remotedisconnected",
            )
        ):
            raise DataConnectionError(
                f"Network error while connecting to market data provider for symbol '{clean_symbol}'. "
                "Please check your internet connection or use a bundled local dataset."
            ) from err
        if any(term in lower_err for term in ("rate limit", "429", "too many requests")):
            raise DataProviderRateLimitError(
                f"Data provider rate limit reached for symbol '{clean_symbol}'. Please wait a moment before trying again."
            ) from err
        raise DataError(
            f"External market data provider error for '{clean_symbol}': {err_msg}"
        ) from err

    if df is None or df.empty:
        raise SymbolNotFoundError(
            f"No market data returned for symbol '{clean_symbol}' (period: {clean_period}). "
            "Verify the ticker symbol and exchange suffix (e.g., '.NS' for NSE, '.BO' for BSE)."
        )

    df = df.reset_index()
    df = normalize_dataframe_columns(df)
    missing_columns = REQUIRED_COLUMNS - set(df.columns)
    if missing_columns:
        raise CorruptedDataError(
            f"Fetched data for '{clean_symbol}' is missing required columns: {sorted(missing_columns)}"
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

    if len(bars) < 5:
        raise CorruptedDataError(
            f"Insufficient valid price bars ({len(bars)}) returned for symbol '{clean_symbol}'. At least 5 bars are required."
        )

    return bars