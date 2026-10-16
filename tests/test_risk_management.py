from datetime import UTC, datetime, timedelta

import pytest

from quantlab.backtest.engine import Backtest
from quantlab.backtest.models import TradeSide
from quantlab.data.models import Bar
from quantlab.strategy.models import Signal


class DummyStrategy:
    """Strategy that outputs a fixed sequence of signals."""

    def __init__(self, signals: list[Signal]) -> None:
        self.signals = signals
        self.index = 0

    def generate_signal(self, prices: list[float]) -> Signal:
        if self.index < len(self.signals):
            sig = self.signals[self.index]
            self.index += 1
            return sig
        return Signal.FLAT


def make_bar(
    day: int,
    open_price: float,
    high_price: float,
    low_price: float,
    close_price: float,
) -> Bar:
    return Bar(
        timestamp=datetime(2024, 1, 1, tzinfo=UTC) + timedelta(days=day),
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
        volume=1000.0,
    )


def test_invalid_risk_parameters():
    with pytest.raises(ValueError, match="stop_loss_pct must be strictly positive"):
        Backtest(initial_cash=10000.0, stop_loss_pct=0.0)

    with pytest.raises(ValueError, match="take_profit_pct must be strictly positive"):
        Backtest(initial_cash=10000.0, take_profit_pct=-0.05)

    with pytest.raises(ValueError, match="trailing_stop_pct must be strictly positive"):
        Backtest(initial_cash=10000.0, trailing_stop_pct=0.0)


def test_fixed_stop_loss_triggers():
    # Buy signal on bar 0 -> buys at bar 1 open (100.0)
    # Stop-loss = 5% (barrier = 95.0)
    # Bar 2 low drops to 94.0 -> triggers SL exit!
    strategy = DummyStrategy([Signal.LONG, Signal.LONG, Signal.LONG, Signal.LONG])
    backtest = Backtest(
        initial_cash=1000.0,
        strategy=strategy,
        stop_loss_pct=0.05,
        commission_rate=0.0,
        slippage_rate=0.0,
    )

    bars = [
        make_bar(0, 100.0, 102.0, 99.0, 100.0),
        make_bar(1, 100.0, 102.0, 99.0, 100.0),  # Buy executed at 100.0
        make_bar(2, 98.0, 99.0, 94.0, 96.0),    # Low 94.0 <= 95.0 -> SL hit!
        make_bar(3, 96.0, 97.0, 95.0, 96.0),
    ]

    result = backtest.run(bars)

    assert len(result.trades) == 2
    buy_trade, sell_trade = result.trades

    assert buy_trade.side == TradeSide.BUY
    assert buy_trade.price == 100.0

    assert sell_trade.side == TradeSide.SELL
    assert sell_trade.price == 95.0  # Barrier exit
    assert sell_trade.exit_reason == "stop_loss"
    assert result.final_cash == pytest.approx(1000.0 - 100.0 + 95.0)


def test_take_profit_triggers():
    # Buy signal on bar 0 -> buys at bar 1 open (100.0)
    # Take-profit = 10% (barrier = 110.0)
    # Bar 2 high rises to 112.0 -> triggers TP exit!
    strategy = DummyStrategy([Signal.LONG, Signal.LONG, Signal.LONG, Signal.LONG])
    backtest = Backtest(
        initial_cash=1000.0,
        strategy=strategy,
        take_profit_pct=0.10,
        commission_rate=0.0,
        slippage_rate=0.0,
    )

    bars = [
        make_bar(0, 100.0, 102.0, 99.0, 100.0),
        make_bar(1, 100.0, 102.0, 99.0, 100.0),  # Buy at 100.0
        make_bar(2, 105.0, 112.0, 104.0, 111.0), # High 112.0 >= 110.0 -> TP hit!
        make_bar(3, 111.0, 113.0, 110.0, 112.0),
    ]

    result = backtest.run(bars)

    assert len(result.trades) == 2
    buy_trade, sell_trade = result.trades

    assert buy_trade.side == TradeSide.BUY
    assert buy_trade.price == 100.0

    assert sell_trade.side == TradeSide.SELL
    assert sell_trade.price == pytest.approx(110.0)  # Barrier exit
    assert sell_trade.exit_reason == "take_profit"
    assert result.final_cash == pytest.approx(1000.0 - 100.0 + 110.0)


def test_stop_loss_gap_down_execution():
    # Buy at 100.0 on bar 1. SL = 5% (barrier 95.0).
    # Bar 2 opens at 90.0 (gap down below 95.0).
    # Execution should be at 90.0, not 95.0!
    strategy = DummyStrategy([Signal.LONG, Signal.LONG, Signal.LONG])
    backtest = Backtest(
        initial_cash=1000.0,
        strategy=strategy,
        stop_loss_pct=0.05,
        commission_rate=0.0,
        slippage_rate=0.0,
    )

    bars = [
        make_bar(0, 100.0, 102.0, 99.0, 100.0),
        make_bar(1, 100.0, 102.0, 99.0, 100.0),
        make_bar(2, 90.0, 92.0, 88.0, 89.0),  # Gapped down to 90.0
    ]

    result = backtest.run(bars)

    assert len(result.trades) == 2
    sell_trade = result.trades[1]
    assert sell_trade.price == 90.0  # Executed at open because gap down
    assert sell_trade.exit_reason == "stop_loss"


def test_trailing_stop_loss():
    # Buy at 100.0 on bar 1. Trailing stop = 10%.
    # Bar 2 rises to high 150.0. Peak = 150.0, trailing barrier = 150 * 0.9 = 135.0.
    # Bar 3 low drops to 130.0 <= 135.0 -> Trailing stop hit at 135.0!
    strategy = DummyStrategy([Signal.LONG, Signal.LONG, Signal.LONG, Signal.LONG])
    backtest = Backtest(
        initial_cash=1000.0,
        strategy=strategy,
        trailing_stop_pct=0.10,
        commission_rate=0.0,
        slippage_rate=0.0,
    )

    bars = [
        make_bar(0, 100.0, 102.0, 99.0, 100.0),
        make_bar(1, 100.0, 105.0, 98.0, 104.0),   # Buy at 100.0
        make_bar(2, 105.0, 150.0, 104.0, 148.0),  # High 150.0 -> barrier becomes 135.0
        make_bar(3, 140.0, 142.0, 130.0, 132.0),  # Low 130.0 <= 135.0 -> Trailing stop hit!
    ]

    result = backtest.run(bars)

    assert len(result.trades) == 2
    sell_trade = result.trades[1]
    assert sell_trade.price == 135.0
    assert sell_trade.exit_reason == "stop_loss"
