from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from itertools import pairwise
from typing import Any

from quantlab.analytics.metrics import PerformanceMetrics, calculate_metrics
from quantlab.backtest.engine import Backtest
from quantlab.backtest.models import Trade
from quantlab.data.models import Bar
from quantlab.strategy.base import Strategy
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.moving_average import MovingAverageCrossover
from quantlab.strategy.rsi import RSIStrategy


def split_bars_train_test(
    bars: Sequence[Bar],
    train_ratio: float = 0.7,
) -> tuple[list[Bar], list[Bar]]:
    """Split market bars chronologically into in-sample (train) and out-of-sample (test) sets.

    Ensures chronological ordering without look-ahead bias or data leakage.
    """
    if not bars:
        raise ValueError("Bars cannot be empty.")
    if len(bars) < 10:
        raise ValueError(
            f"Insufficient bars for train/test split (got {len(bars)}, minimum is 10)."
        )
    if not 0.1 <= train_ratio <= 0.9:
        raise ValueError(
            f"train_ratio must be between 0.1 and 0.9 (got {train_ratio})."
        )

    for prev, curr in pairwise(bars):
        if curr.timestamp <= prev.timestamp:
            raise ValueError(
                "Bars must be ordered by strictly increasing timestamps."
            )

    split_index = int(len(bars) * train_ratio)
    if split_index < 5 or (len(bars) - split_index) < 5:
        raise ValueError(
            "Both train and test sets must contain at least 5 bars."
        )

    in_sample = list(bars[:split_index])
    out_of_sample = list(bars[split_index:])
    return in_sample, out_of_sample


@dataclass(frozen=True)
class WalkForwardWindow:
    window_index: int
    in_sample_start: datetime
    in_sample_end: datetime
    out_of_sample_start: datetime
    out_of_sample_end: datetime
    in_sample_bars_count: int
    out_of_sample_bars_count: int
    best_parameters: dict[str, Any]
    in_sample_metrics: PerformanceMetrics
    out_of_sample_metrics: PerformanceMetrics
    efficiency_ratio: float | None


@dataclass(frozen=True)
class WalkForwardAnalysisResult:
    strategy_name: str
    total_bars: int
    window_mode: str
    windows: list[WalkForwardWindow]
    overall_efficiency: float | None
    stitched_oos_equity_curve: list[float]
    stitched_oos_trades: list[Trade]
    stitched_oos_metrics: PerformanceMetrics | None
    robustness_grade: str
    explanation: str


@dataclass(frozen=True)
class ParameterGridPoint:
    fast_period: int
    slow_period: int
    total_return: float
    total_pnl: float
    final_equity: float
    sharpe_ratio: float | None
    max_drawdown: float
    trades_count: int
    win_rate: float | None
    profit_factor: float | None
    is_plateau: bool = False


@dataclass(frozen=True)
class ParameterHeatmapResult:
    dataset: str
    strategy_name: str
    total_combinations: int
    profitable_combinations: int
    plateau_ratio: float
    stability_verdict: str
    grid: list[ParameterGridPoint] = field(default_factory=list)


def _instantiate_strategy(
    strategy_name: str,
    params: dict[str, Any],
) -> tuple[Strategy, bool]:
    """Helper to instantiate strategy instance and crossover flag."""
    if strategy_name.lower() in ("moving_average", "moving average crossover", "ma"):
        strat = MovingAverageCrossover(
            fast_period=int(params["fast_period"]),
            slow_period=int(params["slow_period"]),
        )
        return strat, True
    if strategy_name.lower() in ("rsi", "relative strength index"):
        strat = RSIStrategy(
            period=int(params["period"]),
            oversold=float(params["oversold"]),
            overbought=float(params["overbought"]),
        )
        return strat, False
    if strategy_name.lower() in ("bollinger", "bollinger_bands", "bollinger bands", "bb"):
        period = int(params.get("period", params.get("bb_period", 20)))
        std_dev = float(
            params.get(
                "std_dev_multiplier",
                params.get("std_dev", params.get("bb_std_dev", 2.0)),
            )
        )
        strat = BollingerBandsStrategy(
            period=period,
            std_dev_multiplier=std_dev,
        )
        return strat, False
    raise ValueError(f"Unsupported strategy '{strategy_name}'.")


def run_walk_forward_optimization(
    bars: Sequence[Bar],
    strategy_name: str = "moving_average",
    candidate_parameters: Sequence[dict[str, Any]] | None = None,
    num_windows: int = 3,
    window_mode: str = "rolling",
    in_sample_ratio: float = 0.65,
    initial_cash: float = 100_000.0,
    commission_rate: float = 0.001,
    slippage_rate: float = 0.001,
    sizing_mode: str = "unit",
    quantity_per_trade: float = 1.0,
    optimization_metric: str = "sharpe_ratio",
) -> WalkForwardAnalysisResult:
    """Execute Walk-Forward Optimization (WFO) to evaluate strategy robustness and detect overfitting."""
    if len(bars) < 30:
        raise ValueError(
            f"Insufficient bars for Walk-Forward Analysis (got {len(bars)}, minimum is 30)."
        )
    if num_windows < 2:
        raise ValueError("num_windows must be at least 2.")
    if window_mode not in ("rolling", "expanding"):
        raise ValueError(
            f"Unsupported window_mode '{window_mode}'. Supported: 'rolling', 'expanding'."
        )

    for prev, curr in pairwise(bars):
        if curr.timestamp <= prev.timestamp:
            raise ValueError(
                "Bars must be ordered by strictly increasing timestamps."
            )

    if candidate_parameters is None:
        if strategy_name.lower() in ("moving_average", "moving average crossover", "ma"):
            candidate_parameters = [
                {"fast_period": 2, "slow_period": 5},
                {"fast_period": 5, "slow_period": 15},
                {"fast_period": 5, "slow_period": 20},
                {"fast_period": 10, "slow_period": 30},
                {"fast_period": 15, "slow_period": 45},
                {"fast_period": 20, "slow_period": 50},
            ]
        elif strategy_name.lower() in ("bollinger", "bollinger_bands", "bollinger bands", "bb"):
            candidate_parameters = [
                {"period": 10, "std_dev_multiplier": 1.5},
                {"period": 10, "std_dev_multiplier": 2.0},
                {"period": 20, "std_dev_multiplier": 1.5},
                {"period": 20, "std_dev_multiplier": 2.0},
                {"period": 20, "std_dev_multiplier": 2.5},
                {"period": 30, "std_dev_multiplier": 2.0},
            ]
        else:
            candidate_parameters = [
                {"period": 7, "oversold": 30.0, "overbought": 70.0},
                {"period": 14, "oversold": 30.0, "overbought": 70.0},
                {"period": 14, "oversold": 25.0, "overbought": 75.0},
                {"period": 21, "oversold": 30.0, "overbought": 70.0},
            ]

    total_bars_count = len(bars)
    step_size = int(total_bars_count / (num_windows + 1))
    if step_size < 10:
        raise ValueError("Dataset too small for the requested number of windows.")

    windows: list[WalkForwardWindow] = []
    stitched_oos_equity: list[float] = [initial_cash]
    stitched_oos_trades: list[Trade] = []
    current_cash = initial_cash

    for w_idx in range(num_windows):
        if window_mode == "expanding":
            is_start_idx = 0
            is_end_idx = int((w_idx + 1) * step_size + (step_size * in_sample_ratio))
        else:  # rolling
            is_start_idx = int(w_idx * step_size)
            is_end_idx = int(is_start_idx + step_size * (1.0 + in_sample_ratio))

        oos_start_idx = is_end_idx
        oos_end_idx = min(total_bars_count, oos_start_idx + step_size)

        if oos_start_idx >= total_bars_count or (oos_end_idx - oos_start_idx) < 5:
            break

        is_bars = bars[is_start_idx:is_end_idx]
        oos_bars = bars[oos_start_idx:oos_end_idx]

        if len(is_bars) < 10 or len(oos_bars) < 5:
            continue

        # In-sample optimization: find parameters that maximize optimization_metric
        best_candidate: dict[str, Any] | None = None
        best_metric_value: float = float("-inf")
        best_is_metrics: PerformanceMetrics | None = None

        for params in candidate_parameters:
            strat, use_crossover = _instantiate_strategy(strategy_name, params)
            bt = Backtest(
                initial_cash=initial_cash,
                strategy=strat,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                use_crossover=use_crossover,
                sizing_mode=sizing_mode,
                quantity_per_trade=quantity_per_trade,
            )
            res = bt.run(is_bars)

            if res.metrics is None:
                continue

            if optimization_metric == "sharpe_ratio":
                score = (
                    res.metrics.sharpe_ratio
                    if res.metrics.sharpe_ratio is not None
                    else -999.0
                )
            elif optimization_metric == "profit_factor":
                score = (
                    res.metrics.profit_factor
                    if res.metrics.profit_factor is not None
                    else 0.0
                )
            else:
                score = res.metrics.total_return

            if score > best_metric_value or best_candidate is None:
                best_metric_value = score
                best_candidate = params
                best_is_metrics = res.metrics

        if best_candidate is None or best_is_metrics is None:
            best_candidate = candidate_parameters[0]
            strat, use_crossover = _instantiate_strategy(
                strategy_name, best_candidate
            )
            res_default = Backtest(
                initial_cash=initial_cash,
                strategy=strat,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                use_crossover=use_crossover,
                sizing_mode=sizing_mode,
                quantity_per_trade=quantity_per_trade,
            ).run(is_bars)
            best_is_metrics = res_default.metrics

        # Out-of-sample forward test with the winning parameters
        strat_oos, use_cross_oos = _instantiate_strategy(
            strategy_name, best_candidate
        )
        bt_oos = Backtest(
            initial_cash=current_cash,
            strategy=strat_oos,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=use_cross_oos,
            sizing_mode=sizing_mode,
            quantity_per_trade=quantity_per_trade,
        )
        res_oos = bt_oos.run(oos_bars)

        # Walk-Forward Efficiency (WFE): OOS return / IS return
        is_ret = best_is_metrics.total_return if best_is_metrics else 0.0
        oos_ret = res_oos.metrics.total_return if res_oos.metrics else 0.0

        if is_ret > 0:
            efficiency = oos_ret / is_ret
        elif is_ret == 0 and oos_ret == 0:
            efficiency = 1.0
        else:
            efficiency = 0.0 if oos_ret <= 0 else 1.0

        windows.append(
            WalkForwardWindow(
                window_index=w_idx + 1,
                in_sample_start=is_bars[0].timestamp,
                in_sample_end=is_bars[-1].timestamp,
                out_of_sample_start=oos_bars[0].timestamp,
                out_of_sample_end=oos_bars[-1].timestamp,
                in_sample_bars_count=len(is_bars),
                out_of_sample_bars_count=len(oos_bars),
                best_parameters=best_candidate,
                in_sample_metrics=best_is_metrics,
                out_of_sample_metrics=res_oos.metrics,
                efficiency_ratio=round(efficiency, 3),
            )
        )

        # Stitch OOS results
        stitched_oos_equity.extend(res_oos.equity_curve)
        stitched_oos_trades.extend(res_oos.trades)
        current_cash = res_oos.final_equity

    # Compute aggregate stitched OOS metrics
    stitched_metrics = (
        calculate_metrics(
            initial_cash=initial_cash,
            equity_curve=stitched_oos_equity,
            trades=stitched_oos_trades,
        )
        if len(stitched_oos_equity) > 1
        else None
    )

    valid_efficiencies = [
        w.efficiency_ratio
        for w in windows
        if w.efficiency_ratio is not None and float("inf") != abs(w.efficiency_ratio)
    ]
    avg_efficiency = (
        sum(valid_efficiencies) / len(valid_efficiencies)
        if valid_efficiencies
        else None
    )

    # Academic Robustness Grading (Pardo / Kaufman standards)
    if avg_efficiency is not None and avg_efficiency >= 0.50 and stitched_metrics and stitched_metrics.total_return > 0:
        grade = "ROBUST (Pass)"
        explanation = (
            f"The strategy achieved an average Walk-Forward Efficiency of {avg_efficiency:.1%}, "
            "retaining significant predictive profitability on unseen out-of-sample data. "
            "Low evidence of curve-fitting."
        )
    elif avg_efficiency is not None and avg_efficiency >= 0.25 and stitched_metrics and stitched_metrics.total_return > 0:
        grade = "MODERATE (Acceptable)"
        explanation = (
            f"The strategy achieved a Walk-Forward Efficiency of {avg_efficiency:.1%}. "
            "It remained net positive out-of-sample, though performance decayed moderately from in-sample optimization."
        )
    else:
        eff_str = f"{avg_efficiency:.1%}" if avg_efficiency is not None else "N/A"
        grade = "OVERFITTED (Caution)"
        explanation = (
            f"The strategy demonstrated low Walk-Forward Efficiency ({eff_str}) or negative out-of-sample return. "
            "In-sample performance was likely driven by curve-fitting historical noise rather than persistent alpha."
        )

    return WalkForwardAnalysisResult(
        strategy_name=strategy_name,
        total_bars=total_bars_count,
        window_mode=window_mode,
        windows=windows,
        overall_efficiency=round(avg_efficiency, 3) if avg_efficiency is not None else None,
        stitched_oos_equity_curve=stitched_oos_equity,
        stitched_oos_trades=stitched_oos_trades,
        stitched_oos_metrics=stitched_metrics,
        robustness_grade=grade,
        explanation=explanation,
    )


def evaluate_parameter_grid_heatmap(
    bars: Sequence[Bar],
    fast_periods: Sequence[int] = (2, 5, 8, 10, 12, 15, 20),
    slow_periods: Sequence[int] = (15, 20, 25, 30, 40, 50, 60),
    initial_cash: float = 100_000.0,
    commission_rate: float = 0.001,
    slippage_rate: float = 0.001,
    sizing_mode: str = "unit",
    quantity_per_trade: float = 1.0,
) -> ParameterHeatmapResult:
    """Evaluate strategy parameter space to detect robust plateaus versus isolated curve-fit spikes."""
    grid_points: list[ParameterGridPoint] = []
    matrix: dict[tuple[int, int], ParameterGridPoint] = {}

    for fast in fast_periods:
        for slow in slow_periods:
            if fast >= slow:
                continue

            strat = MovingAverageCrossover(fast_period=fast, slow_period=slow)
            bt = Backtest(
                initial_cash=initial_cash,
                strategy=strat,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                use_crossover=True,
                sizing_mode=sizing_mode,
                quantity_per_trade=quantity_per_trade,
            )
            res = bt.run(bars)

            pt = ParameterGridPoint(
                fast_period=fast,
                slow_period=slow,
                total_return=res.metrics.total_return if res.metrics else 0.0,
                total_pnl=res.total_pnl,
                final_equity=res.final_equity,
                sharpe_ratio=res.metrics.sharpe_ratio if res.metrics else None,
                max_drawdown=res.metrics.max_drawdown if res.metrics else 0.0,
                trades_count=len(res.trades),
                win_rate=res.metrics.win_rate if res.metrics else None,
                profit_factor=res.metrics.profit_factor if res.metrics else None,
            )
            grid_points.append(pt)
            matrix[(fast, slow)] = pt

    # Plateau analysis: determine what percentage of profitable points have profitable neighbors
    profitable_count = sum(1 for p in grid_points if p.total_return > 0)
    plateau_neighbors_count = 0

    annotated_grid: list[ParameterGridPoint] = []
    for pt in grid_points:
        fast_idx = fast_periods.index(pt.fast_period) if pt.fast_period in fast_periods else -1
        slow_idx = slow_periods.index(pt.slow_period) if pt.slow_period in slow_periods else -1

        # Check adjacent neighbors in grid
        neighbor_keys = [
            (fast_periods[f], slow_periods[s])
            for f in (fast_idx - 1, fast_idx + 1)
            for s in (slow_idx - 1, slow_idx + 1)
            if 0 <= f < len(fast_periods) and 0 <= s < len(slow_periods) and fast_periods[f] < slow_periods[s]
        ]

        if pt.total_return > 0 and neighbor_keys:
            profitable_neighbors = sum(
                1 for k in neighbor_keys if k in matrix and matrix[k].total_return > 0
            )
            is_plateau = (profitable_neighbors / len(neighbor_keys)) >= 0.5
            if is_plateau:
                plateau_neighbors_count += 1
        else:
            is_plateau = False

        annotated_grid.append(
            ParameterGridPoint(
                fast_period=pt.fast_period,
                slow_period=pt.slow_period,
                total_return=pt.total_return,
                total_pnl=pt.total_pnl,
                final_equity=pt.final_equity,
                sharpe_ratio=pt.sharpe_ratio,
                max_drawdown=pt.max_drawdown,
                trades_count=pt.trades_count,
                win_rate=pt.win_rate,
                profit_factor=pt.profit_factor,
                is_plateau=is_plateau,
            )
        )

    plateau_ratio = (
        plateau_neighbors_count / profitable_count if profitable_count > 0 else 0.0
    )

    if plateau_ratio >= 0.60:
        verdict = "STABLE PARAMETER PLATEAU (Robust to parameter shifts)"
    elif plateau_ratio >= 0.30:
        verdict = "MODERATELY SENSITIVE (Some neighbor stability)"
    else:
        verdict = "HIGHLY SENSITIVE / ISOLATED SPIKES (High overfitting risk)"

    return ParameterHeatmapResult(
        dataset="RELIANCE",
        strategy_name="Moving Average Crossover",
        total_combinations=len(grid_points),
        profitable_combinations=profitable_count,
        plateau_ratio=round(plateau_ratio, 3),
        stability_verdict=verdict,
        grid=annotated_grid,
    )
