"""Domain exception classes for market data operations and external providers."""


class DataError(Exception):
    """Base exception for all data processing and retrieval errors."""


class DataConnectionError(DataError):
    """Raised when external data provider network connection fails or is offline."""


class DataProviderRateLimitError(DataError):
    """Raised when external data provider rate limit or quota is exceeded (HTTP 429)."""


class SymbolNotFoundError(DataError):
    """Raised when a requested symbol is not found or has no trading history."""


class InvalidSymbolError(DataError):
    """Raised when a ticker symbol has an invalid format."""


class CorruptedDataError(DataError):
    """Raised when returned market data is malformed, missing required columns, or empty."""
