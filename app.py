

from pathlib import Path

import streamlit as st

from quantlab.analytics.plotting import plot_backtest_results
from quantlab.analytics.strategy_comparison import (
    compare_buy_and_hold,
    compare_strategies,
)
from quantlab.backtest.engine import Backtest
from quantlab.data.csv_loader import load_bars_from_csv
from quantlab.strategy.moving_average import MovingAverageCrossover
from quantlab.strategy.rsi import RSIStrategy

DATA_PATH = Path("data/reliance_daily.csv")



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
    "Test quantitative trading strategies on historical RELIANCE "
    "market data and evaluate performance after transaction costs."
)


# ---------------------------------------------------------
# Sidebar
# ---------------------------------------------------------

st.sidebar.header("Backtest Configuration")

selected_strategy = st.sidebar.selectbox(
    "Trading Strategy",
    ["Moving Average Crossover", "RSI"],
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

else:
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

if not DATA_PATH.exists():
    st.error(f"Dataset not found: {DATA_PATH}")
    st.stop()


# ---------------------------------------------------------
# Run Backtest
# ---------------------------------------------------------

if run_backtest:
    try:
        bars = load_bars_from_csv(DATA_PATH)

        if not bars:
            st.error("The dataset contains no usable market bars.")
            st.stop()

        if selected_strategy == "Moving Average Crossover":
            strategy = MovingAverageCrossover(
                fast_period=int(fast_period),
                slow_period=int(slow_period),
            )
            use_crossover = True

        else:
            strategy = RSIStrategy(
                period=int(rsi_period),
                oversold=float(rsi_oversold),
                overbought=float(rsi_overbought),
            )
            use_crossover = False

        backtest = Backtest(
            initial_cash=initial_cash,
            strategy=strategy,
            commission_rate=commission_rate,
            slippage_rate=slippage_rate,
            use_crossover=use_crossover,
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

    else:
        config_col1, config_col2, config_col3, config_col4 = (
            st.columns(4)
        )

        config_col1.metric("RSI Period", rsi_period)
        config_col2.metric("Oversold", rsi_oversold)
        config_col3.metric("Overbought", rsi_overbought)
        config_col4.metric("Commission", f"{commission_rate:.2%}")

        st.caption(f"Slippage: {slippage_rate:.2%}")

    # -----------------------------------------------------
    # Backtest Chart
    # -----------------------------------------------------

    st.header("Price & Portfolio Performance")

    figure = plot_backtest_results(
        bars=bars,
        equity_curve=result.equity_curve,
        trades=result.trades,
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
        )
        comparison_results.append(
            compare_buy_and_hold(
                bars=bars,
                initial_cash=initial_cash,
                commission_rate=commission_rate,
                slippage_rate=slippage_rate,
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
