from datetime import UTC, datetime, timedelta

import pytest

from quantlab.analytics.walk_forward import (
    evaluate_parameter_grid_heatmap,
    run_walk_forward_optimization,
    split_bars_train_test,
)
from quantlab.data.models import Bar


def make_bar_series(count: int, start_price: float = 100.0, trend: float = 0.5) -> list[Bar]:
    start = datetime(2025, 1, 1, tzinfo=UTC)
    bars: list[Bar] = []
    price = start_price

    for i in range(count):
        # Create subtle oscillating price with trend
        cycle = 5.0 if (i % 6) < 3 else -4.0
        price = max(10.0, price + trend + cycle)
        bars.append(
            Bar(
                timestamp=start + timedelta(days=i),
                open=price,
                high=price + 2.0,
                low=price - 2.0,
                close=price + 0.5,
                volume=1000.0,
            )
        )
    return bars


def test_split_bars_train_test_validation():
    with pytest.raises(ValueError, match="cannot be empty"):
        split_bars_train_test([])

    with pytest.raises(ValueError, match="Insufficient bars"):
        split_bars_train_test(make_bar_series(5))

    with pytest.raises(ValueError, match="train_ratio"):
        split_bars_train_test(make_bar_series(20), train_ratio=0.05)

    with pytest.raises(ValueError, match="train_ratio"):
        split_bars_train_test(make_bar_series(20), train_ratio=0.95)


def test_split_bars_train_test_correct_partition():
    bars = make_bar_series(100)
    in_sample, out_of_sample = split_bars_train_test(bars, train_ratio=0.7)

    assert len(in_sample) == 70
    assert len(out_of_sample) == 30
    assert in_sample[-1].timestamp < out_of_sample[0].timestamp
    assert in_sample + out_of_sample == bars


def test_walk_forward_optimization_rolling_windows():
    bars = make_bar_series(60)

    result = run_walk_forward_optimization(
        bars=bars,
        strategy_name="moving_average",
        num_windows=2,
        window_mode="rolling",
        initial_cash=10_000.0,
    )

    assert result.strategy_name == "moving_average"
    assert result.total_bars == 60
    assert len(result.windows) >= 1
    assert result.robustness_grade is not None
    assert result.explanation is not None
    assert len(result.stitched_oos_equity_curve) > 1

    first_window = result.windows[0]
    assert first_window.window_index == 1
    assert first_window.in_sample_bars_count > 0
    assert first_window.out_of_sample_bars_count > 0
    assert first_window.best_parameters is not None


def test_walk_forward_optimization_expanding_windows():
    bars = make_bar_series(60)

    result = run_walk_forward_optimization(
        bars=bars,
        strategy_name="moving_average",
        num_windows=2,
        window_mode="expanding",
        initial_cash=10_000.0,
    )

    assert result.window_mode == "expanding"
    assert len(result.windows) >= 1


def test_walk_forward_optimization_rsi():
    bars = make_bar_series(60)

    result = run_walk_forward_optimization(
        bars=bars,
        strategy_name="rsi",
        num_windows=2,
        initial_cash=10_000.0,
    )

    assert result.strategy_name == "rsi"
    assert len(result.windows) >= 1


def test_walk_forward_optimization_bollinger():
    bars = make_bar_series(60)

    result = run_walk_forward_optimization(
        bars=bars,
        strategy_name="bollinger",
        num_windows=2,
        initial_cash=10_000.0,
    )

    assert result.strategy_name == "bollinger"
    assert len(result.windows) >= 1
    assert "period" in result.windows[0].best_parameters
    assert "std_dev_multiplier" in result.windows[0].best_parameters


def test_walk_forward_optimization_insufficient_bars():
    with pytest.raises(ValueError, match="Insufficient bars"):
        run_walk_forward_optimization(bars=make_bar_series(15))


def test_parameter_grid_heatmap():
    bars = make_bar_series(40)

    result = evaluate_parameter_grid_heatmap(
        bars=bars,
        fast_periods=(2, 5),
        slow_periods=(10, 15),
        initial_cash=10_000.0,
    )

    # 2 fast x 2 slow = 4 points
    assert result.total_combinations == 4
    assert len(result.grid) == 4
    assert 0.0 <= result.plateau_ratio <= 1.0
    assert result.stability_verdict is not None

    for pt in result.grid:
        assert pt.fast_period < pt.slow_period
        assert pt.final_equity > 0
