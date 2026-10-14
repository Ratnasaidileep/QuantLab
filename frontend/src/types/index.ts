export type StrategyType = 'moving_average' | 'rsi' | 'bollinger';
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
  initial_cash: number;
  commission_rate: number;
  slippage_rate: number;
  sizing_mode: PositionSizingMode;
  quantity_per_trade: number;
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
