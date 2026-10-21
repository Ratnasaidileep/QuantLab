import { createContext } from 'react';
import type {
  BacktestRequest,
  BacktestResponse,
  ComparisonResponse,
  DatasetInfo,
  ExperimentDetailDTO,
} from '../types';

export const DEFAULT_CONFIG: BacktestRequest = {
  dataset: 'reliance_daily.csv',
  strategy: 'moving_average',
  fast_period: 10,
  slow_period: 30,
  rsi_period: 14,
  oversold: 30.0,
  overbought: 70.0,
  bb_period: 20,
  bb_std_dev: 2.0,
  macd_fast: 12,
  macd_slow: 26,
  macd_signal: 9,
  confluence_trend_period: 50,
  confluence_pullback_period: 14,
  confluence_oversold: 35.0,
  confluence_overbought: 65.0,
  initial_cash: 100_000.0,
  commission_rate: 0.001,
  slippage_rate: 0.001,
  sizing_mode: 'unit',
  quantity_per_trade: 1.0,
  atr_period: 14,
  atr_stop_multiplier: null,
  risk_per_trade_pct: null,
};

export interface BacktestContextType {
  config: BacktestRequest;
  setConfig: React.Dispatch<React.SetStateAction<BacktestRequest>>;
  datasets: DatasetInfo[];
  refreshDatasets: () => Promise<void>;
  backtestResult: BacktestResponse | null;
  setBacktestResult: React.Dispatch<React.SetStateAction<BacktestResponse | null>>;
  comparisonResult: ComparisonResponse | null;
  setComparisonResult: React.Dispatch<React.SetStateAction<ComparisonResponse | null>>;
  isLoading: boolean;
  isComparing: boolean;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  runBacktest: () => Promise<void>;
  runComparison: () => Promise<void>;
  loadExperiment: (exp: ExperimentDetailDTO) => void;
}

export const BacktestContext = createContext<BacktestContextType | undefined>(undefined);
