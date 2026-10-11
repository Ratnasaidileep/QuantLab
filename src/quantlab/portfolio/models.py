from dataclasses import dataclass

from quantlab.strategy.models import Signal


@dataclass(frozen=True)
class Position:
    signal: Signal
    quantity: float