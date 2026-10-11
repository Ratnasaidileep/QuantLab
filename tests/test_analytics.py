import matplotlib

matplotlib.use("Agg")

from datetime import UTC, datetime, timedelta

from quantlab.analytics.metrics import calculate_metrics
from quantlab.analytics.plotting import plot_backtest_results
from quantlab.analytics.strategy_comparison import (
    compare_moving_average_strategies,
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