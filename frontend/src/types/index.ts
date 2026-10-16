export type StrategyType = 'moving_average' | 'rsi' | 'bollinger' | 'macd';
export type PositionSizingMode = 'unit' | 'all_in' | 'fixed_quantity';

export interface DatasetInfo {
  filename: string;
  symbol: string;
  bars_count: number;
  start_date: string;
  end_date: string;
  file_size_bytes: number;
}

export interface DatasetUploadResponse {
  message: string;
  dataset: DatasetInfo;
}

export interface FetchDatasetRequest {
  symbol: string;
  period?: string;
}

export interface TradeDTO {
  timestamp: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  commission: number;
  exit_reason?: string | null;
}

export interface EquityPointDTO {
  timestamp: string;
  equity: number;
}

export interface MetricsDTO {
  total_pnl: number;
  total_return: number;
  max_drawdown: number;
  total_trades: number;
  win_rate: number | null;
  profit_factor: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  cagr: number | null;
  calmar_ratio?: number | null;
}

export interface BacktestRequest {
  dataset: string;
  strategy: StrategyType;
  fast_period: number;
  slow_period: number;
  rsi_period: number;
  oversold: number;
  overbought: number;
  bb_period: number;
  bb_std_dev: number;
  macd_fast?: number;
  macd_slow?: number;
  macd_signal?: number;
  initial_cash: number;
  commission_rate: number;
  slippage_rate: number;
  sizing_mode: PositionSizingMode;
  quantity_per_trade: number;
  stop_loss_pct?: number | null;
  take_profit_pct?: number | null;
  trailing_stop_pct?: number | null;
}

export interface BacktestResponse {
  strategy_name: string;
  configuration: string;
  dataset: string;
  bars_processed: number;
  initial_cash: number;
  final_cash: number;
  final_equity: number;
  total_pnl: number;
  metrics: MetricsDTO;
  trades: TradeDTO[];
  equity_curve: EquityPointDTO[];
}

export interface StrategyComparisonItemDTO {
  strategy_name: string;
  configuration: string;
  trades: number;
  final_equity: number;
  total_pnl: number;
  total_return: number;
  max_drawdown: number;
  win_rate: number | null;
  profit_factor: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  cagr: number | null;
  parameters: Record<string, unknown>;
}

export interface ComparisonResponse {
  dataset: string;
  results: StrategyComparisonItemDTO[];
  best_strategy: StrategyComparisonItemDTO | null;
}

export interface WalkForwardWindowDTO {
  window_index: number;
  in_sample_start: string;
  in_sample_end: string;
  out_of_sample_start: string;
  out_of_sample_end: string;
  in_sample_bars_count: number;
  out_of_sample_bars_count: number;
  best_parameters: Record<string, unknown>;
  in_sample_return: number;
  out_of_sample_return: number;
  efficiency_ratio: number | null;
}

export interface WalkForwardRequest {
  dataset: string;
  strategy: StrategyType;
  num_windows: number;
  window_mode: 'rolling' | 'expanding';
  initial_cash: number;
  commission_rate: number;
  slippage_rate: number;
  sizing_mode: PositionSizingMode;
  quantity_per_trade: number;
  optimization_metric: 'sharpe_ratio' | 'profit_factor' | 'total_return';
}

export interface WalkForwardResponse {
  strategy_name: string;
  total_bars: number;
  window_mode: string;
  windows: WalkForwardWindowDTO[];
  overall_efficiency: number | null;
  stitched_metrics: MetricsDTO | null;
  robustness_grade: string;
  explanation: string;
  stitched_equity_curve: number[];
}

export interface ParameterHeatmapRequest {
  dataset: string;
  fast_periods: number[];
  slow_periods: number[];
  initial_cash: number;
  commission_rate: number;
  slippage_rate: number;
  sizing_mode: PositionSizingMode;
  quantity_per_trade: number;
}

export interface ParameterGridPointDTO {
  fast_period: number;
  slow_period: number;
  total_return: number;
  total_pnl: number;
  final_equity: number;
  sharpe_ratio: number | null;
  max_drawdown: number;
  trades_count: number;
  win_rate: number | null;
  profit_factor: number | null;
  is_plateau: boolean;
}

export interface ParameterHeatmapResponse {
  dataset: string;
  strategy_name: string;
  total_combinations: number;
  profitable_combinations: number;
  plateau_ratio: number;
  stability_verdict: string;
  grid: ParameterGridPointDTO[];
}

export interface SaveExperimentRequest {
  name: string;
  notes?: string;
  dataset: string;
  strategy: string;
  parameters?: Record<string, unknown>;
  initial_cash: number;
  commission_rate: number;
  slippage_rate: number;
  sizing_mode: string;
  quantity_per_trade: number;
  final_equity: number;
  total_pnl: number;
  total_return: number;
  max_drawdown: number;
  total_trades: number;
  win_rate: number | null;
  profit_factor: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  cagr: number | null;
  calmar_ratio?: number | null;
  equity_curve: EquityPointDTO[];
  trades: TradeDTO[];
}

export interface ExperimentSummaryDTO {
  id: number;
  name: string;
  notes: string;
  created_at: string;
  dataset: string;
  strategy: string;
  parameters: Record<string, unknown>;
  initial_cash: number;
  final_equity: number;
  total_pnl: number;
  total_return: number;
  max_drawdown: number;
  total_trades: number;
  win_rate: number | null;
  profit_factor: number | null;
  sharpe_ratio: number | null;
  sortino_ratio: number | null;
  cagr: number | null;
  calmar_ratio: number | null;
}

export interface ExperimentDetailDTO extends ExperimentSummaryDTO {
  commission_rate: number;
  slippage_rate: number;
  sizing_mode: string;
  quantity_per_trade: number;
  equity_curve: EquityPointDTO[];
  trades: TradeDTO[];
}

export interface ExperimentListResponse {
  experiments: ExperimentSummaryDTO[];
  total: number;
}

export interface TailRiskDTO {
  var_95_historical: number | null;
  var_95_parametric: number | null;
  var_99_historical: number | null;
  var_99_parametric: number | null;
  cvar_95: number | null;
  cvar_99: number | null;
  tail_ratio: number | null;
  skewness: number | null;
  kurtosis: number | null;
  annualized_volatility: number | null;
  calmar_ratio: number | null;
}

export interface MonthlyReturnRowDTO {
  year: number;
  months: Record<string, number | null>;
  year_total: number;
}

export interface UnderwaterPointDTO {
  timestamp: string;
  drawdown: number;
}

export interface TearSheetRequest extends BacktestRequest {
  risk_free_rate?: number;
}

export interface TearSheetResponse {
  strategy_name: string;
  configuration: string;
  dataset: string;
  bars_processed: number;
  initial_cash: number;
  final_equity: number;
  total_pnl: number;
  summary: MetricsDTO;
  tail_risk: TailRiskDTO;
  monthly_matrix: MonthlyReturnRowDTO[];
  underwater_curve: UnderwaterPointDTO[];
}

export type AllocationWeighting = 'equal_weight' | 'inverse_volatility' | 'custom';
export type RebalanceFrequency = 'none' | 'monthly' | 'quarterly';

export interface BasketTradeDTO {
  timestamp: string;
  symbol: string;
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  commission: number;
  reason: string;
}

export interface BasketEquityPointDTO {
  timestamp: string;
  equity: number;
  cash: number;
  holdings_value: number;
  weights: Record<string, number>;
}

export interface BasketBacktestRequest {
  datasets: string[];
  weighting: AllocationWeighting;
  custom_weights?: Record<string, number> | null;
  rebalance_freq: RebalanceFrequency;
  initial_cash: number;
  commission_rate: number;
  slippage_rate: number;
  risk_free_rate?: number;
}

export interface BasketBacktestResponse {
  datasets: string[];
  symbols: string[];
  weighting: string;
  rebalance_freq: string;
  initial_cash: number;
  final_cash: number;
  final_equity: number;
  total_pnl: number;
  asset_weights: Record<string, number>;
  holdings: Record<string, number>;
  summary: MetricsDTO;
  tail_risk: TailRiskDTO;
  trades: BasketTradeDTO[];
  equity_points: BasketEquityPointDTO[];
}


