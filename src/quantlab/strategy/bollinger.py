import math
from collections.abc import Sequence

from quantlab.strategy.models import Signal


class BollingerBandsStrategy:
    """Mean-reversion strategy using rolling Bollinger Bands and standard deviation."""

    def __init__(
        self,
        period: int = 20,
        std_dev_multiplier: float = 2.0,
        exit_at_mean: bool = True,
    ) -> None:
        if period < 2:
            raise ValueError("Bollinger Bands period must be at least 2.")
        if std_dev_multiplier <= 0:
            raise ValueError("std_dev_multiplier must be strictly positive.")

        self.period = period
        self.std_dev_multiplier = float(std_dev_multiplier)
        self.exit_at_mean = exit_at_mean

    def calculate_bands(
        self, prices: Sequence[float]
    ) -> tuple[list[float | None], list[float | None], list[float | None]]:
        """Calculate middle (mean), upper, and lower Bollinger Bands for the price series.

        Returns (middle_band, upper_band, lower_band).
        """
        for price in prices:
            if not isinstance(price, (int, float)) or not math.isfinite(price):
                raise ValueError("Prices must be finite numbers.")
            if price <= 0:
                raise ValueError("Prices must be positive.")

        n = len(prices)
        middle_band: list[float | None] = [None] * n
        upper_band: list[float | None] = [None] * n
        lower_band: list[float | None] = [None] * n

        if n < self.period:
            return middle_band, upper_band, lower_band

        # Compute rolling mean and sample standard deviation
        for i in range(self.period - 1, n):
            window = [float(p) for p in prices[i - self.period + 1 : i + 1]]
            mean = sum(window) / self.period
            variance = sum((p - mean) ** 2 for p in window) / self.period
            std_dev = math.sqrt(variance)

            middle_band[i] = mean
            upper_band[i] = mean + self.std_dev_multiplier * std_dev
            lower_band[i] = mean - self.std_dev_multiplier * std_dev

        return middle_band, upper_band, lower_band

    def generate_signal(self, prices: Sequence[float]) -> Signal:
        """Return target position implied by Bollinger Bands mean reversion."""
        middle, upper, lower = self.calculate_bands(prices)
        target = Signal.FLAT

        for i in range(len(prices)):
            m = middle[i]
            u = upper[i]
            low = lower[i]
            if m is None or u is None or low is None:
                continue

            current_price = float(prices[i])

            if current_price <= low:
                target = Signal.LONG
            elif (self.exit_at_mean and current_price >= m) or (
                not self.exit_at_mean and current_price >= u
            ):
                target = Signal.FLAT

        return target
