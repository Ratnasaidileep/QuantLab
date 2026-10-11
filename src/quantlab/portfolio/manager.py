from quantlab.portfolio.models import Position
from quantlab.strategy.models import Signal


class Portfolio:
    """Maintain the current portfolio position."""

    def __init__(self) -> None:
        self.position = Position(signal=Signal.FLAT, quantity=0.0)

    def update(self, signal: Signal, quantity: float) -> Position:
        if quantity < 0:
            raise ValueError("Quantity cannot be negative.")

        if signal == Signal.FLAT:
            quantity = 0.0

        self.position = Position(
            signal=signal,
            quantity=quantity,
        )

        return self.position