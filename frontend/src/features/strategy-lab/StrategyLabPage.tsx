import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
import {
  Bookmark,
  Play,
  Check,
  AlertCircle,
  FlaskConical,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { StrategyType } from '../../types';

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
  const [saveFeedback, setSaveFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  // Global Keyboard Shortcut: Ctrl+Enter / Cmd+Enter runs backtest
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        if (!isLoading) {
          e.preventDefault();
          runBacktest();
        }
      }
    },
    [isLoading, runBacktest]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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
      setSaveFeedback({
        type: 'success',
        msg: 'Experiment successfully committed to SQLite repository!',
      });
      setSaveExpName('');
      setSaveExpNotes('');
      setIsSaveOpen(false);
      setTimeout(() => setSaveFeedback(null), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save experiment.';
      setSaveFeedback({ type: 'error', msg: `Failed: ${msg}` });
    } finally {
      setIsSavingExp(false);
    }
  };

  // Callback to load configuration from comparison leaderboard into config panel
  const handleApplyComparisonConfig = (parameters: Record<string, unknown>, strategyName: string) => {
    let stratType: StrategyType = 'moving_average';
    const sName = strategyName.toLowerCase();
    if (sName.includes('rsi')) stratType = 'rsi';
    else if (sName.includes('bollinger')) stratType = 'bollinger';
    else if (sName.includes('macd')) stratType = 'macd';

    setConfig((prev) => ({
      ...prev,
      strategy: stratType,
      fast_period: (parameters.fast_period as number) ?? prev.fast_period,
      slow_period: (parameters.slow_period as number) ?? prev.slow_period,
      rsi_period: (parameters.rsi_period as number) ?? prev.rsi_period,
      oversold: (parameters.oversold as number) ?? prev.oversold,
      overbought: (parameters.overbought as number) ?? prev.overbought,
      bb_period: (parameters.bb_period as number) ?? prev.bb_period,
      bb_std_dev: (parameters.bb_std_dev as number) ?? prev.bb_std_dev,
      macd_fast: (parameters.macd_fast as number) ?? prev.macd_fast,
      macd_slow: (parameters.macd_slow as number) ?? prev.macd_slow,
      macd_signal: (parameters.macd_signal as number) ?? prev.macd_signal,
    }));
  };

  // Find Buy & Hold benchmark from comparison results if available
  const benchmarkItem = comparisonResult?.results.find(
    (r) =>
      r.strategy_name.toLowerCase().includes('buy') &&
      r.strategy_name.toLowerCase().includes('hold')
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Strategy Lab Title Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FlaskConical size={22} style={{ color: 'var(--accent-primary)' }} />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Strategy Lab & Backtest Workspace
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Next-bar execution ($t+1$ Open) with realistic slippage, commission, and intraday risk controls.
          </p>
        </div>

        {backtestResult && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <Badge variant="neutral">Dataset: {backtestResult.dataset}</Badge>
            <Badge variant="info">Bars: {backtestResult.bars_processed}</Badge>
            <Badge variant="success">End-of-Test: Marked-to-Market</Badge>
          </div>
        )}
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'var(--loss-bg)',
            border: '1px solid var(--loss-border)',
            color: 'var(--loss)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Save Feedback Alert */}
      {saveFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: saveFeedback.type === 'error' ? 'var(--loss-bg)' : 'var(--profit-bg)',
            border: `1px solid ${saveFeedback.type === 'error' ? 'var(--loss-border)' : 'var(--profit-border)'}`,
            color: saveFeedback.type === 'error' ? 'var(--loss)' : 'var(--profit)',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={18} />
            <span>{saveFeedback.msg}</span>
          </div>
          {saveFeedback.type === 'success' && (
            <Link
              to="/experiments"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'inherit',
                textDecoration: 'underline',
              }}
            >
              View in Experiments
              <ExternalLink size={13} />
            </Link>
          )}
        </div>
      )}

      {/* Main Strategy Lab Layout */}
      <div className="main-layout" style={{ margin: 0, gap: '1.5rem' }}>
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
        <section className="content-area" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {backtestResult ? (
            <div className="results-view" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Results Top Action Bar */}
              <div
                className="results-header"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1rem',
                  borderRadius: '8px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                    {backtestResult.strategy_name} &bull;{' '}
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
                      {backtestResult.configuration}
                    </span>
                  </h2>
                  <div className="results-meta" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="meta-pill">Dataset: {backtestResult.dataset}</span>
                    <span className="meta-pill">Processed: {backtestResult.bars_processed} bars</span>
                    <span className="meta-pill">
                      Sizing:{' '}
                      {config.sizing_mode === 'unit'
                        ? '1 Share (Unit)'
                        : config.sizing_mode === 'all_in'
                          ? '100% Capital (All-in)'
                          : `Fixed (${config.quantity_per_trade} shares)`}
                    </span>
                    <span className="meta-pill">
                      Friction: {(config.commission_rate * 10000).toFixed(0)} bps comm &bull;{' '}
                      {(config.slippage_rate * 10000).toFixed(0)} bps slip
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
                      setSaveExpName(
                        `${backtestResult.strategy_name} (${backtestResult.dataset.replace('_daily.csv', '')})`
                      );
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
                  subtitle="Persist parameters, execution metrics, and full trade log in SQLite"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--accent-primary)' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                        Experiment Title *
                      </label>
                      <input
                        type="text"
                        className="save-experiment-input"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                        }}
                        placeholder="e.g. Reliance MA 10/30 baseline friction test"
                        value={saveExpName}
                        onChange={(e) => setSaveExpName(e.target.value)}
                        disabled={isSavingExp}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                        Research Notes & Hypotheses (Optional)
                      </label>
                      <input
                        type="text"
                        className="save-experiment-notes"
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--bg-card)',
                          color: 'var(--text-primary)',
                        }}
                        placeholder="e.g. Evaluated under 0.1% slippage and 0.1% commission with 5% stop-loss"
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

              {/* Performance Metric Cards */}
              <MetricCards
                finalEquity={backtestResult.final_equity}
                totalPnl={backtestResult.total_pnl}
                metrics={backtestResult.metrics}
                benchmarkReturn={benchmarkItem?.total_return}
                benchmarkSharpe={benchmarkItem?.sharpe_ratio}
                benchmarkMaxDrawdown={benchmarkItem?.max_drawdown}
              />

              {/* High-Performance Financial Charts */}
              <EquityChart
                data={backtestResult.equity_curve}
                initialCash={backtestResult.initial_cash}
                trades={backtestResult.trades}
              />

              {/* Executed Trade Log Table */}
              <TradeHistoryTable trades={backtestResult.trades} />
            </div>
          ) : (
            <div
              className="welcome-placeholder"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px dashed var(--border-color)',
                textAlign: 'center',
                gap: '1rem',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-primary)',
                }}
              >
                <Sparkles size={28} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Ready to Simulate Quantitative Strategy
              </h3>
              <p
                style={{
                  maxWidth: '520px',
                  margin: 0,
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                }}
              >
                Select your dataset and strategy parameters on the left panel, then press{' '}
                <strong style={{ color: 'var(--text-primary)' }}>Run Backtest</strong> (or press <kbd className="font-mono">Ctrl+Enter</kbd>).
                Orders will be simulated next-bar at $t+1$ Open with realistic frictions.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<Play size={16} />}
                  onClick={runBacktest}
                  isLoading={isLoading}
                >
                  Launch Initial Backtest
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  icon={<Layers size={16} />}
                  onClick={runComparison}
                  isLoading={isComparing}
                >
                  Run Strategy Comparison
                </Button>
              </div>
            </div>
          )}

          {/* Strategy Comparison Leaderboard */}
          <ComparisonTable
            comparison={comparisonResult}
            isLoading={isComparing}
            onApplyConfig={handleApplyComparisonConfig}
          />
        </section>
      </div>
    </div>
  );
}
