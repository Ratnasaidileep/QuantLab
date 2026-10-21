from datetime import UTC, datetime, timedelta

import pytest

from quantlab.backtest.engine import Backtest
from quantlab.data.models import Bar
from quantlab.strategy.confluence import ConfluenceStrategy
from quantlab.strategy.models import Signal


def test_confluence_parameter_validation():
    with pytest.raises(ValueError, match="trend_period"):
        ConfluenceStrategy(trend_period=1)

    with pytest.raises(ValueError, match="pullback_period"):
        ConfluenceStrategy(pullback_period=1)

    with pytest.raises(ValueError, match="Thresholds must satisfy"):
        ConfluenceStrategy(oversold=70.0, overbought=30.0)

    with pytest.raises(ValueError, match="Thresholds must satisfy"):
        ConfluenceStrategy(oversold=50.0, overbought=50.0)


def test_confluence_price_validation():
    strategy = ConfluenceStrategy(trend_period=5, pullback_period=3)

    with pytest.raises(ValueError, match="positive"):
        strategy.calculate_indicators([10.0, -1.0, 15.0])

    with pytest.raises(ValueError, match="finite"):
        strategy.calculate_indicators([10.0, float("nan"), 15.0])


def test_confluence_insufficient_bars():
    strategy = ConfluenceStrategy(trend_period=10, pullback_period=5)
    prices = [100.0] * 8
    ema, _ = strategy.calculate_indicators(prices)

    assert len(ema) == 8
    assert all(v is None for v in ema)  # Needs 10 bars for trend EMA
    assert strategy.generate_signal(prices) == Signal.FLAT


def test_confluence_trend_filter_blocks_downtrend_pullback():
    """In a downtrend (Price < EMA), an oversold RSI should NOT trigger a long signal."""
    strategy = ConfluenceStrategy(trend_period=5, pullback_period=3, oversold=35.0, overbought=65.0)

    # Monotonically falling prices: Price will be below EMA, and RSI will be deeply oversold (< 20)
    falling_prices = [100.0, 95.0, 90.0, 85.0, 80.0, 75.0, 70.0, 65.0]
    ema, rsi = strategy.calculate_indicators(falling_prices)

    assert ema[-1] is not None
    assert falling_prices[-1] < ema[-1]  # Confirmed downtrend
    assert rsi[-1] is not None and rsi[-1] < 35.0  # Oversold

    # Because trend filter is active, signal remains FLAT
    assert strategy.generate_signal(falling_prices) == Signal.FLAT


def test_confluence_buys_pullback_in_confirmed_uptrend():
    """In an uptrend (Price > EMA), an oversold pullback should trigger LONG."""
    strategy = ConfluenceStrategy(trend_period=10, pullback_period=2, oversold=35.0, overbought=65.0)

    # Strong uptrend first to elevate EMA, then a brief pullback that keeps Price > EMA but drives RSI down
    prices = [50.0] * 10 + [60.0, 70.0, 80.0, 90.0, 100.0, 92.0, 85.0]
    ema, rsi = strategy.calculate_indicators(prices)

    assert ema[-1] is not None
    assert prices[-1] > ema[-1]  # Still well above EMA (uptrend intact: 85 > 77.0)
    assert rsi[-1] is not None and rsi[-1] <= 35.0  # Pulled back to oversold (~30.57)

    assert strategy.generate_signal(prices) == Signal.LONG


def test_confluence_exits_on_trend_breakdown():
    """When in a LONG position, if price drops below EMA, position exits to FLAT."""
    strategy = ConfluenceStrategy(trend_period=10, pullback_period=2, oversold=35.0, overbought=65.0)

    # 1. Enter long during pullback in uptrend
    prices = [50.0] * 10 + [60.0, 70.0, 80.0, 90.0, 100.0, 92.0, 85.0]
    assert strategy.generate_signal(prices) == Signal.LONG

    # 2. Severe crash: price crashes below EMA before reaching overbought RSI
    crashed_prices = prices + [60.0, 50.0]
    ema, _ = strategy.calculate_indicators(crashed_prices)
    assert crashed_prices[-1] < ema[-1]  # Structural trend break

    assert strategy.generate_signal(crashed_prices) == Signal.FLAT


def test_confluence_crossover_signal():
    strategy = ConfluenceStrategy(trend_period=10, pullback_period=2, oversold=35.0, overbought=65.0)
    prices_uptrend = [50.0] * 10 + [60.0, 70.0, 80.0, 90.0, 100.0, 92.0, 85.0]

    # At bar 85.0, the signal just turned LONG
    assert strategy.generate_crossover_signal(prices_uptrend) == Signal.LONG

    # On next bar if it stays long, crossover is FLAT
    assert strategy.generate_crossover_signal(prices_uptrend + [86.0]) == Signal.FLAT


def test_confluence_backtest_integration():
    strategy = ConfluenceStrategy(trend_period=5, pullback_period=2, oversold=40.0, overbought=65.0)
    backtest = Backtest(
        initial_cash=10000.0,
        strategy=strategy,
        commission_rate=0.001,
        slippage_rate=0.001,
        use_crossover=False,
    )

    now = datetime(2025, 1, 1, tzinfo=UTC)
    prices = [50.0, 60.0, 70.0, 80.0, 90.0, 100.0, 110.0, 102.0, 96.0, 105.0, 115.0, 120.0]
    bars = [
        Bar(
            timestamp=now + timedelta(days=i),
            open=p - 1.0,
            high=p + 2.0,
            low=p - 2.0,
            close=p,
            volume=1000.0,
        )
        for i, p in enumerate(prices)
    ]

    result = backtest.run(bars)
    assert result.bars_processed == len(bars)
    assert len(result.equity_curve) == len(bars)
    assert result.metrics is not None
    assert result.final_equity > 0
