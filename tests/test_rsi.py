
from datetime import UTC, datetime, timedelta

import pytest

from quantlab.backtest.engine import Backtest
from quantlab.backtest.models import TradeSide
from quantlab.data.models import Bar
from quantlab.strategy.models import Signal
from quantlab.strategy.rsi import RSIStrategy


def test_rsi_returns_none_when_history_is_insufficient():
    strategy = RSIStrategy(period=3)

    assert strategy.calculate_rsi_series([10, 11, 12]) == [
        None,
        None,
        None,
    ]


def test_rsi_is_100_when_prices_only_rise():
    strategy = RSIStrategy(period=3)

    values = strategy.calculate_rsi_series(
        [10, 11, 12, 13, 14]
    )

    assert values[3] == pytest.approx(100.0)
    assert values[4] == pytest.approx(100.0)


def test_rsi_is_zero_when_prices_only_fall():
    strategy = RSIStrategy(period=3)

    values = strategy.calculate_rsi_series(
        [14, 13, 12, 11, 10]
    )

    assert values[3] == pytest.approx(0.0)
    assert values[4] == pytest.approx(0.0)


def test_rsi_strategy_targets_long_when_oversold():
    strategy = RSIStrategy(period=3)

    signal = strategy.generate_signal([14, 13, 12, 11])

    assert signal == Signal.LONG


def test_rsi_strategy_targets_flat_when_overbought():
    strategy = RSIStrategy(period=3)

    signal = strategy.generate_signal([10, 11, 12, 13])

    assert signal == Signal.FLAT


def test_rsi_rejects_invalid_configuration():
    with pytest.raises(ValueError):
        RSIStrategy(period=0)

    with pytest.raises(ValueError):
        RSIStrategy(oversold=70, overbought=30)


def test_rsi_rejects_nonpositive_prices():
    strategy = RSIStrategy(period=3)

    with pytest.raises(ValueError):
        strategy.calculate_rsi_series([10, 11, 0, 12])


def test_rsi_strategy_integrates_with_backtest_engine():
    closes = [14, 13, 12, 11, 12, 13, 14, 15, 16]
    start = datetime(2025, 1, 1, tzinfo=UTC)

    bars = [
        Bar(
            timestamp=start + timedelta(days=index),
            open=float(close),
            high=float(close + 1),
            low=float(close - 1),
            close=float(close),
            volume=1000.0,
        )
        for index, close in enumerate(closes)
    ]

    strategy = RSIStrategy(period=3)
    backtest = Backtest(
        initial_cash=1000.0,
        strategy=strategy,
    )

    result = backtest.run(bars)

    assert result.bars_processed == len(bars)
    assert len(result.equity_curve) == len(bars)
    assert len(result.trades) == 2

    buy_trade, sell_trade = result.trades

    assert buy_trade.side == TradeSide.BUY
    assert buy_trade.timestamp == bars[4].timestamp

    assert sell_trade.side == TradeSide.SELL
    assert sell_trade.timestamp == bars[7].timestamp
