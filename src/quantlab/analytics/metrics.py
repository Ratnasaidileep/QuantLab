
import math
from collections.abc import Sequence
from dataclasses import dataclass

from quantlab.backtest.models import Trade, TradeSide


@dataclass(frozen=True)
class PerformanceMetrics:
    total_pnl: float
    total_return: float
    max_drawdown: float
    total_trades: int = 0
    win_rate: float | None = None
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    cagr: float | None = None
    calmar_ratio: float | None = None
    closed_trades: int = 0


def calculate_trade_pnl(trades: Sequence[Trade]) -> list[float]:
    """Calculate realized net P&L for closed trade round-trips using FIFO matching."""
    closed_pnls: list[float] = []
    buy_queue: list[tuple[float, float, float]] = []

    for trade in trades:
        if trade.side == TradeSide.BUY:
            comm_per_unit = (
                trade.commission / trade.quantity if trade.quantity > 0 else 0.0
            )
            buy_queue.append((trade.price, trade.quantity, comm_per_unit))
        elif trade.side == TradeSide.SELL:
            sell_qty = trade.quantity
            sell_comm_per_unit = (
                trade.commission / trade.quantity if trade.quantity > 0 else 0.0
            )

            while sell_qty > 0 and buy_queue:
                buy_price, buy_qty, buy_comm_per_unit = buy_queue.pop(0)
                matched_qty = min(sell_qty, buy_qty)

                cost = (buy_price + buy_comm_per_unit) * matched_qty
                proceeds = (trade.price - sell_comm_per_unit) * matched_qty
                closed_pnls.append(proceeds - cost)

                sell_qty -= matched_qty
                remaining_buy = buy_qty - matched_qty
                if remaining_buy > 0:
                    buy_queue.insert(
                        0, (buy_price, remaining_buy, buy_comm_per_unit)
                    )

    return closed_pnls


def calculate_daily_returns(equity_curve: Sequence[float]) -> list[float]:
    """Calculate period-by-period simple returns from an equity curve."""
    if len(equity_curve) < 2:
        return []

    returns: list[float] = []
    for index in range(1, len(equity_curve)):
        previous = equity_curve[index - 1]
        current = equity_curve[index]
        if previous > 0:
            returns.append((current - previous) / previous)
        else:
            returns.append(0.0)

    return returns


def calculate_sharpe_ratio(
    daily_returns: Sequence[float],
    risk_free_rate: float = 0.05,
    periods_per_year: int = 252,
) -> float | None:
    """Calculate the annualized Sharpe ratio from period returns."""
    if len(daily_returns) < 2:
        return None

    rf_per_period = risk_free_rate / periods_per_year
    excess_returns = [r - rf_per_period for r in daily_returns]
    mean_excess = sum(excess_returns) / len(excess_returns)

    variance = sum((r - mean_excess) ** 2 for r in excess_returns) / (
        len(excess_returns) - 1
    )
    std_dev = math.sqrt(variance)

    if std_dev == 0.0:
        if mean_excess == 0.0:
            return 0.0
        return float("inf") if mean_excess > 0 else float("-inf")

    return (mean_excess / std_dev) * math.sqrt(periods_per_year)


def calculate_sortino_ratio(
    daily_returns: Sequence[float],
    risk_free_rate: float = 0.05,
    periods_per_year: int = 252,
) -> float | None:
    """Calculate the annualized Sortino ratio evaluating downside deviation risk."""
    if len(daily_returns) < 2:
        return None

    rf_per_period = risk_free_rate / periods_per_year
    excess_returns = [r - rf_per_period for r in daily_returns]
    mean_excess = sum(excess_returns) / len(excess_returns)

    downside_diffs = [min(0.0, r) for r in excess_returns]
    downside_variance = sum(d**2 for d in downside_diffs) / len(downside_diffs)
    downside_std = math.sqrt(downside_variance)

    if downside_std == 0.0:
        return float("inf") if mean_excess > 0 else 0.0

    return (mean_excess / downside_std) * math.sqrt(periods_per_year)


def calculate_cagr(
    initial_cash: float,
    final_equity: float,
    periods: int,
    periods_per_year: int = 252,
) -> float | None:
    """Calculate Compound Annual Growth Rate (CAGR)."""
    if periods <= 1 or initial_cash <= 0 or final_equity <= 0:
        return None

    years = periods / periods_per_year
    if years <= 0:
        return None

    return (final_equity / initial_cash) ** (1.0 / years) - 1.0


def calculate_calmar_ratio(
    cagr: float | None,
    max_drawdown: float,
) -> float | None:
    """Calculate the Calmar ratio (CAGR / Max Drawdown)."""
    if cagr is None:
        return None
    if max_drawdown <= 0.0:
        return float("inf") if cagr > 0.0 else 0.0
    return cagr / max_drawdown


def calculate_metrics(
    initial_cash: float,
    equity_curve: Sequence[float],
    trades: Sequence[Trade] | None = None,
    risk_free_rate: float = 0.05,
    periods_per_year: int = 252,
) -> PerformanceMetrics:
    """Calculate performance metrics from an equity curve and optional trade history."""
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

    total_trades_count = len(trades) if trades is not None else 0
    closed_trades_count = 0
    win_rate: float | None = None
    profit_factor: float | None = None

    if trades:
        closed_pnls = calculate_trade_pnl(trades)
        if closed_pnls:
            closed_trades_count = len(closed_pnls)
            winning_trades = [p for p in closed_pnls if p > 0]
            gross_profit = sum(winning_trades)
            gross_loss = abs(sum(p for p in closed_pnls if p < 0))

            win_rate = len(winning_trades) / len(closed_pnls)

            if gross_loss > 0:
                profit_factor = gross_profit / gross_loss
            elif gross_profit > 0:
                profit_factor = float("inf")
            else:
                profit_factor = 0.0

    daily_returns = calculate_daily_returns(equity_curve)
    sharpe = calculate_sharpe_ratio(
        daily_returns=daily_returns,
        risk_free_rate=risk_free_rate,
        periods_per_year=periods_per_year,
    )
    sortino = calculate_sortino_ratio(
        daily_returns=daily_returns,
        risk_free_rate=risk_free_rate,
        periods_per_year=periods_per_year,
    )
    cagr = calculate_cagr(
        initial_cash=initial_cash,
        final_equity=final_equity,
        periods=len(equity_curve),
        periods_per_year=periods_per_year,
    )
    calmar = calculate_calmar_ratio(
        cagr=cagr,
        max_drawdown=max_drawdown,
    )

    return PerformanceMetrics(
        total_pnl=total_pnl,
        total_return=total_return,
        max_drawdown=max_drawdown,
        total_trades=total_trades_count,
        win_rate=win_rate,
        profit_factor=profit_factor,
        sharpe_ratio=sharpe,
        sortino_ratio=sortino,
        cagr=cagr,
        calmar_ratio=calmar,
        closed_trades=closed_trades_count,
    )