import { useState } from 'react';
import { useBacktest } from '../../hooks/useBacktest';
import { TearSheetPanel } from '../../components/TearSheetPanel';
import { MonteCarloPanel } from '../../components/MonteCarloPanel';
import { BenchmarkPanel } from '../../components/BenchmarkPanel';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { BarChart3, ShieldAlert, Database, Dice5, GraduationCap } from 'lucide-react';

export function AnalyticsPage() {
  const { config, setConfig, datasets } = useBacktest();
  const [activeTab, setActiveTab] = useState<'tear_sheet' | 'monte_carlo' | 'benchmark'>('tear_sheet');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Title & Toolbar */}
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
            {activeTab === 'tear_sheet' ? (
              <BarChart3 size={22} style={{ color: 'var(--accent-primary)' }} />
            ) : activeTab === 'monte_carlo' ? (
              <Dice5 size={22} style={{ color: 'var(--accent-primary)' }} />
            ) : (
              <GraduationCap size={22} style={{ color: 'var(--accent-primary)' }} />
            )}
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {activeTab === 'tear_sheet'
                ? 'Risk Tear-Sheet & Tail Risk Analytics'
                : activeTab === 'monte_carlo'
                  ? 'Monte Carlo Simulation & Confidence Bands'
                  : 'Academic Evaluation Benchmark Suite'}
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            {activeTab === 'tear_sheet'
              ? 'PyFolio-grade risk diagnostics: Historical & Parametric VaR, Expected Shortfall (CVaR), Skewness, Kurtosis, and monthly calendar matrices.'
              : activeTab === 'monte_carlo'
                ? 'Resample trade sequences up to 3,000 synthetic paths to diagnose sequence risk, probability of ruin, and percentile confidence cones.'
                : 'Automated cross-strategy, cross-dataset benchmark matrix generating publication-ready Markdown and LaTeX (booktabs) tables for academic defense.'}
          </p>
        </div>

        {/* Dataset Switcher & Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
            <Database size={14} style={{ color: 'var(--text-tertiary)' }} />
            <label htmlFor="analytics-dataset-select" style={{ color: 'var(--text-secondary)' }}>Dataset:</label>
            <select
              id="analytics-dataset-select"
              value={config.dataset}
              onChange={(e) => setConfig((prev) => ({ ...prev, dataset: e.target.value }))}
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
            >
              {datasets.map((d) => (
                <option key={d.filename} value={d.filename}>
                  {d.symbol} ({d.bars_count} bars)
                </option>
              ))}
              {datasets.length === 0 && (
                <option value="reliance_daily.csv">reliance_daily.csv (Default)</option>
              )}
            </select>
          </div>

          <Badge variant="info">Friction: {(config.commission_rate * 10000).toFixed(0)} bps comm &bull; {(config.slippage_rate * 10000).toFixed(0)} bps slip</Badge>
        </div>
      </div>

      {/* Segmented Sub-Tab Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.25rem',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          width: 'fit-content',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('tear_sheet')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: activeTab === 'tear_sheet' ? 600 : 500,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'tear_sheet' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'tear_sheet' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <BarChart3 size={15} />
          <span>Tail Risk Tear-Sheet</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monte_carlo')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: activeTab === 'monte_carlo' ? 600 : 500,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'monte_carlo' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'monte_carlo' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <Dice5 size={15} />
          <span>Monte Carlo Simulation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('benchmark')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.45rem 0.9rem',
            borderRadius: '6px',
            fontSize: '0.82rem',
            fontWeight: activeTab === 'benchmark' ? 600 : 500,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'benchmark' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
            color: activeTab === 'benchmark' ? 'var(--accent-primary)' : 'var(--text-secondary)',
            transition: 'all var(--transition-fast)',
          }}
        >
          <GraduationCap size={15} />
          <span>Academic Benchmark Suite</span>
        </button>
      </div>

      {/* Methodology Context Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.4',
        }}
      >
        <ShieldAlert size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div>
          {activeTab === 'tear_sheet' ? (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Risk Philosophy: </strong>
              Standard deviation alone assumes Gaussian normality. QuantLab evaluates <strong>fat-tailed distributions</strong> using 95% and 99% Expected Shortfall (CVaR), capturing catastrophic drawdowns where conventional models fail.
            </>
          ) : activeTab === 'monte_carlo' ? (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Sequence Risk Philosophy: </strong>
              A backtest only samples one historical ordering of trades. Monte Carlo simulation shuffles and resamples trades over <strong>1,000+ synthetic paths</strong> to ensure your Sharpe ratio isn't merely the byproduct of a fortunate trade order.
            </>
          ) : (
            <>
              <strong style={{ color: 'var(--text-primary)' }}>Empirical Academic Philosophy: </strong>
              A strategy that succeeds on only one ticker is prone to over-fitting. The Academic Benchmark Suite executes <strong>cross-asset, cross-strategy evaluation</strong> against Buy &amp; Hold and exports publication-ready LaTeX/Markdown tables for peer-reviewed defense.
            </>
          )}
        </div>
      </div>

      {/* Active Tab Workspace */}
      <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
        {activeTab === 'tear_sheet' ? (
          <TearSheetPanel
            dataset={config.dataset}
            initialCash={config.initial_cash}
            commissionRate={config.commission_rate}
            slippageRate={config.slippage_rate}
            sizingMode={config.sizing_mode}
            quantityPerTrade={config.quantity_per_trade}
          />
        ) : activeTab === 'monte_carlo' ? (
          <MonteCarloPanel
            dataset={config.dataset}
            initialCash={config.initial_cash}
            commissionRate={config.commission_rate}
            slippageRate={config.slippage_rate}
            sizingMode={config.sizing_mode}
            quantityPerTrade={config.quantity_per_trade}
          />
        ) : (
          <BenchmarkPanel
            datasets={datasets}
            defaultInitialCash={config.initial_cash}
            defaultCommissionRate={config.commission_rate}
            defaultSlippageRate={config.slippage_rate}
          />
        )}
      </Card>
    </div>
  );
}
