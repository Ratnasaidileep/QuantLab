import { useState } from 'react';
import { useBacktest } from '../../hooks/useBacktest';
import { ConfigPanel } from '../../components/ConfigPanel';
import { MetricCards } from '../../components/MetricCards';
import { EquityChart } from '../../components/EquityChart';
import { TradeHistoryTable } from '../../components/TradeHistoryTable';
import { ComparisonTable } from '../../components/ComparisonTable';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { saveExperiment } from '../../api/client';
import { Bookmark, Play, Check, AlertCircle } from 'lucide-react';

export function StrategyLabPage() {
  const {
    config,
    setConfig,
    datasets,
    refreshDatasets,
    runBacktest,
    runComparison,
    backtestResult,
    comparisonResult,
    isLoading,
    isComparing,
    errorMessage,
  } = useBacktest();

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
          macd_fast: config.macd_fast,
          macd_slow: config.macd_slow,
          macd_signal: config.macd_signal,
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
        calmar_ratio: backtestResult.metrics.calmar_ratio ?? null,
        equity_curve: backtestResult.equity_curve,
        trades: backtestResult.trades,
      });
      setSaveFeedback('Experiment successfully saved to SQLite repository!');
      setSaveExpName('');
      setSaveExpNotes('');
      setIsSaveOpen(false);
      setTimeout(() => setSaveFeedback(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save experiment.';
      setSaveFeedback(`Failed: ${msg}`);
    } finally {
      setIsSavingExp(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Strategy Lab Title Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Strategy Lab & Backtest Workspace
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Next-bar execution ($t+1$ Open) with conservative intraday risk controls and friction modeling.
          </p>
        </div>

        {backtestResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Badge variant="neutral">Dataset: {backtestResult.dataset}</Badge>
            <Badge variant="info">Bars: {backtestResult.bars_processed}</Badge>
            <Badge variant="success">End-of-Test: Marked-to-Market</Badge>
          </div>
        )}
      </div>

      {errorMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'var(--loss-bg)',
            border: '1px solid var(--loss-border)',
            color: 'var(--loss)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      {saveFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: saveFeedback.startsWith('Failed') ? 'var(--loss-bg)' : 'var(--profit-bg)',
            border: `1px solid ${saveFeedback.startsWith('Failed') ? 'var(--loss-border)' : 'var(--profit-border)'}`,
            color: saveFeedback.startsWith('Failed') ? 'var(--loss)' : 'var(--profit)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Check size={18} />
          <span>{saveFeedback}</span>
        </div>
      )}

      {/* Main Strategy Lab Layout */}
      <div className="main-layout" style={{ margin: 0 }}>
        {/* Left Control Panel */}
        <ConfigPanel
          config={config}
          onChange={setConfig}
          datasets={datasets}
          onRefreshDatasets={refreshDatasets}
          onRunBacktest={runBacktest}
          onRunComparison={runComparison}
          isLoading={isLoading}
          isComparing={isComparing}
        />

        {/* Right Output Area */}
        <section className="content-area">
          {backtestResult ? (
            <div className="results-view">
              <div className="results-header">
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
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

                {/* Save Experiment Trigger */}
                {!isSaveOpen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Bookmark size={15} />}
                    onClick={() => {
                      setSaveExpName(`${backtestResult.strategy_name} (${backtestResult.dataset.replace('_daily.csv', '')})`);
                      setIsSaveOpen(true);
                    }}
                  >
                    Save Experiment
                  </Button>
                ) : null}
              </div>

              {/* Collapsible Save Form */}
              {isSaveOpen && (
                <Card
                  title="Save Backtest to Research Repository"
                  subtitle="Store complete equity curve, parameter configuration, and trade log"
                  style={{ marginBottom: '1.5rem', backgroundColor: 'var(--bg-elevated)' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                        Experiment Title *
                      </label>
                      <input
                        type="text"
                        className="save-experiment-input"
                        style={{ width: '100%' }}
                        placeholder="e.g. Reliance MA 10/30 baseline friction test"
                        value={saveExpName}
                        onChange={(e) => setSaveExpName(e.target.value)}
                        disabled={isSavingExp}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                        Research Notes (Optional)
                      </label>
                      <input
                        type="text"
                        className="save-experiment-notes"
                        style={{ width: '100%' }}
                        placeholder="e.g. Tested under 0.1% slippage and 0.1% commission, 3% trailing stop"
                        value={saveExpNotes}
                        onChange={(e) => setSaveExpNotes(e.target.value)}
                        disabled={isSavingExp}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsSaveOpen(false)}
                        disabled={isSavingExp}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={isSavingExp}
                        disabled={!saveExpName.trim() || isSavingExp}
                        onClick={handleSaveExperiment}
                      >
                        Commit to Database
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Performance Metrics */}
              <MetricCards
                finalEquity={backtestResult.final_equity}
                totalPnl={backtestResult.total_pnl}
                metrics={backtestResult.metrics}
              />

              {/* Equity Chart */}
              <EquityChart
                data={backtestResult.equity_curve}
                initialCash={backtestResult.initial_cash}
              />

              {/* Trade Log */}
              <TradeHistoryTable trades={backtestResult.trades} />
            </div>
          ) : (
            <div className="welcome-placeholder">
              <div className="placeholder-icon">📈</div>
              <h3>Ready to simulate</h3>
              <p>
                Configure strategy parameters in the left panel and click{' '}
                <strong>Run Backtest</strong> to simulate next-bar execution against historical prices.
                You can also run a <strong>Compare Strategies</strong> scan against Buy & Hold.
              </p>
              <Button
                variant="primary"
                size="lg"
                icon={<Play size={16} />}
                onClick={runBacktest}
                isLoading={isLoading}
              >
                Launch Initial Backtest
              </Button>
            </div>
          )}

          {/* Strategy Comparison Table */}
          <ComparisonTable
            comparison={comparisonResult}
            isLoading={isComparing}
          />
        </section>
      </div>
    </div>
  );
}
