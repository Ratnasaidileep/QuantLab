
from collections.abc import Sequence
from typing import Protocol

from quantlab.strategy.models import Signal


class Strategy(Protocol):
    """Common interface for quantitative trading strategies."""

    def generate_signal(self, prices: Sequence[float]) -> Signal:
        """Generate a trading signal from historical prices."""
        ...
