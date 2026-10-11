import pytest

from quantlab.strategy.models import Signal
from quantlab.strategy.moving_average import MovingAverageCrossover


def test_insufficient_prices_are_flat():
    strategy = MovingAverageCrossover(fast_period=3, slow_period=5)

    assert strategy.generate_signal([1, 2, 3]) == Signal.FLAT


def test_fast_average_above_slow_average_is_long():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)

    assert strategy.generate_signal([1, 1, 1, 10]) == Signal.LONG


def test_fast_average_below_slow_average_is_short():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)

    assert strategy.generate_signal([10, 10, 10, 1]) == Signal.SHORT


def test_equal_averages_are_flat():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)

    assert strategy.generate_signal([1, 3, 1, 3]) == Signal.FLAT


@pytest.mark.parametrize(
    "fast_period, slow_period",
    [
        (0, 5),
        (-1, 5),
        (5, 5),
        (6, 5),
    ],
)
def test_invalid_periods_are_rejected(fast_period, slow_period):
    with pytest.raises(ValueError):
        MovingAverageCrossover(fast_period, slow_period)

def test_bullish_crossover_generates_long_signal():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)

    prices = [10, 10, 10, 9, 8, 12]

    assert strategy.generate_crossover_signal(prices) == Signal.LONG


def test_bearish_crossover_generates_short_signal():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)

    prices = [10, 10, 10, 10, 14, 5]

    assert strategy.generate_crossover_signal(prices) == Signal.SHORT


def test_no_crossover_returns_flat():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)

    prices = [10, 10, 10, 12, 14, 15]

    assert strategy.generate_crossover_signal(prices) == Signal.FLAT


def test_crossover_requires_enough_previous_data():
    strategy = MovingAverageCrossover(fast_period=2, slow_period=4)

    assert strategy.generate_crossover_signal([10, 10, 10, 12]) == Signal.FLAT