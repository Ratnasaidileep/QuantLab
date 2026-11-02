"""Rigorous quantitative finance correctness verification with hand-calculated reference cases.

Validates:
1. Signal timing & Zero Look-ahead Bias (Bar t Close signal -> Bar t+1 Open fill).
2. Friction modeling (Exact slippage addition on buy / subtraction on sell, and symmetric commission).
3. Position accounting & Cash conservation invariants.
4. Intraday Stop-loss and Take-profit exact price execution.
5. Exact Sharpe ratio and Maximum Drawdown mathematical formulas.
"""

from datetime import UTC, datetime, timedelta

import numpy as np
import pytest

from quantlab.analytics.metrics import calculate_metrics
from quantlab.analytics.tear_sheet import calculate_underwater_series
from quantlab.backtest.engine import Backtest
from quantlab.data.models import Bar
from quantlab.strategy.models import Signal


class DeterministicSignalStrategy:
    """Mock strategy that emits pre-defined signals for each bar index."""

    def __init__(self, signals: list[Signal]):
        self.signals = signals

    def generate_signal(self, prices: list[float]) -> Signal:
        idx = len(prices) - 1
        if 0 <= idx < len(self.signals):
            return self.signals[idx]
        return Signal.FLAT


def make_test_bar(idx: int, open_: float, high: float, low: float, close: float, vol: float = 1000.0) -> Bar:
    base_time = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
    return Bar(
        timestamp=base_time + timedelta(days=idx),
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=vol,
    )


def test_zero_lookahead_and_exact_friction_accounting():
    """Verify hand-calculated trade execution, slippage, commission, and cash conservation."""
    # Bar 0: Close triggers LONG signal
    # Bar 1: Executed at Open with slippage (+0.1%), Close triggers FLAT exit
    # Bar 2: Executed at Open with slippage (-0.1%)
    # Bar 3: No position held
    bars = [
        make_test_bar(0, 100.0, 105.0, 95.0, 102.0),
        make_test_bar(1, 110.0, 115.0, 108.0, 112.0),
        make_test_bar(2, 120.0, 125.0, 118.0, 122.0),
        make_test_bar(3, 120.0, 122.0, 119.0, 121.0),
    ]

    strategy = DeterministicSignalStrategy([Signal.LONG, Signal.FLAT, Signal.FLAT, Signal.FLAT])

    initial_cash = 10000.0
    comm_rate = 0.002  # 0.2%
    slip_rate = 0.001  # 0.1%

    bt = Backtest(
        initial_cash=initial_cash,
        strategy=strategy,
        commission_rate=comm_rate,
        slippage_rate=slip_rate,
        use_crossover=False,
        sizing_mode="unit",
        quantity_per_trade=1.0,
    )
    res = bt.run(bars)

    # 1. Entry at Bar 1 Open (110.0)
    expected_buy_fill = 110.0 * (1.0 + slip_rate)  # 110.11
    expected_buy_comm = 1.0 * expected_buy_fill * comm_rate  # 0.22022
    expected_buy_total_cost = 1.0 * expected_buy_fill + expected_buy_comm  # 110.33022

    # 2. Exit at Bar 2 Open (120.0)
    expected_sell_fill = 120.0 * (1.0 - slip_rate)  # 119.88
    expected_sell_proceeds = 1.0 * expected_sell_fill  # 119.88
    expected_sell_comm = expected_sell_proceeds * comm_rate  # 0.23976
    expected_net_proceeds = expected_sell_proceeds - expected_sell_comm  # 119.64024

    # 3. Net PnL and final cash
    expected_pnl = expected_net_proceeds - expected_buy_total_cost  # 9.31002
    expected_final_cash = initial_cash + expected_pnl

    assert len(res.trades) == 2
    buy_trade, sell_trade = res.trades[0], res.trades[1]

    assert buy_trade.price == pytest.approx(expected_buy_fill, rel=1e-5)
    assert buy_trade.commission == pytest.approx(expected_buy_comm, rel=1e-5)
    assert sell_trade.price == pytest.approx(expected_sell_fill, rel=1e-5)
    assert sell_trade.commission == pytest.approx(expected_sell_comm, rel=1e-5)

    assert res.final_cash == pytest.approx(expected_final_cash, rel=1e-5)
    assert res.final_equity == pytest.approx(expected_final_cash, rel=1e-5)
    assert res.total_pnl == pytest.approx(expected_pnl, rel=1e-5)


def test_intraday_stop_loss_exact_price_execution():
    """Verify stop loss triggers at exact threshold price during adverse intra-bar drawdown."""
    bars = [
        make_test_bar(0, 100.0, 105.0, 95.0, 100.0),
        make_test_bar(1, 100.0, 102.0, 98.0, 100.0),  # Buy at open 100.0
        make_test_bar(2, 99.0, 101.0, 92.0, 96.0),    # Low dips to 92.0 (below 5% stop at 95.0)
        make_test_bar(3, 96.0, 98.0, 95.0, 97.0),
    ]

    strategy = DeterministicSignalStrategy([Signal.LONG, Signal.LONG, Signal.LONG, Signal.LONG])

    bt = Backtest(
        initial_cash=10000.0,
        strategy=strategy,
        commission_rate=0.0,
        slippage_rate=0.0,
        stop_loss_pct=0.05,  # 5% stop loss from 100.0 -> trigger at 95.0
        use_crossover=False,
    )
    res = bt.run(bars)

    assert len(res.trades) == 2
    sell_trade = res.trades[1]
    assert sell_trade.price == pytest.approx(95.0, rel=1e-5)
    assert sell_trade.exit_reason == "stop_loss"


def test_hand_calculated_max_drawdown_formula():
    """Verify maximum drawdown against exact hand-calculated series."""
    equity = [100.0, 120.0, 90.0, 110.0, 80.0, 100.0]
    dd_series = calculate_underwater_series(equity)

    # Peak: 100 -> 120 -> 120 -> 120 -> 120 -> 120
    # DDs:    0     0   -0.25 -0.0833 -0.3333 -0.1667
    expected_dd = [0.0, 0.0, -0.25, -10.0 / 120.0, -40.0 / 120.0, -20.0 / 120.0]

    for actual, expected in zip(dd_series, expected_dd):
        assert actual == pytest.approx(expected, abs=1e-4)

    max_dd = abs(min(dd_series))
    assert max_dd == pytest.approx(40.0 / 120.0, abs=1e-4)


def test_sharpe_ratio_formula_precision():
    """Verify Sharpe Ratio matches exact analytical formula."""
    equity_curve = [100000.0, 101000.0, 102500.0, 102000.0, 103500.0, 104000.0]
    daily_returns = np.diff(equity_curve) / equity_curve[:-1]

    rf_annual = 0.05
    rf_daily = rf_annual / 252.0
    excess_returns = daily_returns - rf_daily
    expected_sharpe = float(np.mean(excess_returns) / np.std(excess_returns, ddof=1) * np.sqrt(252.0))

    metrics = calculate_metrics(initial_cash=100000.0, equity_curve=equity_curve, trades=[], risk_free_rate=rf_annual)
    assert metrics.sharpe_ratio == pytest.approx(expected_sharpe, rel=1e-4)
