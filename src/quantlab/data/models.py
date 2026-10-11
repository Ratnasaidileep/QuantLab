from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class Bar:
    """Represents one OHLCV market-data bar."""

    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float