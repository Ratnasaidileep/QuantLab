from datetime import UTC, datetime, timedelta

import numpy as np

from quantlab.analytics.tear_sheet import (
    calculate_annualized_volatility,
    calculate_cvar,
    calculate_historical_var,
    calculate_kurtosis,
    calculate_monthly_returns_matrix,
    calculate_parametric_var,
    calculate_skewness,
    calculate_tail_ratio,
    calculate_underwater_series,
    generate_tear_sheet,
    generate_tear_sheet_markdown_report,
)
from quantlab.backtest.models import Trade, TradeSide
from quantlab.data.models import Bar


def make_bar(close: float, day: int) -> Bar:
    return Bar(
        timestamp=datetime(2025, 1, 1, tzinfo=UTC) + timedelta(days=day),
        open=close,
        high=close,
        low=close,
        close=close,
        volume=1000.0,
    )


def test_var_historical_and_parametric_basic():
    # Normal distribution with mean 0, std 0.01
    np.random.seed(42)
    returns = list(np.random.normal(loc=0.0005, scale=0.01, size=1000))

    var_95_hist = calculate_historical_var(returns, confidence=0.95)
    var_95_param = calculate_parametric_var(returns, confidence=0.95)

    assert var_95_hist is not None
    assert var_95_param is not None
    assert var_95_hist > 0.0
    assert var_95_param > 0.0
    # Both should be around 1.6% (0.016)
    assert abs(var_95_hist - 0.016) < 0.005
    assert abs(var_95_param - 0.016) < 0.005


def test_var_99_higher_than_var_95():
    returns = [-0.05, -0.03, -0.02, -0.01, 0.0, 0.01, 0.02, 0.03, 0.04, 0.05] * 20
    var_95 = calculate_historical_var(returns, confidence=0.95)
    var_99 = calculate_historical_var(returns, confidence=0.99)

    assert var_95 is not None
    assert var_99 is not None
    assert var_99 >= var_95


def test_cvar_greater_than_or_equal_to_var():
    # CVaR (Expected Shortfall) must be >= VaR
    returns = [-0.10, -0.06, -0.04, -0.02, -0.01, 0.0, 0.01, 0.02, 0.03, 0.04] * 20
    var_95 = calculate_historical_var(returns, confidence=0.95)
    cvar_95 = calculate_cvar(returns, confidence=0.95)

    assert var_95 is not None
    assert cvar_95 is not None
    assert cvar_95 >= var_95


def test_tail_ratio():
    # Symmetrical returns
    returns = [-0.02, -0.01, 0.0, 0.01, 0.02] * 20
    tr = calculate_tail_ratio(returns)
    assert tr is not None
    assert abs(tr - 1.0) < 0.05


def test_skewness_and_kurtosis():
    np.random.seed(42)
    # Standard normal returns: skewness ~ 0, excess kurtosis ~ 0
    normal_returns = list(np.random.normal(loc=0.0, scale=0.01, size=2000))
    skew = calculate_skewness(normal_returns)
    kurt = calculate_kurtosis(normal_returns)

    assert skew is not None
    assert kurt is not None
    assert abs(skew) < 0.2
    assert abs(kurt) < 0.3


def test_annualized_volatility():
    # Constant daily returns of 1% has 0 std dev
    const_returns = [0.01] * 50
    vol_zero = calculate_annualized_volatility(const_returns)
    assert vol_zero == 0.0

    # 1% daily std dev -> ~ 1% * sqrt(252) = 15.87%
    np.random.seed(42)
    rets = list(np.random.normal(loc=0.0, scale=0.01, size=1000))
    vol = calculate_annualized_volatility(rets)
    assert vol is not None
    assert abs(vol - 0.1587) < 0.015


def test_underwater_series():
    equity = [100.0, 110.0, 99.0, 110.0, 88.0]
    underwater = calculate_underwater_series(equity)
    assert len(underwater) == 5
    assert underwater[0] == 0.0
    assert underwater[1] == 0.0
    assert abs(underwater[2] - (-0.10)) < 1e-4  # (99 - 110) / 110 = -10%
    assert underwater[3] == 0.0
    assert abs(underwater[4] - (-0.20)) < 1e-4  # (88 - 110) / 110 = -20%


def test_monthly_returns_matrix():
    # Create equity points spanning Jan, Feb, Mar 2025
    equity_points = [
        (datetime(2025, 1, 2, tzinfo=UTC), 100_000.0),
        (datetime(2025, 1, 15, tzinfo=UTC), 105_000.0),
        (datetime(2025, 1, 31, tzinfo=UTC), 110_000.0),  # Jan +10%
        (datetime(2025, 2, 14, tzinfo=UTC), 104_500.0),
        (datetime(2025, 2, 28, tzinfo=UTC), 99_000.0),   # Feb: 99k / 110k - 1 = -10%
        (datetime(2025, 3, 15, tzinfo=UTC), 100_000.0),
        (datetime(2025, 3, 31, tzinfo=UTC), 108_900.0),  # Mar: 108.9k / 99k - 1 = +10%
    ]

    matrix = calculate_monthly_returns_matrix(equity_points)
    assert len(matrix) == 1
    row = matrix[0]
    assert row.year == 2025
    assert row.months["Jan"] is not None and abs(row.months["Jan"] - 0.10) < 1e-3
    assert row.months["Feb"] is not None and abs(row.months["Feb"] - (-0.10)) < 1e-3
    assert row.months["Mar"] is not None and abs(row.months["Mar"] - 0.10) < 1e-3
    assert row.months["Apr"] is None
    # Year total: 108,900 / 100,000 - 1 = 8.9%
    assert abs(row.year_total - 0.089) < 1e-3


def test_generate_tear_sheet_end_to_end():
    bars = [make_bar(100.0 + i, i) for i in range(30)]
    equity_curve = [100_000.0 * (1.0 + 0.001 * i) for i in range(30)]
    trades = [
        Trade(
            timestamp=datetime(2025, 1, 5, tzinfo=UTC),
            side=TradeSide.BUY,
            price=105.0,
            quantity=10.0,
            commission=1.0,
        )
    ]

    sheet = generate_tear_sheet(
        bars=bars,
        equity_curve=equity_curve,
        trades=trades,
        initial_cash=100_000.0,
    )

    assert sheet.summary.total_return > 0
    assert sheet.tail_risk.var_95_historical is not None
    assert sheet.tail_risk.calmar_ratio is not None
    assert len(sheet.monthly_matrix) >= 1
    assert len(sheet.underwater_curve) == 30

    report = generate_tear_sheet_markdown_report(
        data=sheet,
        strategy_name="Moving Average Crossover",
        configuration="Fast 10 / Slow 30",
        dataset_name="reliance_daily.csv",
    )

    assert "# QuantLab Quantitative Research Tear-Sheet — Moving Average Crossover" in report
    assert "Fast 10 / Slow 30" in report
    assert "Historical VaR (95%)" in report
    assert "Expected Shortfall" in report
    assert "Calendar Monthly Returns Matrix" in report
    assert "Disclaimer" in report
