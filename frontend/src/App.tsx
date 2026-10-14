import { useEffect, useState } from 'react';
import {
  executeBacktest,
  executeComparison,
  fetchDatasets,
  fetchHealth,
  saveExperiment,
} from './api/client';
import { ComparisonTable } from './components/ComparisonTable';
import { ConfigPanel } from './components/ConfigPanel';
import { EquityChart } from './components/EquityChart';
import { ExperimentHistoryPanel } from './components/ExperimentHistoryPanel';
import { MetricCards } from './components/MetricCards';
import { Navbar } from './components/Navbar';
import { ParameterHeatmap } from './components/ParameterHeatmap';
import { ResearchNotice } from './components/ResearchNotice';
import { TradeHistoryTable } from './components/TradeHistoryTable';
import { WalkForwardPanel } from './components/WalkForwardPanel';
import type {
  BacktestRequest,
  BacktestResponse,
  ComparisonResponse,
  DatasetInfo,
  ExperimentDetailDTO,
} from './types';
import './App.css';

type ActiveTab = 'backtest' | 'walk-forward' | 'parameter-heatmap' | 'experiment-history';

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('backtest');
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [apiVersion, setApiVersion] = useState<string>('0.1.0');
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);

  const [config, setConfig] = useState<BacktestRequest>({
    dataset: 'reliance_daily.csv',
    strategy: 'moving_average',
    fast_period: 10,
    slow_period: 30,
    rsi_period: 14,
    oversold: 30.0,
    overbought: 70.0,
    bb_period: 20,
    bb_std_dev: 2.0,
    initial_cash: 100_000.0,
    commission_rate: 0.001,
    slippage_rate: 0.001,
    sizing_mode: 'unit',
    quantity_per_trade: 1.0,
  });

  const [backtestResult, setBacktestResult] = useState<BacktestResponse | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const health = await fetchHealth();
        setApiStatus('online');
        setApiVersion(health.version);
      } catch {
        setApiStatus('offline');
      }

      try {
        const dsets = await fetchDatasets();
        setDatasets(dsets);
        if (dsets.length > 0) {
          setConfig((prev) => ({ ...prev, dataset: dsets[0].filename }));
        }
      } catch {
        // Handled silently
      }
    }

    init();
  }, []);

  const handleRefreshDatasets = async () => {
    try {
      const dsets = await fetchDatasets();
      setDatasets(dsets);
    } catch {
      // Handled silently
    }
  };

  const handleRunBacktest = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await executeBacktest(config);
      setBacktestResult(result);
      setActiveTab('backtest');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backtest execution failed.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunComparison = async () => {
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
      setActiveTab('backtest');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Comparison failed.';
      setErrorMessage(msg);
    } finally {
      setIsComparing(false);
    }
  };

  const [isSaveOpen, setIsSaveOpen] = useState<boolean>(false);
  const [saveExpName, setSaveExpName] = useState<string>('');
  const [saveExpNotes, setSaveExpNotes] = useState<string>('');
  const [isSavingExp, setIsSavingExp] = useState<boolean>(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const handleSaveExperiment = async () => {
    if (!backtestResult || !saveExpName.trim()) return;
    setIsSavingExp(true);
    setSaveFeedback(null);
    try {
      await saveExperiment({
        name: saveExpName.trim(),
        notes: saveExpNotes.trim(),
        dataset: backtestResult.dataset,
        strategy: backtestResult.strategy_name,
        parameters: {
          fast_period: config.fast_period,
          slow_period: config.slow_period,
          rsi_period: config.rsi_period,
          oversold: config.oversold,
          overbought: config.overbought,
          bb_period: config.bb_period,
          bb_std_dev: config.bb_std_dev,
        },
        initial_cash: backtestResult.initial_cash,
        commission_rate: config.commission_rate,
        slippage_rate: config.slippage_rate,
        sizing_mode: config.sizing_mode,
        quantity_per_trade: config.quantity_per_trade,
        final_equity: backtestResult.final_equity,
        total_pnl: backtestResult.total_pnl,
        total_return: backtestResult.metrics.total_return,
        max_drawdown: backtestResult.metrics.max_drawdown,
        total_trades: backtestResult.metrics.total_trades,
        win_rate: backtestResult.metrics.win_rate,
        profit_factor: backtestResult.metrics.profit_factor,
        sharpe_ratio: backtestResult.metrics.sharpe_ratio,
        sortino_ratio: backtestResult.metrics.sortino_ratio,
        cagr: backtestResult.metrics.cagr,
        equity_curve: backtestResult.equity_curve,
        trades: backtestResult.trades,
      });
      setSaveFeedback('✅ Saved successfully to database!');
      setSaveExpName('');
      setSaveExpNotes('');
      setIsSaveOpen(false);
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save experiment.';
      setSaveFeedback(`❌ ${msg}`);
    } finally {
      setIsSavingExp(false);
    }
  };

  const handleLoadExperiment = (exp: ExperimentDetailDTO) => {
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
      },
      trades: exp.trades,
      equity_curve: exp.equity_curve,
    });
    setActiveTab('backtest');
  };

  return (
    <div className="quantlab-app">
      <Navbar apiStatus={apiStatus} apiVersion={apiVersion} />

      <main className="main-layout">
        <ConfigPanel
          config={config}
          onChange={setConfig}
          datasets={datasets}
          onRefreshDatasets={handleRefreshDatasets}
          onRunBacktest={handleRunBacktest}
          onRunComparison={handleRunComparison}
          isLoading={isLoading}
          isComparing={isComparing}
        />

        <section className="content-area">
          {errorMessage && (
            <div className="alert alert-error">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="tabs-nav">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'backtest' ? 'active' : ''}`}
              onClick={() => setActiveTab('backtest')}
            >
              📊 Backtest & Benchmarks
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'walk-forward' ? 'active' : ''}`}
              onClick={() => setActiveTab('walk-forward')}
            >
              🔄 Walk-Forward Optimization (OOS)
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'parameter-heatmap' ? 'active' : ''}`}
              onClick={() => setActiveTab('parameter-heatmap')}
            >
              🗺️ 2D Parameter Surface Heatmap
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'experiment-history' ? 'active' : ''}`}
              onClick={() => setActiveTab('experiment-history')}
            >
              📁 Saved Experiments
            </button>
          </div>

          {/* Active Tab Content */}
          {activeTab === 'backtest' && (
            <>
              {backtestResult ? (
                <div className="results-view">
                  <div className="results-header">
                    <h2>
                      {backtestResult.strategy_name} — {backtestResult.configuration}
                    </h2>
                    <div className="results-meta">
                      <span className="meta-pill">Dataset: {backtestResult.dataset}</span>
                      <span className="meta-pill">Bars: {backtestResult.bars_processed}</span>
                      <span className="meta-pill">
                        Sizing:{' '}
                        {config.sizing_mode === 'unit'
                          ? '1 Share (Unit)'
                          : config.sizing_mode === 'all_in'
                            ? '100% Capital (All-in)'
                            : `Fixed (${config.quantity_per_trade} shares)`}
                      </span>
                    </div>
                  </div>

                  {/* Save Experiment Bar */}
                  <div className="save-experiment-bar">
                    {!isSaveOpen ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {saveFeedback ? saveFeedback : 'Permanently log this simulation to your research database:'}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            setSaveExpName(`${backtestResult.strategy_name} (${backtestResult.dataset.replace('_daily.csv', '')})`);
                            setIsSaveOpen(true);
                          }}
                        >
                          💾 Save Experiment
                        </button>
                      </div>
                    ) : (
                      <div className="save-experiment-form">
                        <input
                          type="text"
                          className="save-experiment-input"
                          placeholder="Experiment Title (e.g. Reliance MA 10/30 baseline)"
                          value={saveExpName}
                          onChange={(e) => setSaveExpName(e.target.value)}
                          disabled={isSavingExp}
                        />
                        <input
                          type="text"
                          className="save-experiment-notes"
                          placeholder="Notes (optional, e.g. tested under 0.1% friction)"
                          value={saveExpNotes}
                          onChange={(e) => setSaveExpNotes(e.target.value)}
                          disabled={isSavingExp}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={handleSaveExperiment}
                          disabled={isSavingExp || !saveExpName.trim()}
                        >
                          {isSavingExp ? <span className="spinner"></span> : 'Save to DB'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setIsSaveOpen(false)}
                          disabled={isSavingExp}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>

                  <MetricCards
                    finalEquity={backtestResult.final_equity}
                    totalPnl={backtestResult.total_pnl}
                    metrics={backtestResult.metrics}
                  />

                  <EquityChart
                    data={backtestResult.equity_curve}
                    initialCash={backtestResult.initial_cash}
                  />

                  <TradeHistoryTable trades={backtestResult.trades} />
                </div>
              ) : (
                <div className="welcome-placeholder">
                  <div className="placeholder-icon">📊</div>
                  <h3>Ready to simulate</h3>
                  <p>
                    Configure strategy parameters in the sidebar and click{' '}
                    <strong>Run Backtest</strong> to evaluate historical performance, or click{' '}
                    <strong>Compare Strategies</strong> to view side-by-side benchmark rankings.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleRunBacktest}
                    disabled={isLoading}
                  >
                    {isLoading ? <span className="spinner"></span> : '▶ Launch Initial Backtest'}
                  </button>
                </div>
              )}

              <ComparisonTable
                comparison={comparisonResult}
                isLoading={isComparing}
              />
            </>
          )}

          {activeTab === 'walk-forward' && (
            <WalkForwardPanel
              dataset={config.dataset}
              initialCash={config.initial_cash}
              commissionRate={config.commission_rate}
              slippageRate={config.slippage_rate}
              sizingMode={config.sizing_mode}
              quantityPerTrade={config.quantity_per_trade}
            />
          )}

          {activeTab === 'parameter-heatmap' && (
            <ParameterHeatmap
              dataset={config.dataset}
              initialCash={config.initial_cash}
              commissionRate={config.commission_rate}
              slippageRate={config.slippage_rate}
              sizingMode={config.sizing_mode}
              quantityPerTrade={config.quantity_per_trade}
            />
          )}

          {activeTab === 'experiment-history' && (
            <ExperimentHistoryPanel
              datasets={datasets}
              onLoadExperiment={handleLoadExperiment}
            />
          )}

          <ResearchNotice />
        </section>
      </main>
    </div>
  );
}

export default App;
