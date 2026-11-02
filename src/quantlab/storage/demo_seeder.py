"""Safe, idempotent demo experiment seeding for QuantLab."""

from pathlib import Path

from quantlab.backtest.engine import Backtest
from quantlab.config import settings
from quantlab.data.csv_loader import load_bars_from_csv
from quantlab.storage.repository import (
    ExperimentRecord,
    get_connection,
    save_experiment,
)
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.confluence import ConfluenceStrategy
from quantlab.strategy.macd import MACDStrategy
from quantlab.strategy.moving_average import MovingAverageCrossover

DEMO_EXPERIMENT_SPECS = [
    {
        "name": "DEMO — MA Crossover — Reliance",
        "notes": "Standard trend-following benchmark on Reliance Industries daily bars (Fast 10 / Slow 30, 0.1% friction).",
        "dataset": "reliance_daily.csv",
        "strategy_type": "moving_average",
        "strategy_factory": lambda: MovingAverageCrossover(fast_period=10, slow_period=30),
        "use_crossover": True,
        "parameters": {"fast_period": 10, "slow_period": 30},
    },
    {
        "name": "DEMO — Confluence — TCS",
        "notes": "Multi-indicator confluence strategy combining 30-day EMA macro trend regime with 10-day RSI pullback entries on TCS.",
        "dataset": "tcs_daily.csv",
        "strategy_type": "confluence",
        "strategy_factory": lambda: ConfluenceStrategy(
            trend_period=30, pullback_period=10, oversold=50.0, overbought=65.0
        ),
        "use_crossover": False,
        "parameters": {
            "confluence_trend_period": 30,
            "confluence_pullback_period": 10,
            "confluence_oversold": 50.0,
            "confluence_overbought": 65.0,
        },
    },
    {
        "name": "DEMO — Bollinger Bands — Reliance",
        "notes": "Mean-reversion strategy trading lower-band bounces with upper-band profit targets.",
        "dataset": "reliance_daily.csv",
        "strategy_type": "bollinger",
        "strategy_factory": lambda: BollingerBandsStrategy(period=20, std_dev_multiplier=2.0),
        "use_crossover": False,
        "parameters": {"bb_period": 20, "bb_std_dev": 2.0},
    },
    {
        "name": "DEMO — MACD — TCS",
        "notes": "Standard MACD (12/26/9) momentum crossover strategy evaluating trend persistence on TCS.",
        "dataset": "tcs_daily.csv",
        "strategy_type": "macd",
        "strategy_factory": lambda: MACDStrategy(fast_period=12, slow_period=26, signal_period=9),
        "use_crossover": True,
        "parameters": {"macd_fast": 12, "macd_slow": 26, "macd_signal": 9},
    },
]


def seed_demo_experiments(
    db_path: Path | str | None = None,
    data_dir: Path | str | None = None,
    force: bool = False,
) -> list[ExperimentRecord]:
    """Idempotently seed verified baseline demo experiments into the SQLite repository.

    Safety Guarantees:
    - Never modifies, updates, or deletes real user experiments (user_id IS NOT NULL).
    - Checks for existing demo records by exact name where user_id IS NULL.
    - If already present and force is False, skips insertion to prevent duplicates.
    - All metrics and equity curves are generated using the genuine backtest engine on actual data.
    """
    db_target = Path(db_path) if db_path is not None else settings.db_path
    data_target = Path(data_dir) if data_dir is not None else settings.data_dir

    conn = get_connection(db_target)
    try:
        # Map of existing demo experiments (user_id IS NULL)
        existing_rows = conn.execute(
            "SELECT id, name FROM experiments WHERE user_id IS NULL AND name LIKE 'DEMO — %';"
        ).fetchall()
        existing_names = {r["name"]: r["id"] for r in existing_rows}
    finally:
        conn.close()

    seeded: list[ExperimentRecord] = []

    for spec in DEMO_EXPERIMENT_SPECS:
        name = spec["name"]
        if name in existing_names and not force:
            continue

        file_path = data_target / spec["dataset"]
        if not file_path.exists():
            continue

        bars = load_bars_from_csv(file_path)
        strat = spec["strategy_factory"]()
        bt = Backtest(
            initial_cash=100000.0,
            strategy=strat,
            commission_rate=0.001,
            slippage_rate=0.001,
            use_crossover=spec["use_crossover"],
            sizing_mode="unit",
            quantity_per_trade=1.0,
        )
        res = bt.run(bars)

        trades_dicts = [
            {
                "timestamp": t.timestamp.isoformat(),
                "side": t.side.value.lower(),
                "price": t.price,
                "quantity": t.quantity,
                "commission": t.commission,
                "exit_reason": t.exit_reason,
            }
            for t in res.trades
        ]
        equity_dicts = [
            {
                "timestamp": bar.timestamp.isoformat(),
                "equity": eq,
                "price": bar.close,
            }
            for bar, eq in zip(bars, res.equity_curve)
        ]

        # If force=True and record existed, remove old demo record first
        if name in existing_names and force:
            old_id = existing_names[name]
            del_conn = get_connection(db_target)
            try:
                with del_conn:
                    del_conn.execute(
                        "DELETE FROM experiments WHERE id = ? AND user_id IS NULL;",
                        (old_id,),
                    )
            finally:
                del_conn.close()

        rec = save_experiment(
            name=name,
            notes=spec["notes"],
            dataset=spec["dataset"],
            strategy=spec["strategy_type"],
            parameters=spec["parameters"],
            initial_cash=100000.0,
            commission_rate=0.001,
            slippage_rate=0.001,
            sizing_mode="unit",
            quantity_per_trade=1.0,
            final_equity=res.final_equity,
            total_pnl=res.total_pnl,
            total_return=res.metrics.total_return,
            max_drawdown=res.metrics.max_drawdown,
            total_trades=res.metrics.total_trades,
            win_rate=res.metrics.win_rate,
            profit_factor=res.metrics.profit_factor,
            sharpe_ratio=res.metrics.sharpe_ratio,
            sortino_ratio=res.metrics.sortino_ratio,
            cagr=res.metrics.cagr,
            equity_curve=equity_dicts,
            trades=trades_dicts,
            user_id=None,
            db_path=db_target,
        )
        seeded.append(rec)

    return seeded
