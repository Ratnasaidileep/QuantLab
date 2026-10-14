from collections.abc import Sequence

import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

from quantlab.backtest.models import Trade, TradeSide
from quantlab.data.models import Bar


def plot_backtest_results(
    bars: Sequence[Bar],
    equity_curve: Sequence[float],
    trades: Sequence[Trade],
    symbol: str = "Price",
):
    """Plot price, executed trades, and portfolio equity."""

    if len(bars) != len(equity_curve):
        raise ValueError(
            "Bars and equity curve must contain the same number of points."
        )

    timestamps = [bar.timestamp for bar in bars]
    prices = [bar.close for bar in bars]

    figure, (price_axis, equity_axis) = plt.subplots(
        2,
        1,
        figsize=(12, 8),
        sharex=True,
    )

    price_label = f"{symbol} Close" if symbol else "Close"

    price_axis.plot(
        timestamps,
        prices,
        label=price_label,
    )

    buy_trades = [
        trade for trade in trades
        if trade.side == TradeSide.BUY
    ]

    sell_trades = [
        trade for trade in trades
        if trade.side == TradeSide.SELL
    ]

    price_axis.scatter(
        [trade.timestamp for trade in buy_trades],
        [trade.price for trade in buy_trades],
        marker="^",
        label="Buy",
    )

    price_axis.scatter(
        [trade.timestamp for trade in sell_trades],
        [trade.price for trade in sell_trades],
        marker="v",
        label="Sell",
    )

    price_axis.set_ylabel("Price")
    price_axis.set_title("Strategy Trades")
    price_axis.legend()
    price_axis.grid(True)

    equity_axis.plot(
        timestamps,
        equity_curve,
        label="Portfolio Equity",
    )

    equity_axis.yaxis.set_major_formatter(
        FuncFormatter(lambda value, _: f"₹{value:,.0f}")
    )

    equity_axis.set_xlabel("Date")
    equity_axis.set_ylabel("Equity")
    equity_axis.set_title("Portfolio Equity Curve")
    equity_axis.legend()
    equity_axis.grid(True)

    figure.tight_layout()

    return figure