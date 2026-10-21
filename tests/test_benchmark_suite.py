from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from quantlab.analytics.benchmark_suite import (
    BenchmarkMatrixResult,
    BenchmarkRow,
    generate_benchmark_matrix,
)
from quantlab.api.main import app
from quantlab.data.models import Bar


def _generate_synthetic_bars(count: int = 150, start_price: float = 100.0) -> list[Bar]:
    base_time = datetime(2023, 1, 1, 9, 15, tzinfo=UTC)
    bars: list[Bar] = []
    price = start_price

    for i in range(count):
        # Create an alternating trend with some volatility
        delta = 1.0 if (i % 8 < 5) else -0.8
        price = max(10.0, price + delta)
        bars.append(
            Bar(
                timestamp=base_time + timedelta(days=i),
                open=price - 0.2,
                high=price + 0.8,
                low=price - 0.5,
                close=price,
                volume=10_000 + i * 50,
            )
        )
    return bars


def test_benchmark_matrix_synthetic_data() -> None:
    data = {
        "TEST_ASSET_A.csv": _generate_synthetic_bars(120, 100.0),
        "TEST_ASSET_B.csv": _generate_synthetic_bars(120, 250.0),
    }

    result = generate_benchmark_matrix(
        bars_by_symbol=data,
        initial_cash=50_000.0,
        commission_rate=0.001,
        slippage_rate=0.0005,
    )

    assert isinstance(result, BenchmarkMatrixResult)
    assert len(result.datasets) == 2
    assert len(result.strategies) == 6
    # 2 datasets * 6 strategies = 12 benchmark rows
    assert len(result.rows) == 12

    for r in result.rows:
        assert isinstance(r, BenchmarkRow)
        assert r.total_trades >= 0
        assert r.final_equity > 0
        assert r.total_return is not None
        assert r.max_drawdown >= 0.0

    # Test Markdown formatting
    md = result.to_markdown()
    assert "| Dataset | Strategy |" in md
    assert "Buy and Hold" in md
    assert "Confluence Strategy" in md
    assert "TEST_ASSET_A" in md

    # Test LaTeX formatting
    latex = result.to_latex()
    assert r"\begin{table*}" in latex
    assert r"\caption{Cross-Strategy Quantitative Performance Benchmark Across Evaluation Datasets}" in latex
    assert r"\toprule" in latex
    assert r"\bottomrule" in latex
    assert r"\end{table*}" in latex

    # Test CSV formatting
    csv_str = result.to_csv()
    assert "dataset,symbol,strategy_name,configuration" in csv_str
    assert "TEST_ASSET_A.csv" in csv_str

    # Test dictionary output
    d = result.to_dict()
    assert "rows" in d
    assert "markdown_table" in d
    assert "latex_table" in d
    assert "csv_table" in d
    assert len(d["rows"]) == 12


def test_benchmark_matrix_real_dataset() -> None:
    result = generate_benchmark_matrix(
        datasets=["reliance_daily.csv"],
        initial_cash=100_000.0,
    )
    assert len(result.rows) == 6
    strategies_evaluated = {r.strategy_name for r in result.rows}
    expected_strategies = {
        "Buy and Hold",
        "Moving Average Crossover",
        "RSI Reversal",
        "Bollinger Bands",
        "MACD Trend Following",
        "Confluence Strategy",
    }
    assert strategies_evaluated == expected_strategies


def test_benchmark_matrix_invalid_inputs() -> None:
    with pytest.raises(ValueError, match="initial_cash must be strictly positive"):
        generate_benchmark_matrix(bars_by_symbol={"A": _generate_synthetic_bars()}, initial_cash=-10)

    with pytest.raises(ValueError, match="commission_rate and slippage_rate cannot be negative"):
        generate_benchmark_matrix(bars_by_symbol={"A": _generate_synthetic_bars()}, commission_rate=-0.01)

    with pytest.raises(FileNotFoundError, match="Dataset file not found"):
        generate_benchmark_matrix(datasets=["non_existent_dataset_123.csv"])


def test_api_benchmark_matrix_endpoint() -> None:
    client = TestClient(app)
    response = client.post(
        "/api/v1/analytics/benchmark-matrix",
        json={
            "datasets": ["reliance_daily.csv", "tcs_daily.csv"],
            "initial_cash": 100_000.0,
            "commission_rate": 0.001,
            "slippage_rate": 0.0005,
        },
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert "rows" in data
    assert "markdown_table" in data
    assert "latex_table" in data
    assert "csv_table" in data
    assert len(data["datasets"]) == 2
    assert len(data["rows"]) == 12  # 2 datasets * 6 strategies
