from datetime import UTC, datetime, timedelta

import pytest

from quantlab.analytics.metrics import PerformanceMetrics
from quantlab.backtest.engine import Backtest
from quantlab.backtest.models import TradeSide
from quantlab.data.models import Bar
from quantlab.strategy.models import Signal
from quantlab.strategy.moving_average import MovingAverageCrossover


def make_bar(
    open_price: float,
    close: float,
    minute: int,
) -> Bar:
    return Bar(
        timestamp=datetime(2026, 1, 1, tzinfo=UTC)
        + timedelta(minutes=minute),
        open=open_price,
        high=max(open_price, close),
        low=min(open_price, close),
        close=close,
        volume=1000.0,
    )


def test_backtest_uses_next_bar_open_for_long_entry():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(20.0, 20.0, 2),
        make_bar(30.0, 25.0, 3),
    ]

    result = backtest.run(bars)

    assert result.bars_processed == 4
    assert backtest.position.signal == Signal.LONG
    assert backtest.position.quantity == 1.0
    assert result.final_cash == 70.0
    assert result.final_equity == 95.0
    assert result.total_pnl == -5.0


def test_backtest_records_equity_for_each_bar():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(20.0, 20.0, 2),
        make_bar(30.0, 25.0, 3),
    ]

    result = backtest.run(bars)

    assert len(result.equity_curve) == 4
    assert result.equity_curve[0] == 100.0
    assert result.equity_curve[1] == 100.0
    assert result.equity_curve[2] == 100.0
    assert result.equity_curve[3] == 95.0


def test_empty_backtest_has_no_equity_points():
    backtest = Backtest(initial_cash=10_000.0)

    result = backtest.run([])

    assert result.bars_processed == 0
    assert result.equity_curve == []
    assert result.metrics is None


def test_backtest_tracks_cash_and_equity_separately():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(20.0, 20.0, 2),
        make_bar(30.0, 25.0, 3),
    ]

    result = backtest.run(bars)

    assert backtest.position.signal == Signal.LONG
    assert backtest.position.quantity == 1.0
    assert result.final_cash == 70.0
    assert result.final_equity == 95.0


def test_backtest_can_run_twice_without_carrying_old_state():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(20.0, 20.0, 2),
        make_bar(30.0, 25.0, 3),
    ]

    first_result = backtest.run(bars)
    second_result = backtest.run(bars)

    assert first_result.equity_curve == second_result.equity_curve
    assert first_result.final_cash == second_result.final_cash
    assert first_result.final_equity == second_result.final_equity
    assert second_result.bars_processed == 4


def test_backtest_result_reports_cash_equity_and_pnl():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(5.0, 5.0, 0),
        make_bar(5.0, 5.0, 1),
        make_bar(10.0, 10.0, 2),
        make_bar(20.0, 20.0, 3),
    ]

    result = backtest.run(bars)

    assert result.final_cash == 80.0
    assert result.final_equity == 100.0
    assert result.total_pnl == 0.0


def test_short_signal_does_not_open_short_position_in_long_only_backtest():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(20.0, 20.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(5.0, 5.0, 2),
        make_bar(4.0, 4.0, 3),
    ]

    result = backtest.run(bars)

    assert result.final_cash >= 0.0
    assert backtest.position.signal != Signal.SHORT


def test_backtest_rejects_negative_initial_cash():
    with pytest.raises(ValueError):
        Backtest(initial_cash=-100.0)


def test_backtest_rejects_invalid_market_data():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(0.0, 0.0, 1),
        make_bar(20.0, 20.0, 2),
    ]

    with pytest.raises(ValueError, match="positive"):
        backtest.run(bars)


def test_backtest_rejects_out_of_order_timestamps():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(10.0, 10.0, 1),
        make_bar(12.0, 12.0, 0),
    ]

    with pytest.raises(ValueError, match="timestamps"):
        backtest.run(bars)

def test_backtest_result_includes_performance_metrics():
    backtest = Backtest(initial_cash=100.0)

    bars = [
        make_bar(5.0, 5.0, 0),
        make_bar(5.0, 5.0, 1),
        make_bar(10.0, 10.0, 2),
        make_bar(20.0, 20.0, 3),
    ]

    result = backtest.run(bars)

    assert isinstance(result.metrics, PerformanceMetrics)
    assert result.metrics.total_pnl == 0.0
    assert result.metrics.total_return == 0.0
    assert result.metrics.max_drawdown == 0.0
def test_backtest_applies_slippage_to_long_entry():
    backtest = Backtest(
        initial_cash=100.0,
        slippage_rate=0.10,
    )

    bars = [
        make_bar(5.0, 5.0, 0),
        make_bar(5.0, 5.0, 1),
        make_bar(10.0, 10.0, 2),
        make_bar(20.0, 20.0, 3),
    ]

    result = backtest.run(bars)

    # Signal becomes LONG after the 10.0 close.
    # Next bar opens at 20.0.
    # With 10% slippage, entry price is 22.0.
    assert result.final_cash == 78.0
    assert result.final_equity == 98.0
    assert result.total_pnl == -2.0


def test_backtest_applies_commission_to_long_entry():
    backtest = Backtest(
        initial_cash=100.0,
        commission_rate=0.001,
    )

    bars = [
        make_bar(5.0, 5.0, 0),
        make_bar(5.0, 5.0, 1),
        make_bar(10.0, 10.0, 2),
        make_bar(20.0, 20.0, 3),
    ]

    result = backtest.run(bars)

    # Buy at 20.0 and pay 0.10 commission.
    assert result.final_cash == 79.98
    assert result.final_equity == 99.98
    assert result.total_pnl == pytest.approx(-0.02)


def test_backtest_rejects_negative_trading_costs():
    with pytest.raises(ValueError):
        Backtest(
            initial_cash=100.0,
            commission_rate=-0.01,
        )

    with pytest.raises(ValueError):
        Backtest(
            initial_cash=100.0,
            slippage_rate=-0.01,
        )

def test_backtest_applies_costs_when_closing_long_position():
    backtest = Backtest(
        initial_cash=100.0,
        commission_rate=0.001,
        slippage_rate=0.10,
    )

    bars = [
        make_bar(5.0, 5.0, 0),
        make_bar(5.0, 5.0, 1),
        make_bar(10.0, 10.0, 2),
        make_bar(20.0, 20.0, 3),
        make_bar(15.0, 15.0, 4),
        make_bar(13.0, 13.0, 5),
        make_bar(13.0, 13.0, 6),
    ]

    result = backtest.run(bars)

    assert result.final_cash == pytest.approx(89.6663)
    assert result.final_equity == pytest.approx(89.6663)
    assert result.total_pnl == pytest.approx(-10.3337)

def test_backtest_uses_bullish_crossover_for_long_entry():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)
    backtest = Backtest(
        initial_cash=100.0,
        strategy=strategy,
        use_crossover=True,
    )

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(10.0, 10.0, 2),
        make_bar(9.0, 9.0, 3),
        make_bar(8.0, 8.0, 4),
        make_bar(12.0, 12.0, 5),
        make_bar(20.0, 20.0, 6),
    ]

    result = backtest.run(bars)

    assert result.final_cash == pytest.approx(80.0)
    assert backtest.position.signal == Signal.LONG
    assert backtest.position.quantity == pytest.approx(1.0)


def test_backtest_uses_bearish_crossover_to_close_long():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)
    backtest = Backtest(
        initial_cash=100.0,
        strategy=strategy,
        use_crossover=True,
    )

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(10.0, 10.0, 2),
        make_bar(9.0, 9.0, 3),
        make_bar(8.0, 8.0, 4),
        make_bar(12.0, 12.0, 5),
        make_bar(20.0, 20.0, 6),
        make_bar(15.0, 15.0, 7),
        make_bar(10.0, 10.0, 8),
    ]

    result = backtest.run(bars)

    assert result.final_cash == pytest.approx(95.0)
    assert result.final_equity == pytest.approx(95.0)
    assert backtest.position.signal == Signal.FLAT
    assert backtest.position.quantity == pytest.approx(0.0)

def test_backtest_records_executed_buy_trade():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=3)
    backtest = Backtest(
        initial_cash=100.0,
        strategy=strategy,
    )

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(20.0, 20.0, 2),
        make_bar(30.0, 30.0, 3),
    ]

    result = backtest.run(bars)

    assert len(result.trades) == 1

    trade = result.trades[0]

    assert trade.side == TradeSide.BUY
    assert trade.price == pytest.approx(30.0)
    assert trade.quantity == pytest.approx(1.0)
    assert trade.commission == pytest.approx(0.0)
    assert trade.timestamp == bars[3].timestamp


def test_backtest_records_buy_and_sell_trades():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)
    backtest = Backtest(
        initial_cash=100.0,
        strategy=strategy,
        use_crossover=True,
    )

    bars = [
        make_bar(10.0, 10.0, 0),
        make_bar(10.0, 10.0, 1),
        make_bar(10.0, 10.0, 2),
        make_bar(9.0, 9.0, 3),
        make_bar(8.0, 8.0, 4),
        make_bar(12.0, 12.0, 5),
        make_bar(20.0, 20.0, 6),
        make_bar(15.0, 15.0, 7),
        make_bar(10.0, 10.0, 8),
        make_bar(10.0, 10.0, 9),
    ]

    result = backtest.run(bars)

    assert len(result.trades) == 2

    assert result.trades[0].side == TradeSide.BUY
    assert result.trades[0].quantity == pytest.approx(1.0)

    assert result.trades[1].side == TradeSide.SELL
    assert result.trades[1].quantity == pytest.approx(1.0)





def test_backtest_accepts_custom_strategy():
    from datetime import datetime, timedelta

    from quantlab.backtest.engine import Backtest
    from quantlab.data.models import Bar
    from quantlab.strategy.models import Signal

    class AlwaysLongStrategy:
        def generate_signal(self, prices):
            return Signal.LONG

    start = datetime(2025, 1, 1, tzinfo=UTC)
    bars = [
        Bar(
            timestamp=start + timedelta(days=i),
            open=100.0 + i,
            high=102.0 + i,
            low=99.0 + i,
            close=101.0 + i,
            volume=1000.0,
        )
        for i in range(3)
    ]

    backtest = Backtest(
        initial_cash=1000.0,
        strategy=AlwaysLongStrategy(),
    )

    result = backtest.run(bars)

    assert result.bars_processed == 3
    assert len(result.equity_curve) == 3
    assert result.trades
