"""Seed baseline experiments into QuantLab's SQLite database.

Generates genuine, engine-verified backtest runs with real equity curves,
trades, and risk metrics for:
1. Moving Average Crossover (Fast 10 / Slow 30) on Reliance Industries.
2. Bollinger Bands (20, 2.0) on Reliance Industries.
3. Regime-Filtered Confluence Strategy (EMA 30 / RSI 10, 50/65) on Tata Consultancy Services (TCS).
4. MACD Histogram Trend (12 / 26 / 9) on Tata Consultancy Services (TCS).
"""

from quantlab.backtest.engine import Backtest
from quantlab.config import settings
from quantlab.data.csv_loader import load_bars_from_csv
from quantlab.storage.repository import get_connection, save_experiment
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.confluence import ConfluenceStrategy
from quantlab.strategy.macd import MACDStrategy
from quantlab.strategy.moving_average import MovingAverageCrossover


def seed_experiments() -> None:
    data_dir = settings.data_dir
    db_path = settings.db_path

    # Clean previous baseline seeds to ensure fresh, high-quality demonstration records
    conn = get_connection(db_path)
    with conn:
        conn.execute("DELETE FROM experiments;")
    conn.close()

    # 1. Reliance MA Crossover (10 / 30)
    rel_path = data_dir / "reliance_daily.csv"
    if rel_path.exists():
        bars_rel = load_bars_from_csv(rel_path)
        strat_ma = MovingAverageCrossover(fast_period=10, slow_period=30)
        bt_ma = Backtest(
            initial_cash=100000.0,
            strategy=strat_ma,
            commission_rate=0.001,
            slippage_rate=0.001,
            use_crossover=True,
            sizing_mode="unit",
            quantity_per_trade=1.0,
        )
        res_ma = bt_ma.run(bars_rel)

        trades_ma = [
            {
                "timestamp": t.timestamp.isoformat(),
                "side": t.side.value.lower(),
                "price": t.price,
                "quantity": t.quantity,
                "commission": t.commission,
                "exit_reason": t.exit_reason,
            }
            for t in res_ma.trades
        ]
        equity_ma = [
            {
                "timestamp": bar.timestamp.isoformat(),
                "equity": eq,
                "price": bar.close,
            }
            for bar, eq in zip(bars_rel, res_ma.equity_curve)
        ]

        rec_ma = save_experiment(
            name="Baseline: Reliance MA Crossover (10/30)",
            notes="Standard trend-following benchmark on Reliance Industries daily bars with 0.1% commission and 0.1% slippage.",
            dataset="reliance_daily.csv",
            strategy="moving_average",
            parameters={"fast_period": 10, "slow_period": 30},
            initial_cash=100000.0,
            commission_rate=0.001,
            slippage_rate=0.001,
            sizing_mode="unit",
            quantity_per_trade=1.0,
            final_equity=res_ma.final_equity,
            total_pnl=res_ma.total_pnl,
            total_return=res_ma.metrics.total_return,
            max_drawdown=res_ma.metrics.max_drawdown,
            total_trades=res_ma.metrics.total_trades,
            win_rate=res_ma.metrics.win_rate,
            profit_factor=res_ma.metrics.profit_factor,
            sharpe_ratio=res_ma.metrics.sharpe_ratio,
            sortino_ratio=res_ma.metrics.sortino_ratio,
            cagr=res_ma.metrics.cagr,
            equity_curve=equity_ma,
            trades=trades_ma,
            user_id=None,
            db_path=db_path,
        )
        print(f"Created Baseline 1 (ID {rec_ma.id}): {rec_ma.name} ({res_ma.metrics.total_trades} trades)")

    # 2. Reliance Bollinger Bands (20, 2.0)
    if rel_path.exists():
        strat_bb = BollingerBandsStrategy(period=20, std_dev_multiplier=2.0)
        bt_bb = Backtest(
            initial_cash=100000.0,
            strategy=strat_bb,
            commission_rate=0.001,
            slippage_rate=0.001,
            use_crossover=False,
            sizing_mode="unit",
            quantity_per_trade=1.0,
        )
        res_bb = bt_bb.run(bars_rel)

        trades_bb = [
            {
                "timestamp": t.timestamp.isoformat(),
                "side": t.side.value.lower(),
                "price": t.price,
                "quantity": t.quantity,
                "commission": t.commission,
                "exit_reason": t.exit_reason,
            }
            for t in res_bb.trades
        ]
        equity_bb = [
            {
                "timestamp": bar.timestamp.isoformat(),
                "equity": eq,
                "price": bar.close,
            }
            for bar, eq in zip(bars_rel, res_bb.equity_curve)
        ]

        rec_bb = save_experiment(
            name="Baseline: Reliance Bollinger Bands (20, 2.0)",
            notes="Mean-reversion strategy trading lower-band bounces with upper-band profit targets.",
            dataset="reliance_daily.csv",
            strategy="bollinger",
            parameters={"bb_period": 20, "bb_std_dev": 2.0},
            initial_cash=100000.0,
            commission_rate=0.001,
            slippage_rate=0.001,
            sizing_mode="unit",
            quantity_per_trade=1.0,
            final_equity=res_bb.final_equity,
            total_pnl=res_bb.total_pnl,
            total_return=res_bb.metrics.total_return,
            max_drawdown=res_bb.metrics.max_drawdown,
            total_trades=res_bb.metrics.total_trades,
            win_rate=res_bb.metrics.win_rate,
            profit_factor=res_bb.metrics.profit_factor,
            sharpe_ratio=res_bb.metrics.sharpe_ratio,
            sortino_ratio=res_bb.metrics.sortino_ratio,
            cagr=res_bb.metrics.cagr,
            equity_curve=equity_bb,
            trades=trades_bb,
            user_id=None,
            db_path=db_path,
        )
        print(f"Created Baseline 2 (ID {rec_bb.id}): {rec_bb.name} ({res_bb.metrics.total_trades} trades)")

    # 3. TCS Confluence Strategy (EMA 30 / RSI 10, 50/65)
    tcs_path = data_dir / "tcs_daily.csv"
    if tcs_path.exists():
        bars_tcs = load_bars_from_csv(tcs_path)
        strat_conf = ConfluenceStrategy(
            trend_period=30,
            pullback_period=10,
            oversold=50.0,
            overbought=65.0,
        )
        bt_conf = Backtest(
            initial_cash=100000.0,
            strategy=strat_conf,
            commission_rate=0.001,
            slippage_rate=0.001,
            use_crossover=False,
            sizing_mode="unit",
            quantity_per_trade=1.0,
        )
        res_conf = bt_conf.run(bars_tcs)

        trades_conf = [
            {
                "timestamp": t.timestamp.isoformat(),
                "side": t.side.value.lower(),
                "price": t.price,
                "quantity": t.quantity,
                "commission": t.commission,
                "exit_reason": t.exit_reason,
            }
            for t in res_conf.trades
        ]
        equity_conf = [
            {
                "timestamp": bar.timestamp.isoformat(),
                "equity": eq,
                "price": bar.close,
            }
            for bar, eq in zip(bars_tcs, res_conf.equity_curve)
        ]

        rec_conf = save_experiment(
            name="Baseline: TCS Confluence Regime Filter",
            notes="Multi-indicator confluence strategy combining 30-day EMA macro trend regime with 10-day RSI pullback entries on TCS.",
            dataset="tcs_daily.csv",
            strategy="confluence",
            parameters={
                "confluence_trend_period": 30,
                "confluence_pullback_period": 10,
                "confluence_oversold": 50.0,
                "confluence_overbought": 65.0,
            },
            initial_cash=100000.0,
            commission_rate=0.001,
            slippage_rate=0.001,
            sizing_mode="unit",
            quantity_per_trade=1.0,
            final_equity=res_conf.final_equity,
            total_pnl=res_conf.total_pnl,
            total_return=res_conf.metrics.total_return,
            max_drawdown=res_conf.metrics.max_drawdown,
            total_trades=res_conf.metrics.total_trades,
            win_rate=res_conf.metrics.win_rate,
            profit_factor=res_conf.metrics.profit_factor,
            sharpe_ratio=res_conf.metrics.sharpe_ratio,
            sortino_ratio=res_conf.metrics.sortino_ratio,
            cagr=res_conf.metrics.cagr,
            equity_curve=equity_conf,
            trades=trades_conf,
            user_id=None,
            db_path=db_path,
        )
        print(f"Created Baseline 3 (ID {rec_conf.id}): {rec_conf.name} ({res_conf.metrics.total_trades} trades)")

    # 4. TCS MACD Strategy (12, 26, 9)
    if tcs_path.exists():
        strat_macd = MACDStrategy(fast_period=12, slow_period=26, signal_period=9)
        bt_macd = Backtest(
            initial_cash=100000.0,
            strategy=strat_macd,
            commission_rate=0.001,
            slippage_rate=0.001,
            use_crossover=True,
            sizing_mode="unit",
            quantity_per_trade=1.0,
        )
        res_macd = bt_macd.run(bars_tcs)

        trades_macd = [
            {
                "timestamp": t.timestamp.isoformat(),
                "side": t.side.value.lower(),
                "price": t.price,
                "quantity": t.quantity,
                "commission": t.commission,
                "exit_reason": t.exit_reason,
            }
            for t in res_macd.trades
        ]
        equity_macd = [
            {
                "timestamp": bar.timestamp.isoformat(),
                "equity": eq,
                "price": bar.close,
            }
            for bar, eq in zip(bars_tcs, res_macd.equity_curve)
        ]

        rec_macd = save_experiment(
            name="Baseline: TCS MACD Signal Crossover",
            notes="Standard MACD (12/26/9) momentum crossover strategy evaluating trend persistence on TCS.",
            dataset="tcs_daily.csv",
            strategy="macd",
            parameters={"macd_fast": 12, "macd_slow": 26, "macd_signal": 9},
            initial_cash=100000.0,
            commission_rate=0.001,
            slippage_rate=0.001,
            sizing_mode="unit",
            quantity_per_trade=1.0,
            final_equity=res_macd.final_equity,
            total_pnl=res_macd.total_pnl,
            total_return=res_macd.metrics.total_return,
            max_drawdown=res_macd.metrics.max_drawdown,
            total_trades=res_macd.metrics.total_trades,
            win_rate=res_macd.metrics.win_rate,
            profit_factor=res_macd.metrics.profit_factor,
            sharpe_ratio=res_macd.metrics.sharpe_ratio,
            sortino_ratio=res_macd.metrics.sortino_ratio,
            cagr=res_macd.metrics.cagr,
            equity_curve=equity_macd,
            trades=trades_macd,
            user_id=None,
            db_path=db_path,
        )
        print(f"Created Baseline 4 (ID {rec_macd.id}): {rec_macd.name} ({res_macd.metrics.total_trades} trades)")

if __name__ == "__main__":
    seed_experiments()
