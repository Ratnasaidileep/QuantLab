
from collections.abc import Sequence
from dataclasses import dataclass
from itertools import pairwise
from typing import Any

from quantlab.analytics.metrics import calculate_metrics
from quantlab.backtest.engine import Backtest
from quantlab.data.models import Bar
from quantlab.data.validation import validate_bar
from quantlab.strategy.moving_average import MovingAverageCrossover
from quantlab.strategy.rsi import RSIStrategy


@dataclass(frozen=True)
class StrategyComparisonResult:
    fast_period: int
    slow_period: int
    trades: int
    final_equity: float
    total_pnl: float
    total_return: float
    max_drawdown: float
    strategy_name: str = "Moving Average Crossover"
    configuration: str = ""


def _build_result(
    strategy_name: str,
    configuration: str,
    result: Any,
    fast_period: int = 0,
    slow_period: int = 0,
) -> StrategyComparisonResult:
    """Convert a backtest result into a comparable summary."""
    return StrategyComparisonResult(
        fast_period=fast_period,
        slow_period=slow_period,
        trades=len(result.trades),
        final_equity=result.final_equity,
        total_pnl=result.total_pnl,
        total_return=result.metrics.total_return,
        max_drawdown=result.metrics.max_drawdown,
        strategy_name=strategy_name,
        configuration=configuration,
    )


def compare_moving_average_strategies(
    bars: Sequence[Bar],
    initial_cash: float,
    parameter_pairs: Sequence[tuple[int, int]],
    commission_rate: float = 0.0,
    slippage_rate: float = 0.0,
) -> list[StrategyComparisonResult]:
    """Compare multiple moving-average crossover configurations."""
    results: list[StrategyComparisonResult] = []

    for fast_period, slow_period in parameter_pairs:
        strategy = MovingAverageCrossover(
            fast_period=fast_period,
            slow_period=slow_period,
        )

        backtest = Backtest(
            initial_cash=initial_cash,
            strategy=strategy,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=True,
        )

        result = backtest.run(bars)

        results.append(
            _build_result(
                strategy_name="Moving Average Crossover",
                configuration=f"Fast {fast_period} / Slow {slow_period}",
                result=result,
                fast_period=fast_period,
                slow_period=slow_period,
            )
        )

    return results


def compare_strategies(
    bars: Sequence[Bar],
    initial_cash: float,
    commission_rate: float = 0.0,
    slippage_rate: float = 0.0,
    ma_parameter_pairs: Sequence[tuple[int, int]] = ((10, 30),),
    rsi_configurations: Sequence[tuple[int, float, float]] = (
        (14, 30.0, 70.0),
    ),
) -> list[StrategyComparisonResult]:
    """Compare moving-average and RSI configurations under the same costs."""
    results = compare_moving_average_strategies(
        bars=bars,
        initial_cash=initial_cash,
        parameter_pairs=ma_parameter_pairs,
        commission_rate=commission_rate,
        slippage_rate=slippage_rate,
    )

    for period, oversold, overbought in rsi_configurations:
        strategy = RSIStrategy(
            period=period,
            oversold=oversold,
            overbought=overbought,
        )

        backtest = Backtest(
            initial_cash=initial_cash,
            strategy=strategy,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=False,
        )

        result = backtest.run(bars)

        results.append(
            _build_result(
                strategy_name="RSI",
                configuration=(
                    f"Period {period} / "
                    f"Oversold {oversold:g} / "
                    f"Overbought {overbought:g}"
                ),
                result=result,
            )
        )

    return results


def compare_buy_and_hold(
    bars: Sequence[Bar],
    initial_cash: float,
    commission_rate: float = 0.0,
    slippage_rate: float = 0.0,
) -> StrategyComparisonResult:
    """Evaluate a buy-and-hold benchmark over the available bars."""
    if initial_cash < 0:
        raise ValueError("Initial cash cannot be negative.")

    if commission_rate < 0:
        raise ValueError("Commission rate cannot be negative.")

    if slippage_rate < 0:
        raise ValueError("Slippage rate cannot be negative.")

    if not bars:
        raise ValueError("Bars cannot be empty.")

    for bar in bars:

        validate_bar(bar)

    for previous, current in pairwise(bars):
        if current.timestamp <= previous.timestamp:
            raise ValueError(
                "Bars must be ordered by strictly increasing timestamps."
            )

    # Buy at the first bar's open, using the same one-unit sizing
    # convention as the existing backtest engine.
    first_bar = bars[0]
    buy_price = first_bar.open * (1.0 + slippage_rate)
    buy_commission = buy_price * commission_rate
    purchase_cost = buy_price + buy_commission

    if initial_cash < purchase_cost:
        raise ValueError(
            "Initial cash is insufficient to purchase one unit "
            "including transaction costs."
        )

    remaining_cash = initial_cash - purchase_cost

    # Hold the unit until the final close. Selling incurs slippage
    # and commission, just as a normal sell execution would.
    final_sell_price = bars[-1].close * (1.0 - slippage_rate)
    sell_commission = final_sell_price * commission_rate
    final_equity = remaining_cash + final_sell_price - sell_commission

    total_pnl = final_equity - initial_cash
    total_return = total_pnl / initial_cash if initial_cash else 0.0

    equity_curve = [
        remaining_cash + bar.close
        for bar in bars
    ]

    # Include the entry cost in the first marked equity value.
    equity_curve[0] = (
        initial_cash - purchase_cost + first_bar.close
    )


    metrics = calculate_metrics(
        initial_cash=initial_cash,
        equity_curve=equity_curve,
    )

    return StrategyComparisonResult(
        fast_period=0,
        slow_period=0,
        trades=2,
        final_equity=final_equity,
        total_pnl=total_pnl,
        total_return=total_return,
        max_drawdown=metrics.max_drawdown,
        strategy_name="Buy and Hold",
        configuration="Buy first open / Hold to final close",
    )
