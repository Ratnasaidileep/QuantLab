from dataclasses import dataclass
from datetime import datetime
from enum import Enum


class TradeSide(Enum):
    BUY = "buy"
    SELL = "sell"


@dataclass(frozen=True)
class Trade:
    """Represents one executed trade."""

    timestamp: datetime
    side: TradeSide
    price: float
    quantity: float
    commission: float
    exit_reason: str | None = None