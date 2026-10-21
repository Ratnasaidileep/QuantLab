from __future__ import annotations

import csv
import io
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

from quantlab.analytics.strategy_comparison import compare_buy_and_hold
from quantlab.backtest.engine import Backtest
from quantlab.config import settings
from quantlab.data.csv_loader import load_bars_from_csv
from quantlab.data.models import Bar
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.confluence import ConfluenceStrategy
from quantlab.strategy.macd import MACDStrategy
from quantlab.strategy.moving_average import MovingAverageCrossover
from quantlab.strategy.rsi import RSIStrategy


@dataclass(frozen=True)
class BenchmarkRow:
    dataset: str
    symbol: str
    strategy_name: str
    configuration: str
    total_trades: int
    final_equity: float
    total_pnl: float
    total_return: float
    cagr: float | None
    sharpe_ratio: float | None
    sortino_ratio: float | None
    max_drawdown: float
    calmar_ratio: float | None
    win_rate: float | None
    profit_factor: float | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class BenchmarkMatrixResult:
    rows: list[BenchmarkRow]
    datasets: list[str]
    strategies: list[str]

    def to_markdown(self) -> str:
        """Generate a clean, GitHub-flavored Markdown table for thesis and reports."""
        headers = [
            "Dataset",
            "Strategy",
            "Configuration",
            "Return (%)",
            "CAGR (%)",
            "Sharpe",
            "Sortino",
            "Max DD (%)",
            "Calmar",
            "Win Rate (%)",
            "Profit Factor",
            "Trades",
        ]

        lines = [
            "| " + " | ".join(headers) + " |",
            "| " + " | ".join(["---"] * len(headers)) + " |",
        ]

        for r in self.rows:
            ret_str = f"{r.total_return * 100:+.2f}%"
            cagr_str = f"{r.cagr * 100:+.2f}%" if r.cagr is not None else "N/A"
            sharpe_str = f"{r.sharpe_ratio:.2f}" if r.sharpe_ratio is not None else "N/A"
            sortino_str = f"{r.sortino_ratio:.2f}" if r.sortino_ratio is not None else "N/A"
            dd_str = f"{r.max_drawdown * 100:.2f}%"
            calmar_str = f"{r.calmar_ratio:.2f}" if r.calmar_ratio is not None else "N/A"
            win_str = f"{r.win_rate * 100:.1f}%" if r.win_rate is not None else "N/A"
            pf_str = f"{r.profit_factor:.2f}" if r.profit_factor is not None else "N/A"

            row_line = (
                f"| {r.symbol} | {r.strategy_name} | {r.configuration} | "
                f"{ret_str} | {cagr_str} | {sharpe_str} | {sortino_str} | "
                f"{dd_str} | {calmar_str} | {win_str} | {pf_str} | {r.total_trades} |"
            )
            lines.append(row_line)

        return "\n".join(lines)

    def to_latex(self) -> str:
        """Generate a publication-ready LaTeX table using the booktabs package."""
        lines = [
            r"\begin{table*}[htbp]",
            r"\centering",
            r"\caption{Cross-Strategy Quantitative Performance Benchmark Across Evaluation Datasets}",
            r"\label{tab:quantlab_academic_benchmark}",
            r"\small",
            r"\begin{tabular}{llrrrrrrrrr}",
            r"\toprule",
            r"\textbf{Asset} & \textbf{Strategy} & \textbf{Trades} & \textbf{Return (\%)} & \textbf{CAGR (\%)} & \textbf{Sharpe} & \textbf{Sortino} & \textbf{Max DD (\%)} & \textbf{Calmar} & \textbf{Win Rate (\%)} & \textbf{Profit Factor} \\",
            r"\midrule",
        ]

        current_dataset = None
        for r in self.rows:
            if current_dataset is not None and r.dataset != current_dataset:
                lines.append(r"\midrule")
            current_dataset = r.dataset

            ret_str = f"{r.total_return * 100:+.2f}\\%"
            cagr_str = f"{r.cagr * 100:+.2f}\\%" if r.cagr is not None else "N/A"
            sharpe_str = f"{r.sharpe_ratio:.2f}" if r.sharpe_ratio is not None else "N/A"
            sortino_str = f"{r.sortino_ratio:.2f}" if r.sortino_ratio is not None else "N/A"
            dd_str = f"{r.max_drawdown * 100:.2f}\\%"
            calmar_str = f"{r.calmar_ratio:.2f}" if r.calmar_ratio is not None else "N/A"
            win_str = f"{r.win_rate * 100:.1f}\\%" if r.win_rate is not None else "N/A"
            pf_str = f"{r.profit_factor:.2f}" if r.profit_factor is not None else "N/A"

            strat_label = r.strategy_name.replace("&", r"\&")
            row_tex = (
                f"{r.symbol} & {strat_label} & {r.total_trades} & {ret_str} & {cagr_str} & "
                f"{sharpe_str} & {sortino_str} & {dd_str} & {calmar_str} & {win_str} & {pf_str} \\\\"
            )
            lines.append(row_tex)

        lines.extend([
            r"\bottomrule",
            r"\end{tabular}",
            r"\end{table*}",
        ])
        return "\n".join(lines)

    def to_csv(self) -> str:
        """Export benchmark performance rows to CSV format."""
        output = io.StringIO()
        fieldnames = [
            "dataset",
            "symbol",
            "strategy_name",
            "configuration",
            "total_trades",
            "final_equity",
            "total_pnl",
            "total_return",
            "cagr",
            "sharpe_ratio",
            "sortino_ratio",
            "max_drawdown",
            "calmar_ratio",
            "win_rate",
            "profit_factor",
        ]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for r in self.rows:
            writer.writerow(r.to_dict())
        return output.getvalue()

    def to_dict(self) -> dict[str, Any]:
        return {
            "rows": [r.to_dict() for r in self.rows],
            "datasets": self.datasets,
            "strategies": self.strategies,
            "markdown_table": self.to_markdown(),
            "latex_table": self.to_latex(),
            "csv_table": self.to_csv(),
        }


def _extract_symbol_from_name(name: str) -> str:
    base = Path(name).name
    clean = base.replace("_daily.csv", "").replace(".csv", "").upper()
    return clean or base


def generate_benchmark_matrix(
    datasets: Sequence[str] | None = None,
    bars_by_symbol: dict[str, Sequence[Bar]] | None = None,
    initial_cash: float = 100_000.0,
    commission_rate: float = 0.001,
    slippage_rate: float = 0.001,
) -> BenchmarkMatrixResult:
    """Execute automated cross-strategy, cross-dataset benchmark matrix evaluation.

    Compares all core trading strategies against Buy & Hold:
    1. Buy and Hold (Benchmark)
    2. Moving Average Crossover (Fast 5 / Slow 20)
    3. RSI Pullback Reversal (Period 14, 30/70)
    4. Bollinger Bands Mean Reversion (Period 20, 2.0 StdDev)
    5. MACD Trend Following (12, 26, 9)
    6. Regime-Filtered Confluence (EMA 200 Trend Filter + RSI 14 Pullback)
    """
    if initial_cash <= 0:
        raise ValueError("initial_cash must be strictly positive.")
    if commission_rate < 0 or slippage_rate < 0:
        raise ValueError("commission_rate and slippage_rate cannot be negative.")

    resolved_data: dict[str, Sequence[Bar]] = {}

    if bars_by_symbol is not None:
        resolved_data = dict(bars_by_symbol)
    else:
        # Determine dataset files to load
        target_files: list[Path] = []
        if datasets:
            for d in datasets:
                p = Path(d)
                if not p.is_absolute():
                    p = settings.data_dir / p.name
                if not p.exists():
                    raise FileNotFoundError(f"Dataset file not found: {p}")
                target_files.append(p)
        else:
            # Auto-discover CSV datasets in data_dir
            target_files = sorted([
                f for f in settings.data_dir.glob("*.csv")
                if f.is_file() and not f.name.startswith("temp")
            ])

        if not target_files:
            raise ValueError("No dataset files found to evaluate benchmark matrix.")

        for f in target_files:
            bars = load_bars_from_csv(f)
            sym = _extract_symbol_from_name(f.name)
            resolved_data[f.name] = bars

    all_rows: list[BenchmarkRow] = []
    strategy_names = [
        "Buy and Hold",
        "Moving Average Crossover",
        "RSI Reversal",
        "Bollinger Bands",
        "MACD Trend Following",
        "Confluence Strategy",
    ]

    for d_name, bars in resolved_data.items():
        sym = _extract_symbol_from_name(d_name)

        # 1. Buy and Hold Benchmark
        bnh = compare_buy_and_hold(
            bars=bars,
            initial_cash=initial_cash,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            sizing_mode="unit",
            liquidate_on_end=False,
        )
        all_rows.append(
            BenchmarkRow(
                dataset=d_name,
                symbol=sym,
                strategy_name="Buy and Hold",
                configuration="First Open / Final Close",
                total_trades=bnh.trades,
                final_equity=bnh.final_equity,
                total_pnl=bnh.total_pnl,
                total_return=bnh.total_return,
                cagr=bnh.cagr,
                sharpe_ratio=bnh.sharpe_ratio,
                sortino_ratio=bnh.sortino_ratio,
                max_drawdown=bnh.max_drawdown,
                calmar_ratio=None,
                win_rate=bnh.win_rate,
                profit_factor=bnh.profit_factor,
            )
        )

        # 2. Moving Average Crossover (Fast 5 / Slow 20)
        ma_strat = MovingAverageCrossover(fast_period=5, slow_period=20)
        ma_engine = Backtest(
            initial_cash=initial_cash,
            strategy=ma_strat,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=True,
            sizing_mode="unit",
        )
        ma_res = ma_engine.run(bars)
        all_rows.append(
            BenchmarkRow(
                dataset=d_name,
                symbol=sym,
                strategy_name="Moving Average Crossover",
                configuration="Fast 5 / Slow 20",
                total_trades=len(ma_res.trades),
                final_equity=ma_res.final_equity,
                total_pnl=ma_res.total_pnl,
                total_return=ma_res.metrics.total_return,
                cagr=ma_res.metrics.cagr,
                sharpe_ratio=ma_res.metrics.sharpe_ratio,
                sortino_ratio=ma_res.metrics.sortino_ratio,
                max_drawdown=ma_res.metrics.max_drawdown,
                calmar_ratio=ma_res.metrics.calmar_ratio,
                win_rate=ma_res.metrics.win_rate,
                profit_factor=ma_res.metrics.profit_factor,
            )
        )

        # 3. RSI Reversal (14, 30/70)
        rsi_strat = RSIStrategy(period=14, oversold=30.0, overbought=70.0)
        rsi_engine = Backtest(
            initial_cash=initial_cash,
            strategy=rsi_strat,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=False,
            sizing_mode="unit",
        )
        rsi_res = rsi_engine.run(bars)
        all_rows.append(
            BenchmarkRow(
                dataset=d_name,
                symbol=sym,
                strategy_name="RSI Reversal",
                configuration="14 Period (30/70)",
                total_trades=len(rsi_res.trades),
                final_equity=rsi_res.final_equity,
                total_pnl=rsi_res.total_pnl,
                total_return=rsi_res.metrics.total_return,
                cagr=rsi_res.metrics.cagr,
                sharpe_ratio=rsi_res.metrics.sharpe_ratio,
                sortino_ratio=rsi_res.metrics.sortino_ratio,
                max_drawdown=rsi_res.metrics.max_drawdown,
                calmar_ratio=rsi_res.metrics.calmar_ratio,
                win_rate=rsi_res.metrics.win_rate,
                profit_factor=rsi_res.metrics.profit_factor,
            )
        )

        # 4. Bollinger Bands (20, 2.0 StdDev)
        bb_strat = BollingerBandsStrategy(period=20, std_dev_multiplier=2.0)
        bb_engine = Backtest(
            initial_cash=initial_cash,
            strategy=bb_strat,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=False,
            sizing_mode="unit",
        )
        bb_res = bb_engine.run(bars)
        all_rows.append(
            BenchmarkRow(
                dataset=d_name,
                symbol=sym,
                strategy_name="Bollinger Bands",
                configuration="20 Period / 2.0 StdDev",
                total_trades=len(bb_res.trades),
                final_equity=bb_res.final_equity,
                total_pnl=bb_res.total_pnl,
                total_return=bb_res.metrics.total_return,
                cagr=bb_res.metrics.cagr,
                sharpe_ratio=bb_res.metrics.sharpe_ratio,
                sortino_ratio=bb_res.metrics.sortino_ratio,
                max_drawdown=bb_res.metrics.max_drawdown,
                calmar_ratio=bb_res.metrics.calmar_ratio,
                win_rate=bb_res.metrics.win_rate,
                profit_factor=bb_res.metrics.profit_factor,
            )
        )

        # 5. MACD Trend Following (12, 26, 9)
        macd_strat = MACDStrategy(fast_period=12, slow_period=26, signal_period=9)
        macd_engine = Backtest(
            initial_cash=initial_cash,
            strategy=macd_strat,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=True,
            sizing_mode="unit",
        )
        macd_res = macd_engine.run(bars)
        all_rows.append(
            BenchmarkRow(
                dataset=d_name,
                symbol=sym,
                strategy_name="MACD Trend Following",
                configuration="12 / 26 / 9 Crossover",
                total_trades=len(macd_res.trades),
                final_equity=macd_res.final_equity,
                total_pnl=macd_res.total_pnl,
                total_return=macd_res.metrics.total_return,
                cagr=macd_res.metrics.cagr,
                sharpe_ratio=macd_res.metrics.sharpe_ratio,
                sortino_ratio=macd_res.metrics.sortino_ratio,
                max_drawdown=macd_res.metrics.max_drawdown,
                calmar_ratio=macd_res.metrics.calmar_ratio,
                win_rate=macd_res.metrics.win_rate,
                profit_factor=macd_res.metrics.profit_factor,
            )
        )

        # 6. Regime-Filtered Confluence Strategy (EMA 200 + RSI 14)
        trend_period = min(200, max(20, len(bars) // 3))
        conf_strat = ConfluenceStrategy(
            trend_period=trend_period,
            pullback_period=14,
            oversold=40.0,
            overbought=70.0,
        )
        conf_engine = Backtest(
            initial_cash=initial_cash,
            strategy=conf_strat,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=False,
            sizing_mode="unit",
        )
        conf_res = conf_engine.run(bars)
        all_rows.append(
            BenchmarkRow(
                dataset=d_name,
                symbol=sym,
                strategy_name="Confluence Strategy",
                configuration=f"EMA {trend_period} Trend + RSI 14 Pullback",
                total_trades=len(conf_res.trades),
                final_equity=conf_res.final_equity,
                total_pnl=conf_res.total_pnl,
                total_return=conf_res.metrics.total_return,
                cagr=conf_res.metrics.cagr,
                sharpe_ratio=conf_res.metrics.sharpe_ratio,
                sortino_ratio=conf_res.metrics.sortino_ratio,
                max_drawdown=conf_res.metrics.max_drawdown,
                calmar_ratio=conf_res.metrics.calmar_ratio,
                win_rate=conf_res.metrics.win_rate,
                profit_factor=conf_res.metrics.profit_factor,
            )
        )

    return BenchmarkMatrixResult(
        rows=all_rows,
        datasets=list(resolved_data.keys()),
        strategies=strategy_names,
    )
