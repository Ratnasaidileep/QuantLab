

import io
import math
import re
import sqlite3
from pathlib import Path
from typing import Any

import pandas as pd
import streamlit as st

from quantlab.analytics.plotting import plot_backtest_results
from quantlab.analytics.strategy_comparison import (
    compare_buy_and_hold,
    compare_strategies,
)
from quantlab.analytics.tear_sheet import generate_tear_sheet
from quantlab.analytics.walk_forward import (
    evaluate_parameter_grid_heatmap,
    run_walk_forward_optimization,
)
from quantlab.backtest.engine import Backtest
from quantlab.data.csv_loader import (
    fetch_ohlcv_from_yfinance,
    load_bars_from_csv,
    save_bars_to_csv,
)
from quantlab.portfolio.basket import (
    AllocationWeighting,
    BasketBacktestEngine,
    RebalanceFrequency,
)
from quantlab.storage.repository import (
    delete_experiment,
    get_experiment,
    list_experiments,
    save_experiment,
)
from quantlab.strategy.bollinger import BollingerBandsStrategy
from quantlab.strategy.moving_average import MovingAverageCrossover
from quantlab.strategy.rsi import RSIStrategy

DATA_DIR = Path("data")


st.set_page_config(
    page_title="QuantLab",
    page_icon="📈",
    layout="wide",
)


# ---------------------------------------------------------
# Header
# ---------------------------------------------------------

st.title("📈 QuantLab")
st.subheader("Quantitative Research & Backtesting Platform")

st.write(
    "Test quantitative trading strategies on historical market data "
    "and evaluate performance after transaction costs."
)


# ---------------------------------------------------------
# Sidebar
# ---------------------------------------------------------

st.sidebar.header("Market Dataset")

DATA_DIR.mkdir(parents=True, exist_ok=True)
available_datasets = sorted([p.name for p in DATA_DIR.glob("*.csv")])
if not available_datasets:
    available_datasets = ["reliance_daily.csv"]

selected_dataset = st.sidebar.selectbox("Select Asset Dataset", available_datasets)
data_path = DATA_DIR / selected_dataset

with st.sidebar.expander("📥 Ingest Market Data (Upload / Fetch)"):
    upload_file = st.file_uploader("Upload OHLCV CSV", type=["csv"], key="sb_upload")
    if upload_file is not None:
        try:
            content = upload_file.read()
            df = pd.read_csv(io.StringIO(content.decode("utf-8", errors="replace")))
            target = DATA_DIR / upload_file.name.lower()
            df.to_csv(target, index=False)
            bars = load_bars_from_csv(target)
            save_bars_to_csv(bars, target)
            st.success(f"Saved {len(bars)} bars: {upload_file.name}")
            st.rerun()
        except (ValueError, TypeError, OSError) as e:
            st.error(f"Upload error: {e}")

    ticker_sym = st.text_input("Download Ticker (Yahoo)", placeholder="e.g. TCS.NS, AAPL", key="sb_ticker")
    ticker_period = st.selectbox("Period", ["1y", "2y", "5y", "max"], index=1, key="sb_period")
    if st.button("Download Ticker Data", key="sb_fetch") and ticker_sym.strip():
        with st.spinner(f"Downloading {ticker_sym.strip()}..."):
            try:
                bars = fetch_ohlcv_from_yfinance(ticker_sym.strip(), period=ticker_period)
                safe_sym = re.sub(r"[^\w\-]", "_", ticker_sym.strip().upper()).lower()
                target = DATA_DIR / f"{safe_sym}_daily.csv"
                save_bars_to_csv(bars, target)
                st.success(f"Downloaded {len(bars)} bars for {ticker_sym.strip()}!")
                st.rerun()
            except (ValueError, TypeError, OSError) as e:
                st.error(f"Download failed: {e}")

st.sidebar.header("Backtest Configuration")

selected_strategy = st.sidebar.selectbox(
    "Trading Strategy",
    ["Moving Average Crossover", "RSI", "Bollinger Bands"],
)

initial_cash = st.sidebar.number_input(
    "Initial Capital (₹)",
    min_value=1000.0,
    value=100000.0,
    step=5000.0,
)

if selected_strategy == "Moving Average Crossover":
    fast_period = st.sidebar.number_input(
        "Fast MA Period",
        min_value=1,
        value=10,
        step=1,
    )

    slow_period = st.sidebar.number_input(
        "Slow MA Period",
        min_value=2,
        value=30,
        step=1,
    )

    if fast_period >= slow_period:
        st.sidebar.error(
            "Fast MA period must be smaller than Slow MA period."
        )
        st.stop()

elif selected_strategy == "RSI":
    rsi_period = st.sidebar.number_input(
        "RSI Period",
        min_value=2,
        value=14,
        step=1,
    )

    rsi_oversold = st.sidebar.number_input(
        "RSI Oversold Threshold",
        min_value=0.0,
        max_value=99.0,
        value=30.0,
        step=1.0,
    )

    rsi_overbought = st.sidebar.number_input(
        "RSI Overbought Threshold",
        min_value=1.0,
        max_value=100.0,
        value=70.0,
        step=1.0,
    )

    if rsi_oversold >= rsi_overbought:
        st.sidebar.error(
            "RSI oversold threshold must be smaller "
            "than RSI overbought threshold."
        )
        st.stop()

else:
    bb_period = st.sidebar.number_input(
        "Bollinger Period (N)",
        min_value=2,
        value=20,
        step=1,
    )
    bb_std_dev = st.sidebar.number_input(
        "Std Dev Multiplier (k)",
        min_value=0.1,
        value=2.0,
        step=0.1,
        format="%.2f",
    )
    st.sidebar.caption("Statistical Mean Reversion: Buy at Lower Band (μ - kσ), exit at Middle SMA (μ).")

sizing_label = st.sidebar.selectbox(
    "Position Sizing",
    ["Unit Trade (1 share)", "Full Capital (All-in)", "Fixed Quantity"],
)

if sizing_label == "Unit Trade (1 share)":
    sizing_mode = "unit"
    quantity_per_trade = 1.0
elif sizing_label == "Full Capital (All-in)":
    sizing_mode = "all_in"
    quantity_per_trade = 1.0
else:
    sizing_mode = "fixed_quantity"
    quantity_per_trade = st.sidebar.number_input(
        "Shares per Trade",
        min_value=1.0,
        value=10.0,
        step=1.0,
    )

commission_rate = st.sidebar.number_input(
    "Commission Rate",
    min_value=0.0,
    value=0.001,
    step=0.0001,
    format="%.4f",
)

slippage_rate = st.sidebar.number_input(
    "Slippage Rate",
    min_value=0.0,
    value=0.001,
    step=0.0001,
    format="%.4f",
)

run_backtest = st.sidebar.button(
    "▶ Run Backtest",
    use_container_width=True,
)


# ---------------------------------------------------------
# Dataset Validation
# ---------------------------------------------------------

if not data_path.exists():
    st.error(f"Dataset not found: {data_path}")
    st.stop()


# ---------------------------------------------------------
# Run Backtest
# ---------------------------------------------------------

if run_backtest:
    try:
        bars = load_bars_from_csv(data_path)

        if not bars:
            st.error("The dataset contains no usable market bars.")
            st.stop()

        if selected_strategy == "Moving Average Crossover":
            strategy = MovingAverageCrossover(
                fast_period=int(fast_period),
                slow_period=int(slow_period),
            )
            use_crossover = True

        elif selected_strategy == "RSI":
            strategy = RSIStrategy(
                period=int(rsi_period),
                oversold=float(rsi_oversold),
                overbought=float(rsi_overbought),
            )
            use_crossover = False

        else:
            strategy = BollingerBandsStrategy(
                period=int(bb_period),
                std_dev_multiplier=float(bb_std_dev),
            )
            use_crossover = False

        backtest = Backtest(
            initial_cash=initial_cash,
            strategy=strategy,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=use_crossover,
            sizing_mode=sizing_mode,
            quantity_per_trade=float(quantity_per_trade),
        )

        result = backtest.run(bars)

    except (ValueError, TypeError, OSError) as error:
        st.error(f"Backtest failed: {error}")
        st.stop()

    # -----------------------------------------------------
    # Performance Summary
    # -----------------------------------------------------

    st.header("Backtest Results")

    metric_col1, metric_col2, metric_col3, metric_col4 = (
        st.columns(4)
    )

    metric_col1.metric(
        "Final Equity",
        f"₹{result.final_equity:,.2f}",
    )

    metric_col2.metric(
        "Total P&L",
        f"₹{result.total_pnl:,.2f}",
    )

    if result.metrics is not None:
        metric_col3.metric(
            "Total Return",
            f"{result.metrics.total_return:.2%}",
        )

        metric_col4.metric(
            "Max Drawdown",
            f"{result.metrics.max_drawdown:.2%}",
        )

        metric_col5, metric_col6, metric_col7 = st.columns(3)

        win_rate_str = (
            f"{result.metrics.win_rate:.1%}"
            if result.metrics.win_rate is not None
            else "N/A"
        )
        if result.metrics.profit_factor is None:
            pf_str = "N/A"
        elif math.isinf(result.metrics.profit_factor):
            pf_str = "∞ (No losses)"
        else:
            pf_str = f"{result.metrics.profit_factor:.2f}"

        metric_col5.metric("Win Rate", win_rate_str)
        metric_col6.metric("Profit Factor", pf_str)
        metric_col7.metric("Executed Trades", result.metrics.total_trades)

        metric_col8, metric_col9, metric_col10, metric_col11 = st.columns(4)

        sharpe_str = (
            f"{result.metrics.sharpe_ratio:.2f}"
            if result.metrics.sharpe_ratio is not None
            and not math.isinf(result.metrics.sharpe_ratio)
            else (
                "N/A"
                if result.metrics.sharpe_ratio is None
                else ("∞" if result.metrics.sharpe_ratio > 0 else "-∞")
            )
        )
        sortino_str = (
            f"{result.metrics.sortino_ratio:.2f}"
            if result.metrics.sortino_ratio is not None
            and not math.isinf(result.metrics.sortino_ratio)
            else (
                "N/A"
                if result.metrics.sortino_ratio is None
                else ("∞" if result.metrics.sortino_ratio > 0 else "0.00")
            )
        )
        cagr_str = (
            f"{result.metrics.cagr:.2%}"
            if result.metrics.cagr is not None
            else "N/A"
        )
        calmar_str = (
            f"{result.metrics.calmar_ratio:.2f}"
            if result.metrics.calmar_ratio is not None
            and not math.isinf(result.metrics.calmar_ratio)
            else (
                "N/A"
                if result.metrics.calmar_ratio is None
                else ("∞" if result.metrics.calmar_ratio > 0 else "0.00")
            )
        )

        metric_col8.metric("Sharpe (Rf=5%)", sharpe_str)
        metric_col9.metric("Sortino Ratio", sortino_str)
        metric_col10.metric("CAGR", cagr_str)
        metric_col11.metric("Calmar Ratio", calmar_str)
    else:
        metric_col3.metric("Total Return", "N/A")
        metric_col4.metric("Max Drawdown", "N/A")

    # -----------------------------------------------------
    # Result Interpretation
    # -----------------------------------------------------

    if result.total_pnl > 0:
        st.success(
            f"The strategy generated a profit of "
            f"₹{result.total_pnl:,.2f} after transaction costs."
        )
    elif result.total_pnl < 0:
        st.warning(
            f"The strategy generated a loss of "
            f"₹{abs(result.total_pnl):,.2f} after transaction costs."
        )
    else:
        st.info("The strategy finished approximately at breakeven.")

    # -----------------------------------------------------
    # Save Experiment to Database
    # -----------------------------------------------------

    with st.expander("💾 Save Experiment Run to History", expanded=False):
        save_col1, save_col2 = st.columns([3, 1])
        default_exp_name = f"{selected_strategy} on {selected_dataset}"
        exp_name_input = save_col1.text_input(
            "Experiment Run Name",
            value=default_exp_name,
            key="exp_save_name",
        )
        exp_notes_input = st.text_area(
            "Research Notes / Hypotheses",
            placeholder="e.g. Evaluated MA fast=10, slow=30 with 0.1% slippage during trend regime",
            key="exp_save_notes",
        )
        if save_col2.button("💾 Save Run", key="exp_save_btn", use_container_width=True):
            strat_key = "moving_average"
            params_dict: dict[str, Any] = {}
            if selected_strategy == "Moving Average Crossover":
                strat_key = "moving_average"
                params_dict = {
                    "fast_period": int(fast_period),
                    "slow_period": int(slow_period),
                }
            elif selected_strategy == "RSI":
                strat_key = "rsi"
                params_dict = {
                    "period": int(rsi_period),
                    "oversold": float(rsi_oversold),
                    "overbought": float(rsi_overbought),
                }
            else:
                strat_key = "bollinger"
                params_dict = {
                    "period": int(bb_period),
                    "std_dev_multiplier": float(bb_std_dev),
                }

            eq_list = [
                {
                    "timestamp": p.timestamp.isoformat()
                    if hasattr(p.timestamp, "isoformat")
                    else str(p.timestamp),
                    "equity": p.equity,
                    "cash": p.cash,
                    "position": p.position,
                }
                for p in result.equity_curve
            ]
            tr_list = [
                {
                    "timestamp": t.timestamp.isoformat()
                    if hasattr(t.timestamp, "isoformat")
                    else str(t.timestamp),
                    "side": t.side.value if hasattr(t.side, "value") else str(t.side),
                    "price": t.price,
                    "quantity": t.quantity,
                    "commission": t.commission,
                }
                for t in result.trades
            ]

            saved_rec = save_experiment(
                name=exp_name_input.strip() or default_exp_name,
                dataset=selected_dataset,
                strategy=strat_key,
                parameters=params_dict,
                initial_cash=initial_cash,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                sizing_mode=sizing_mode,
                quantity_per_trade=float(quantity_per_trade),
                final_equity=result.final_equity,
                total_pnl=result.total_pnl,
                total_return=result.metrics.total_return if result.metrics else 0.0,
                max_drawdown=result.metrics.max_drawdown if result.metrics else 0.0,
                total_trades=result.metrics.total_trades if result.metrics else len(result.trades),
                win_rate=result.metrics.win_rate if result.metrics else None,
                profit_factor=result.metrics.profit_factor if result.metrics else None,
                sharpe_ratio=result.metrics.sharpe_ratio if result.metrics else None,
                sortino_ratio=result.metrics.sortino_ratio if result.metrics else None,
                cagr=result.metrics.cagr if result.metrics else None,
                equity_curve=eq_list,
                trades=tr_list,
                notes=exp_notes_input,
            )
            st.success(f"Successfully saved Experiment #{saved_rec.id}: **{saved_rec.name}**")

    # -----------------------------------------------------
    # Strategy Configuration
    # -----------------------------------------------------

    st.header("Strategy Configuration")

    if selected_strategy == "Moving Average Crossover":
        config_col1, config_col2, config_col3, config_col4 = (
            st.columns(4)
        )

        config_col1.metric("Fast MA", fast_period)
        config_col2.metric("Slow MA", slow_period)
        config_col3.metric("Commission", f"{commission_rate:.2%}")
        config_col4.metric("Slippage", f"{slippage_rate:.2%}")
        st.caption(f"Position Sizing: {sizing_label}")

    else:
        config_col1, config_col2, config_col3, config_col4 = (
            st.columns(4)
        )

        config_col1.metric("RSI Period", rsi_period)
        config_col2.metric("Oversold", rsi_oversold)
        config_col3.metric("Overbought", rsi_overbought)
        config_col4.metric("Commission", f"{commission_rate:.2%}")

        st.caption(f"Slippage: {slippage_rate:.2%} | Position Sizing: {sizing_label}")

    # -----------------------------------------------------
    # Backtest Chart
    # -----------------------------------------------------

    st.header("Price & Portfolio Performance")

    figure = plot_backtest_results(
        bars=bars,
        equity_curve=result.equity_curve,
        trades=result.trades,
        symbol="RELIANCE",
    )

    st.pyplot(figure, use_container_width=True)

    # -----------------------------------------------------
    # Trade History
    # -----------------------------------------------------

    st.header("Trade History")

    trade_rows = [
        {
            "Date": trade.timestamp,
            "Side": trade.side.value.upper(),
            "Price": trade.price,
            "Quantity": trade.quantity,
            "Commission": trade.commission,
        }
        for trade in result.trades
    ]

    if trade_rows:
        st.dataframe(
            trade_rows,
            use_container_width=True,
            hide_index=True,
        )

        st.caption(f"Total executed trades: {len(result.trades)}")
    else:
        st.info("No trades were executed during the backtest.")

    # -----------------------------------------------------
    # Dataset Information
    # -----------------------------------------------------

    st.header("Dataset Information")

    data_col1, data_col2, data_col3 = st.columns(3)

    data_col1.metric("Bars Processed", result.bars_processed)

    data_col2.metric(
        "Start Date",
        bars[0].timestamp.strftime("%Y-%m-%d"),
    )

    data_col3.metric(
        "End Date",
        bars[-1].timestamp.strftime("%Y-%m-%d"),
    )

    # -----------------------------------------------------
    # Unified Strategy Comparison
    # -----------------------------------------------------

    st.header("Strategy Comparison")

    st.write(
        "Compare Moving Average Crossover and RSI configurations "
        "using the same dataset, initial capital, commission, "
        "slippage, and backtest engine."
    )

    if selected_strategy == "RSI":
        rsi_comparison_configurations = [
            (
                int(rsi_period),
                float(rsi_oversold),
                float(rsi_overbought),
            )
        ]
    else:
        rsi_comparison_configurations = [
            (14, 30.0, 70.0),
        ]

    if selected_strategy == "Bollinger Bands":
        bb_comparison_configurations = [
            (int(bb_period), float(bb_std_dev)),
        ]
    else:
        bb_comparison_configurations = [
            (10, 1.5),
            (20, 2.0),
        ]

    comparison_pairs = [
        (2, 3),
        (5, 20),
        (10, 30),
        (20, 50),
    ]

    try:
        comparison_results = compare_strategies(
            bars=bars,
            initial_cash=initial_cash,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            ma_parameter_pairs=comparison_pairs,
            rsi_configurations=rsi_comparison_configurations,
            bb_configurations=bb_comparison_configurations,
            sizing_mode=sizing_mode,
            quantity_per_trade=float(quantity_per_trade),
        )
        comparison_results.append(
            compare_buy_and_hold(
                bars=bars,
                initial_cash=initial_cash,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
                sizing_mode=sizing_mode,
                quantity_per_trade=float(quantity_per_trade),
            )
        )

    except (ValueError, TypeError, OSError) as error:
        st.error(f"Strategy comparison failed: {error}")
        comparison_results = []

    if comparison_results:
        comparison_rows = [
            {
                "Strategy": item.strategy_name,
                "Configuration": item.configuration,
                "Trades": item.trades,
                "Final Equity (₹)": round(item.final_equity, 2),
                "Total P&L (₹)": round(item.total_pnl, 2),
                "Return (%)": round(item.total_return * 100, 2),
                "Max Drawdown (%)": round(
                    item.max_drawdown * 100,
                    2,
                ),
                "Win Rate (%)": (
                    round(item.win_rate * 100, 1)
                    if item.win_rate is not None
                    else "N/A"
                ),
                "Profit Factor": (
                    round(item.profit_factor, 2)
                    if item.profit_factor is not None
                    and not math.isinf(item.profit_factor)
                    else ("∞" if item.profit_factor == float("inf") else "N/A")
                ),
                "Sharpe": (
                    round(item.sharpe_ratio, 2)
                    if item.sharpe_ratio is not None
                    and not math.isinf(item.sharpe_ratio)
                    else (
                        "N/A"
                        if item.sharpe_ratio is None
                        else ("∞" if item.sharpe_ratio > 0 else "-∞")
                    )
                ),
                "Sortino": (
                    round(item.sortino_ratio, 2)
                    if item.sortino_ratio is not None
                    and not math.isinf(item.sortino_ratio)
                    else (
                        "N/A"
                        if item.sortino_ratio is None
                        else ("∞" if item.sortino_ratio > 0 else "0.00")
                    )
                ),
                "CAGR (%)": (
                    round(item.cagr * 100, 2)
                    if item.cagr is not None
                    else "N/A"
                ),
            }
            for item in comparison_results
        ]

        st.dataframe(
            comparison_rows,
            use_container_width=True,
            hide_index=True,
        )

        best_strategy = max(
            comparison_results,
            key=lambda item: item.final_equity,
        )

        st.subheader("Best Result Among Tested Configurations")

        best_col1, best_col2, best_col3, best_col4 = st.columns(4)

        best_col1.metric(
            "Strategy",
            best_strategy.strategy_name,
        )

        best_col2.metric(
            "Configuration",
            best_strategy.configuration,
        )

        best_col3.metric(
            "Final Equity",
            f"₹{best_strategy.final_equity:,.2f}",
        )

        best_col4.metric(
            "Return",
            f"{best_strategy.total_return:.2%}",
        )

        st.caption(
            "The highest final equity identifies the best result in "
            "this tested group only. It does not establish future "
            "profitability or guarantee that the configuration "
            "will outperform in unseen market data."
        )
    else:
        st.warning(
            "No comparison results are available. Check the dataset "
            "and strategy configuration."
        )

    # -----------------------------------------------------
    # Research Interpretation
    # -----------------------------------------------------

    st.header("Research Interpretation")

    st.info(
        "This backtest evaluates historical performance; it does not "
        "guarantee future returns. Strategy comparisons are sensitive "
        "to transaction costs, parameter choices, market conditions, "
        "and execution assumptions. Validate promising configurations "
        "on unseen data before drawing conclusions."
    )

else:
    st.info(
        "Configure the strategy parameters in the sidebar and click "
        "**Run Backtest** to begin."
    )


# ---------------------------------------------------------
# Advanced Quantitative Analytics (WFO & Parameter Surface)
# ---------------------------------------------------------

st.divider()
st.header("Advanced Quantitative Analytics")

analytics_tab_wfo, analytics_tab_heatmap, analytics_tab_tearsheet, analytics_tab_basket, analytics_tab_history = st.tabs([
    "🔄 Walk-Forward Optimization (Out-of-Sample)",
    "🗺️ 2D Parameter Surface & Stability Heatmap",
    "📑 Quantitative Tear-Sheet & Tail-Risk Diagnostics",
    "🧺 Multi-Asset Basket & Portfolio Rebalancing",
    "📁 Saved Experiments / Run History",
])

with analytics_tab_wfo:
    st.subheader("Walk-Forward Out-of-Sample Optimization (WFO)")
    st.write(
        "Evaluate trading strategy robustness using Pardo (2008) rolling or expanding "
        "walk-forward optimization to detect curve-fitting and measure out-of-sample efficiency."
    )
    wfo_col1, wfo_col2, wfo_col3, wfo_col4 = st.columns(4)
    wfo_strat_choice = wfo_col1.selectbox("WFO Strategy", ["moving_average", "rsi", "bollinger"], key="wfo_strat")
    wfo_windows = wfo_col2.number_input("Windows", min_value=2, max_value=6, value=3, step=1, key="wfo_win")
    wfo_mode = wfo_col3.selectbox("Window Mode", ["rolling", "expanding"], key="wfo_mode")
    wfo_metric = wfo_col4.selectbox("Target Metric", ["sharpe_ratio", "profit_factor", "total_return"], key="wfo_metric")

    if st.button("▶ Run Walk-Forward Optimization", key="run_wfo_btn"):
        with st.spinner("Executing walk-forward forward testing..."):
            try:
                bars = load_bars_from_csv(data_path)
                wfo_res = run_walk_forward_optimization(
                    bars=bars,
                    strategy_name=wfo_strat_choice,
                    num_windows=int(wfo_windows),
                    window_mode=wfo_mode,
                    initial_cash=initial_cash,
                    commission_rate=commission_rate,
                    slippage_rate=slippage_rate,
                    sizing_mode=sizing_mode,
                    quantity_per_trade=float(quantity_per_trade),
                    optimization_metric=wfo_metric,
                )

                if "ROBUST" in wfo_res.robustness_grade:
                    eff_pct = f"{wfo_res.overall_efficiency:.1%}" if wfo_res.overall_efficiency is not None else "N/A"
                    st.success(f"**Robustness Grade:** {wfo_res.robustness_grade} — WFE: {eff_pct}")
                elif "MODERATE" in wfo_res.robustness_grade:
                    eff_pct = f"{wfo_res.overall_efficiency:.1%}" if wfo_res.overall_efficiency is not None else "N/A"
                    st.warning(f"**Robustness Grade:** {wfo_res.robustness_grade} — WFE: {eff_pct}")
                else:
                    eff_txt = f"{wfo_res.overall_efficiency:.1%}" if wfo_res.overall_efficiency is not None else "N/A"
                    st.error(f"**Robustness Grade:** {wfo_res.robustness_grade} — WFE: {eff_txt}")

                st.info(wfo_res.explanation)

                if wfo_res.stitched_oos_metrics:
                    m1, m2, m3, m4 = st.columns(4)
                    m1.metric("Stitched OOS Return", f"{wfo_res.stitched_oos_metrics.total_return:.2%}")
                    m2.metric("Stitched Total P&L", f"₹{wfo_res.stitched_oos_metrics.total_pnl:,.2f}")
                    m3.metric("Stitched Max Drawdown", f"{wfo_res.stitched_oos_metrics.max_drawdown:.2%}")
                    sharpe_val = f"{wfo_res.stitched_oos_metrics.sharpe_ratio:.2f}" if wfo_res.stitched_oos_metrics.sharpe_ratio is not None else "N/A"
                    m4.metric("Stitched Sharpe", sharpe_val)

                st.subheader("Stitched Out-of-Sample Cumulative Equity Curve")
                st.line_chart(wfo_res.stitched_oos_equity_curve)

                st.subheader("Walk-Forward Windows Breakdown")
                table_data = [
                    {
                        "Window": f"#{w.window_index + 1}",
                        "In-Sample Period": f"{w.in_sample_start.strftime('%Y-%m-%d')} → {w.in_sample_end.strftime('%Y-%m-%d')} ({w.in_sample_bars_count} bars)",
                        "Optimal Parameters": str(w.best_parameters),
                        "In-Sample Return": f"{w.in_sample_return:.2%}",
                        "Out-of-Sample Period": f"{w.out_of_sample_start.strftime('%Y-%m-%d')} → {w.out_of_sample_end.strftime('%Y-%m-%d')} ({w.out_of_sample_bars_count} bars)",
                        "Out-of-Sample Return": f"{w.out_of_sample_return:.2%}",
                        "Window WFE": f"{w.efficiency_ratio:.1%}" if w.efficiency_ratio is not None else "N/A",
                    }
                    for w in wfo_res.windows
                ]
                st.dataframe(table_data, use_container_width=True, hide_index=True)

            except (ValueError, TypeError, OSError) as error:
                st.error(f"Walk-Forward Optimization failed: {error}")

with analytics_tab_heatmap:
    st.subheader("2D Parameter Surface & Stability Analysis")
    st.write(
        "Detect brittle curve-fitting spikes versus stable parameter plateaus across "
        "combinations of Fast and Slow Moving Averages."
    )
    hm_col1, hm_col2 = st.columns(2)
    fast_str = hm_col1.text_input("Fast MA Periods (comma-separated)", value="2, 5, 8, 10, 12, 15, 20", key="hm_fast")
    slow_str = hm_col2.text_input("Slow MA Periods (comma-separated)", value="15, 20, 25, 30, 40, 50, 60", key="hm_slow")

    if st.button("▶ Run Parameter Heatmap Analysis", key="run_hm_btn"):
        with st.spinner("Evaluating parameter matrix..."):
            try:
                bars = load_bars_from_csv(data_path)
                fast_periods = [int(x.strip()) for x in fast_str.split(",") if x.strip().isdigit() and int(x.strip()) > 0]
                slow_periods = [int(x.strip()) for x in slow_str.split(",") if x.strip().isdigit() and int(x.strip()) > 0]
                if not fast_periods or not slow_periods:
                    st.error("Please enter at least one valid period for both Fast and Slow MA.")
                else:
                    hm_res = evaluate_parameter_grid_heatmap(
                        bars=bars,
                        fast_periods=fast_periods,
                        slow_periods=slow_periods,
                        initial_cash=initial_cash,
                        commission_rate=commission_rate,
                        slippage_rate=slippage_rate,
                        sizing_mode=sizing_mode,
                        quantity_per_trade=float(quantity_per_trade),
                    )

                    if "STABLE" in hm_res.stability_verdict:
                        st.success(f"**Verdict:** {hm_res.stability_verdict} — Plateau Ratio: {hm_res.plateau_ratio:.1%}")
                    else:
                        st.warning(f"**Verdict:** {hm_res.stability_verdict} — Plateau Ratio: {hm_res.plateau_ratio:.1%}")

                    hm_m1, hm_m2, hm_m3 = st.columns(3)
                    hm_m1.metric("Total Combinations", hm_res.total_combinations)
                    hm_m2.metric("Profitable Configurations", hm_res.profitable_combinations)
                    hm_m3.metric("Plateau Ratio", f"{hm_res.plateau_ratio:.1%}")

                    grid_rows = [
                        {
                            "Fast MA": pt.fast_period,
                            "Slow MA": pt.slow_period,
                            "Return (%)": f"{pt.total_return:.2%}",
                            "Total P&L (₹)": f"₹{pt.total_pnl:,.2f}",
                            "Sharpe": f"{pt.sharpe_ratio:.2f}" if pt.sharpe_ratio is not None else "N/A",
                            "Max Drawdown (%)": f"{pt.max_drawdown:.2%}",
                            "Trades": pt.trades_count,
                            "Win Rate (%)": f"{pt.win_rate:.1%}" if pt.win_rate is not None else "N/A",
                            "Profit Factor": f"{pt.profit_factor:.2f}" if pt.profit_factor is not None else "N/A",
                            "Plateau Robust?": "YES (Cluster)" if pt.is_plateau else "NO (Isolated)",
                        }
                        for pt in hm_res.grid
                    ]
                    st.dataframe(grid_rows, use_container_width=True, hide_index=True)

            except (ValueError, TypeError, OSError) as error:
                st.error(f"Parameter Heatmap evaluation failed: {error}")

with analytics_tab_tearsheet:
    st.subheader("Quantitative Tear-Sheet & Tail-Risk Diagnostics")
    st.write(
        "Evaluate Value-at-Risk (VaR 95/99%), Expected Shortfall (CVaR), Calmar ratio, "
        "calendar monthly/annual returns heatmap, and peak-to-trough underwater drawdown curves."
    )

    ts_c1, ts_c2, ts_c3 = st.columns([2, 2, 1])
    ts_strategy = ts_c1.selectbox(
        "Tear-Sheet Strategy",
        ["Moving Average Crossover", "RSI", "Bollinger Bands"],
        key="ts_strat_select",
    )
    ts_rf_rate = ts_c3.number_input(
        "Risk-Free Rate (Annual)",
        min_value=0.0,
        max_value=0.20,
        value=0.05,
        step=0.01,
        key="ts_rf_input",
    )

    if ts_strategy == "Moving Average Crossover":
        ts_p1, ts_p2 = ts_c2.columns(2)
        ts_fast = ts_p1.number_input("Fast MA", min_value=1, value=10, step=1, key="ts_fast_ma")
        ts_slow = ts_p2.number_input("Slow MA", min_value=2, value=30, step=1, key="ts_slow_ma")
    elif ts_strategy == "RSI":
        ts_p1, ts_p2, ts_p3 = ts_c2.columns(3)
        ts_rsi_p = ts_p1.number_input("RSI Period", min_value=2, value=14, step=1, key="ts_rsi_p")
        ts_os = ts_p2.number_input("Oversold", min_value=1.0, max_value=99.0, value=30.0, step=1.0, key="ts_rsi_os")
        ts_ob = ts_p3.number_input("Overbought", min_value=1.0, max_value=100.0, value=70.0, step=1.0, key="ts_rsi_ob")
    else:
        ts_p1, ts_p2 = ts_c2.columns(2)
        ts_bb_n = ts_p1.number_input("BB Period (N)", min_value=2, value=20, step=1, key="ts_bb_n")
        ts_bb_k = ts_p2.number_input("Multiplier (k)", min_value=0.1, value=2.0, step=0.1, key="ts_bb_k")

    if st.button("▶ Generate Quantitative Tear-Sheet", key="btn_run_tearsheet"):
        with st.spinner("Simulating strategy and computing risk tear-sheet..."):
            try:
                bars = load_bars_from_csv(data_path)
                if ts_strategy == "Moving Average Crossover":
                    if ts_fast >= ts_slow:
                        st.error("Fast MA must be smaller than Slow MA.")
                        st.stop()
                    strat_obj = MovingAverageCrossover(fast_period=int(ts_fast), slow_period=int(ts_slow))
                    crossover_flag = True
                elif ts_strategy == "RSI":
                    strat_obj = RSIStrategy(period=int(ts_rsi_p), oversold=float(ts_os), overbought=float(ts_ob))
                    crossover_flag = False
                else:
                    strat_obj = BollingerBandsStrategy(period=int(ts_bb_n), std_dev_multiplier=float(ts_bb_k))
                    crossover_flag = False

                b_engine = Backtest(
                    initial_cash=initial_cash,
                    strategy=strat_obj,
                    commission_rate=commission_rate,
                    slippage_rate=slippage_rate,
                    use_crossover=crossover_flag,
                    sizing_mode=sizing_mode,
                    quantity_per_trade=float(quantity_per_trade),
                )
                bt_res = b_engine.run(bars)

                sheet_data = generate_tear_sheet(
                    bars=bars,
                    equity_curve=bt_res.equity_curve,
                    trades=bt_res.trades,
                    initial_cash=initial_cash,
                    risk_free_rate=float(ts_rf_rate),
                )

                st.subheader("Executive Performance Scorecard")
                sc1, sc2, sc3, sc4 = st.columns(4)
                sc1.metric("Total Return", f"{sheet_data.summary.total_return:.2%}")
                sc2.metric("CAGR", f"{sheet_data.summary.cagr:.2%}" if sheet_data.summary.cagr is not None else "N/A")
                sc3.metric("Max Drawdown", f"{sheet_data.summary.max_drawdown:.2%}")
                calmar_v = f"{sheet_data.summary.calmar_ratio:.2f}" if sheet_data.summary.calmar_ratio is not None and not math.isinf(sheet_data.summary.calmar_ratio) else "N/A"
                sc4.metric("Calmar Ratio", calmar_v)

                sc5, sc6, sc7, sc8 = st.columns(4)
                sharpe_v = f"{sheet_data.summary.sharpe_ratio:.2f}" if sheet_data.summary.sharpe_ratio is not None and not math.isinf(sheet_data.summary.sharpe_ratio) else "N/A"
                sortino_v = f"{sheet_data.summary.sortino_ratio:.2f}" if sheet_data.summary.sortino_ratio is not None and not math.isinf(sheet_data.summary.sortino_ratio) else "N/A"
                win_v = f"{sheet_data.summary.win_rate:.1%}" if sheet_data.summary.win_rate is not None else "N/A"
                pf_v = f"{sheet_data.summary.profit_factor:.2f}" if sheet_data.summary.profit_factor is not None and not math.isinf(sheet_data.summary.profit_factor) else "N/A"
                sc5.metric("Sharpe Ratio", sharpe_v)
                sc6.metric("Sortino Ratio", sortino_v)
                sc7.metric("Win Rate", win_v)
                sc8.metric("Profit Factor", pf_v)

                st.subheader("Tail-Risk & Extreme Loss Diagnostics")
                r1, r2, r3, r4 = st.columns(4)
                var95_h = f"{sheet_data.tail_risk.var_95_historical:.2%}" if sheet_data.tail_risk.var_95_historical is not None else "N/A"
                var95_p = f"{sheet_data.tail_risk.var_95_parametric:.2%}" if sheet_data.tail_risk.var_95_parametric is not None else "N/A"
                cvar95 = f"{sheet_data.tail_risk.cvar_95:.2%}" if sheet_data.tail_risk.cvar_95 is not None else "N/A"
                var99_h = f"{sheet_data.tail_risk.var_99_historical:.2%}" if sheet_data.tail_risk.var_99_historical is not None else "N/A"
                r1.metric("Historical VaR (95%)", var95_h, help="Daily loss exceeded only 5% of trading sessions.")
                r2.metric("Parametric VaR (95%)", var95_p, help="Gaussian model -(μ - 1.645σ).")
                r3.metric("Expected Shortfall (CVaR 95%)", cvar95, help="Average loss strictly during worst 5% tail sessions.")
                r4.metric("Historical VaR (99%)", var99_h, help="1-in-100 day extreme tail loss.")

                r5, r6, r7, r8 = st.columns(4)
                cvar99 = f"{sheet_data.tail_risk.cvar_99:.2%}" if sheet_data.tail_risk.cvar_99 is not None else "N/A"
                vol_v = f"{sheet_data.tail_risk.annualized_volatility:.2%}" if sheet_data.tail_risk.annualized_volatility is not None else "N/A"
                tr_v = f"{sheet_data.tail_risk.tail_ratio:.2f}" if sheet_data.tail_risk.tail_ratio is not None else "N/A"
                skew_v = f"{sheet_data.tail_risk.skewness:.2f}" if sheet_data.tail_risk.skewness is not None else "N/A"
                r5.metric("Expected Shortfall (CVaR 99%)", cvar99, help="Average loss in worst 1% catastrophic market events.")
                r6.metric("Annualized Volatility", vol_v, help="Daily standard deviation annualized (√252).")
                r7.metric("Tail Ratio (P95/|P5|)", tr_v, help="Values > 1.0 indicate positive upside tail skew.")
                r8.metric("Return Skewness", skew_v, help="Third standardized moment asymmetry.")

                st.subheader("Calendar Monthly & Annual Return Heatmap")
                matrix_rows = []
                for m_row in sheet_data.monthly_matrix:
                    row_dict = {"Year": str(m_row.year)}
                    for m_name, val in m_row.months.items():
                        row_dict[m_name] = f"{val:.1%}" if val is not None else "—"
                    row_dict["Year Total"] = f"{m_row.year_total:.2%}"
                    matrix_rows.append(row_dict)
                st.dataframe(matrix_rows, use_container_width=True, hide_index=True)

                st.subheader("Underwater Portfolio Drawdown Curve")
                underwater_df = pd.DataFrame([
                    {"Date": pt.timestamp, "Drawdown (%)": pt.drawdown * 100}
                    for pt in sheet_data.underwater_curve
                ]).set_index("Date")
                st.area_chart(underwater_df)

            except (ValueError, TypeError, OSError) as error:
                st.error(f"Tear-sheet generation failed: {error}")

with analytics_tab_basket:
    st.subheader("🧺 Multi-Asset Basket & Portfolio Rebalancing Engine")
    st.write(
        "Simultaneously simulate multi-asset portfolios across arbitrary asset collections. "
        "Evaluate Equal Weight (1/N), Inverse Volatility (Risk Parity), and Custom Target Allocations "
        "with next-bar open execution and monthly/quarterly rebalancing friction."
    )

    csv_files = [p.name for p in sorted(DATA_DIR.glob("*.csv"))]
    selected_baskets = st.multiselect(
        "Asset Universe (select 2 or more)",
        options=csv_files,
        default=csv_files[:2] if len(csv_files) >= 2 else csv_files,
        key="basket_multiselect",
    )

    b_col1, b_col2, b_col3, b_col4 = st.columns(4)
    weighting_scheme = b_col1.selectbox(
        "Weighting Scheme",
        ["Equal Weight (1/N)", "Inverse Volatility (Risk Parity)", "Custom Target Weights"],
        key="basket_weighting_choice",
    )
    rebalance_schedule = b_col2.selectbox(
        "Rebalance Schedule",
        ["Monthly", "Quarterly", "Buy & Hold (None)"],
        key="basket_rebalance_choice",
    )
    basket_cash = b_col3.number_input(
        "Portfolio Cash (₹)",
        min_value=1000.0,
        value=100000.0,
        step=10000.0,
        key="basket_cash_input",
    )
    basket_comm = b_col4.number_input(
        "Commission Rate",
        min_value=0.0,
        max_value=0.05,
        value=0.001,
        step=0.0005,
        format="%.4f",
        key="basket_comm_input",
    )

    custom_weights_dict: dict[str, float] = {}
    if weighting_scheme == "Custom Target Weights" and selected_baskets:
        st.write("**Specify Custom Target Allocations (%):**")
        w_cols = st.columns(min(len(selected_baskets), 4))
        for idx, fname in enumerate(selected_baskets):
            sym = fname.replace("_daily.csv", "").replace(".csv", "").upper()
            col = w_cols[idx % len(w_cols)]
            default_val = round(100.0 / len(selected_baskets), 1)
            custom_weights_dict[sym] = (
                col.number_input(
                    f"{sym} Weight (%)",
                    min_value=0.0,
                    max_value=100.0,
                    value=default_val,
                    step=5.0,
                    key=f"cust_w_{sym}",
                )
                / 100.0
            )

    if st.button("▶ Run Basket Portfolio Simulation", key="run_basket_portfolio_btn"):
        if not selected_baskets:
            st.error("Please select at least one dataset for the portfolio basket.")
        else:
            with st.spinner("Simulating multi-asset portfolio with next-bar rebalancing..."):
                try:
                    bars_map = {}
                    for fname in selected_baskets:
                        fpath = DATA_DIR / fname
                        bars = load_bars_from_csv(fpath)
                        sym = fname.replace("_daily.csv", "").replace(".csv", "").upper()
                        bars_map[sym] = bars

                    # Map enums
                    if weighting_scheme == "Equal Weight (1/N)":
                        w_enum = AllocationWeighting.EQUAL_WEIGHT
                    elif weighting_scheme == "Inverse Volatility (Risk Parity)":
                        w_enum = AllocationWeighting.INVERSE_VOLATILITY
                    else:
                        w_enum = AllocationWeighting.CUSTOM

                    if rebalance_schedule == "Monthly":
                        r_enum = RebalanceFrequency.MONTHLY
                    elif rebalance_schedule == "Quarterly":
                        r_enum = RebalanceFrequency.QUARTERLY
                    else:
                        r_enum = RebalanceFrequency.NONE

                    engine = BasketBacktestEngine(
                        initial_cash=basket_cash,
                        weighting=w_enum,
                        custom_weights=custom_weights_dict if w_enum == AllocationWeighting.CUSTOM else None,
                        rebalance_freq=r_enum,
                        commission_rate=basket_comm,
                        slippage_rate=slippage_rate,
                    )

                    basket_res = engine.run(bars_map)

                    st.success("✅ Basket Simulation Complete!")

                    # Summary metric cards
                    sm1, sm2, sm3, sm4, sm5, sm6 = st.columns(6)
                    sm1.metric("Total Return", f"{basket_res.metrics.total_return:.2%}")
                    sm2.metric("Total P&L", f"₹{basket_res.total_pnl:,.2f}")
                    cagr_str = f"{basket_res.metrics.cagr:.2%}" if basket_res.metrics.cagr is not None else "N/A"
                    sm3.metric("CAGR", cagr_str)
                    sm4.metric("Max Drawdown", f"{basket_res.metrics.max_drawdown:.2%}")
                    sharpe_str = f"{basket_res.metrics.sharpe_ratio:.2f}" if basket_res.metrics.sharpe_ratio is not None else "N/A"
                    sm5.metric("Sharpe Ratio", sharpe_str)
                    sm6.metric("Total Trades", str(len(basket_res.trades)))

                    # Asset Allocations & Holdings
                    st.subheader("Target Allocations & Asset Breakdown")
                    alloc_rows = [
                        {
                            "Symbol": sym,
                            "Target Weight": f"{basket_res.asset_weights.get(sym, 0.0):.1%}",
                            "Final Holdings": f"{basket_res.holdings.get(sym, 0.0):,.2f} units",
                        }
                        for sym in sorted(basket_res.asset_weights.keys())
                    ]
                    st.dataframe(alloc_rows, use_container_width=True, hide_index=True)

                    # Tail Risk Metrics
                    st.subheader("Tail Risk & Value-at-Risk (VaR)")
                    tr1, tr2, tr3, tr4 = st.columns(4)
                    v95 = f"{basket_res.tail_risk.var_95_historical:.2%}" if basket_res.tail_risk.var_95_historical is not None else "N/A"
                    tr1.metric("95% Historical VaR", v95)
                    v99 = f"{basket_res.tail_risk.var_99_historical:.2%}" if basket_res.tail_risk.var_99_historical is not None else "N/A"
                    tr2.metric("99% Historical VaR", v99)
                    cv95 = f"{basket_res.tail_risk.cvar_95:.2%}" if basket_res.tail_risk.cvar_95 is not None else "N/A"
                    tr3.metric("95% CVaR (Expected Shortfall)", cv95)
                    trato = f"{basket_res.tail_risk.tail_ratio:.2f}" if basket_res.tail_risk.tail_ratio is not None else "N/A"
                    tr4.metric("Tail Ratio", trato)

                    # Equity Chart
                    st.subheader("Portfolio Equity Growth")
                    eq_points = [
                        {"timestamp": pt.timestamp, "Portfolio Equity": pt.equity, "Cash": pt.cash}
                        for pt in basket_res.equity_points
                    ]
                    eq_df = pd.DataFrame(eq_points).set_index("timestamp")
                    st.line_chart(eq_df["Portfolio Equity"])

                    # Trades log
                    if basket_res.trades:
                        st.subheader(f"Executed Allocation & Rebalancing Orders ({len(basket_res.trades)})")
                        trades_table = [
                            {
                                "Timestamp": t.timestamp.strftime("%Y-%m-%d"),
                                "Symbol": t.symbol,
                                "Side": t.side.value if hasattr(t.side, "value") else str(t.side),
                                "Price": f"₹{t.price:,.2f}",
                                "Quantity": f"{t.quantity:,.2f}",
                                "Commission": f"₹{t.commission:,.2f}",
                                "Reason": t.reason,
                            }
                            for t in basket_res.trades
                        ]
                        st.dataframe(trades_table, use_container_width=True, hide_index=True)

                except (ValueError, TypeError, KeyError, OSError, RuntimeError) as e:
                    st.error(f"Error during basket simulation: {e}")

with analytics_tab_history:
    st.subheader("Persistent Experiment History (SQLite Repository)")
    st.write(
        "Browse, inspect, and manage saved backtest simulations across datasets and strategies "
        "to track hypothesis progression and maintain reproducible quantitative research."
    )

    filter_c1, filter_c2, filter_c3 = st.columns([2, 2, 1])
    hist_datasets = ["All"] + available_datasets
    selected_hist_dataset = filter_c1.selectbox(
        "Filter by Dataset",
        hist_datasets,
        key="hist_filter_ds",
    )
    hist_strategies = ["All", "moving_average", "rsi", "bollinger"]
    selected_hist_strategy = filter_c2.selectbox(
        "Filter by Strategy",
        hist_strategies,
        key="hist_filter_strat",
    )

    ds_arg = None if selected_hist_dataset == "All" else selected_hist_dataset
    strat_arg = None if selected_hist_strategy == "All" else selected_hist_strategy

    try:
        experiments = list_experiments(dataset=ds_arg, strategy=strat_arg)
        filter_c3.metric("Saved Runs", len(experiments))

        if not experiments:
            st.info(
                "No saved experiments match the filter criteria. "
                "Run a backtest above and expand 'Save Experiment Run' to persist your results."
            )
        else:
            table_summary = [
                {
                    "ID": exp.id,
                    "Name": exp.name,
                    "Created At": exp.created_at[:19].replace("T", " "),
                    "Dataset": exp.dataset,
                    "Strategy": exp.strategy,
                    "Return": f"{exp.total_return:.2%}",
                    "Max Drawdown": f"{exp.max_drawdown:.2%}",
                    "Sharpe": (
                        f"{exp.sharpe_ratio:.2f}"
                        if exp.sharpe_ratio is not None
                        else "N/A"
                    ),
                    "Trades": exp.total_trades,
                    "Win Rate": (
                        f"{exp.win_rate:.1%}"
                        if exp.win_rate is not None
                        else "N/A"
                    ),
                    "Notes": exp.notes if exp.notes else "—",
                }
                for exp in experiments
            ]
            st.dataframe(table_summary, use_container_width=True, hide_index=True)

            st.divider()
            st.subheader("Inspect Saved Experiment Details")
            exp_options = {
                f"#{e.id}: {e.name} ({e.strategy} on {e.dataset})": e.id
                for e in experiments
            }
            chosen_label = st.selectbox(
                "Select Experiment to Inspect",
                list(exp_options.keys()),
                key="sel_inspect_exp",
            )
            chosen_id = exp_options[chosen_label]

            exp_detail = get_experiment(chosen_id)
            if exp_detail is not None:
                det_m1, det_m2, det_m3, det_m4 = st.columns(4)
                det_m1.metric("Final Equity", f"₹{exp_detail.final_equity:,.2f}")
                det_m2.metric("Total P&L", f"₹{exp_detail.total_pnl:,.2f}")
                det_m3.metric("Total Return", f"{exp_detail.total_return:.2%}")
                det_m4.metric("Max Drawdown", f"{exp_detail.max_drawdown:.2%}")

                st.caption(
                    f"**Parameters:** `{exp_detail.parameters}` | "
                    f"**Sizing:** {exp_detail.sizing_mode} ({exp_detail.quantity_per_trade}) | "
                    f"**Commission:** {exp_detail.commission_rate:.2%} | "
                    f"**Slippage:** {exp_detail.slippage_rate:.2%}"
                )
                if exp_detail.notes:
                    st.info(f"**Research Notes:** {exp_detail.notes}")

                if exp_detail.equity_curve:
                    st.subheader("Equity Curve")
                    eq_df = pd.DataFrame(exp_detail.equity_curve)
                    if "timestamp" in eq_df.columns and "equity" in eq_df.columns:
                        eq_df["timestamp"] = pd.to_datetime(eq_df["timestamp"])
                        eq_df = eq_df.set_index("timestamp")
                        st.line_chart(eq_df["equity"])

                if exp_detail.trades:
                    st.subheader(f"Executed Trades ({len(exp_detail.trades)})")
                    st.dataframe(
                        exp_detail.trades,
                        use_container_width=True,
                        hide_index=True,
                    )

                del_col1, del_col2 = st.columns([4, 1])
                if del_col2.button(
                    f"🗑️ Delete #{exp_detail.id}",
                    key=f"del_exp_{exp_detail.id}",
                    type="secondary",
                ):
                    delete_experiment(exp_detail.id)
                    st.warning(f"Deleted Experiment #{exp_detail.id}")
                    st.rerun()

    except (ValueError, TypeError, OSError, sqlite3.Error) as e:
        st.error(f"Failed to access experiment repository: {e}")
