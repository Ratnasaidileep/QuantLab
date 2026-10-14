import matplotlib

matplotlib.use("Agg")

from datetime import UTC, datetime, timedelta

import pytest

from quantlab.analytics.metrics import (
    calculate_cagr,
    calculate_daily_returns,
    calculate_metrics,
    calculate_sharpe_ratio,
    calculate_sortino_ratio,
    calculate_trade_pnl,
)
from quantlab.analytics.plotting import plot_backtest_results
from quantlab.analytics.strategy_comparison import (
    compare_bollinger_bands_strategies,
    compare_buy_and_hold,
    compare_moving_average_strategies,
    compare_strategies,
)
from quantlab.backtest.models import Trade, TradeSide
from quantlab.data.models import Bar


def make_bar(close: float, day: int) -> Bar:
    """Create a simple valid market-data bar for testing."""
    return Bar(
        timestamp=datetime(2025, 1, 1, tzinfo=UTC) + timedelta(days=day),
        open=close,
        high=close,
        low=close,
        close=close,
        volume=1000.0,
    )


def test_calculate_metrics_for_profitable_equity_curve():
    metrics = calculate_metrics(
        initial_cash=10_000.0,
        equity_curve=[10_000.0, 10_500.0, 11_000.0],
    )

    assert metrics.total_pnl == 1_000.0
    assert metrics.total_return == 0.10
    assert metrics.max_drawdown == 0.0


def test_calculate_maximum_drawdown():
    metrics = calculate_metrics(
        initial_cash=10_000.0,
        equity_curve=[10_000.0, 12_000.0, 9_000.0, 11_000.0],
    )

    assert metrics.max_drawdown == 0.25


def test_compare_moving_average_strategies_returns_one_result_per_configuration():
    bars = [
        make_bar(10.0, 0),
        make_bar(10.0, 1),
        make_bar(11.0, 2),
        make_bar(12.0, 3),
        make_bar(13.0, 4),
        make_bar(12.0, 5),
        make_bar(11.0, 6),
        make_bar(10.0, 7),
    ]

    parameter_pairs = [
        (2, 3),
        (2, 4),
    ]

    results = compare_moving_average_strategies(
        bars=bars,
        initial_cash=100.0,
        parameter_pairs=parameter_pairs,
    )

    assert len(results) == 2

    assert results[0].fast_period == 2
    assert results[0].slow_period == 3

    assert results[1].fast_period == 2
    assert results[1].slow_period == 4


def test_compare_moving_average_strategies_uses_trading_costs():
    bars = [
        make_bar(10.0, 0),
        make_bar(10.0, 1),
        make_bar(10.0, 2),
        make_bar(9.0, 3),
        make_bar(8.0, 4),
        make_bar(12.0, 5),
        make_bar(20.0, 6),
        make_bar(15.0, 7),
        make_bar(10.0, 8),
        make_bar(10.0, 9),
    ]

    results = compare_moving_average_strategies(
        bars=bars,
        initial_cash=100.0,
        parameter_pairs=[(2, 4)],
        commission_rate=0.001,
        slippage_rate=0.001,
    )

    assert len(results) == 1

    result = results[0]

    assert result.fast_period == 2
    assert result.slow_period == 4
    assert result.trades == 2
    assert result.final_equity < 100.0
    assert result.total_pnl < 0.0

def test_plot_backtest_results_returns_figure():
    bars = [
        make_bar(10.0, 0),
        make_bar(11.0, 1),
        make_bar(12.0, 2),
    ]

    equity_curve = [
        100.0,
        101.0,
        102.0,
    ]

    trades = [
        Trade(
            timestamp=bars[1].timestamp,
            side=TradeSide.BUY,
            price=11.0,
            quantity=1.0,
            commission=0.0,
        ),
    ]

    figure = plot_backtest_results(
        bars=bars,
        equity_curve=equity_curve,
        trades=trades,
    )

    assert figure is not None
    assert len(figure.axes) == 2

def test_plot_backtest_results_rejects_mismatched_lengths():
    bars = [
        make_bar(10.0, 0),
        make_bar(11.0, 1),
    ]

    equity_curve = [100.0]

    try:
        plot_backtest_results(
            bars=bars,
            equity_curve=equity_curve,
            trades=[],
        )
    except ValueError as error:
        assert str(error) == (
            "Bars and equity curve must contain the same number of points."
        )
    else:
        raise AssertionError("Expected ValueError")

def test_plot_backtest_results_formats_equity_axis_as_currency():
    bars = [
        make_bar(10.0, 0),
        make_bar(11.0, 1),
        make_bar(12.0, 2),
    ]

    equity_curve = [
        100_000.0,
        100_010.0,
        99_990.0,
    ]

    figure = plot_backtest_results(
        bars=bars,
        equity_curve=equity_curve,
        trades=[],
    )

    formatter = figure.axes[1].yaxis.get_major_formatter()

    assert formatter(100_000.0, 0) == "₹100,000"


def test_compare_buy_and_hold_mark_to_market_by_default():
    bars = [
        make_bar(100.0, 0),
        make_bar(110.0, 1),
        make_bar(120.0, 2),
    ]

    result = compare_buy_and_hold(
        bars=bars,
        initial_cash=1_000.0,
    )

    assert result.strategy_name == "Buy and Hold"
    assert result.configuration == "Buy first open / Hold to final close"
    assert result.trades == 1
    assert result.final_equity == 1_020.0
    assert result.total_pnl == 20.0
    assert result.total_return == pytest.approx(0.02)
    assert result.max_drawdown == 0.0


def test_compare_buy_and_hold_with_trading_costs():
    bars = [
        make_bar(100.0, 0),
        make_bar(100.0, 1),
        make_bar(100.0, 2),
    ]

    result_hold = compare_buy_and_hold(
        bars=bars,
        initial_cash=1_000.0,
        commission_rate=0.01,
        slippage_rate=0.01,
        liquidate_on_end=False,
    )

    assert result_hold.trades == 1
    assert result_hold.final_equity == pytest.approx(997.99)
    assert result_hold.total_pnl == pytest.approx(-2.01)
    assert result_hold.configuration == "Buy first open / Hold to final close"

    result_liquidate = compare_buy_and_hold(
        bars=bars,
        initial_cash=1_000.0,
        commission_rate=0.01,
        slippage_rate=0.01,
        liquidate_on_end=True,
    )

    assert result_liquidate.trades == 2
    assert result_liquidate.final_equity == pytest.approx(996.00)
    assert result_liquidate.total_pnl == pytest.approx(-4.00)
    assert result_liquidate.configuration == "Buy first open / Liquidate final close"


def test_compare_buy_and_hold_input_validation():
    valid_bars = [
        make_bar(100.0, 0),
        make_bar(110.0, 1),
    ]

    with pytest.raises(ValueError, match="Initial cash cannot be negative"):
        compare_buy_and_hold(bars=valid_bars, initial_cash=-100.0)

    with pytest.raises(ValueError, match="Commission rate cannot be negative"):
        compare_buy_and_hold(bars=valid_bars, initial_cash=1000.0, commission_rate=-0.01)

    with pytest.raises(ValueError, match="Slippage rate cannot be negative"):
        compare_buy_and_hold(bars=valid_bars, initial_cash=1000.0, slippage_rate=-0.01)

    with pytest.raises(ValueError, match="Bars cannot be empty"):
        compare_buy_and_hold(bars=[], initial_cash=1000.0)

    with pytest.raises(ValueError, match="Initial cash is insufficient"):
        compare_buy_and_hold(bars=valid_bars, initial_cash=50.0)

    out_of_order_bars = [
        make_bar(100.0, 1),
        make_bar(110.0, 0),
    ]
    with pytest.raises(ValueError, match="timestamps"):
        compare_buy_and_hold(bars=out_of_order_bars, initial_cash=1000.0)


def test_compare_strategies_unifies_ma_and_rsi():
    bars = [
        make_bar(10.0, 0),
        make_bar(10.0, 1),
        make_bar(10.0, 2),
        make_bar(9.0, 3),
        make_bar(8.0, 4),
        make_bar(12.0, 5),
        make_bar(20.0, 6),
        make_bar(15.0, 7),
        make_bar(10.0, 8),
        make_bar(10.0, 9),
    ]

    results = compare_strategies(
        bars=bars,
        initial_cash=100.0,
        ma_parameter_pairs=[(2, 4)],
        rsi_configurations=[(3, 30.0, 70.0)],
    )

    assert len(results) == 2
    ma_result, rsi_result = results

    assert ma_result.strategy_name == "Moving Average Crossover"
    assert ma_result.configuration == "Fast 2 / Slow 4"
    assert ma_result.trades == 2
    assert ma_result.fast_period == 2
    assert ma_result.slow_period == 4

    assert rsi_result.strategy_name == "RSI"
    assert "Period 3" in rsi_result.configuration
    assert rsi_result.fast_period == 0
    assert rsi_result.slow_period == 0


def test_compare_strategies_applies_trading_costs():
    bars = [
        make_bar(10.0, 0),
        make_bar(10.0, 1),
        make_bar(10.0, 2),
        make_bar(9.0, 3),
        make_bar(8.0, 4),
        make_bar(12.0, 5),
        make_bar(20.0, 6),
        make_bar(15.0, 7),
        make_bar(10.0, 8),
        make_bar(10.0, 9),
    ]

    costless_results = compare_strategies(
        bars=bars,
        initial_cash=100.0,
        commission_rate=0.0,
        slippage_rate=0.0,
        ma_parameter_pairs=[(2, 4)],
        rsi_configurations=[(3, 30.0, 70.0)],
    )

    cost_results = compare_strategies(
        bars=bars,
        initial_cash=100.0,
        commission_rate=0.005,
        slippage_rate=0.005,
        ma_parameter_pairs=[(2, 4)],
        rsi_configurations=[(3, 30.0, 70.0)],
    )

    for costless, with_cost in zip(costless_results, cost_results):
        if costless.trades > 0:
            assert with_cost.final_equity < costless.final_equity


def test_strategy_comparison_result_parameters_metadata():
    bars = [
        make_bar(10.0, 0),
        make_bar(10.0, 1),
        make_bar(10.0, 2),
        make_bar(9.0, 3),
        make_bar(8.0, 4),
        make_bar(12.0, 5),
        make_bar(20.0, 6),
        make_bar(15.0, 7),
        make_bar(10.0, 8),
        make_bar(10.0, 9),
    ]

    results = compare_strategies(
        bars=bars,
        initial_cash=100.0,
        ma_parameter_pairs=[(2, 4)],
        rsi_configurations=[(3, 30.0, 70.0)],
    )
    bnh = compare_buy_and_hold(bars=bars, initial_cash=100.0)

    assert results[0].parameters == {"fast_period": 2, "slow_period": 4}
    assert results[1].parameters == {"period": 3, "oversold": 30.0, "overbought": 70.0}
    assert bnh.parameters == {"liquidate_on_end": False}


def test_plot_backtest_results_custom_symbol_label():
    bars = [
        make_bar(10.0, 0),
        make_bar(11.0, 1),
    ]
    figure = plot_backtest_results(
        bars=bars,
        equity_curve=[100.0, 101.0],
        trades=[],
        symbol="TCS",
    )
    legend_labels = [
        text.get_text() for text in figure.axes[0].get_legend().get_texts()
    ]
    assert "TCS Close" in legend_labels


def test_calculate_trade_pnl_fifo_matching():
    trades = [
        Trade(
            timestamp=datetime(2025, 1, 1, tzinfo=UTC),
            side=TradeSide.BUY,
            price=100.0,
            quantity=1.0,
            commission=0.1,
        ),
        Trade(
            timestamp=datetime(2025, 1, 2, tzinfo=UTC),
            side=TradeSide.SELL,
            price=110.0,
            quantity=1.0,
            commission=0.11,
        ),
        Trade(
            timestamp=datetime(2025, 1, 3, tzinfo=UTC),
            side=TradeSide.BUY,
            price=120.0,
            quantity=1.0,
            commission=0.12,
        ),
        Trade(
            timestamp=datetime(2025, 1, 4, tzinfo=UTC),
            side=TradeSide.SELL,
            price=115.0,
            quantity=1.0,
            commission=0.115,
        ),
    ]

    closed_pnls = calculate_trade_pnl(trades)

    assert len(closed_pnls) == 2
    assert closed_pnls[0] == pytest.approx(109.89 - 100.1)  # 9.79
    assert closed_pnls[1] == pytest.approx(114.885 - 120.12)  # -5.235


def test_calculate_metrics_with_trades_win_rate_and_profit_factor():
    trades = [
        Trade(
            timestamp=datetime(2025, 1, 1, tzinfo=UTC),
            side=TradeSide.BUY,
            price=100.0,
            quantity=1.0,
            commission=0.1,
        ),
        Trade(
            timestamp=datetime(2025, 1, 2, tzinfo=UTC),
            side=TradeSide.SELL,
            price=110.0,
            quantity=1.0,
            commission=0.11,
        ),
        Trade(
            timestamp=datetime(2025, 1, 3, tzinfo=UTC),
            side=TradeSide.BUY,
            price=120.0,
            quantity=1.0,
            commission=0.12,
        ),
        Trade(
            timestamp=datetime(2025, 1, 4, tzinfo=UTC),
            side=TradeSide.SELL,
            price=115.0,
            quantity=1.0,
            commission=0.115,
        ),
    ]

    metrics = calculate_metrics(
        initial_cash=1000.0,
        equity_curve=[1000.0, 1009.79, 1004.555],
        trades=trades,
    )

    assert metrics.total_trades == 4
    assert metrics.win_rate == pytest.approx(0.5)
    assert metrics.profit_factor == pytest.approx(9.79 / 5.235)


def test_calculate_metrics_all_winning_trades():
    trades = [
        Trade(
            timestamp=datetime(2025, 1, 1, tzinfo=UTC),
            side=TradeSide.BUY,
            price=100.0,
            quantity=1.0,
            commission=0.0,
        ),
        Trade(
            timestamp=datetime(2025, 1, 2, tzinfo=UTC),
            side=TradeSide.SELL,
            price=110.0,
            quantity=1.0,
            commission=0.0,
        ),
    ]

    metrics = calculate_metrics(
        initial_cash=1000.0,
        equity_curve=[1000.0, 1010.0],
        trades=trades,
    )

    assert metrics.total_trades == 2
    assert metrics.win_rate == 1.0
    assert metrics.profit_factor == float("inf")


def test_calculate_metrics_all_losing_trades():
    trades = [
        Trade(
            timestamp=datetime(2025, 1, 1, tzinfo=UTC),
            side=TradeSide.BUY,
            price=100.0,
            quantity=1.0,
            commission=0.0,
        ),
        Trade(
            timestamp=datetime(2025, 1, 2, tzinfo=UTC),
            side=TradeSide.SELL,
            price=90.0,
            quantity=1.0,
            commission=0.0,
        ),
    ]

    metrics = calculate_metrics(
        initial_cash=1000.0,
        equity_curve=[1000.0, 990.0],
        trades=trades,
    )

    assert metrics.total_trades == 2
    assert metrics.win_rate == 0.0
    assert metrics.profit_factor == 0.0


def test_calculate_metrics_without_trades_defaults_to_none():
    metrics = calculate_metrics(
        initial_cash=1000.0,
        equity_curve=[1000.0, 1050.0],
    )

    assert metrics.total_trades == 0
    assert metrics.win_rate is None
    assert metrics.profit_factor is None


def test_calculate_daily_returns_empty_and_single_point():
    assert calculate_daily_returns([]) == []
    assert calculate_daily_returns([1000.0]) == []


def test_calculate_daily_returns_valid_curve():
    returns = calculate_daily_returns([100.0, 105.0, 102.9])
    assert len(returns) == 2
    assert returns[0] == pytest.approx(0.05)
    assert returns[1] == pytest.approx(-0.02)


def test_calculate_daily_returns_zero_or_negative_previous():
    returns = calculate_daily_returns([0.0, 100.0, -10.0, 50.0])
    assert returns[0] == 0.0
    assert returns[1] == pytest.approx(-1.1)
    assert returns[2] == 0.0


def test_calculate_sharpe_ratio_insufficient_data():
    assert calculate_sharpe_ratio([]) is None
    assert calculate_sharpe_ratio([0.01]) is None


def test_calculate_sharpe_ratio_zero_volatility():
    # Mean excess == 0
    rf = 0.05
    rf_daily = rf / 252
    assert calculate_sharpe_ratio([rf_daily, rf_daily], risk_free_rate=rf) == 0.0

    # Mean excess > 0 with 0 std
    assert calculate_sharpe_ratio([0.01, 0.01], risk_free_rate=0.0) == float("inf")

    # Mean excess < 0 with 0 std
    assert calculate_sharpe_ratio([-0.01, -0.01], risk_free_rate=0.0) == float("-inf")


def test_calculate_sharpe_ratio_normal():
    # Returns with known mean and std
    returns = [0.01, -0.005, 0.015, -0.002, 0.008]
    sharpe = calculate_sharpe_ratio(returns, risk_free_rate=0.0, periods_per_year=252)
    assert sharpe is not None
    assert sharpe > 0.0


def test_calculate_sortino_ratio_insufficient_data():
    assert calculate_sortino_ratio([]) is None
    assert calculate_sortino_ratio([0.01]) is None


def test_calculate_sortino_ratio_no_downside():
    # All excess returns positive
    returns = [0.01, 0.02, 0.015]
    sortino = calculate_sortino_ratio(returns, risk_free_rate=0.0, periods_per_year=252)
    assert sortino == float("inf")


def test_calculate_sortino_ratio_normal():
    returns = [0.01, -0.005, 0.015, -0.002, 0.008]
    sortino = calculate_sortino_ratio(returns, risk_free_rate=0.0, periods_per_year=252)
    assert sortino is not None
    assert sortino > 0.0


def test_calculate_cagr_invalid_or_insufficient_data():
    assert calculate_cagr(initial_cash=100.0, final_equity=110.0, periods=1) is None
    assert calculate_cagr(initial_cash=-100.0, final_equity=110.0, periods=252) is None
    assert calculate_cagr(initial_cash=100.0, final_equity=0.0, periods=252) is None


def test_calculate_cagr_multi_year():
    # 1 year (252 periods): 100 -> 110 is 10%
    cagr_1yr = calculate_cagr(
        initial_cash=100.0, final_equity=110.0, periods=252, periods_per_year=252
    )
    assert cagr_1yr == pytest.approx(0.10)

    # 2 years (504 periods): 100 -> 121 is 10%
    cagr_2yr = calculate_cagr(
        initial_cash=100.0, final_equity=121.0, periods=504, periods_per_year=252
    )
    assert cagr_2yr == pytest.approx(0.10)


def test_calculate_metrics_populates_advanced_risk_metrics():
    # 252 periods of steady 0.1% daily gain
    equity = [1000.0 * (1.001**i) for i in range(253)]
    metrics = calculate_metrics(
        initial_cash=1000.0,
        equity_curve=equity,
        risk_free_rate=0.05,
    )
    assert metrics.sharpe_ratio is not None
    assert metrics.sharpe_ratio > 0.0
    assert metrics.sortino_ratio is not None
    assert metrics.cagr is not None
    assert metrics.cagr == pytest.approx((equity[-1] / 1000.0) ** (252 / 253) - 1.0)


def test_compare_strategies_populates_advanced_risk_metrics():
    bars = [
        make_bar(10.0, 0),
        make_bar(10.0, 1),
        make_bar(11.0, 2),
        make_bar(12.0, 3),
        make_bar(13.0, 4),
        make_bar(12.0, 5),
    ]

    results = compare_strategies(
        bars=bars,
        initial_cash=100.0,
        ma_parameter_pairs=[(2, 3)],
        rsi_configurations=[(3, 30.0, 70.0)],
    )
    bnh = compare_buy_and_hold(bars=bars, initial_cash=100.0)

    for res in [*results, bnh]:
        # Equity curve has 6 points, so returns has 5 points; Sharpe & Sortino should be floats
        assert res.sharpe_ratio is not None
        assert res.sortino_ratio is not None
        assert res.cagr is not None


def test_compare_strategies_supports_sizing_mode():
    bars = [
        make_bar(10.0, 0),
        make_bar(10.0, 1),
        make_bar(10.0, 2),
        make_bar(9.0, 3),
        make_bar(8.0, 4),
        make_bar(12.0, 5),
        make_bar(20.0, 6),
        make_bar(15.0, 7),
        make_bar(10.0, 8),
        make_bar(10.0, 9),
    ]

    results_unit = compare_strategies(
        bars=bars,
        initial_cash=100.0,
        ma_parameter_pairs=[(2, 4)],
        rsi_configurations=[],
        sizing_mode="unit",
    )
    results_all_in = compare_strategies(
        bars=bars,
        initial_cash=100.0,
        ma_parameter_pairs=[(2, 4)],
        rsi_configurations=[],
        sizing_mode="all_in",
    )

    # Unit sizing buys 1 share at 12.0 -> equity swing is smaller
    # All-in sizing buys int(100 // 12) = 8 shares -> equity swing is much larger
    unit_pnl = results_unit[0].total_pnl
    all_in_pnl = results_all_in[0].total_pnl
    assert abs(all_in_pnl) > abs(unit_pnl)
    assert results_all_in[0].parameters["sizing_mode"] == "all_in"


def test_compare_buy_and_hold_all_in_sizing():
    bars = [
        make_bar(10.0, 0),
        make_bar(15.0, 1),
    ]

    # Cash 105.0, open=10.0 -> max whole shares = 10 (cost 100.0, cash left 5.0)
    # End close=15.0 -> final equity = 5.0 + 10 * 15.0 = 155.0
    result = compare_buy_and_hold(
        bars=bars,
        initial_cash=105.0,
        sizing_mode="all_in",
    )

    assert result.final_equity == 155.0
    assert result.total_pnl == 50.0
    assert result.parameters["sizing_mode"] == "all_in"


def test_compare_buy_and_hold_invalid_sizing():
    bars = [make_bar(10.0, 0), make_bar(15.0, 1)]

    with pytest.raises(ValueError, match="Unsupported sizing mode"):
        compare_buy_and_hold(bars=bars, initial_cash=100.0, sizing_mode="bad_mode")

    with pytest.raises(ValueError, match="quantity_per_trade must be positive"):
        compare_buy_and_hold(bars=bars, initial_cash=100.0, quantity_per_trade=-1.0)


def test_compare_bollinger_bands_strategies_and_combined():
    bars = [
        make_bar(100.0, 0),
        make_bar(100.0, 1),
        make_bar(100.0, 2),
        make_bar(90.0, 3),   # dip below lower band
        make_bar(100.0, 4),  # rebound to mean
        make_bar(105.0, 5),
    ]

    bb_results = compare_bollinger_bands_strategies(
        bars=bars,
        initial_cash=10_000.0,
        parameter_pairs=[(3, 1.5), (3, 2.0)],
    )

    assert len(bb_results) == 2
    assert bb_results[0].strategy_name == "Bollinger Bands"
    assert "Period 3 / StdDev 1.5" in bb_results[0].configuration

    combined = compare_strategies(
        bars=bars,
        initial_cash=10_000.0,
        ma_parameter_pairs=[(2, 3)],
        rsi_configurations=[(3, 30.0, 70.0)],
        bb_configurations=[(3, 1.5)],
    )

    assert len(combined) == 3
    names = [r.strategy_name for r in combined]
    assert names == ["Moving Average Crossover", "RSI", "Bollinger Bands"]

