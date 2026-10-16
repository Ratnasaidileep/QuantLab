import math
from collections.abc import Sequence

from quantlab.strategy.models import Signal


class MACDStrategy:
    """Trend-following and momentum strategy using Moving Average Convergence Divergence (MACD).

    Calculates:
    - Fast EMA (default 12)
    - Slow EMA (default 26)
    - MACD Line = Fast EMA - Slow EMA
    - Signal Line = EMA of MACD Line (default 9)
    - MACD Histogram = MACD Line - Signal Line

    Signals:
    - generate_signal: returns Signal.LONG when MACD Line > Signal Line (Histogram > 0),
      Signal.SHORT when MACD Line < Signal Line (Histogram < 0), or Signal.FLAT if equal / insufficient bars.
    - generate_crossover_signal: returns Signal.LONG on bullish crossover (prev_hist <= 0 and curr_hist > 0),
      Signal.SHORT on bearish crossover (prev_hist >= 0 and curr_hist < 0), or Signal.FLAT otherwise.
    """

    def __init__(
        self,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
    ) -> None:
        if fast_period < 1:
            raise ValueError("Fast period must be at least 1.")
        if slow_period <= fast_period:
            raise ValueError("Slow period must be strictly greater than fast period.")
        if signal_period < 1:
            raise ValueError("Signal period must be at least 1.")

        self.fast_period = fast_period
        self.slow_period = slow_period
        self.signal_period = signal_period

    def calculate_macd_series(
        self, prices: Sequence[float]
    ) -> tuple[list[float | None], list[float | None], list[float | None]]:
        """Calculate (macd_line, signal_line, histogram) series with zero look-ahead bias."""
        for price in prices:
            if not isinstance(price, (int, float)) or not math.isfinite(price):
                raise ValueError("Prices must be finite numbers.")
            if price <= 0:
                raise ValueError("Prices must be positive.")

        n = len(prices)
        macd_line: list[float | None] = [None] * n
        signal_line: list[float | None] = [None] * n
        histogram: list[float | None] = [None] * n

        if n < self.slow_period:
            return macd_line, signal_line, histogram

        # 1. Fast EMA
        alpha_fast = 2.0 / (self.fast_period + 1)
        fast_ema: list[float | None] = [None] * n
        fast_seed = sum(float(p) for p in prices[: self.fast_period]) / self.fast_period
        fast_ema[self.fast_period - 1] = fast_seed
        for i in range(self.fast_period, n):
            fast_ema[i] = float(prices[i]) * alpha_fast + fast_ema[i - 1] * (1.0 - alpha_fast)

        # 2. Slow EMA
        alpha_slow = 2.0 / (self.slow_period + 1)
        slow_ema: list[float | None] = [None] * n
        slow_seed = sum(float(p) for p in prices[: self.slow_period]) / self.slow_period
        slow_ema[self.slow_period - 1] = slow_seed
        for i in range(self.slow_period, n):
            slow_ema[i] = float(prices[i]) * alpha_slow + slow_ema[i - 1] * (1.0 - alpha_slow)

        # 3. MACD Line = Fast EMA - Slow EMA
        for i in range(self.slow_period - 1, n):
            f = fast_ema[i]
            s = slow_ema[i]
            if f is not None and s is not None:
                macd_line[i] = f - s

        # 4. Signal Line = EMA of MACD Line
        first_signal_idx = self.slow_period + self.signal_period - 2
        if n > first_signal_idx:
            alpha_signal = 2.0 / (self.signal_period + 1)
            macd_seed_values = [
                macd_line[j] for j in range(self.slow_period - 1, first_signal_idx + 1)
            ]
            signal_seed = sum(macd_seed_values) / self.signal_period
            signal_line[first_signal_idx] = signal_seed

            for i in range(first_signal_idx + 1, n):
                curr_macd = macd_line[i]
                prev_sig = signal_line[i - 1]
                if curr_macd is not None and prev_sig is not None:
                    signal_line[i] = curr_macd * alpha_signal + prev_sig * (1.0 - alpha_signal)

        # 5. Histogram = MACD Line - Signal Line
        for i in range(n):
            m = macd_line[i]
            s = signal_line[i]
            if m is not None and s is not None:
                histogram[i] = m - s

        return macd_line, signal_line, histogram

    def generate_signal(self, prices: Sequence[float]) -> Signal:
        """Return target position implied by current MACD level."""
        _, _, histogram = self.calculate_macd_series(prices)
        if not histogram or histogram[-1] is None:
            return Signal.FLAT

        current_hist = histogram[-1]
        if current_hist > 0:
            return Signal.LONG
        if current_hist < 0:
            return Signal.SHORT
        return Signal.FLAT

    def generate_crossover_signal(self, prices: Sequence[float]) -> Signal:
        """Return a signal only on a crossover between MACD Line and Signal Line."""
        _, _, histogram = self.calculate_macd_series(prices)
        if len(histogram) < 2:
            return Signal.FLAT

        prev_hist = histogram[-2]
        curr_hist = histogram[-1]

        if prev_hist is None or curr_hist is None:
            return Signal.FLAT

        if prev_hist <= 0.0 and curr_hist > 0.0:
            return Signal.LONG
        if prev_hist >= 0.0 and curr_hist < 0.0:
            return Signal.SHORT

        return Signal.FLAT
