from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from quantlab.analytics.monte_carlo import run_monte_carlo_simulation
from quantlab.api.main import app
from quantlab.backtest.models import Trade, TradeSide


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def make_sample_trades(pnl_pattern: list[float], initial_price: float = 100.0) -> list[Trade]:
    """Helper to generate a sequence of paired Buy/Sell trades with given P&Ls."""
    trades: list[Trade] = []
    current_time = datetime(2025, 1, 1, tzinfo=UTC)
    qty = 10.0

    for i, pnl in enumerate(pnl_pattern):
        buy_price = initial_price + i * 5.0
        # PnL = (sell_price - buy_price) * qty => sell_price = buy_price + pnl / qty
        sell_price = buy_price + (pnl / qty)

        trades.append(
            Trade(
                timestamp=current_time,
                side=TradeSide.BUY,
                price=buy_price,
                quantity=qty,
                commission=0.0,
            )
        )
        current_time += timedelta(hours=1)
        trades.append(
            Trade(
                timestamp=current_time,
                side=TradeSide.SELL,
                price=sell_price,
                quantity=qty,
                commission=0.0,
            )
        )
        current_time += timedelta(hours=1)

    return trades


def test_monte_carlo_reproducibility_with_seed():
    trades = make_sample_trades([100.0, -50.0, 200.0, -100.0, 150.0])
    res1 = run_monte_carlo_simulation(
        initial_cash=10_000.0,
        trades=trades,
        num_simulations=500,
        seed=42,
    )
    res2 = run_monte_carlo_simulation(
        initial_cash=10_000.0,
        trades=trades,
        num_simulations=500,
        seed=42,
    )

    assert res1.summary.median_terminal_equity == res2.summary.median_terminal_equity
    assert res1.summary.probability_of_ruin == res2.summary.probability_of_ruin
    assert res1.summary.median_max_drawdown == res2.summary.median_max_drawdown
    assert len(res1.confidence_cone) == len(res2.confidence_cone)
    for p1, p2 in zip(res1.confidence_cone, res2.confidence_cone, strict=True):
        assert p1.p50 == p2.p50


def test_monte_carlo_percentile_hierarchy():
    trades = make_sample_trades([50.0, -30.0, 120.0, -80.0, 90.0, -20.0])
    res = run_monte_carlo_simulation(
        initial_cash=10_000.0,
        trades=trades,
        num_simulations=1000,
        mode="trade_shuffle",
        seed=123,
    )

    for pt in res.confidence_cone:
        assert pt.p5 <= pt.p25
        assert pt.p25 <= pt.p50
        assert pt.p50 <= pt.p75
        assert pt.p75 <= pt.p95


def test_monte_carlo_bootstrap_mode():
    trades = make_sample_trades([80.0, -40.0, 150.0, -60.0])
    res = run_monte_carlo_simulation(
        initial_cash=5_000.0,
        trades=trades,
        num_simulations=500,
        mode="bootstrap",
        seed=999,
    )

    assert res.summary.simulations_count == 500
    assert res.summary.trades_resampled == 4
    assert 0.0 <= res.summary.probability_of_ruin <= 1.0
    assert res.summary.p5_terminal_equity <= res.summary.p95_terminal_equity
    assert len(res.drawdown_histogram) == 10
    total_percentage = sum(b.percentage for b in res.drawdown_histogram)
    assert pytest.approx(total_percentage, abs=1e-5) == 1.0


def test_monte_carlo_probability_of_ruin():
    # Massive losses that should guarantee 100% ruin on a 10% threshold
    disastrous_trades = make_sample_trades([-2000.0, -2000.0, -2000.0])
    res = run_monte_carlo_simulation(
        initial_cash=5_000.0,
        trades=disastrous_trades,
        num_simulations=200,
        ruin_drawdown_pct=0.10,
        seed=1,
    )

    assert res.summary.probability_of_ruin == 1.0

    # Mild gains with no drawdowns exceeding 50%
    profitable_trades = make_sample_trades([100.0, 200.0, 150.0, 50.0])
    res_safe = run_monte_carlo_simulation(
        initial_cash=10_000.0,
        trades=profitable_trades,
        num_simulations=200,
        ruin_drawdown_pct=0.50,
        seed=1,
    )
    assert res_safe.summary.probability_of_ruin == 0.0


def test_monte_carlo_input_validation():
    trades = make_sample_trades([10.0, -5.0])

    with pytest.raises(ValueError, match="Initial cash must be strictly positive"):
        run_monte_carlo_simulation(initial_cash=-100.0, trades=trades)

    with pytest.raises(ValueError, match="Number of simulations must be between"):
        run_monte_carlo_simulation(initial_cash=1000.0, trades=trades, num_simulations=5)

    with pytest.raises(ValueError, match="ruin_drawdown_pct must be between"):
        run_monte_carlo_simulation(initial_cash=1000.0, trades=trades, ruin_drawdown_pct=1.5)

    with pytest.raises(ValueError, match="Unsupported Monte Carlo mode"):
        run_monte_carlo_simulation(initial_cash=1000.0, trades=trades, mode="invalid_mode")

    with pytest.raises(ValueError, match="requires at least 2 closed trades"):
        single_trade = make_sample_trades([10.0])
        run_monte_carlo_simulation(initial_cash=1000.0, trades=single_trade)


def test_monte_carlo_api_endpoint(client: TestClient):
    payload = {
        "dataset": "reliance_daily.csv",
        "strategy": "moving_average",
        "fast_period": 2,
        "slow_period": 3,
        "initial_cash": 100_000.0,
        "commission_rate": 0.001,
        "slippage_rate": 0.001,
        "sizing_mode": "unit",
        "quantity_per_trade": 1.0,
        "num_simulations": 200,
        "ruin_drawdown_pct": 0.20,
        "mode": "trade_shuffle",
        "seed": 42,
    }

    response = client.post("/api/v1/analytics/monte-carlo", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["strategy_name"] == "Moving Average Crossover"
    assert data["dataset"] == "reliance_daily.csv"
    assert "summary" in data
    assert data["summary"]["simulations_count"] == 200
    assert data["summary"]["ruin_threshold"] == 0.20
    assert 0.0 <= data["summary"]["probability_of_ruin"] <= 1.0
    assert len(data["confidence_cone"]) > 0
    assert len(data["drawdown_histogram"]) == 10
