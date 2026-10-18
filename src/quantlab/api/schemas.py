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


class FailedSymbolDTO(BaseModel):
    symbol: str
    error: str


class BatchFetchDatasetsRequest(BaseModel):
    symbols: list[str] = Field(
        ...,
        min_length=1,
        max_length=25,
        description="List of ticker symbols to download in batch.",
    )
    period: str = Field(
        default="2y",
        description="Historical period to download (e.g. 6mo, 1y, 2y, 5y, max).",
    )


class BatchFetchDatasetsResponse(BaseModel):
    message: str
    datasets: list[DatasetInfo]
    failed_symbols: list[FailedSymbolDTO] = Field(default_factory=list)


class StrategyType(str, Enum):
    MOVING_AVERAGE = "moving_average"
    RSI = "rsi"
    BOLLINGER = "bollinger"
    MACD = "macd"


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
    exit_reason: str | None = None


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
    calmar_ratio: float | None = None


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
    macd_fast: int = Field(
        default=12,
        ge=1,
        description="Fast EMA period for MACD.",
    )
    macd_slow: int = Field(
        default=26,
        ge=2,
        description="Slow EMA period for MACD.",
    )
    macd_signal: int = Field(
        default=9,
        ge=1,
        description="Signal line EMA period for MACD.",
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
    stop_loss_pct: float | None = Field(
        default=None,
        gt=0.0,
        le=1.0,
        description="Fixed stop-loss threshold as decimal (e.g. 0.05 for 5%).",
    )
    take_profit_pct: float | None = Field(
        default=None,
        gt=0.0,
        le=10.0,
        description="Take-profit threshold as decimal (e.g. 0.10 for 10%).",
    )
    trailing_stop_pct: float | None = Field(
        default=None,
        gt=0.0,
        le=1.0,
        description="Trailing stop-loss threshold as decimal.",
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
        if (
            self.strategy == StrategyType.MACD
            and self.macd_fast >= self.macd_slow
        ):
            raise ValueError(
                f"macd_fast ({self.macd_fast}) must be strictly less than macd_slow ({self.macd_slow})."
            )
        if (
            self.strategy == StrategyType.MACD
            and self.macd_signal < 1
        ):
            raise ValueError(
                f"macd_signal ({self.macd_signal}) must be at least 1."
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
    macd_configurations: list[tuple[int, int, int]] = Field(
        default_factory=lambda: [(12, 26, 9)],
        description="List of (fast_period, slow_period, signal_period) tuples for MACD.",
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
        for fast, slow, sig in self.macd_configurations:
            if fast < 1 or slow <= fast or sig < 1:
                raise ValueError(
                    f"Invalid MACD config ({fast}, {slow}, {sig}): fast >= 1, slow > fast, and signal >= 1."
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


class SaveExperimentRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Name or title for the experiment.")
    notes: str = Field(default="", max_length=1000, description="User notes or observations.")
    dataset: str
    strategy: str
    parameters: dict[str, Any] = Field(default_factory=dict)
    initial_cash: float
    commission_rate: float = 0.001
    slippage_rate: float = 0.001
    sizing_mode: str = "unit"
    quantity_per_trade: float = 1.0
    final_equity: float
    total_pnl: float
    total_return: float
    max_drawdown: float
    total_trades: int
    win_rate: float | None = None
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    cagr: float | None = None
    calmar_ratio: float | None = None
    equity_curve: list[EquityPointDTO] = Field(default_factory=list)
    trades: list[TradeDTO] = Field(default_factory=list)


class ExperimentSummaryDTO(BaseModel):
    id: int
    name: str
    notes: str
    created_at: str
    dataset: str
    strategy: str
    parameters: dict[str, Any]
    initial_cash: float
    final_equity: float
    total_pnl: float
    total_return: float
    max_drawdown: float
    total_trades: int
    win_rate: float | None = None
    profit_factor: float | None = None
    sharpe_ratio: float | None = None
    sortino_ratio: float | None = None
    cagr: float | None = None
    calmar_ratio: float | None = None
    user_id: int | None = None


class ExperimentDetailDTO(ExperimentSummaryDTO):
    commission_rate: float
    slippage_rate: float
    sizing_mode: str
    quantity_per_trade: float
    equity_curve: list[EquityPointDTO] = Field(default_factory=list)
    trades: list[TradeDTO] = Field(default_factory=list)


class ExperimentListResponse(BaseModel):
    experiments: list[ExperimentSummaryDTO]
    total: int


class TailRiskDTO(BaseModel):
    var_95_historical: float | None
    var_95_parametric: float | None
    var_99_historical: float | None
    var_99_parametric: float | None
    cvar_95: float | None
    cvar_99: float | None
    tail_ratio: float | None
    skewness: float | None
    kurtosis: float | None
    annualized_volatility: float | None
    calmar_ratio: float | None


class MonthlyReturnRowDTO(BaseModel):
    year: int
    months: dict[str, float | None]
    year_total: float


class UnderwaterPointDTO(BaseModel):
    timestamp: str
    drawdown: float


class TearSheetRequest(BacktestRequest):
    risk_free_rate: float = Field(default=0.05, ge=0.0, le=0.20)


class TearSheetResponse(BaseModel):
    strategy_name: str
    configuration: str
    dataset: str
    bars_processed: int
    initial_cash: float
    final_equity: float
    total_pnl: float
    summary: MetricsDTO
    tail_risk: TailRiskDTO
    monthly_matrix: list[MonthlyReturnRowDTO]
    underwater_curve: list[UnderwaterPointDTO]


class AllocationWeightingEnum(str, Enum):
    EQUAL_WEIGHT = "equal_weight"
    INVERSE_VOLATILITY = "inverse_volatility"
    CUSTOM = "custom"


class RebalanceFrequencyEnum(str, Enum):
    NONE = "none"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"


class BasketTradeDTO(BaseModel):
    timestamp: str
    symbol: str
    side: str
    price: float
    quantity: float
    commission: float
    reason: str


class BasketEquityPointDTO(BaseModel):
    timestamp: str
    equity: float
    cash: float
    holdings_value: float
    weights: dict[str, float]


class BasketBacktestRequest(BaseModel):
    datasets: list[str] = Field(
        default_factory=lambda: ["reliance_daily.csv", "tcs_daily.csv"],
        min_length=1,
        description="List of dataset filenames in data/ folder.",
    )
    weighting: AllocationWeightingEnum = Field(
        default=AllocationWeightingEnum.EQUAL_WEIGHT,
        description="Portfolio weighting allocation scheme.",
    )
    custom_weights: dict[str, float] | None = Field(
        default=None,
        description="Custom target weights by symbol (required when weighting=custom).",
    )
    rebalance_freq: RebalanceFrequencyEnum = Field(
        default=RebalanceFrequencyEnum.MONTHLY,
        description="Periodic rebalancing frequency.",
    )
    initial_cash: float = Field(
        default=100_000.0,
        gt=0,
        description="Initial portfolio cash amount.",
    )
    commission_rate: float = Field(
        default=0.001,
        ge=0.0,
        le=0.05,
        description="Commission rate per trade.",
    )
    slippage_rate: float = Field(
        default=0.0005,
        ge=0.0,
        le=0.05,
        description="Slippage rate applied to execution price.",
    )
    risk_free_rate: float = Field(
        default=0.05,
        ge=0.0,
        le=0.20,
        description="Annual risk-free rate for Sharpe and Sortino ratios.",
    )


class BasketBacktestResponse(BaseModel):
    datasets: list[str]
    symbols: list[str]
    weighting: str
    rebalance_freq: str
    initial_cash: float
    final_cash: float
    final_equity: float
    total_pnl: float
    asset_weights: dict[str, float]
    holdings: dict[str, float]
    summary: MetricsDTO
    tail_risk: TailRiskDTO
    trades: list[BasketTradeDTO]
    equity_points: list[BasketEquityPointDTO]


class UserDTO(BaseModel):
    id: int
    username: str
    created_at: str


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Unique username")
    password: str = Field(..., min_length=6, max_length=128, description="User password (min 6 chars)")


class LoginRequest(BaseModel):
    username: str = Field(..., description="Registered username")
    password: str = Field(..., description="User password")


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserDTO


class MonteCarloModeEnum(str, Enum):
    TRADE_SHUFFLE = "trade_shuffle"
    BOOTSTRAP = "bootstrap"


class MonteCarloPointDTO(BaseModel):
    step: int
    p5: float
    p25: float
    p50: float
    p75: float
    p95: float


class DrawdownHistogramBinDTO(BaseModel):
    bin_start: float
    bin_end: float
    count: int
    percentage: float


class MonteCarloSummaryDTO(BaseModel):
    simulations_count: int
    trades_resampled: int
    ruin_threshold: float
    probability_of_ruin: float
    median_max_drawdown: float
    p95_max_drawdown: float
    p5_max_drawdown: float
    median_terminal_equity: float
    p5_terminal_equity: float
    p95_terminal_equity: float


class MonteCarloRequest(BacktestRequest):
    num_simulations: int = Field(
        default=1000, ge=10, le=10000, description="Number of Monte Carlo simulations."
    )
    ruin_drawdown_pct: float = Field(
        default=0.25, gt=0.0, lt=1.0, description="Drawdown threshold to define portfolio ruin."
    )
    mode: MonteCarloModeEnum = Field(
        default=MonteCarloModeEnum.TRADE_SHUFFLE,
        description="Resampling mode: trade_shuffle (permutation) or bootstrap.",
    )
    seed: int | None = Field(
        default=None, description="Optional seed for deterministic reproducibility."
    )


class MonteCarloResponse(BaseModel):
    strategy_name: str
    configuration: str
    dataset: str
    initial_cash: float
    summary: MonteCarloSummaryDTO
    confidence_cone: list[MonteCarloPointDTO]
    drawdown_histogram: list[DrawdownHistogramBinDTO]


