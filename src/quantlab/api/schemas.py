from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, model_validator


class HealthResponse(BaseModel):
    status: str = "ok"
    app: str = "QuantLab"
    version: str = "0.1.0"


class DatasetInfo(BaseModel):
    filename: str
    symbol: str
    bars_count: int
    start_date: str
    end_date: str
    file_size_bytes: int


class DatasetListResponse(BaseModel):
    datasets: list[DatasetInfo]


class FetchDatasetRequest(BaseModel):
    symbol: str = Field(
        ...,
        min_length=1,
        max_length=20,
        description="Ticker symbol to fetch (e.g. TCS.NS, INFY.NS, AAPL, NVDA, SPY).",
    )
    period: str = Field(
        default="2y",
        description="Historical period to download (e.g. 6mo, 1y, 2y, 5y, max).",
    )


class DatasetUploadResponse(BaseModel):
    message: str
    dataset: DatasetInfo


class StrategyType(str, Enum):
    MOVING_AVERAGE = "moving_average"
    RSI = "rsi"
    BOLLINGER = "bollinger"


class PositionSizingMode(str, Enum):
    UNIT = "unit"
    ALL_IN = "all_in"
    FIXED_QUANTITY = "fixed_quantity"


class TradeDTO(BaseModel):
    timestamp: str
    side: str
    price: float
    quantity: float
    commission: float


class EquityPointDTO(BaseModel):
    timestamp: str
    equity: float


class MetricsDTO(BaseModel):
    total_pnl: float
    total_return: float
    max_drawdown: float
    total_trades: int
    win_rate: float | None = None
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    cagr: float | None = None


class BacktestRequest(BaseModel):
    dataset: str = Field(
        default="reliance_daily.csv",
        description="Dataset filename inside the data/ directory.",
    )
    strategy: StrategyType = Field(
        default=StrategyType.MOVING_AVERAGE,
        description="Strategy to simulate (moving_average or rsi).",
    )
    fast_period: int = Field(
        default=10,
        ge=1,
        description="Fast moving average period (MA strategy only).",
    )
    slow_period: int = Field(
        default=30,
        ge=2,
        description="Slow moving average period (MA strategy only).",
    )
    rsi_period: int = Field(
        default=14,
        ge=2,
        description="RSI calculation period (RSI strategy only).",
    )
    oversold: float = Field(
        default=30.0,
        ge=0.0,
        le=99.0,
        description="RSI oversold threshold.",
    )
    overbought: float = Field(
        default=70.0,
        ge=1.0,
        le=100.0,
        description="RSI overbought threshold.",
    )
    bb_period: int = Field(
        default=20,
        ge=2,
        description="Bollinger Bands calculation period (Bollinger Bands strategy only).",
    )
    bb_std_dev: float = Field(
        default=2.0,
        gt=0.0,
        description="Bollinger Bands standard deviation multiplier.",
    )
    initial_cash: float = Field(
        default=100_000.0,
        gt=0.0,
        description="Initial starting capital.",
    )
    commission_rate: float = Field(
        default=0.001,
        ge=0.0,
        description="Broker commission rate as decimal.",
    )
    slippage_rate: float = Field(
        default=0.001,
        ge=0.0,
        description="Slippage rate as decimal.",
    )
    sizing_mode: PositionSizingMode = Field(
        default=PositionSizingMode.UNIT,
        description="Position sizing model: unit, all_in, or fixed_quantity.",
    )
    quantity_per_trade: float = Field(
        default=1.0,
        gt=0.0,
        description="Quantity per trade for fixed_quantity mode.",
    )

    @model_validator(mode="after")
    def validate_strategy_parameters(self) -> "BacktestRequest":
        if (
            self.strategy == StrategyType.MOVING_AVERAGE
            and self.fast_period >= self.slow_period
        ):
            raise ValueError(
                f"fast_period ({self.fast_period}) must be strictly less than slow_period ({self.slow_period})."
            )
        if (
            self.strategy == StrategyType.RSI
            and self.oversold >= self.overbought
        ):
            raise ValueError(
                f"oversold threshold ({self.oversold}) must be strictly less than overbought threshold ({self.overbought})."
            )
        if (
            self.strategy == StrategyType.BOLLINGER
            and self.bb_period < 2
        ):
            raise ValueError(
                f"bb_period ({self.bb_period}) must be at least 2."
            )
        if (
            self.strategy == StrategyType.BOLLINGER
            and self.bb_std_dev <= 0.0
        ):
            raise ValueError(
                f"bb_std_dev ({self.bb_std_dev}) must be positive."
            )
        return self


class BacktestResponse(BaseModel):
    strategy_name: str
    configuration: str
    dataset: str
    bars_processed: int
    initial_cash: float
    final_cash: float
    final_equity: float
    total_pnl: float
    metrics: MetricsDTO
    trades: list[TradeDTO]
    equity_curve: list[EquityPointDTO]


class ComparisonRequest(BaseModel):
    dataset: str = Field(
        default="reliance_daily.csv",
        description="Dataset filename inside the data/ directory.",
    )
    initial_cash: float = Field(
        default=100_000.0,
        gt=0.0,
        description="Initial starting capital.",
    )
    commission_rate: float = Field(
        default=0.001,
        ge=0.0,
        description="Broker commission rate as decimal.",
    )
    slippage_rate: float = Field(
        default=0.001,
        ge=0.0,
        description="Slippage rate as decimal.",
    )
    sizing_mode: PositionSizingMode = Field(
        default=PositionSizingMode.UNIT,
        description="Position sizing model: unit, all_in, or fixed_quantity.",
    )
    quantity_per_trade: float = Field(
        default=1.0,
        gt=0.0,
        description="Quantity per trade for fixed_quantity mode.",
    )
    ma_parameter_pairs: list[tuple[int, int]] = Field(
        default_factory=lambda: [(2, 3), (5, 20), (10, 30), (20, 50)],
        description="List of (fast_period, slow_period) pairs.",
    )
    rsi_configurations: list[tuple[int, float, float]] = Field(
        default_factory=lambda: [(14, 30.0, 70.0)],
        description="List of (period, oversold, overbought) tuples.",
    )
    bb_configurations: list[tuple[int, float]] = Field(
        default_factory=lambda: [(20, 2.0)],
        description="List of (period, std_dev_multiplier) tuples for Bollinger Bands.",
    )
    include_buy_and_hold: bool = Field(
        default=True,
        description="Whether to include the Buy and Hold benchmark.",
    )
    liquidate_buy_and_hold_on_end: bool = Field(
        default=False,
        description="Whether the Buy and Hold benchmark should liquidate on the final bar.",
    )

    @model_validator(mode="after")
    def validate_pairs(self) -> "ComparisonRequest":
        for fast, slow in self.ma_parameter_pairs:
            if fast <= 0 or slow <= 0 or fast >= slow:
                raise ValueError(
                    f"Invalid MA pair ({fast}, {slow}): fast must be positive and less than slow."
                )
        for period, os, ob in self.rsi_configurations:
            if period < 2 or os >= ob or os < 0 or ob > 100:
                raise ValueError(
                    f"Invalid RSI config ({period}, {os}, {ob}): period >= 2 and 0 <= os < ob <= 100."
                )
        for period, std_dev in self.bb_configurations:
            if period < 2 or std_dev <= 0.0:
                raise ValueError(
                    f"Invalid Bollinger config ({period}, {std_dev}): period >= 2 and std_dev > 0."
                )
        return self


class StrategyComparisonItemDTO(BaseModel):
    strategy_name: str
    configuration: str
    trades: int
    final_equity: float
    total_pnl: float
    total_return: float
    max_drawdown: float
    win_rate: float | None = None
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    cagr: float | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class ComparisonResponse(BaseModel):
    dataset: str
    results: list[StrategyComparisonItemDTO]
    best_strategy: StrategyComparisonItemDTO | None = None


class WalkForwardWindowDTO(BaseModel):
    window_index: int
    in_sample_start: str
    in_sample_end: str
    out_of_sample_start: str
    out_of_sample_end: str
    in_sample_bars_count: int
    out_of_sample_bars_count: int
    best_parameters: dict[str, Any]
    in_sample_return: float
    out_of_sample_return: float
    efficiency_ratio: float | None = None


class WalkForwardRequest(BaseModel):
    dataset: str = Field(
        default="reliance_daily.csv",
        description="Dataset filename inside the data/ directory.",
    )
    strategy: StrategyType = Field(
        default=StrategyType.MOVING_AVERAGE,
        description="Strategy to simulate (moving_average or rsi).",
    )
    num_windows: int = Field(
        default=3,
        ge=2,
        le=10,
        description="Number of rolling/expanding forward test windows.",
    )
    window_mode: str = Field(
        default="rolling",
        description="Window generation mode: 'rolling' or 'expanding'.",
    )
    initial_cash: float = Field(
        default=100_000.0,
        gt=0.0,
        description="Initial capital.",
    )
    commission_rate: float = Field(
        default=0.001,
        ge=0.0,
        description="Broker commission rate as decimal.",
    )
    slippage_rate: float = Field(
        default=0.001,
        ge=0.0,
        description="Slippage rate as decimal.",
    )
    sizing_mode: PositionSizingMode = Field(
        default=PositionSizingMode.UNIT,
        description="Position sizing model: unit, all_in, or fixed_quantity.",
    )
    quantity_per_trade: float = Field(
        default=1.0,
        gt=0.0,
        description="Quantity per trade for fixed_quantity mode.",
    )
    optimization_metric: str = Field(
        default="sharpe_ratio",
        description="Metric used to select winning parameters in-sample (sharpe_ratio, profit_factor, total_return).",
    )


class WalkForwardResponse(BaseModel):
    strategy_name: str
    total_bars: int
    window_mode: str
    windows: list[WalkForwardWindowDTO]
    overall_efficiency: float | None
    stitched_metrics: MetricsDTO | None = None
    robustness_grade: str
    explanation: str
    stitched_equity_curve: list[float] = Field(default_factory=list)


class ParameterHeatmapRequest(BaseModel):
    dataset: str = Field(
        default="reliance_daily.csv",
        description="Dataset filename inside data/.",
    )
    fast_periods: list[int] = Field(
        default_factory=lambda: [2, 5, 8, 10, 12, 15, 20],
        description="List of Fast MA periods to test.",
    )
    slow_periods: list[int] = Field(
        default_factory=lambda: [15, 20, 25, 30, 40, 50, 60],
        description="List of Slow MA periods to test.",
    )
    initial_cash: float = Field(default=100_000.0, gt=0.0)
    commission_rate: float = Field(default=0.001, ge=0.0)
    slippage_rate: float = Field(default=0.001, ge=0.0)
    sizing_mode: PositionSizingMode = Field(default=PositionSizingMode.UNIT)
    quantity_per_trade: float = Field(default=1.0, gt=0.0)


class ParameterGridPointDTO(BaseModel):
    fast_period: int
    slow_period: int
    total_return: float
    total_pnl: float
    final_equity: float
    sharpe_ratio: float | None
    max_drawdown: float
    trades_count: int
    win_rate: float | None
    profit_factor: float | None
    is_plateau: bool


class ParameterHeatmapResponse(BaseModel):
    dataset: str
    strategy_name: str
    total_combinations: int
    profitable_combinations: int
    plateau_ratio: float
    stability_verdict: str
    grid: list[ParameterGridPointDTO]

