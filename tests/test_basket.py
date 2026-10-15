from datetime import UTC, datetime, timedelta

from quantlab.data.models import Bar
from quantlab.portfolio.basket import (
    AllocationWeighting,
    BasketBacktestEngine,
    RebalanceFrequency,
)


def make_bar_series(symbol: str, prices: list[float], start_date: datetime | None = None) -> list[Bar]:
    start = start_date or datetime(2025, 1, 1, tzinfo=UTC)
    bars = []
    for i, p in enumerate(prices):
        dt = start + timedelta(days=i)
        bars.append(
            Bar(
                timestamp=dt,
                open=p,
                high=p * 1.01,
                low=p * 0.99,
                close=p,
                volume=1000.0,
            )
        )
    return bars


def test_equal_weight_buy_and_hold_two_assets():
    # Asset A doubles from 100 to 200 (+100%)
    # Asset B stays flat at 100 (0%)
    # Total portfolio should gain ~50%
    bars_a = make_bar_series("ASSET_A", [100.0, 100.0, 150.0, 200.0])
    bars_b = make_bar_series("ASSET_B", [100.0, 100.0, 100.0, 100.0])

    engine = BasketBacktestEngine(
        initial_cash=100_000.0,
        weighting=AllocationWeighting.EQUAL_WEIGHT,
        rebalance_freq=RebalanceFrequency.NONE,
        commission_rate=0.0,
        slippage_rate=0.0,
    )

    result = engine.run({"ASSET_A": bars_a, "ASSET_B": bars_b})

    assert result.initial_cash == 100_000.0
    # Day 1: Buys 500 shares of A at 100 (50k) and 500 shares of B at 100 (50k)
    # Day 4: A is at 200 (100k value), B is at 100 (50k value). Total = 150,000
    assert abs(result.final_equity - 150_000.0) < 1.0
    assert abs(result.metrics.total_return - 0.50) < 0.01
    assert len(result.trades) == 2  # 1 buy for A, 1 buy for B


def test_execution_timing_next_bar_open():
    # Verify that initial allocation trades execute at Bar 1 Open price, not Bar 0 close
    bars_a = [
        Bar(timestamp=datetime(2025, 1, 1, tzinfo=UTC), open=100.0, high=105.0, low=95.0, close=100.0, volume=100.0),
        Bar(timestamp=datetime(2025, 1, 2, tzinfo=UTC), open=110.0, high=115.0, low=108.0, close=112.0, volume=100.0),
    ]
    bars_b = [
        Bar(timestamp=datetime(2025, 1, 1, tzinfo=UTC), open=50.0, high=52.0, low=48.0, close=50.0, volume=100.0),
        Bar(timestamp=datetime(2025, 1, 2, tzinfo=UTC), open=55.0, high=58.0, low=54.0, close=56.0, volume=100.0),
    ]

    engine = BasketBacktestEngine(
        initial_cash=100_000.0,
        weighting=AllocationWeighting.EQUAL_WEIGHT,
        rebalance_freq=RebalanceFrequency.NONE,
        commission_rate=0.0,
        slippage_rate=0.0,
    )

    result = engine.run({"ASSET_A": bars_a, "ASSET_B": bars_b})

    # Trade for A must execute at bar 2 open = 110.0
    # Trade for B must execute at bar 2 open = 55.0
    trade_a = next(t for t in result.trades if t.symbol == "ASSET_A")
    trade_b = next(t for t in result.trades if t.symbol == "ASSET_B")

    assert trade_a.price == 110.0
    assert trade_b.price == 55.0


def test_monthly_rebalancing():
    # Asset A surges in month 1 and drops in month 2
    # Monthly rebalance will sell some A at the start of month 2 and rebalance into B
    d1 = datetime(2025, 1, 2, tzinfo=UTC)
    d2 = datetime(2025, 1, 15, tzinfo=UTC)
    d3 = datetime(2025, 1, 31, tzinfo=UTC)
    d4 = datetime(2025, 2, 3, tzinfo=UTC)  # New month -> Rebalance trigger!
    d5 = datetime(2025, 2, 28, tzinfo=UTC)

    dates = [d1, d2, d3, d4, d5]
    bars_a = [Bar(timestamp=dt, open=p, high=p, low=p, close=p, volume=100) for dt, p in zip(dates, [100.0, 150.0, 200.0, 200.0, 100.0])]
    bars_b = [Bar(timestamp=dt, open=p, high=p, low=p, close=p, volume=100) for dt, p in zip(dates, [100.0, 100.0, 100.0, 100.0, 100.0])]

    engine = BasketBacktestEngine(
        initial_cash=100_000.0,
        weighting=AllocationWeighting.EQUAL_WEIGHT,
        rebalance_freq=RebalanceFrequency.MONTHLY,
        commission_rate=0.001,
        slippage_rate=0.001,
    )

    result = engine.run({"ASSET_A": bars_a, "ASSET_B": bars_b})

    # We should have initial buys on d2, plus rebalance trades on d4
    assert len(result.trades) > 2
    rebalance_trades = [t for t in result.trades if "rebalance" in t.reason]
    assert len(rebalance_trades) >= 1


def test_custom_weights_allocation():
    bars_a = make_bar_series("ASSET_A", [100.0, 100.0, 100.0])
    bars_b = make_bar_series("ASSET_B", [100.0, 100.0, 100.0])

    engine = BasketBacktestEngine(
        initial_cash=100_000.0,
        weighting=AllocationWeighting.CUSTOM,
        custom_weights={"ASSET_A": 0.70, "ASSET_B": 0.30},
        rebalance_freq=RebalanceFrequency.NONE,
        commission_rate=0.0,
        slippage_rate=0.0,
    )

    result = engine.run({"ASSET_A": bars_a, "ASSET_B": bars_b})

    trade_a = next(t for t in result.trades if t.symbol == "ASSET_A")
    trade_b = next(t for t in result.trades if t.symbol == "ASSET_B")

    # 70% of 100k = 70k -> 700 shares at 100
    # 30% of 100k = 30k -> 300 shares at 100
    assert trade_a.quantity == 700.0
    assert trade_b.quantity == 300.0


def test_inverse_volatility_allocation():
    # Asset A has zero volatility (constant prices)
    # Asset B has high volatility
    # Inverse volatility gives near 100% weight to A or caps it smoothly
    bars_a = make_bar_series("ASSET_A", [100.0] * 30)
    bars_b = make_bar_series("ASSET_B", [100.0 + (10.0 if i % 2 == 0 else -10.0) for i in range(30)])

    engine = BasketBacktestEngine(
        initial_cash=100_000.0,
        weighting=AllocationWeighting.INVERSE_VOLATILITY,
        rebalance_freq=RebalanceFrequency.NONE,
        commission_rate=0.0,
        slippage_rate=0.0,
    )

    result = engine.run({"ASSET_A": bars_a, "ASSET_B": bars_b})

    trade_a = next(t for t in result.trades if t.symbol == "ASSET_A")
    trade_b = next(t for t in result.trades if t.symbol == "ASSET_B")

    # Asset A (lower vol) should receive significantly higher capital allocation than Asset B
    assert trade_a.quantity * 100.0 > trade_b.quantity * 100.0


def test_basket_performance_and_tail_risk_metrics():
    bars_a = make_bar_series("ASSET_A", [100.0 + i for i in range(50)])
    bars_b = make_bar_series("ASSET_B", [100.0 + 0.5 * i for i in range(50)])

    engine = BasketBacktestEngine(
        initial_cash=100_000.0,
        weighting=AllocationWeighting.EQUAL_WEIGHT,
        rebalance_freq=RebalanceFrequency.MONTHLY,
    )

    result = engine.run({"ASSET_A": bars_a, "ASSET_B": bars_b})

    assert result.metrics.total_return > 0.0
    assert result.metrics.cagr is not None
    assert result.metrics.sharpe_ratio is not None
    assert result.tail_risk.var_95_historical is not None
    assert result.tail_risk.cvar_95 is not None
    assert len(result.equity_curve) == 50
