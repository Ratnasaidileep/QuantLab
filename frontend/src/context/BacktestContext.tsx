import React, { useEffect, useState } from 'react';
import {
  executeBacktest,
  executeComparison,
  fetchDatasets,
} from '../api/client';
import type {
  BacktestRequest,
  BacktestResponse,
  ComparisonResponse,
  DatasetInfo,
  ExperimentDetailDTO,
  StrategyType,
} from '../types';
import { BacktestContext, DEFAULT_CONFIG } from './backtest-context';

export function BacktestProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<BacktestRequest>(DEFAULT_CONFIG);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [backtestResult, setBacktestResult] = useState<BacktestResponse | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshDatasets = async () => {
    try {
      const dsets = await fetchDatasets();
      setDatasets(dsets);
      if (dsets.length > 0 && !dsets.some((d) => d.filename === config.dataset)) {
        setConfig((prev) => ({ ...prev, dataset: dsets[0].filename }));
      }
    } catch {
      // Handled silently
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitialDatasets() {
      try {
        const dsets = await fetchDatasets();
        if (isMounted) {
          setDatasets(dsets);
          if (dsets.length > 0) {
            setConfig((prev) => ({ ...prev, dataset: dsets[0].filename }));
          }
        }
      } catch {
        // Handled silently
      }
    }

    loadInitialDatasets();

    return () => {
      isMounted = false;
    };
  }, []);

  const runBacktest = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await executeBacktest(config);
      setBacktestResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backtest execution failed.';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const runComparison = async () => {
    setIsComparing(true);
    setErrorMessage(null);
    try {
      const comp = await executeComparison(
        config.dataset,
        config.initial_cash,
        config.commission_rate,
        config.slippage_rate,
        config.sizing_mode,
        config.quantity_per_trade,
      );
      setComparisonResult(comp);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Strategy comparison failed.';
      setErrorMessage(msg);
      throw err;
    } finally {
      setIsComparing(false);
    }
  };

  const loadExperiment = (exp: ExperimentDetailDTO) => {
    let stratType: StrategyType = 'moving_average';
    const sName = (exp.strategy || '').toLowerCase();
    if (sName.includes('rsi')) stratType = 'rsi';
    else if (sName.includes('bollinger')) stratType = 'bollinger';
    else if (sName.includes('macd')) stratType = 'macd';
    else if (sName.includes('confluence')) stratType = 'confluence';

    const p = exp.parameters || {};
    setConfig((prev) => ({
      ...prev,
      dataset: exp.dataset || prev.dataset,
      strategy: stratType,
      fast_period: typeof p.fast_period === 'number' ? p.fast_period : prev.fast_period,
      slow_period: typeof p.slow_period === 'number' ? p.slow_period : prev.slow_period,
      rsi_period: typeof p.rsi_period === 'number' ? p.rsi_period : prev.rsi_period,
      oversold: typeof p.oversold === 'number' ? p.oversold : prev.oversold,
      overbought: typeof p.overbought === 'number' ? p.overbought : prev.overbought,
      bb_period: typeof p.bb_period === 'number' ? p.bb_period : (typeof p.period === 'number' ? p.period : prev.bb_period),
      bb_std_dev: typeof p.bb_std_dev === 'number' ? p.bb_std_dev : (typeof p.std_dev_multiplier === 'number' ? p.std_dev_multiplier : prev.bb_std_dev),
      macd_fast: typeof p.macd_fast === 'number' ? p.macd_fast : (typeof p.fast_period === 'number' && stratType === 'macd' ? p.fast_period : prev.macd_fast),
      macd_slow: typeof p.macd_slow === 'number' ? p.macd_slow : (typeof p.slow_period === 'number' && stratType === 'macd' ? p.slow_period : prev.macd_slow),
      macd_signal: typeof p.macd_signal === 'number' ? p.macd_signal : (typeof p.signal_period === 'number' ? p.signal_period : prev.macd_signal),
      confluence_trend_period: typeof p.confluence_trend_period === 'number' ? p.confluence_trend_period : (typeof p.trend_period === 'number' ? p.trend_period : prev.confluence_trend_period),
      confluence_pullback_period: typeof p.confluence_pullback_period === 'number' ? p.confluence_pullback_period : (typeof p.pullback_period === 'number' ? p.pullback_period : prev.confluence_pullback_period),
      confluence_oversold: typeof p.confluence_oversold === 'number' ? p.confluence_oversold : (typeof p.oversold === 'number' && stratType === 'confluence' ? p.oversold : prev.confluence_oversold),
      confluence_overbought: typeof p.confluence_overbought === 'number' ? p.confluence_overbought : (typeof p.overbought === 'number' && stratType === 'confluence' ? p.overbought : prev.confluence_overbought),
      initial_cash: exp.initial_cash ?? prev.initial_cash,
      commission_rate: exp.commission_rate ?? prev.commission_rate,
      slippage_rate: exp.slippage_rate ?? prev.slippage_rate,
      sizing_mode: (exp.sizing_mode as 'unit' | 'fixed_quantity' | 'all_in' | 'atr_fractional') ?? prev.sizing_mode,
      quantity_per_trade: exp.quantity_per_trade ?? prev.quantity_per_trade,
      atr_period: typeof p.atr_period === 'number' ? p.atr_period : prev.atr_period,
      atr_stop_multiplier: typeof p.atr_stop_multiplier === 'number' ? p.atr_stop_multiplier : prev.atr_stop_multiplier,
      risk_per_trade_pct: typeof p.risk_per_trade_pct === 'number' ? p.risk_per_trade_pct : prev.risk_per_trade_pct,
    }));

    setBacktestResult({
      strategy_name: exp.strategy,
      configuration: exp.name,
      dataset: exp.dataset,
      bars_processed: exp.equity_curve.length,
      initial_cash: exp.initial_cash,
      final_cash: exp.final_equity,
      final_equity: exp.final_equity,
      total_pnl: exp.total_pnl,
      metrics: {
        total_pnl: exp.total_pnl,
        total_return: exp.total_return,
        max_drawdown: exp.max_drawdown,
        total_trades: exp.total_trades,
        win_rate: exp.win_rate,
        profit_factor: exp.profit_factor,
        sharpe_ratio: exp.sharpe_ratio,
        sortino_ratio: exp.sortino_ratio,
        cagr: exp.cagr,
        calmar_ratio: exp.calmar_ratio ?? null,
      },
      trades: exp.trades,
      equity_curve: exp.equity_curve,
    });
  };

  return (
    <BacktestContext.Provider
      value={{
        config,
        setConfig,
        datasets,
        refreshDatasets,
        backtestResult,
        setBacktestResult,
        comparisonResult,
        setComparisonResult,
        isLoading,
        isComparing,
        errorMessage,
        setErrorMessage,
        runBacktest,
        runComparison,
        loadExperiment,
      }}
    >
      {children}
    </BacktestContext.Provider>
  );
}
