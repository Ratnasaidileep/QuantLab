
from collections.abc import Sequence

from quantlab.strategy.models import Signal


class RSIStrategy:
    """Long-only RSI strategy using Wilder's RSI smoothing."""

    def __init__(
        self,
        period: int = 14,
        oversold: float = 30.0,
        overbought: float = 70.0,
    ) -> None:
        if period < 1:
            raise ValueError("RSI period must be at least 1.")

        if not 0 <= oversold < overbought <= 100:
            raise ValueError(
                "Thresholds must satisfy "
                "0 <= oversold < overbought <= 100."
            )

        self.period = period
        self.oversold = oversold
        self.overbought = overbought

    def calculate_rsi_series(
        self, prices: Sequence[float]
    ) -> list[float | None]:
        """Return RSI values, using None until enough prices exist."""
        if any(
            not isinstance(price, (int, float))
            or not __import__("math").isfinite(price)
            for price in prices
        ):
            raise ValueError("Prices must be finite numbers.")

        if any(price <= 0 for price in prices):
            raise ValueError("Prices must be positive.")

        values: list[float | None] = [None] * len(prices)

        if len(prices) <= self.period:
            return values

        changes = [
            float(prices[i]) - float(prices[i - 1])
            for i in range(1, len(prices))
        ]

        gains = [max(change, 0.0) for change in changes]
        losses = [max(-change, 0.0) for change in changes]

        average_gain = sum(gains[: self.period]) / self.period
        average_loss = sum(losses[: self.period]) / self.period

        def rsi_value(gain: float, loss: float) -> float:
            if gain == 0 and loss == 0:
                return 50.0
            if loss == 0:
                return 100.0
            if gain == 0:
                return 0.0

            relative_strength = gain / loss
            return 100.0 - (100.0 / (1.0 + relative_strength))

        values[self.period] = rsi_value(average_gain, average_loss)

        for index in range(self.period + 1, len(prices)):
            change_index = index - 1
            average_gain = (
                average_gain * (self.period - 1)
                + gains[change_index]
            ) / self.period
            average_loss = (
                average_loss * (self.period - 1)
                + losses[change_index]
            ) / self.period

            values[index] = rsi_value(average_gain, average_loss)

        return values

    def generate_signal(self, prices: Sequence[float]) -> Signal:
        """Return the target position implied by the RSI history."""
        rsi_values = self.calculate_rsi_series(prices)
        target = Signal.FLAT

        for value in rsi_values:
            if value is None:
                continue

            if value <= self.oversold:
                target = Signal.LONG
            elif value >= self.overbought:
                target = Signal.FLAT

        return target
