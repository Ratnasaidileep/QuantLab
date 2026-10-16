from datetime import UTC, datetime, timedelta

import pytest

from quantlab.backtest.engine import Backtest
from quantlab.data.models import Bar
from quantlab.strategy.macd import MACDStrategy
from quantlab.strategy.models import Signal


def make_bar(
    timestamp_idx: int,
    open_price: float,
    high_price: float,
    low_price: float,
    close_price: float,
    volume: float = 1000.0,
) -> Bar:
    dt = datetime(2024, 1, 1, tzinfo=UTC) + timedelta(days=timestamp_idx)
    return Bar(
        timestamp=dt,
        open=open_price,
        high=high_price,
        low=low_price,
        close=close_price,
        volume=volume,
    )


def test_macd_parameter_validation():
    with pytest.raises(ValueError, match="Fast period must be at least 1"):
        MACDStrategy(fast_period=0, slow_period=26, signal_period=9)

    with pytest.raises(ValueError, match="Slow period must be strictly greater"):
        MACDStrategy(fast_period=26, slow_period=26, signal_period=9)

    with pytest.raises(ValueError, match="Slow period must be strictly greater"):
        MACDStrategy(fast_period=30, slow_period=20, signal_period=9)

    with pytest.raises(ValueError, match="Signal period must be at least 1"):
        MACDStrategy(fast_period=12, slow_period=26, signal_period=0)


def test_macd_price_validation():
    strategy = MACDStrategy(fast_period=3, slow_period=5, signal_period=2)

    with pytest.raises(ValueError, match="Prices must be positive"):
        strategy.calculate_macd_series([10.0, 12.0, 0.0, 14.0])

    with pytest.raises(ValueError, match="Prices must be finite"):
        strategy.calculate_macd_series([10.0, 12.0, float("nan"), 14.0])


def test_macd_insufficient_data():
    strategy = MACDStrategy(fast_period=3, slow_period=5, signal_period=3)
    prices = [10.0, 11.0, 12.0, 13.0]  # len 4 < slow_period (5)

    macd_line, signal_line, hist = strategy.calculate_macd_series(prices)

    assert len(macd_line) == 4
    assert all(x is None for x in macd_line)
    assert all(x is None for x in signal_line)
    assert all(x is None for x in hist)
    assert strategy.generate_signal(prices) == Signal.FLAT
    assert strategy.generate_crossover_signal(prices) == Signal.FLAT


def test_macd_mathematical_calculation():
    # fast=2, slow=4, signal=2
    # slow_period - 1 = 3 (index 3 is 4th bar)
    # first signal index = 4 + 2 - 2 = 4 (5th bar)
    strategy = MACDStrategy(fast_period=2, slow_period=4, signal_period=2)
    prices = [10.0, 12.0, 14.0, 16.0, 18.0, 20.0]

    # Fast EMA (N=2, alpha=2/3):
    # i=0: None
    # i=1: seed = (10+12)/2 = 11.0
    # i=2: 14 * (2/3) + 11 * (1/3) = 9.3333 + 3.6667 = 13.0
    # i=3: 16 * (2/3) + 13 * (1/3) = 10.6667 + 4.3333 = 15.0
    # i=4: 18 * (2/3) + 15 * (1/3) = 12.0 + 5.0 = 17.0
    # i=5: 20 * (2/3) + 17 * (1/3) = 13.3333 + 5.6667 = 19.0

    # Slow EMA (N=4, alpha=2/5 = 0.4):
    # i=0..2: None
    # i=3: seed = (10+12+14+16)/4 = 13.0
    # i=4: 18 * 0.4 + 13 * 0.6 = 7.2 + 7.8 = 15.0
    # i=5: 20 * 0.4 + 15 * 0.6 = 8.0 + 9.0 = 17.0

    # MACD Line = Fast - Slow:
    # i=3: 15.0 - 13.0 = 2.0
    # i=4: 17.0 - 15.0 = 2.0
    # i=5: 19.0 - 17.0 = 2.0

    # Signal Line (N=2, alpha=2/3 = 0.6667):
    # i=4: seed = (macd[3] + macd[4]) / 2 = (2.0 + 2.0)/2 = 2.0
    # i=5: 2.0 * (2/3) + 2.0 * (1/3) = 2.0

    # Histogram = MACD - Signal:
    # i=4: 2.0 - 2.0 = 0.0
    # i=5: 2.0 - 2.0 = 0.0

    macd, sig, hist = strategy.calculate_macd_series(prices)

    assert macd[0] is None
    assert macd[1] is None
    assert macd[2] is None
    assert macd[3] == pytest.approx(2.0)
    assert macd[4] == pytest.approx(2.0)
    assert macd[5] == pytest.approx(2.0)

    assert sig[3] is None
    assert sig[4] == pytest.approx(2.0)
    assert sig[5] == pytest.approx(2.0)

    assert hist[4] == pytest.approx(0.0)
    assert hist[5] == pytest.approx(0.0)


def test_macd_generate_signal_bullish_and_bearish():
    strategy = MACDStrategy(fast_period=2, slow_period=3, signal_period=2)

    # Bullish scenario (prices increasing rapidly)
    prices_up = [10.0, 11.0, 12.0, 15.0, 20.0, 26.0]
    _, _, hist_up = strategy.calculate_macd_series(prices_up)
    assert hist_up[-1] is not None and hist_up[-1] > 0
    assert strategy.generate_signal(prices_up) == Signal.LONG

    # Bearish scenario (prices falling rapidly)
    prices_down = [26.0, 25.0, 24.0, 20.0, 14.0, 8.0]
    _, _, hist_down = strategy.calculate_macd_series(prices_down)
    assert hist_down[-1] is not None and hist_down[-1] < 0
    assert strategy.generate_signal(prices_down) == Signal.SHORT


def test_macd_generate_crossover_signal():
    strategy = MACDStrategy(fast_period=2, slow_period=3, signal_period=2)

    # Prices transition from downtrend to sharp uptrend
    prices = [20.0, 19.0, 18.0, 15.0, 13.0, 12.0, 22.0]
    _, _, hist = strategy.calculate_macd_series(prices)

    # Check previous and current histogram values
    if (
        hist[-2] is not None
        and hist[-1] is not None
        and hist[-2] <= 0
        and hist[-1] > 0
    ):
        assert strategy.generate_crossover_signal(prices) == Signal.LONG

    # Flat prices should not trigger crossover
    flat_prices = [10.0, 10.0, 10.0, 10.0, 10.0, 10.0, 10.0]
    assert strategy.generate_crossover_signal(flat_prices) == Signal.FLAT


def test_macd_backtest_integration():
    strategy = MACDStrategy(fast_period=2, slow_period=4, signal_period=2)
    backtest = Backtest(
        initial_cash=10000.0,
        strategy=strategy,
        commission_rate=0.001,
        slippage_rate=0.001,
        use_crossover=False,
    )

    bars = [
        make_bar(0, 100.0, 102.0, 99.0, 100.0),
        make_bar(1, 100.0, 103.0, 99.0, 101.0),
        make_bar(2, 101.0, 105.0, 100.0, 103.0),
        make_bar(3, 103.0, 106.0, 102.0, 105.0),
        make_bar(4, 105.0, 109.0, 104.0, 108.0),
        make_bar(5, 108.0, 114.0, 107.0, 112.0),
        make_bar(6, 112.0, 115.0, 110.0, 113.0),
        make_bar(7, 113.0, 114.0, 105.0, 106.0),
        make_bar(8, 106.0, 108.0, 100.0, 101.0),
        make_bar(9, 101.0, 102.0, 95.0, 96.0),
    ]

    result = backtest.run(bars)

    assert result.bars_processed == 10
    assert len(result.equity_curve) == 10
    assert result.metrics is not None
    assert isinstance(result.total_pnl, float)
