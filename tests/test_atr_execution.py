from datetime import UTC, datetime, timedelta

import pytest

from quantlab.backtest.engine import Backtest
from quantlab.data.models import Bar
from quantlab.execution.atr import calculate_atr_series, calculate_true_range_series
from quantlab.strategy.moving_average import MovingAverageCrossover


def test_atr_series_calculation():
    now = datetime(2025, 1, 1, tzinfo=UTC)
    bars = [
        Bar(timestamp=now, open=100.0, high=105.0, low=95.0, close=100.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=1), open=101.0, high=110.0, low=100.0, close=108.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=2), open=107.0, high=109.0, low=99.0, close=102.0, volume=1000.0),
    ]

    tr = calculate_true_range_series(bars)
    assert len(tr) == 3
    # Bar 0: 105 - 95 = 10
    assert tr[0] == 10.0
    # Bar 1: max(110-100, |110-100|, |100-100|) = 10
    assert tr[1] == 10.0
    # Bar 2: max(109-99=10, |109-108|=1, |99-108|=9) = 10
    assert tr[2] == 10.0

    atr = calculate_atr_series(bars, period=2)
    assert len(atr) == 3
    assert atr[0] is None
    # Index 1: mean(tr[0], tr[1]) = 10.0
    assert atr[1] == 10.0
    # Index 2: (10.0 * 1 + 10.0) / 2 = 10.0
    assert atr[2] == 10.0


def test_atr_invalid_period():
    with pytest.raises(ValueError, match="period"):
        calculate_atr_series([], period=0)


def test_atr_trailing_stop_exit():
    """Verify that ATR trailing stop triggers intraday exit when low drops below peak - k*ATR."""
    strategy = MovingAverageCrossover(fast_period=2, slow_period=3)
    backtest = Backtest(
        initial_cash=100_000.0,
        strategy=strategy,
        use_crossover=False,
        atr_period=3,
        atr_stop_multiplier=2.0,  # stop barrier at peak - 2*ATR
    )

    now = datetime(2025, 1, 1, tzinfo=UTC)
    bars = [
        Bar(timestamp=now, open=100.0, high=102.0, low=98.0, close=100.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=1), open=100.0, high=102.0, low=98.0, close=100.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=2), open=100.0, high=102.0, low=98.0, close=100.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=3), open=100.0, high=106.0, low=99.0, close=105.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=4), open=105.0, high=110.0, low=104.0, close=109.0, volume=1000.0),
        # Intraday drop below ATR trailing barrier triggers exit:
        Bar(timestamp=now + timedelta(days=5), open=109.0, high=110.0, low=85.0, close=105.0, volume=1000.0),
    ]

    result = backtest.run(bars)
    assert len(result.trades) >= 2
    exit_trade = result.trades[-1]
    assert exit_trade.exit_reason == "atr_trailing_stop"


def test_atr_fractional_position_sizing():
    """Verify that sizing_mode='atr_fractional' dynamically scales position based on volatility risk."""
    strategy = MovingAverageCrossover(fast_period=2, slow_period=3)
    backtest = Backtest(
        initial_cash=100_000.0,
        strategy=strategy,
        use_crossover=False,
        sizing_mode="atr_fractional",
        risk_per_trade_pct=0.02,  # risk 2% of $100k = $2,000
        atr_period=3,
        atr_stop_multiplier=2.0,
    )

    now = datetime(2025, 1, 1, tzinfo=UTC)
    bars = [
        Bar(timestamp=now, open=100.0, high=102.0, low=98.0, close=100.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=1), open=100.0, high=102.0, low=98.0, close=100.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=2), open=100.0, high=102.0, low=98.0, close=100.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=3), open=100.0, high=106.0, low=99.0, close=105.0, volume=1000.0),
        Bar(timestamp=now + timedelta(days=4), open=105.0, high=110.0, low=104.0, close=109.0, volume=1000.0),
    ]

    result = backtest.run(bars)
    assert len(result.trades) >= 1
    entry_trade = result.trades[0]
    # In unit sizing it would be 1.0; here it dynamically sizes to 200.0
    assert entry_trade.quantity == 200.0
