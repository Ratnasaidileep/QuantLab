from collections.abc import Sequence

from quantlab.data.models import Bar


def calculate_true_range_series(bars: Sequence[Bar]) -> list[float]:
    """Calculate True Range (TR) series across chronological market bars.

    TR_0 = High_0 - Low_0
    TR_t = max(High_t - Low_t, |High_t - Close_{t-1}|, |Low_t - Close_{t-1}|)

    Zero look-ahead bias: each value only uses information available up to bar t.
    """
    if not bars:
        return []

    tr_values: list[float] = []
    for i, bar in enumerate(bars):
        if i == 0:
            tr = bar.high - bar.low
        else:
            prev_close = bars[i - 1].close
            tr = max(
                bar.high - bar.low,
                abs(bar.high - prev_close),
                abs(bar.low - prev_close),
            )
        tr_values.append(float(tr))

    return tr_values


def calculate_atr_series(
    bars: Sequence[Bar], period: int = 14
) -> list[float | None]:
    """Calculate Wilder's Average True Range (ATR) series with zero look-ahead bias.

    Returns:
        List of float or None matching the length of bars.
        Indices prior to (period - 1) are None.
        The first valid ATR at index (period - 1) is the simple moving average of the first `period` TRs.
        Subsequent values use Wilder's exponential smoothing:
            ATR_t = (ATR_{t-1} * (period - 1) + TR_t) / period
    """
    if period < 1:
        raise ValueError("ATR period must be at least 1.")

    n = len(bars)
    atr_values: list[float | None] = [None] * n

    if n < period:
        return atr_values

    tr_series = calculate_true_range_series(bars)

    # First ATR seed: simple arithmetic mean of the first `period` true ranges
    initial_atr = sum(tr_series[:period]) / period
    atr_values[period - 1] = initial_atr

    # Subsequent values smoothed via Wilder's running formula
    current_atr = initial_atr
    for i in range(period, n):
        current_atr = (current_atr * (period - 1) + tr_series[i]) / period
        atr_values[i] = current_atr

    return atr_values
