from .models import Bar


def validate_bar(bar: Bar) -> None:
    """Validate a market-data bar."""

    if bar.open <= 0:
        raise ValueError("Open price must be positive.")

    if bar.high <= 0:
        raise ValueError("High price must be positive.")

    if bar.low <= 0:
        raise ValueError("Low price must be positive.")

    if bar.close <= 0:
        raise ValueError("Close price must be positive.")

    if bar.volume < 0:
        raise ValueError("Volume cannot be negative.")

    if bar.high < max(bar.open, bar.close):
        raise ValueError("High must be >= open and close.")

    if bar.low > min(bar.open, bar.close):
        raise ValueError("Low must be <= open and close.")