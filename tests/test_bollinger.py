from datetime import UTC, datetime, timedelta

import pytest

from quantlab.backtest.engine import Backtest
from quantlab.data.models import Bar
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.models import Signal


def test_bollinger_insufficient_history():
    strategy = BollingerBandsStrategy(period=5, std_dev_multiplier=2.0)
    prices = [100.0, 102.0, 101.0, 103.0]
    middle, upper, lower = strategy.calculate_bands(prices)

    assert len(middle) == 4
    assert all(m is None for m in middle)
    assert all(u is None for u in upper)
    assert all(low is None for low in lower)
    assert strategy.generate_signal(prices) == Signal.FLAT


def test_bollinger_constant_prices():
    strategy = BollingerBandsStrategy(period=3, std_dev_multiplier=2.0)
    prices = [100.0, 100.0, 100.0, 100.0]
    middle, upper, lower = strategy.calculate_bands(prices)

    assert middle[2] == pytest.approx(100.0)
    assert upper[2] == pytest.approx(100.0)
    assert lower[2] == pytest.approx(100.0)


def test_bollinger_oversold_triggers_long():
    # 5 bars: 100, 100, 100, 100, then drop to 80
    strategy = BollingerBandsStrategy(period=4, std_dev_multiplier=1.5)
    prices = [100.0, 100.0, 100.0, 100.0, 80.0]
    signal = strategy.generate_signal(prices)

    assert signal == Signal.LONG


def test_bollinger_reversion_to_mean_triggers_flat():
    # Drop to 80 (triggers LONG), then rises to 105 (above mean, triggers FLAT)
    strategy = BollingerBandsStrategy(period=4, std_dev_multiplier=1.5, exit_at_mean=True)
    prices = [100.0, 100.0, 100.0, 100.0, 80.0, 105.0]
    signal = strategy.generate_signal(prices)

    assert signal == Signal.FLAT


def test_bollinger_invalid_parameters():
    with pytest.raises(ValueError, match="period must be at least 2"):
        BollingerBandsStrategy(period=1)

    with pytest.raises(ValueError, match="std_dev_multiplier must be strictly positive"):
        BollingerBandsStrategy(period=5, std_dev_multiplier=0.0)

    with pytest.raises(ValueError, match="Prices must be positive"):
        strategy = BollingerBandsStrategy(period=3)
        strategy.calculate_bands([100.0, -10.0, 105.0])


def test_bollinger_strategy_integrates_with_backtest_engine():
    base_time = datetime(2026, 1, 1, 9, 30, tzinfo=UTC)
    prices = [100.0, 100.0, 100.0, 100.0, 85.0, 84.0, 100.0, 105.0, 102.0]

    bars = [
        Bar(
            timestamp=base_time + timedelta(days=i),
            open=prices[i],
            high=prices[i] + 1.0,
            low=prices[i] - 1.0,
            close=prices[i],
            volume=1000.0,
        )
        for i in range(len(prices))
    ]

    strategy = BollingerBandsStrategy(period=4, std_dev_multiplier=1.5)
    backtest = Backtest(
        initial_cash=100_000.0,
        strategy=strategy,
        commission_rate=0.001,
        slippage_rate=0.001,
    )

    result = backtest.run(bars)
    assert result.bars_processed == len(bars)
    assert result.final_equity > 0
    assert len(result.equity_curve) == len(bars)
    assert len(result.trades) >= 1
