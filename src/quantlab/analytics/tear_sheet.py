import math
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime

import numpy as np

from quantlab.analytics.metrics import (
    PerformanceMetrics,
    calculate_calmar_ratio,
    calculate_daily_returns,
    calculate_metrics,
)
from quantlab.backtest.models import Trade
from quantlab.data.models import Bar

MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]


@dataclass(frozen=True)
class TailRiskMetrics:
    var_95_historical: float | None
    var_95_parametric: float | None
    var_99_historical: float | None
    var_99_parametric: float | None
    cvar_95: float | None
    cvar_99: float | None
    tail_ratio: float | None
    skewness: float | None
    kurtosis: float | None
    annualized_volatility: float | None
    calmar_ratio: float | None


@dataclass(frozen=True)
class YearlyReturnMatrixRow:
    year: int
    months: dict[str, float | None]
    year_total: float


@dataclass(frozen=True)
class UnderwaterPoint:
    timestamp: datetime
    drawdown: float


@dataclass(frozen=True)
class TearSheetData:
    summary: PerformanceMetrics
    tail_risk: TailRiskMetrics
    monthly_matrix: list[YearlyReturnMatrixRow] = field(default_factory=list)
    underwater_curve: list[UnderwaterPoint] = field(default_factory=list)


def _approximate_inverse_normal(p: float) -> float:
    """Acklam's rational approximation for the inverse cumulative normal distribution function."""
    if p <= 0.0 or p >= 1.0:
        raise ValueError("Probability p must be strictly between 0 and 1.")

    # Standard exact lookup for common quantiles
    if abs(p - 0.95) < 1e-4:
        return 1.6448536269514722
    if abs(p - 0.99) < 1e-4:
        return 2.3263478740408408
    if abs(p - 0.975) < 1e-4:
        return 1.959963984540054
    if abs(p - 0.90) < 1e-4:
        return 1.2815515655446004

    # Coefficients in rational approximations
    a = [
        -3.969683028665376e01, 2.209460984245205e02,
        -2.759285104469687e02, 1.383577518672690e02,
        -3.066479806614716e01, 2.506628277459239e00,
    ]
    b = [
        -5.447609879822406e01, 1.615858368580409e02,
        -1.556989798598866e02, 6.680131188771972e01,
        -1.328068155288572e01,
    ]
    c = [
        -7.784894002430293e-03, -3.223964580411365e-01,
        -2.400758277161838e00, -2.549732539343734e00,
        4.374664141464968e00, 2.938163982698783e00,
    ]
    d = [
        7.784695709041462e-03, 3.224671290700398e-01,
        2.445134137142996e00, 3.754408661907416e00,
    ]

    q = min(p, 1.0 - p)
    if q > 0.02425:
        r = q - 0.5
        r2 = r * r
        x = (((((a[0] * r2 + a[1]) * r2 + a[2]) * r2 + a[3]) * r2 + a[4]) * r2 + a[5]) * r / \
            (((((b[0] * r2 + b[1]) * r2 + b[2]) * r2 + b[3]) * r2 + b[4]) * r2 + 1.0)
    else:
        r = math.sqrt(-2.0 * math.log(q))
        x = (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / \
            ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1.0)

    return x if p > 0.5 else -x


def calculate_historical_var(
    returns: Sequence[float],
    confidence: float = 0.95,
) -> float | None:
    """Calculate Historical Value-at-Risk (VaR) expressed as a positive loss fraction.

    e.g. A return quantile of -0.025 at 95% confidence yields VaR = 0.025 (2.5% loss).
    """
    if len(returns) < 5 or not (0.0 < confidence < 1.0):
        return None

    quantile_level = 100.0 * (1.0 - confidence)
    loss_quantile = float(np.percentile(returns, quantile_level))
    return -loss_quantile


def calculate_parametric_var(
    returns: Sequence[float],
    confidence: float = 0.95,
) -> float | None:
    """Calculate Parametric (Gaussian) Value-at-Risk: -(mean - z * std)."""
    if len(returns) < 5 or not (0.0 < confidence < 1.0):
        return None

    mean = float(np.mean(returns))
    std = float(np.std(returns, ddof=1))
    if std == 0.0:
        return 0.0

    z = _approximate_inverse_normal(confidence)
    return -(mean - z * std)


def calculate_cvar(
    returns: Sequence[float],
    confidence: float = 0.95,
) -> float | None:
    """Calculate Conditional Value-at-Risk (CVaR) / Expected Shortfall.

    Measures the expected (mean) loss strictly within the worst (1 - confidence) tail.
    """
    if len(returns) < 5 or not (0.0 < confidence < 1.0):
        return None

    quantile_level = 100.0 * (1.0 - confidence)
    threshold = float(np.percentile(returns, quantile_level))
    tail_returns = [r for r in returns if r <= threshold]

    if not tail_returns:
        tail_returns = [threshold]

    mean_tail_loss = -float(np.mean(tail_returns))
    return mean_tail_loss


def calculate_tail_ratio(returns: Sequence[float]) -> float | None:
    """Calculate Tail Ratio (95th percentile gain / abs(5th percentile loss))."""
    if len(returns) < 5:
        return None

    p95 = float(np.percentile(returns, 95.0))
    p5 = float(np.percentile(returns, 5.0))

    if p5 == 0.0:
        return float("inf") if p95 > 0.0 else 0.0

    return abs(p95) / abs(p5)


def calculate_skewness(returns: Sequence[float]) -> float | None:
    """Calculate Fisher-Pearson standardized sample skewness of the return distribution."""
    n = len(returns)
    if n < 3:
        return None

    mean = float(np.mean(returns))
    std = float(np.std(returns, ddof=1))
    if std == 0.0:
        return 0.0

    m3 = float(np.mean([(r - mean) ** 3 for r in returns]))
    skewness = (math.sqrt(n * (n - 1)) / (n - 2)) * (m3 / (std ** 3))
    return skewness


def calculate_kurtosis(returns: Sequence[float]) -> float | None:
    """Calculate Fisher sample excess kurtosis (normal distribution = 0.0)."""
    n = len(returns)
    if n < 4:
        return None

    mean = float(np.mean(returns))
    var = float(np.var(returns, ddof=1))
    if var == 0.0:
        return 0.0

    m4 = float(np.mean([(r - mean) ** 4 for r in returns]))
    excess_kurt = (m4 / (var ** 2)) - 3.0
    return excess_kurt


def calculate_annualized_volatility(
    returns: Sequence[float],
    periods_per_year: int = 252,
) -> float | None:
    """Calculate annualized standard deviation of period returns."""
    if len(returns) < 2:
        return None

    std = float(np.std(returns, ddof=1))
    return std * math.sqrt(periods_per_year)


def calculate_underwater_series(equity_curve: Sequence[float]) -> list[float]:
    """Calculate underwater drawdown series (drawdown from peak, expressed as <= 0.0)."""
    if not equity_curve:
        return []

    underwater: list[float] = []
    peak = equity_curve[0]

    for val in equity_curve:
        peak = max(peak, val)
        if peak > 0:
            dd = (val - peak) / peak
            underwater.append(dd)
        else:
            underwater.append(0.0)

    return underwater


def calculate_monthly_returns_matrix(
    equity_points: Sequence[tuple[datetime, float]],
) -> list[YearlyReturnMatrixRow]:
    """Compute calendar monthly and annual compound returns matrix.

    Groups timestamped equity points by Year and Month, calculating:
      R_month = (E_end_month / E_start_month) - 1
      R_year  = (E_end_year / E_start_year) - 1
    """
    if not equity_points:
        return []

    # Sort chronological
    sorted_points = sorted(equity_points, key=lambda p: p[0])

    # Group equity points by year
    by_year: dict[int, list[tuple[datetime, float]]] = defaultdict(list)
    for dt, eq in sorted_points:
        by_year[dt.year].append((dt, eq))

    matrix_rows: list[YearlyReturnMatrixRow] = []

    # Keep track of previous month's final equity to chain month-over-month cleanly
    prev_month_end_equity: float | None = None

    for year in sorted(by_year.keys()):
        year_points = by_year[year]
        year_start_equity = prev_month_end_equity if prev_month_end_equity is not None else year_points[0][1]
        year_end_equity = year_points[-1][1]

        # Group by month index (1..12)
        by_month: dict[int, list[float]] = defaultdict(list)
        for dt, eq in year_points:
            by_month[dt.month].append(eq)

        months_dict: dict[str, float | None] = {name: None for name in MONTH_NAMES}

        for m_idx in range(1, 13):
            month_name = MONTH_NAMES[m_idx - 1]
            if m_idx in by_month:
                pts = by_month[m_idx]
                m_start = prev_month_end_equity if prev_month_end_equity is not None else pts[0]
                m_end = pts[-1]
                if m_start > 0:
                    months_dict[month_name] = (m_end - m_start) / m_start
                else:
                    months_dict[month_name] = 0.0
                prev_month_end_equity = m_end

        year_total = (
            (year_end_equity - year_start_equity) / year_start_equity
            if year_start_equity > 0
            else 0.0
        )

        matrix_rows.append(
            YearlyReturnMatrixRow(
                year=year,
                months=months_dict,
                year_total=year_total,
            )
        )

    return matrix_rows


def generate_tear_sheet(
    bars: Sequence[Bar],
    equity_curve: Sequence[float],
    trades: Sequence[Trade] | None = None,
    initial_cash: float = 100_000.0,
    risk_free_rate: float = 0.05,
    periods_per_year: int = 252,
) -> TearSheetData:
    """Generate a comprehensive quantitative tear-sheet combining baseline metrics,

    tail risk diagnostics, monthly/annual returns calendar, and underwater drawdown series.
    """
    summary = calculate_metrics(
        initial_cash=initial_cash,
        equity_curve=equity_curve,
        trades=trades,
        risk_free_rate=risk_free_rate,
        periods_per_year=periods_per_year,
    )

    daily_returns = calculate_daily_returns(equity_curve)

    var_95_hist = calculate_historical_var(daily_returns, confidence=0.95)
    var_95_param = calculate_parametric_var(daily_returns, confidence=0.95)
    var_99_hist = calculate_historical_var(daily_returns, confidence=0.99)
    var_99_param = calculate_parametric_var(daily_returns, confidence=0.99)
    cvar_95 = calculate_cvar(daily_returns, confidence=0.95)
    cvar_99 = calculate_cvar(daily_returns, confidence=0.99)
    tail_ratio = calculate_tail_ratio(daily_returns)
    skewness = calculate_skewness(daily_returns)
    kurtosis = calculate_kurtosis(daily_returns)
    ann_vol = calculate_annualized_volatility(daily_returns, periods_per_year=periods_per_year)
    calmar = calculate_calmar_ratio(summary.cagr, summary.max_drawdown)

    tail_risk = TailRiskMetrics(
        var_95_historical=var_95_hist,
        var_95_parametric=var_95_param,
        var_99_historical=var_99_hist,
        var_99_parametric=var_99_param,
        cvar_95=cvar_95,
        cvar_99=cvar_99,
        tail_ratio=tail_ratio,
        skewness=skewness,
        kurtosis=kurtosis,
        annualized_volatility=ann_vol,
        calmar_ratio=calmar,
    )

    # Monthly returns matrix
    equity_points = [
        (bar.timestamp, eq) for bar, eq in zip(bars, equity_curve)
    ]
    monthly_matrix = calculate_monthly_returns_matrix(equity_points)

    # Underwater series
    raw_underwater = calculate_underwater_series(equity_curve)
    underwater_curve = [
        UnderwaterPoint(timestamp=bar.timestamp, drawdown=dd)
        for bar, dd in zip(bars, raw_underwater)
    ]

    return TearSheetData(
        summary=summary,
        tail_risk=tail_risk,
        monthly_matrix=monthly_matrix,
        underwater_curve=underwater_curve,
    )


def generate_tear_sheet_markdown_report(
    data: TearSheetData,
    strategy_name: str,
    configuration: str,
    dataset_name: str,
) -> str:
    """Generate a clean, structured Markdown research report from a TearSheetData instance."""
    s = data.summary
    t = data.tail_risk

    def _fmt_pct(val: float | None, digits: int = 2) -> str:
        if val is None or math.isnan(val):
            return "N/A"
        return f"{val * 100:.{digits}f}%"

    def _fmt_num(val: float | None, digits: int = 2) -> str:
        if val is None or math.isnan(val):
            return "N/A"
        return f"{val:.{digits}f}"

    lines = [
        f"# QuantLab Quantitative Research Tear-Sheet — {strategy_name}",
        "",
        "## Executive Summary",
        f"- **Strategy:** {strategy_name}",
        f"- **Configuration:** {configuration}",
        f"- **Dataset:** {dataset_name}",
        f"- **Total Return:** {_fmt_pct(s.total_return)}",
        f"- **CAGR:** {_fmt_pct(s.cagr)}",
        f"- **Max Drawdown:** {_fmt_pct(s.max_drawdown)}",
        f"- **Sharpe Ratio (Rf=5%):** {_fmt_num(s.sharpe_ratio)}",
        f"- **Sortino Ratio:** {_fmt_num(s.sortino_ratio)}",
        f"- **Calmar Ratio:** {_fmt_num(s.calmar_ratio)}",
        f"- **Win Rate:** {_fmt_pct(s.win_rate, 1)}",
        f"- **Profit Factor:** {_fmt_num(s.profit_factor)}",
        f"- **Total Trades:** {s.total_trades}",
        "",
        "## Tail Risk & Extreme Loss Diagnostics",
        f"- **Historical VaR (95%):** {_fmt_pct(t.var_95_historical)}",
        f"- **Parametric VaR (95%):** {_fmt_pct(t.var_95_parametric)}",
        f"- **Historical VaR (99%):** {_fmt_pct(t.var_99_historical)}",
        f"- **Parametric VaR (99%):** {_fmt_pct(t.var_99_parametric)}",
        f"- **Expected Shortfall (CVaR 95%):** {_fmt_pct(t.cvar_95)}",
        f"- **Expected Shortfall (CVaR 99%):** {_fmt_pct(t.cvar_99)}",
        f"- **Annualized Volatility:** {_fmt_pct(t.annualized_volatility)}",
        f"- **Skewness:** {_fmt_num(t.skewness)}",
        f"- **Excess Kurtosis:** {_fmt_num(t.kurtosis)}",
        f"- **Tail Ratio:** {_fmt_num(t.tail_ratio)}",
        "",
        "## Calendar Monthly Returns Matrix",
        "| Year | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct | Nov | Dec | Year Total |",
        "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ]

    for row in data.monthly_matrix:
        cells = [str(row.year)]
        for m in MONTH_NAMES:
            m_val = row.months.get(m)
            cells.append(_fmt_pct(m_val, 1) if m_val is not None else "-")
        cells.append(_fmt_pct(row.year_total, 1))
        lines.append("| " + " | ".join(cells) + " |")

    lines.extend([
        "",
        "---",
        "*Disclaimer: Backtest simulation results are for research and educational purposes only. Past performance does not guarantee future results. Zero look-ahead bias and next-bar open execution friction enforced by QuantLab engine.*",
    ])

    return "\n".join(lines)

