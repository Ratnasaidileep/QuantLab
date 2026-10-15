"""Multi-Asset Basket & Portfolio Rebalancing Engine.

Provides multi-asset portfolio backtesting with Equal Weight, Inverse Volatility (Risk Parity),
and Custom Target Weights allocation, along with Monthly, Quarterly, and Drift (Buy & Hold)
rebalancing schedules executed at Next-Bar Open without look-ahead bias.
"""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from enum import Enum

import numpy as np

from quantlab.analytics.metrics import (
    PerformanceMetrics,
    calculate_daily_returns,
    calculate_metrics,
    calculate_trade_pnl,
)
from quantlab.analytics.tear_sheet import (
    TailRiskMetrics,
    calculate_annualized_volatility,
    calculate_cvar,
    calculate_historical_var,
    calculate_kurtosis,
    calculate_parametric_var,
    calculate_skewness,
    calculate_tail_ratio,
)
from quantlab.backtest.models import Trade, TradeSide
from quantlab.data.models import Bar
from quantlab.data.validation import validate_bar


class AllocationWeighting(str, Enum):
    """Weighting allocation scheme for basket portfolios."""

    EQUAL_WEIGHT = "equal_weight"
    INVERSE_VOLATILITY = "inverse_volatility"
    CUSTOM = "custom"


class RebalanceFrequency(str, Enum):
    """Rebalancing schedule frequency."""

    NONE = "none"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


@dataclass(frozen=True)
class BasketTrade:
    """Individual trade executed within the multi-asset basket."""

    timestamp: datetime
    symbol: str
    side: TradeSide
    price: float
    quantity: float
    commission: float
    reason: str = "allocation"


@dataclass(frozen=True)
class BasketEquityPoint:
    """Daily timestamped mark-to-market portfolio snapshot."""

    timestamp: datetime
    equity: float
    cash: float
    holdings_value: float
    weights: dict[str, float]


@dataclass(frozen=True)
class BasketResult:
    """Complete results from a multi-asset basket backtest execution."""

    initial_cash: float
    final_cash: float
    final_equity: float
    total_pnl: float
    trades: list[BasketTrade]
    equity_curve: list[float]
    equity_points: list[BasketEquityPoint]
    metrics: PerformanceMetrics
    tail_risk: TailRiskMetrics
    asset_weights: dict[str, float]
    holdings: dict[str, float]


class BasketBacktestEngine:
    """Multi-asset portfolio simulation engine.

    Executes initial target weight allocations and periodic rebalance orders strictly
    at Next-Bar Open prices, preventing look-ahead bias and modeling realistic slippage
    and commissions.
    """

    def __init__(
        self,
        initial_cash: float = 100_000.0,
        weighting: AllocationWeighting = AllocationWeighting.EQUAL_WEIGHT,
        custom_weights: dict[str, float] | None = None,
        rebalance_freq: RebalanceFrequency = RebalanceFrequency.NONE,
        commission_rate: float = 0.0,
        slippage_rate: float = 0.0,
        risk_free_rate: float = 0.05,
        periods_per_year: int = 252,
    ) -> None:
        if initial_cash <= 0:
            raise ValueError("Initial cash must be positive.")
        if commission_rate < 0:
            raise ValueError("Commission rate cannot be negative.")
        if slippage_rate < 0:
            raise ValueError("Slippage rate cannot be negative.")

        self.initial_cash = initial_cash
        self.weighting = weighting
        self.custom_weights = custom_weights or {}
        self.rebalance_freq = rebalance_freq
        self.commission_rate = commission_rate
        self.slippage_rate = slippage_rate
        self.risk_free_rate = risk_free_rate
        self.periods_per_year = periods_per_year

    def _compute_weights(
        self, symbols: list[str], data: dict[str, Sequence[Bar]]
    ) -> dict[str, float]:
        """Compute target asset weights according to the selected weighting scheme."""
        if self.weighting == AllocationWeighting.EQUAL_WEIGHT:
            n = len(symbols)
            return {sym: 1.0 / n for sym in symbols}

        if self.weighting == AllocationWeighting.CUSTOM:
            for sym in symbols:
                if sym not in self.custom_weights:
                    raise ValueError(f"Custom weight missing for asset '{sym}'")
                if self.custom_weights[sym] < 0:
                    raise ValueError(
                        f"Negative weight for asset '{sym}' is not supported"
                    )
            total_w = sum(self.custom_weights[s] for s in symbols)
            if total_w <= 0:
                raise ValueError("Sum of custom weights must be greater than zero")
            return {s: self.custom_weights[s] / total_w for s in symbols}

        if self.weighting == AllocationWeighting.INVERSE_VOLATILITY:
            inv_vols: dict[str, float] = {}
            for sym in symbols:
                closes = [b.close for b in data[sym]]
                if len(closes) >= 2:
                    rets = [
                        (closes[i] - closes[i - 1]) / closes[i - 1]
                        for i in range(1, len(closes))
                    ]
                    vol = float(np.std(rets, ddof=1)) if len(rets) > 1 else 0.0
                else:
                    vol = 0.0
                inv_vols[sym] = 1.0 / max(vol, 1e-4)
            total_inv = sum(inv_vols.values())
            return {sym: v / total_inv for sym, v in inv_vols.items()}

        raise ValueError(f"Unsupported allocation weighting: {self.weighting}")

    @staticmethod
    def _is_new_period(
        current_dt: datetime, previous_dt: datetime, freq: RebalanceFrequency
    ) -> bool:
        """Determine if a rebalance boundary has been crossed."""
        if freq == RebalanceFrequency.NONE:
            return False
        if freq == RebalanceFrequency.MONTHLY:
            return (current_dt.year != previous_dt.year) or (
                current_dt.month != previous_dt.month
            )
        if freq == RebalanceFrequency.QUARTERLY:
            curr_q = (current_dt.month - 1) // 3
            prev_q = (previous_dt.month - 1) // 3
            return (current_dt.year != previous_dt.year) or (curr_q != prev_q)
        return False

    def run(self, data: dict[str, Sequence[Bar]]) -> BasketResult:
        """Run the multi-asset backtest on aligned price series."""
        if not data:
            raise ValueError("Basket data cannot be empty.")

        symbols = sorted(data.keys())
        for sym in symbols:
            bars = data[sym]
            if not bars:
                raise ValueError(f"No bars provided for symbol '{sym}'.")
            for b in bars:
                validate_bar(b)

        # Build chronological timestamps across all assets
        time_maps = {sym: {b.timestamp: b for b in data[sym]} for sym in symbols}
        common_timestamps = sorted(
            set.intersection(*(set(m.keys()) for m in time_maps.values()))
        )
        if not common_timestamps:
            raise ValueError("No common timestamps found across symbols in the basket.")

        cash = self.initial_cash
        holdings: dict[str, float] = {s: 0.0 for s in symbols}
        trades: list[BasketTrade] = []
        equity_curve: list[float] = []
        equity_points: list[BasketEquityPoint] = []
        target_weights = self._compute_weights(symbols, data)

        previous_dt: datetime | None = None
        allocated: bool = False

        for idx, current_dt in enumerate(common_timestamps):
            current_bars = {s: time_maps[s][current_dt] for s in symbols}

            # Check if rebalance / initial allocation should execute at current bar open
            trigger_rebalance = False
            rebalance_reason = "allocation"

            if not allocated:
                if idx > 0:
                    trigger_rebalance = True
                    rebalance_reason = "initial_allocation"
                    allocated = True
            elif previous_dt is not None and self._is_new_period(
                current_dt, previous_dt, self.rebalance_freq
            ):
                trigger_rebalance = True
                rebalance_reason = "rebalance"

            if trigger_rebalance:
                current_open_equity = cash + sum(
                    holdings[s] * current_bars[s].open for s in symbols
                )

                # 1. Execute SELL orders first to free up liquidity
                for s in symbols:
                    target_val = target_weights[s] * current_open_equity
                    current_val = holdings[s] * current_bars[s].open
                    if target_val < current_val:
                        diff_val = current_val - target_val
                        shares_to_sell = diff_val / current_bars[s].open
                        shares_to_sell = min(holdings[s], shares_to_sell)
                        if shares_to_sell > 0:
                            exec_price = current_bars[s].open * (
                                1.0 - self.slippage_rate
                            )
                            proceeds = shares_to_sell * exec_price
                            comm = proceeds * self.commission_rate
                            cash += proceeds - comm
                            holdings[s] -= shares_to_sell
                            trades.append(
                                BasketTrade(
                                    timestamp=current_dt,
                                    symbol=s,
                                    side=TradeSide.SELL,
                                    price=exec_price,
                                    quantity=shares_to_sell,
                                    commission=comm,
                                    reason=rebalance_reason,
                                )
                            )

                # 2. Execute BUY orders second
                for s in symbols:
                    target_val = target_weights[s] * current_open_equity
                    current_val = holdings[s] * current_bars[s].open
                    if target_val > current_val:
                        diff_val = target_val - current_val
                        exec_price = current_bars[s].open * (
                            1.0 + self.slippage_rate
                        )
                        cost_per_share = exec_price * (1.0 + self.commission_rate)
                        desired_shares = diff_val / cost_per_share
                        if cost_per_share > 0:
                            max_affordable = cash / cost_per_share
                            shares_to_buy = min(desired_shares, max_affordable)
                        else:
                            shares_to_buy = 0.0

                        if shares_to_buy > 0:
                            total_cost = shares_to_buy * cost_per_share
                            comm = shares_to_buy * exec_price * self.commission_rate
                            cash -= total_cost
                            holdings[s] += shares_to_buy
                            trades.append(
                                BasketTrade(
                                    timestamp=current_dt,
                                    symbol=s,
                                    side=TradeSide.BUY,
                                    price=exec_price,
                                    quantity=shares_to_buy,
                                    commission=comm,
                                    reason=rebalance_reason,
                                )
                            )

            # End of bar: Mark portfolio to market at bar close
            holdings_val = sum(holdings[s] * current_bars[s].close for s in symbols)
            bar_equity = cash + holdings_val
            equity_curve.append(bar_equity)

            current_weights = (
                {s: (holdings[s] * current_bars[s].close) / bar_equity for s in symbols}
                if bar_equity > 0
                else {s: 0.0 for s in symbols}
            )

            equity_points.append(
                BasketEquityPoint(
                    timestamp=current_dt,
                    equity=bar_equity,
                    cash=cash,
                    holdings_value=holdings_val,
                    weights=current_weights,
                )
            )

            previous_dt = current_dt

        final_equity = equity_curve[-1] if equity_curve else self.initial_cash
        total_pnl = final_equity - self.initial_cash

        # Calculate closed PnLs per symbol
        closed_pnls: list[float] = []
        trades_by_sym: dict[str, list[BasketTrade]] = defaultdict(list)
        for t in trades:
            trades_by_sym[t.symbol].append(t)
        for sym_trades in trades_by_sym.values():
            single_trades = [
                Trade(
                    timestamp=t.timestamp,
                    side=t.side,
                    price=t.price,
                    quantity=t.quantity,
                    commission=t.commission,
                )
                for t in sym_trades
            ]
            closed_pnls.extend(calculate_trade_pnl(single_trades))

        win_rate: float | None = None
        profit_factor: float | None = None
        if closed_pnls:
            winning = [p for p in closed_pnls if p > 0]
            gross_profit = sum(winning)
            gross_loss = abs(sum(p for p in closed_pnls if p < 0))
            win_rate = len(winning) / len(closed_pnls)
            if gross_loss > 0:
                profit_factor = gross_profit / gross_loss
            elif gross_profit > 0:
                profit_factor = float("inf")
            else:
                profit_factor = 0.0

        base_metrics = calculate_metrics(
            initial_cash=self.initial_cash,
            equity_curve=equity_curve,
            trades=None,
            risk_free_rate=self.risk_free_rate,
            periods_per_year=self.periods_per_year,
        )

        metrics = PerformanceMetrics(
            total_pnl=base_metrics.total_pnl,
            total_return=base_metrics.total_return,
            max_drawdown=base_metrics.max_drawdown,
            total_trades=len(trades),
            win_rate=win_rate,
            profit_factor=profit_factor,
            sharpe_ratio=base_metrics.sharpe_ratio,
            sortino_ratio=base_metrics.sortino_ratio,
            cagr=base_metrics.cagr,
            calmar_ratio=base_metrics.calmar_ratio,
        )

        daily_returns = calculate_daily_returns(equity_curve)
        calmar = base_metrics.calmar_ratio

        tail_risk = TailRiskMetrics(
            var_95_historical=calculate_historical_var(daily_returns, 0.95),
            var_95_parametric=calculate_parametric_var(daily_returns, 0.95),
            var_99_historical=calculate_historical_var(daily_returns, 0.99),
            var_99_parametric=calculate_parametric_var(daily_returns, 0.99),
            cvar_95=calculate_cvar(daily_returns, 0.95),
            cvar_99=calculate_cvar(daily_returns, 0.99),
            tail_ratio=calculate_tail_ratio(daily_returns),
            skewness=calculate_skewness(daily_returns),
            kurtosis=calculate_kurtosis(daily_returns),
            annualized_volatility=calculate_annualized_volatility(
                daily_returns, periods_per_year=self.periods_per_year
            ),
            calmar_ratio=calmar,
        )

        return BasketResult(
            initial_cash=self.initial_cash,
            final_cash=cash,
            final_equity=final_equity,
            total_pnl=total_pnl,
            trades=trades,
            equity_curve=equity_curve,
            equity_points=equity_points,
            metrics=metrics,
            tail_risk=tail_risk,
            asset_weights=target_weights,
            holdings=holdings,
        )
