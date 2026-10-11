from collections.abc import Sequence

from quantlab.strategy.models import Signal


class MovingAverageCrossover:
    """Generate signals from fast and slow moving averages."""

    def __init__(self, fast_period: int, slow_period: int) -> None:
        if fast_period <= 0:
            raise ValueError("Fast period must be positive.")
        if slow_period <= 0:
            raise ValueError("Slow period must be positive.")
        if fast_period >= slow_period:
            raise ValueError("Fast period must be less than slow period.")

        self.fast_period = fast_period
        self.slow_period = slow_period

    def generate_signal(self, prices: Sequence[float]) -> Signal:
        if len(prices) < self.slow_period:
            return Signal.FLAT

        fast_average = sum(prices[-self.fast_period:]) / self.fast_period
        slow_average = sum(prices[-self.slow_period:]) / self.slow_period

        if fast_average > slow_average:
            return Signal.LONG

        if fast_average < slow_average:
            return Signal.SHORT

        return Signal.FLAT

    def generate_crossover_signal(self, prices: Sequence[float]) -> Signal:
        """Return a signal only when the fast average crosses the slow average."""
        if len(prices) < self.slow_period + 1:
            return Signal.FLAT

        previous_fast = (
            sum(prices[-self.fast_period - 1 : -1]) / self.fast_period
        )
        previous_slow = (
            sum(prices[-self.slow_period - 1 : -1]) / self.slow_period
        )

        current_fast = (
            sum(prices[-self.fast_period :]) / self.fast_period
        )
        current_slow = (
            sum(prices[-self.slow_period :]) / self.slow_period
        )

        if previous_fast <= previous_slow and current_fast > current_slow:
            return Signal.LONG

        if previous_fast >= previous_slow and current_fast < current_slow:
            return Signal.SHORT

        return Signal.FLAT