"""Modern Portfolio Theory (MPT) & Markowitz Efficient Frontier Optimization.

Provides:
- Exact long-only simplex projection algorithm for convex quadratic portfolio optimization.
- Global Minimum Variance portfolio optimization.
- Tangency / Maximum Sharpe Ratio portfolio optimization.
- Markowitz Efficient Frontier curve generation.
- Monte Carlo random portfolio simulation cloud for visual risk-return dispersion.
"""

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from quantlab.data.models import Bar


def project_simplex(v: np.ndarray, z: float = 1.0) -> np.ndarray:
    """Project vector v onto the probability simplex {w >= 0, sum(w) = z} in O(N log N) time."""
    n = len(v)
    if n == 0:
        return v
    u = np.sort(v)[::-1]
    cssv = np.cumsum(u) - z
    ind = np.arange(1, n + 1)
    cond = u - cssv / ind > 0
    if not np.any(cond):
        return np.ones(n) / n
    rho = ind[cond][-1]
    theta = cssv[cond][-1] / float(rho)
    return np.maximum(v - theta, 0.0)


def extract_returns_and_covariance(
    symbols: list[str],
    data: dict[str, Sequence[Bar]],
    periods_per_year: int = 252,
) -> tuple[np.ndarray, np.ndarray, list[str]]:
    """Extract annualized expected returns and covariance matrix from aligned closing prices."""
    valid_symbols = [s for s in symbols if s in data and len(data[s]) >= 5]
    if len(valid_symbols) < 2:
        raise ValueError("At least 2 assets with >= 5 bars are required for portfolio optimization.")

    # Align closing prices on common dates
    dates_map: dict[str, dict[Any, float]] = {}
    for s in valid_symbols:
        dates_map[s] = {b.timestamp: float(b.close) for b in data[s]}

    common_dates = sorted(set.intersection(*[set(dates_map[s].keys()) for s in valid_symbols]))
    if len(common_dates) < 5:
        # Fallback to shortest series truncation if timestamps do not strictly intersect
        min_len = min(len(data[s]) for s in valid_symbols)
        price_matrix = np.array([[float(b.close) for b in data[s][-min_len:]] for s in valid_symbols])
    else:
        price_matrix = np.array([[dates_map[s][d] for d in common_dates] for s in valid_symbols])

    # Daily percentage returns: shape (N, T - 1)
    returns_matrix = np.diff(price_matrix, axis=1) / price_matrix[:, :-1]

    # Annualized mean returns and covariance
    mean_daily = np.mean(returns_matrix, axis=1)
    annualized_returns = mean_daily * periods_per_year
    cov_matrix = np.cov(returns_matrix) * periods_per_year

    # Ensure covariance matrix is 2D even if 1x1
    cov_matrix = np.atleast_2d(cov_matrix)

    return annualized_returns, cov_matrix, valid_symbols


def compute_portfolio_stats(
    weights: np.ndarray,
    mean_returns: np.ndarray,
    cov_matrix: np.ndarray,
    risk_free_rate: float = 0.05,
) -> tuple[float, float, float]:
    """Compute (expected_return, volatility, sharpe_ratio) for a given weight vector."""
    w = np.asarray(weights, dtype=float)
    exp_return = float(np.dot(w, mean_returns))
    variance = float(np.dot(w, np.dot(cov_matrix, w)))
    volatility = float(np.sqrt(max(variance, 1e-12)))
    sharpe = float((exp_return - risk_free_rate) / volatility) if volatility > 0 else 0.0
    return exp_return, volatility, sharpe


def solve_mean_variance(
    cov_matrix: np.ndarray,
    mean_returns: np.ndarray,
    q: float,
    max_iter: int = 500,
    lr: float = 0.05,
) -> np.ndarray:
    """Solve min 0.5 * w^T Sigma w - q * mu^T w subject to w >= 0, sum(w) = 1."""
    n = len(mean_returns)
    w = np.ones(n) / n
    # Adaptive learning rate based on spectral norm of cov_matrix
    eig_max = np.linalg.norm(cov_matrix, 2)
    step = min(lr, 1.0 / (eig_max + 1e-4))

    for _ in range(max_iter):
        grad = np.dot(cov_matrix, w) - q * mean_returns
        w_next = project_simplex(w - step * grad)
        if np.max(np.abs(w_next - w)) < 1e-6:
            break
        w = w_next

    # Clean small floating point precision residues
    w[w < 1e-5] = 0.0
    s = np.sum(w)
    return w / s if s > 0 else np.ones(n) / n


@dataclass(frozen=True)
class PortfolioPoint:
    expected_return: float
    volatility: float
    sharpe_ratio: float
    weights: dict[str, float] = field(default_factory=dict)


@dataclass(frozen=True)
class EfficientFrontierResult:
    symbols: list[str]
    frontier_curve: list[PortfolioPoint]
    simulated_portfolios: list[PortfolioPoint]
    max_sharpe: PortfolioPoint
    min_variance: PortfolioPoint
    equal_weight: PortfolioPoint
    inverse_volatility: PortfolioPoint
    annualized_returns: dict[str, float]
    annualized_volatilities: dict[str, float]


def generate_efficient_frontier(
    symbols: list[str],
    data: dict[str, Sequence[Bar]],
    num_points: int = 30,
    num_simulations: int = 1000,
    risk_free_rate: float = 0.05,
    seed: int = 42,
) -> EfficientFrontierResult:
    """Compute the Markowitz Efficient Frontier, Max Sharpe, Min Volatility, and Monte Carlo cloud."""
    mu, cov, valid_symbols = extract_returns_and_covariance(symbols, data)
    n = len(valid_symbols)

    # 1. Benchmark Portfolios
    # Equal Weight
    w_eq = np.ones(n) / n
    ret_eq, vol_eq, sr_eq = compute_portfolio_stats(w_eq, mu, cov, risk_free_rate)
    pt_equal_weight = PortfolioPoint(
        expected_return=ret_eq,
        volatility=vol_eq,
        sharpe_ratio=sr_eq,
        weights={valid_symbols[i]: float(w_eq[i]) for i in range(n)},
    )

    # Inverse Volatility (Risk Parity approximation)
    diag_vols = np.sqrt(np.diag(cov))
    inv_v = 1.0 / np.maximum(diag_vols, 1e-6)
    w_iv = inv_v / np.sum(inv_v)
    ret_iv, vol_iv, sr_iv = compute_portfolio_stats(w_iv, mu, cov, risk_free_rate)
    pt_inverse_vol = PortfolioPoint(
        expected_return=ret_iv,
        volatility=vol_iv,
        sharpe_ratio=sr_iv,
        weights={valid_symbols[i]: float(w_iv[i]) for i in range(n)},
    )

    # 2. Global Minimum Variance (q = 0)
    w_min_var = solve_mean_variance(cov, mu, q=0.0)
    ret_mv, vol_mv, sr_mv = compute_portfolio_stats(w_min_var, mu, cov, risk_free_rate)
    pt_min_variance = PortfolioPoint(
        expected_return=ret_mv,
        volatility=vol_mv,
        sharpe_ratio=sr_mv,
        weights={valid_symbols[i]: float(w_min_var[i]) for i in range(n)},
    )

    # 3. Efficient Frontier Sweep: q from 0.0 to high risk-appetite
    q_values = np.logspace(-2, 2.5, num_points)
    q_values = np.insert(q_values, 0, 0.0)

    frontier_points: list[PortfolioPoint] = []
    best_sharpe = float("-inf")
    best_sharpe_pt = pt_equal_weight

    seen_vols: set[float] = set()

    for q in q_values:
        w_q = solve_mean_variance(cov, mu, q=float(q))
        r, v, sr = compute_portfolio_stats(w_q, mu, cov, risk_free_rate)

        # Avoid redundant points
        v_round = round(v, 4)
        if v_round not in seen_vols:
            seen_vols.add(v_round)
            pt = PortfolioPoint(
                expected_return=r,
                volatility=v,
                sharpe_ratio=sr,
                weights={valid_symbols[i]: float(w_q[i]) for i in range(n)},
            )
            frontier_points.append(pt)

            if sr > best_sharpe:
                best_sharpe = sr
                best_sharpe_pt = pt

    # Sort frontier by volatility ascending
    frontier_points.sort(key=lambda p: p.volatility)

    # 4. Monte Carlo Random Dirichlet Simulation Cloud
    rng = np.random.default_rng(seed)
    simulated: list[PortfolioPoint] = []

    # Dirichlet samples
    random_weights = rng.dirichlet(np.ones(n), size=num_simulations)
    for w in random_weights:
        r, v, sr = compute_portfolio_stats(w, mu, cov, risk_free_rate)
        simulated.append(
            PortfolioPoint(
                expected_return=r,
                volatility=v,
                sharpe_ratio=sr,
                weights={valid_symbols[i]: float(w[i]) for i in range(n)},
            )
        )
        if sr > best_sharpe:
            best_sharpe = sr
            best_sharpe_pt = PortfolioPoint(
                expected_return=r,
                volatility=v,
                sharpe_ratio=sr,
                weights={valid_symbols[i]: float(w[i]) for i in range(n)},
            )

    asset_returns = {valid_symbols[i]: float(mu[i]) for i in range(n)}
    asset_vols = {valid_symbols[i]: float(np.sqrt(cov[i, i])) for i in range(n)}

    return EfficientFrontierResult(
        symbols=valid_symbols,
        frontier_curve=frontier_points,
        simulated_portfolios=simulated,
        max_sharpe=best_sharpe_pt,
        min_variance=pt_min_variance,
        equal_weight=pt_equal_weight,
        inverse_volatility=pt_inverse_vol,
        annualized_returns=asset_returns,
        annualized_volatilities=asset_vols,
    )
