"""Tests for external market data provider error handling, offline resilience, and validation."""

from datetime import UTC
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from quantlab.api.main import create_app
from quantlab.backtest.engine import Backtest
from quantlab.data.csv_loader import fetch_ohlcv_from_yfinance, load_bars_from_csv
from quantlab.data.exceptions import (
    CorruptedDataError,
    DataConnectionError,
    DataProviderRateLimitError,
    InvalidSymbolError,
    SymbolNotFoundError,
)
from quantlab.strategy.moving_average import MovingAverageCrossover


@pytest.fixture
def mock_valid_df() -> pd.DataFrame:
    """Fixture providing a valid 10-bar OHLCV daily dataframe."""
    dates = pd.date_range("2026-01-01", periods=10, freq="D", tz=UTC)
    data = {
        "Open": [100.0 + i for i in range(10)],
        "High": [105.0 + i for i in range(10)],
        "Low": [98.0 + i for i in range(10)],
        "Close": [103.0 + i for i in range(10)],
        "Volume": [1000.0 + i * 100 for i in range(10)],
    }
    return pd.DataFrame(data, index=dates)


def test_fetch_invalid_symbol_rejected():
    """Verify malformed symbol strings are rejected upfront without external calls."""
    with pytest.raises(InvalidSymbolError, match="Invalid symbol"):
        fetch_ohlcv_from_yfinance("")

    with pytest.raises(InvalidSymbolError, match="Invalid symbol"):
        fetch_ohlcv_from_yfinance("AAPL DROP TABLE;--")

    with pytest.raises(InvalidSymbolError, match="Invalid symbol"):
        fetch_ohlcv_from_yfinance("TOOLONGSYMBOLNAMETHATEXCEEDSTWENTYCHARS")


def test_fetch_invalid_period_rejected():
    """Verify invalid period string raises DataError."""
    with pytest.raises(Exception, match="Invalid period"):
        fetch_ohlcv_from_yfinance("AAPL", period="invalid_period_99")


@patch("yfinance.Ticker")
def test_fetch_network_unavailable(mock_ticker_cls):
    """Verify connection errors are classified as DataConnectionError."""
    mock_instance = MagicMock()
    mock_instance.history.side_effect = Exception("Failed to resolve 'query1.finance.yahoo.com' (gaierror: Name or service not known)")
    mock_ticker_cls.return_value = mock_instance

    with pytest.raises(DataConnectionError, match="Network error while connecting"):
        fetch_ohlcv_from_yfinance("AAPL")


@patch("yfinance.Ticker")
def test_fetch_rate_limit(mock_ticker_cls):
    """Verify 429 rate limit is classified as DataProviderRateLimitError."""
    mock_instance = MagicMock()
    mock_instance.history.side_effect = Exception("429 Client Error: Too Many Requests for url")
    mock_ticker_cls.return_value = mock_instance

    with pytest.raises(DataProviderRateLimitError, match="rate limit reached"):
        fetch_ohlcv_from_yfinance("AAPL")


@patch("yfinance.Ticker")
def test_fetch_empty_provider_response(mock_ticker_cls):
    """Verify empty dataframe response raises SymbolNotFoundError."""
    mock_instance = MagicMock()
    mock_instance.history.return_value = pd.DataFrame()
    mock_ticker_cls.return_value = mock_instance

    with pytest.raises(SymbolNotFoundError, match="No market data returned"):
        fetch_ohlcv_from_yfinance("NONEXISTENT_TICKER")


@patch("yfinance.Ticker")
def test_fetch_malformed_downloaded_data(mock_ticker_cls):
    """Verify response missing required OHLCV columns raises CorruptedDataError."""
    mock_instance = MagicMock()
    # Missing High, Low, Volume
    dates = pd.date_range("2026-01-01", periods=10, freq="D", tz=UTC)
    incomplete_df = pd.DataFrame({"Close": [100.0] * 10}, index=dates)
    mock_instance.history.return_value = incomplete_df
    mock_ticker_cls.return_value = mock_instance

    with pytest.raises(CorruptedDataError, match="missing required columns"):
        fetch_ohlcv_from_yfinance("AAPL")


@patch("yfinance.Ticker")
def test_fetch_successful_online_download(mock_ticker_cls, mock_valid_df):
    """Verify successful response correctly transforms into valid Bar objects."""
    mock_instance = MagicMock()
    mock_instance.history.return_value = mock_valid_df
    mock_ticker_cls.return_value = mock_instance

    bars = fetch_ohlcv_from_yfinance("AAPL", period="1mo")
    assert len(bars) == 10
    assert bars[0].open == 100.0
    assert bars[0].high == 105.0
    assert bars[0].low == 98.0
    assert bars[0].close == 103.0
    assert bars[0].volume == 1000.0


def test_offline_backtest_with_local_data():
    """Verify local backtest runs completely offline without network dependencies."""
    bars = load_bars_from_csv("data/reliance_daily.csv")
    assert len(bars) >= 400

    strategy = MovingAverageCrossover(fast_period=10, slow_period=30)
    bt = Backtest(
        initial_cash=100000.0,
        strategy=strategy,
        commission_rate=0.001,
        slippage_rate=0.001,
        use_crossover=True,
    )
    result = bt.run(bars)

    assert result.bars_processed == len(bars)
    assert result.final_equity > 0
    assert len(result.trades) > 0


@patch("quantlab.api.routes.datasets.fetch_ohlcv_from_yfinance")
def test_api_fetch_dataset_status_codes(mock_fetch):
    """Verify API route maps domain exceptions to appropriate HTTP status codes."""
    app = create_app()
    client = TestClient(app)

    # 1. Invalid symbol -> 400
    mock_fetch.side_effect = InvalidSymbolError("Invalid symbol format")
    resp = client.post("/api/v1/datasets/fetch", json={"symbol": "BAD!"})
    assert resp.status_code == 400
    assert "Invalid symbol" in resp.json()["detail"]

    # 2. Symbol not found -> 404
    mock_fetch.side_effect = SymbolNotFoundError("No market data returned for symbol 'XYZ'")
    resp = client.post("/api/v1/datasets/fetch", json={"symbol": "XYZ"})
    assert resp.status_code == 404
    assert "No market data" in resp.json()["detail"]

    # 3. Connection error -> 503
    mock_fetch.side_effect = DataConnectionError("Network error while connecting")
    resp = client.post("/api/v1/datasets/fetch", json={"symbol": "AAPL"})
    assert resp.status_code == 503
    assert "Network error" in resp.json()["detail"]

    # 4. Rate limit -> 429
    mock_fetch.side_effect = DataProviderRateLimitError("Rate limit reached")
    resp = client.post("/api/v1/datasets/fetch", json={"symbol": "AAPL"})
    assert resp.status_code == 429
    assert "rate limit" in resp.json()["detail"].lower()
