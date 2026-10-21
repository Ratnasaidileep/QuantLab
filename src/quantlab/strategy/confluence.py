import math
from collections.abc import Sequence

from quantlab.strategy.models import Signal


class ConfluenceStrategy:
    """Multi-Indicator Confluence Strategy: Trend Regime Filter + Momentum Pullback.

    Combines:
    1. Macro Trend Filter: Exponential Moving Average (EMA) of period `trend_period`.
       A long entry is only permitted if Price > EMA (bullish regime).
    2. Micro Momentum Oscillator: Wilder's RSI of period `pullback_period`.
       Buys oversold pullbacks (RSI <= oversold) while the macro trend is intact.

    Exit Logic:
    - Exits to FLAT when momentum target is reached (RSI >= overbought).
    - Exits to FLAT immediately if the macro trend structurally breaks (Price < EMA).

    All calculations strictly prevent look-ahead bias and process data sequentially.
    """

    def __init__(
        self,
        trend_period: int = 50,
        pullback_period: int = 14,
        oversold: float = 35.0,
        overbought: float = 65.0,
    ) -> None:
        if trend_period < 2:
            raise ValueError("trend_period must be at least 2.")
        if pullback_period < 2:
            raise ValueError("pullback_period must be at least 2.")
        if not (0.0 <= oversold < overbought <= 100.0):
            raise ValueError(
                f"Thresholds must satisfy 0 <= oversold < overbought <= 100 (got oversold={oversold}, overbought={overbought})."
            )

        self.trend_period = trend_period
        self.pullback_period = pullback_period
        self.oversold = oversold
        self.overbought = overbought

    def calculate_indicators(
        self, prices: Sequence[float]
    ) -> tuple[list[float | None], list[float | None]]:
        """Calculate (trend_ema, rsi_series) with zero look-ahead bias."""
        for price in prices:
            if not isinstance(price, (int, float)) or not math.isfinite(price):
                raise ValueError("Prices must be finite numbers.")
            if price <= 0:
                raise ValueError("Prices must be positive.")

        n = len(prices)
        trend_ema: list[float | None] = [None] * n
        rsi_series: list[float | None] = [None] * n

        # 1. Trend EMA
        if n >= self.trend_period:
            alpha = 2.0 / (self.trend_period + 1)
            seed = sum(float(p) for p in prices[: self.trend_period]) / self.trend_period
            trend_ema[self.trend_period - 1] = seed
            for i in range(self.trend_period, n):
                prev_ema = trend_ema[i - 1]
                if prev_ema is not None:
                    trend_ema[i] = float(prices[i]) * alpha + prev_ema * (1.0 - alpha)

        # 2. Wilder's RSI
        if n > self.pullback_period:
            changes = [
                float(prices[i]) - float(prices[i - 1])
                for i in range(1, n)
            ]
            gains = [max(change, 0.0) for change in changes]
            losses = [max(-change, 0.0) for change in changes]

            avg_gain = sum(gains[: self.pullback_period]) / self.pullback_period
            avg_loss = sum(losses[: self.pullback_period]) / self.pullback_period

            def compute_rsi(gain: float, loss: float) -> float:
                if gain == 0.0 and loss == 0.0:
                    return 50.0
                if loss == 0.0:
                    return 100.0
                if gain == 0.0:
                    return 0.0
                rs = gain / loss
                return 100.0 - (100.0 / (1.0 + rs))

            rsi_series[self.pullback_period] = compute_rsi(avg_gain, avg_loss)

            for i in range(self.pullback_period + 1, n):
                c_idx = i - 1
                avg_gain = (avg_gain * (self.pullback_period - 1) + gains[c_idx]) / self.pullback_period
                avg_loss = (avg_loss * (self.pullback_period - 1) + losses[c_idx]) / self.pullback_period
                rsi_series[i] = compute_rsi(avg_gain, avg_loss)

        return trend_ema, rsi_series

    def generate_signal(self, prices: Sequence[float]) -> Signal:
        """Return the target position (LONG or FLAT) implied by the full price series."""
        trend_ema, rsi_series = self.calculate_indicators(prices)
        target = Signal.FLAT

        for i, price in enumerate(prices):
            ema = trend_ema[i]
            rsi = rsi_series[i]

            # Require both indicators to be valid before making decisions
            if ema is None or rsi is None:
                continue

            in_uptrend = price > ema

            if target == Signal.FLAT and in_uptrend and rsi <= self.oversold:
                target = Signal.LONG
            elif target == Signal.LONG and (rsi >= self.overbought or not in_uptrend):
                target = Signal.FLAT

        return target

    def generate_crossover_signal(self, prices: Sequence[float]) -> Signal:
        """Return a discrete crossover signal (LONG on entry, SHORT/FLAT on exit)."""
        if len(prices) < 2:
            return Signal.FLAT

        curr_signal = self.generate_signal(prices)
        prev_signal = self.generate_signal(prices[:-1])

        if prev_signal == Signal.FLAT and curr_signal == Signal.LONG:
            return Signal.LONG
        if prev_signal == Signal.LONG and curr_signal == Signal.FLAT:
            return Signal.SHORT
        return Signal.FLAT
