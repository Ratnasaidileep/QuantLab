from dataclasses import dataclass
from enum import Enum


class Signal(Enum):
    FLAT = "flat"
    LONG = "long"
    SHORT = "short"


@dataclass(frozen=True)
class StrategySignal:
    signal: Signal