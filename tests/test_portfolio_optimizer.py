from datetime import UTC, datetime, timedelta

import numpy as np

from quantlab.data.models import Bar
from quantlab.portfolio.basket import AllocationWeighting, BasketBacktestEngine
from quantlab.portfolio.optimizer import (
    extract_returns_and_covariance,
    generate_efficient_frontier,
    project_simplex,
    solve_mean_variance,
)


def test_project_simplex():
    # Empty
    assert len(project_simplex(np.array([]))) == 0

    # Arbitrary vector with negative and positive elements
    v = np.array([0.5, -0.4, 1.2, 0.1])
    proj = project_simplex(v)
    assert np.isclose(np.sum(proj), 1.0)
    assert np.all(proj >= 0.0)


def test_extract_returns_and_covariance():
    now = datetime(2025, 1, 1, tzinfo=UTC)
    bars_a = [
        Bar(timestamp=now + timedelta(days=i), open=100.0 + i, high=102.0 + i, low=99.0 + i, close=100.0 + i, volume=1000.0)
        for i in range(10)
    ]
    bars_b = [
        Bar(timestamp=now + timedelta(days=i), open=50.0 + 2 * i, high=52.0 + 2 * i, low=49.0 + 2 * i, close=50.0 + 2 * i, volume=1000.0)
        for i in range(10)
    ]

    data = {"ASSET_A": bars_a, "ASSET_B": bars_b}
    mu, cov, symbols = extract_returns_and_covariance(["ASSET_A", "ASSET_B"], data)

    assert len(symbols) == 2
    assert len(mu) == 2
    assert cov.shape == (2, 2)
    # Variance of both assets must be positive
    assert cov[0, 0] > 0
    assert cov[1, 1] > 0


def test_solve_mean_variance():
    cov = np.array([[0.04, 0.01], [0.01, 0.09]])
    mu = np.array([0.15, 0.25])

    # Minimum variance (q=0) should favor the lower-variance asset 0 (vol 0.20 vs 0.30)
    w_min = solve_mean_variance(cov, mu, q=0.0)
    assert np.isclose(np.sum(w_min), 1.0)
    assert np.all(w_min >= 0.0)
    assert w_min[0] > w_min[1]

    # High return trade-off (q=10) should favor higher return asset 1
    w_risk = solve_mean_variance(cov, mu, q=10.0)
    assert np.isclose(np.sum(w_risk), 1.0)
    assert w_risk[1] > w_risk[0]


def test_generate_efficient_frontier():
    now = datetime(2025, 1, 1, tzinfo=UTC)
    rng = np.random.default_rng(123)

    # 3 synthetic assets
    bars_map = {}
    for sym, base_price, drift in [("TCS", 100.0, 0.001), ("INFY", 50.0, 0.0015), ("RELIANCE", 200.0, 0.0008)]:
        prices = [base_price]
        for _ in range(30):
            ret = drift + float(rng.normal(0, 0.015))
            prices.append(prices[-1] * (1.0 + ret))
        bars_map[sym] = [
            Bar(timestamp=now + timedelta(days=i), open=p, high=p * 1.01, low=p * 0.99, close=p, volume=1000.0)
            for i, p in enumerate(prices)
        ]

    frontier = generate_efficient_frontier(
        symbols=["TCS", "INFY", "RELIANCE"],
        data=bars_map,
        num_points=15,
        num_simulations=100,
        risk_free_rate=0.05,
        seed=42,
    )

    assert len(frontier.symbols) == 3
    assert len(frontier.frontier_curve) >= 5
    assert len(frontier.simulated_portfolios) == 100

    # Max Sharpe vs Min Variance
    assert frontier.max_sharpe.sharpe_ratio >= frontier.min_variance.sharpe_ratio
    assert frontier.min_variance.volatility <= frontier.max_sharpe.volatility

    # Curve must be sorted by volatility
    vols = [p.volatility for p in frontier.frontier_curve]
    assert vols == sorted(vols)


def test_basket_engine_mpt_weighting():
    now = datetime(2025, 1, 1, tzinfo=UTC)
    bars_map = {
        "A": [Bar(timestamp=now + timedelta(days=i), open=100.0 + i, high=102.0 + i, low=99.0 + i, close=100.0 + i, volume=1000.0) for i in range(15)],
        "B": [Bar(timestamp=now + timedelta(days=i), open=50.0 + 2 * i, high=52.0 + 2 * i, low=49.0 + 2 * i, close=50.0 + 2 * i, volume=1000.0) for i in range(15)],
    }

    # Max Sharpe weighting execution
    engine_ms = BasketBacktestEngine(
        initial_cash=50_000.0,
        weighting=AllocationWeighting.MAX_SHARPE,
    )
    result_ms = engine_ms.run(bars_map)
    assert result_ms.final_equity > 0
    assert np.isclose(sum(result_ms.asset_weights.values()), 1.0)

    # Min Variance weighting execution
    engine_mv = BasketBacktestEngine(
        initial_cash=50_000.0,
        weighting=AllocationWeighting.MIN_VARIANCE,
    )
    result_mv = engine_mv.run(bars_map)
    assert result_mv.final_equity > 0
    assert np.isclose(sum(result_mv.asset_weights.values()), 1.0)
