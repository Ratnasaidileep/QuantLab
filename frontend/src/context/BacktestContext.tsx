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
