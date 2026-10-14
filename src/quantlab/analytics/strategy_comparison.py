
from collections.abc import Sequence
from dataclasses import dataclass, field
from itertools import pairwise
from typing import Any

from quantlab.analytics.metrics import calculate_metrics
from quantlab.backtest.engine import Backtest
from quantlab.backtest.models import Trade, TradeSide
from quantlab.data.models import Bar
from quantlab.data.validation import validate_bar
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.moving_average import MovingAverageCrossover
from quantlab.strategy.rsi import RSIStrategy


@dataclass(frozen=True)
class StrategyComparisonResult:
    strategy_name: str
    configuration: str
    trades: int
    final_equity: float
    total_pnl: float
    total_return: float
    max_drawdown: float
    parameters: dict[str, Any] = field(default_factory=dict)
    fast_period: int = 0
    slow_period: int = 0
    win_rate: float | None = None
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    cagr: float | None = None


def _build_result(
    strategy_name: str,
    configuration: str,
    result: Any,
    fast_period: int = 0,
    slow_period: int = 0,
    parameters: dict[str, Any] | None = None,
) -> StrategyComparisonResult:
    """Convert a backtest result into a comparable summary."""
    params = dict(parameters) if parameters else {}
    if fast_period or slow_period:
        params = {"fast_period": fast_period, "slow_period": slow_period, **params}

    win_rate = result.metrics.win_rate if result.metrics else None
    profit_factor = result.metrics.profit_factor if result.metrics else None
    sharpe = result.metrics.sharpe_ratio if result.metrics else None
    sortino = result.metrics.sortino_ratio if result.metrics else None
    cagr = result.metrics.cagr if result.metrics else None

    return StrategyComparisonResult(
        strategy_name=strategy_name,
        configuration=configuration,
        trades=len(result.trades),
        final_equity=result.final_equity,
        total_pnl=result.total_pnl,
        total_return=result.metrics.total_return,
        max_drawdown=result.metrics.max_drawdown,
        parameters=params,
        fast_period=fast_period,
        slow_period=slow_period,
        win_rate=win_rate,
        profit_factor=profit_factor,
        sharpe_ratio=sharpe,
        sortino_ratio=sortino,
        cagr=cagr,
    )


def compare_moving_average_strategies(
    bars: Sequence[Bar],
    initial_cash: float,
    parameter_pairs: Sequence[tuple[int, int]],
    commission_rate: float = 0.0,
    slippage_rate: float = 0.0,
    sizing_mode: str = "unit",
    quantity_per_trade: float = 1.0,
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
            sizing_mode=sizing_mode,
            quantity_per_trade=quantity_per_trade,
        )

        result = backtest.run(bars)

        params: dict[str, Any] = {
            "fast_period": fast_period,
            "slow_period": slow_period,
        }
        if sizing_mode != "unit":
            params["sizing_mode"] = sizing_mode

        results.append(
            _build_result(
                strategy_name="Moving Average Crossover",
                configuration=f"Fast {fast_period} / Slow {slow_period}",
                result=result,
                fast_period=fast_period,
                slow_period=slow_period,
                parameters=params,
            )
        )

    return results


def compare_bollinger_bands_strategies(
    bars: Sequence[Bar],
    initial_cash: float,
    parameter_pairs: Sequence[tuple[int, float]],
    commission_rate: float = 0.0,
    slippage_rate: float = 0.0,
    sizing_mode: str = "unit",
    quantity_per_trade: float = 1.0,
) -> list[StrategyComparisonResult]:
    """Compare multiple Bollinger Bands configurations."""
    results: list[StrategyComparisonResult] = []

    for period, std_dev in parameter_pairs:
        strategy = BollingerBandsStrategy(
            period=period,
            std_dev_multiplier=std_dev,
        )

        backtest = Backtest(
            initial_cash=initial_cash,
            strategy=strategy,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=False,
            sizing_mode=sizing_mode,
            quantity_per_trade=quantity_per_trade,
        )

        result = backtest.run(bars)

        params: dict[str, Any] = {
            "period": period,
            "std_dev_multiplier": std_dev,
        }
        if sizing_mode != "unit":
            params["sizing_mode"] = sizing_mode

        results.append(
            _build_result(
                strategy_name="Bollinger Bands",
                configuration=f"Period {period} / StdDev {std_dev:g}",
                result=result,
                parameters=params,
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
    bb_configurations: Sequence[tuple[int, float]] | None = None,
    sizing_mode: str = "unit",
    quantity_per_trade: float = 1.0,
) -> list[StrategyComparisonResult]:
    """Compare moving-average, RSI, and Bollinger Bands configurations under the same costs."""
    results = compare_moving_average_strategies(
        bars=bars,
        initial_cash=initial_cash,
        parameter_pairs=ma_parameter_pairs,
        commission_rate=commission_rate,
        slippage_rate=slippage_rate,
        sizing_mode=sizing_mode,
        quantity_per_trade=quantity_per_trade,
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
            sizing_mode=sizing_mode,
            quantity_per_trade=quantity_per_trade,
        )

        result = backtest.run(bars)

        params = {
            "period": period,
            "oversold": oversold,
            "overbought": overbought,
        }
        if sizing_mode != "unit":
            params["sizing_mode"] = sizing_mode

        results.append(
            _build_result(
                strategy_name="RSI",
                configuration=(
                    f"Period {period} / "
                    f"Oversold {oversold:g} / "
                    f"Overbought {overbought:g}"
                ),
                result=result,
                parameters=params,
            )
        )

    if bb_configurations:
        bb_results = compare_bollinger_bands_strategies(
            bars=bars,
            initial_cash=initial_cash,
            parameter_pairs=bb_configurations,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            sizing_mode=sizing_mode,
            quantity_per_trade=quantity_per_trade,
        )
        results.extend(bb_results)

    return results


def compare_buy_and_hold(
    bars: Sequence[Bar],
    initial_cash: float,
    commission_rate: float = 0.0,
    slippage_rate: float = 0.0,
    liquidate_on_end: bool = False,
    sizing_mode: str = "unit",
    quantity_per_trade: float = 1.0,
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

    if sizing_mode not in ("unit", "fixed_quantity", "all_in"):
        raise ValueError(
            f"Unsupported sizing mode '{sizing_mode}'. Supported modes: 'unit', 'fixed_quantity', 'all_in'."
        )

    if quantity_per_trade <= 0:
        raise ValueError("quantity_per_trade must be positive.")

    for bar in bars:
        validate_bar(bar)

    for previous, current in pairwise(bars):
        if current.timestamp <= previous.timestamp:
            raise ValueError(
                "Bars must be ordered by strictly increasing timestamps."
            )

    first_bar = bars[0]
    buy_price = first_bar.open * (1.0 + slippage_rate)
    cost_per_unit = buy_price * (1.0 + commission_rate)

    if sizing_mode == "unit":
        trade_quantity = 1.0
    elif sizing_mode == "fixed_quantity":
        trade_quantity = quantity_per_trade
    elif sizing_mode == "all_in":
        trade_quantity = (
            float(int(initial_cash // cost_per_unit))
            if cost_per_unit > 0
            else 0.0
        )

    total_cost = trade_quantity * cost_per_unit
    buy_commission = trade_quantity * buy_price * commission_rate

    if initial_cash < total_cost or trade_quantity <= 0.0:
        raise ValueError(
            "Initial cash is insufficient to purchase the requested quantity "
            "including transaction costs."
        )

    remaining_cash = initial_cash - total_cost

    equity_curve = [
        remaining_cash + trade_quantity * bar.close
        for bar in bars
    ]

    if liquidate_on_end:
        # Selling incurs slippage and commission upon exiting the position.
        final_sell_price = bars[-1].close * (1.0 - slippage_rate)
        sell_proceeds = trade_quantity * final_sell_price
        sell_commission = sell_proceeds * commission_rate
        final_equity = remaining_cash + sell_proceeds - sell_commission
        equity_curve[-1] = final_equity
        trades = 2
        configuration = "Buy first open / Liquidate final close"
    else:
        # Mark to market at final close without liquidation costs,
        # matching the Backtest engine's convention.
        final_equity = remaining_cash + trade_quantity * bars[-1].close
        trades = 1
        configuration = "Buy first open / Hold to final close"

    total_pnl = final_equity - initial_cash
    total_return = total_pnl / initial_cash if initial_cash else 0.0

    bnh_trades = [
        Trade(
            timestamp=first_bar.timestamp,
            side=TradeSide.BUY,
            price=buy_price,
            quantity=trade_quantity,
            commission=buy_commission,
        )
    ]
    if liquidate_on_end:
        bnh_trades.append(
            Trade(
                timestamp=bars[-1].timestamp,
                side=TradeSide.SELL,
                price=final_sell_price,
                quantity=trade_quantity,
                commission=sell_commission,
            )
        )

    metrics = calculate_metrics(
        initial_cash=initial_cash,
        equity_curve=equity_curve,
        trades=bnh_trades,
    )

    params: dict[str, Any] = {"liquidate_on_end": liquidate_on_end}
    if sizing_mode != "unit":
        params["sizing_mode"] = sizing_mode

    return StrategyComparisonResult(
        strategy_name="Buy and Hold",
        configuration=configuration,
        trades=trades,
        final_equity=final_equity,
        total_pnl=total_pnl,
        total_return=total_return,
        max_drawdown=metrics.max_drawdown,
        parameters=params,
        fast_period=0,
        slow_period=0,
        win_rate=metrics.win_rate,
        profit_factor=metrics.profit_factor,
        sharpe_ratio=metrics.sharpe_ratio,
        sortino_ratio=metrics.sortino_ratio,
        cagr=metrics.cagr,
    )

