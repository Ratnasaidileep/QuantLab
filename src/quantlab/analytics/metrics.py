
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class PerformanceMetrics:
    total_pnl: float
    total_return: float
    max_drawdown: float


def calculate_metrics(
    initial_cash: float,
    equity_curve: Sequence[float],
) -> PerformanceMetrics:
    """Calculate basic performance metrics from an equity curve."""
    if initial_cash <= 0:
        raise ValueError("Initial cash must be positive.")

    if not equity_curve:
        raise ValueError("Equity curve cannot be empty.")

    if any(value < 0 for value in equity_curve):
        raise ValueError("Equity values cannot be negative.")

    final_equity = equity_curve[-1]
    total_pnl = final_equity - initial_cash
    total_return = total_pnl / initial_cash

    peak = initial_cash
    max_drawdown = 0.0

    for equity in equity_curve:
        peak = max(peak, equity)

        if peak > 0:
            drawdown = (peak - equity) / peak
            max_drawdown = max(max_drawdown, drawdown)

    return PerformanceMetrics(
        total_pnl=total_pnl,
        total_return=total_return,
        max_drawdown=max_drawdown,
    )