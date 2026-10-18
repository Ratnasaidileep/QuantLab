import math
from collections.abc import Sequence
from dataclasses import dataclass, field

import numpy as np

from quantlab.analytics.metrics import calculate_trade_pnl
from quantlab.backtest.models import Trade


@dataclass(frozen=True)
class MonteCarloPoint:
    step: int
    p5: float
    p25: float
    p50: float
    p75: float
    p95: float


@dataclass(frozen=True)
class DrawdownHistogramBin:
    bin_start: float
    bin_end: float
    count: int
    percentage: float


@dataclass(frozen=True)
class MonteCarloSummary:
    simulations_count: int
    trades_resampled: int
    ruin_threshold: float
    probability_of_ruin: float
    median_max_drawdown: float
    p95_max_drawdown: float
    p5_max_drawdown: float
    median_terminal_equity: float
    p5_terminal_equity: float
    p95_terminal_equity: float


@dataclass(frozen=True)
class MonteCarloResult:
    summary: MonteCarloSummary
    confidence_cone: list[MonteCarloPoint] = field(default_factory=list)
    drawdown_histogram: list[DrawdownHistogramBin] = field(default_factory=list)


def run_monte_carlo_simulation(
    initial_cash: float,
    trades: Sequence[Trade],
    num_simulations: int = 1000,
    ruin_drawdown_pct: float = 0.25,
    mode: str = "trade_shuffle",
    seed: int | None = None,
    max_cone_points: int = 100,
) -> MonteCarloResult:
    """Run Monte Carlo simulation over historical trades.

    Args:
        initial_cash: Starting portfolio cash.
        trades: Closed executed trades from a backtest.
        num_simulations: Number of synthetic paths to simulate (100 to 5000).
        ruin_drawdown_pct: Drawdown threshold for ruin probability (0.05 to 0.90).
        mode: Resampling method ('trade_shuffle' or 'bootstrap').
        seed: Optional RNG seed for deterministic reproduction.
        max_cone_points: Maximum number of steps sampled for frontend visualization.

    Returns:
        MonteCarloResult containing summary statistics, percentile confidence cone,
        and drawdown distribution histogram.
    """
    if initial_cash <= 0:
        raise ValueError("Initial cash must be strictly positive for Monte Carlo simulation.")

    if num_simulations < 10 or num_simulations > 10000:
        raise ValueError("Number of simulations must be between 10 and 10,000.")

    if ruin_drawdown_pct <= 0.0 or ruin_drawdown_pct >= 1.0:
        raise ValueError("ruin_drawdown_pct must be between 0.01 and 0.99.")

    if mode not in ("trade_shuffle", "bootstrap"):
        raise ValueError(
            f"Unsupported Monte Carlo mode '{mode}'. Choose 'trade_shuffle' or 'bootstrap'."
        )

    trade_pnls = calculate_trade_pnl(trades)
    if len(trade_pnls) < 2:
        raise ValueError(
            "Monte Carlo simulation requires at least 2 closed trades to resample."
        )

    rng = np.random.default_rng(seed)
    pnl_array = np.asarray(trade_pnls, dtype=np.float64)
    n_trades = len(pnl_array)

    if mode == "trade_shuffle":
        # Generate independent permutations across rows
        permutation_indices = np.argsort(rng.random((num_simulations, n_trades)), axis=1)
        pnl_matrix = np.take(pnl_array, permutation_indices)
    else:  # bootstrap
        pnl_matrix = rng.choice(pnl_array, size=(num_simulations, n_trades), replace=True)

    # Compute equity paths starting at initial_cash
    cum_pnls = np.cumsum(pnl_matrix, axis=1)
    initial_col = np.full((num_simulations, 1), initial_cash, dtype=np.float64)
    equity_paths = np.hstack([initial_col, initial_cash + cum_pnls])
    equity_paths = np.maximum(equity_paths, 0.0)

    # Calculate Drawdown series for each simulation path
    running_peaks = np.maximum.accumulate(equity_paths, axis=1)
    safe_peaks = np.where(running_peaks > 0.0, running_peaks, 1.0)
    drawdowns = (safe_peaks - equity_paths) / safe_peaks
    max_drawdowns = np.max(drawdowns, axis=1)

    # Terminal equity
    terminal_equities = equity_paths[:, -1]

    # Probability of Ruin
    ruined_count = int(np.sum(max_drawdowns >= ruin_drawdown_pct))
    prob_ruin = float(ruined_count / num_simulations)

    # Summary Statistics
    summary = MonteCarloSummary(
        simulations_count=num_simulations,
        trades_resampled=n_trades,
        ruin_threshold=ruin_drawdown_pct,
        probability_of_ruin=prob_ruin,
        median_max_drawdown=float(np.median(max_drawdowns)),
        p95_max_drawdown=float(np.percentile(max_drawdowns, 95)),
        p5_max_drawdown=float(np.percentile(max_drawdowns, 5)),
        median_terminal_equity=float(np.median(terminal_equities)),
        p5_terminal_equity=float(np.percentile(terminal_equities, 5)),
        p95_terminal_equity=float(np.percentile(terminal_equities, 95)),
    )

    # Build Percentile Confidence Cone (downsample steps if n_trades > max_cone_points)
    total_steps = n_trades + 1
    if total_steps <= max_cone_points:
        sampled_indices = list(range(total_steps))
    else:
        sampled_indices = sorted(
            {int(idx) for idx in np.linspace(0, total_steps - 1, max_cone_points)}
        )

    confidence_cone: list[MonteCarloPoint] = []
    for step_idx in sampled_indices:
        col = equity_paths[:, step_idx]
        confidence_cone.append(
            MonteCarloPoint(
                step=step_idx,
                p5=float(np.percentile(col, 5)),
                p25=float(np.percentile(col, 25)),
                p50=float(np.percentile(col, 50)),
                p75=float(np.percentile(col, 75)),
                p95=float(np.percentile(col, 95)),
            )
        )

    # Build Max Drawdown Histogram (10 bins)
    max_dd_val = max(0.10, float(np.max(max_drawdowns)))
    counts, bin_edges = np.histogram(
        max_drawdowns, bins=10, range=(0.0, min(1.0, math.ceil(max_dd_val * 10) / 10))
    )
    histogram_bins: list[DrawdownHistogramBin] = []
    for i in range(len(counts)):
        histogram_bins.append(
            DrawdownHistogramBin(
                bin_start=float(bin_edges[i]),
                bin_end=float(bin_edges[i + 1]),
                count=int(counts[i]),
                percentage=float(counts[i] / num_simulations),
            )
        )

    return MonteCarloResult(
        summary=summary,
        confidence_cone=confidence_cone,
        drawdown_histogram=histogram_bins,
    )
