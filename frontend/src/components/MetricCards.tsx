import { TrendingUp, TrendingDown, ShieldAlert, Award, Percent, DollarSign, Activity, Compass } from 'lucide-react';
import type { MetricsDTO } from '../types';

interface MetricCardsProps {
  finalEquity: number;
  totalPnl: number;
  metrics: MetricsDTO;
  benchmarkReturn?: number | null;
  benchmarkSharpe?: number | null;
  benchmarkMaxDrawdown?: number | null;
}

export function MetricCards({
  finalEquity,
  totalPnl,
  metrics,
  benchmarkReturn,
  benchmarkSharpe,
  benchmarkMaxDrawdown,
}: MetricCardsProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  const pnlClass = totalPnl > 0 ? 'positive' : totalPnl < 0 ? 'negative' : 'neutral';

  const winRateStr =
    metrics.win_rate !== null ? `${(metrics.win_rate * 100).toFixed(1)}%` : 'N/A';

  const profitFactorStr =
    metrics.profit_factor !== null
      ? Number.isFinite(metrics.profit_factor)
        ? metrics.profit_factor.toFixed(2)
        : '∞'
      : 'N/A';

  const sharpeStr =
    metrics.sharpe_ratio !== null
      ? Number.isFinite(metrics.sharpe_ratio)
        ? metrics.sharpe_ratio.toFixed(2)
        : metrics.sharpe_ratio > 0
          ? '∞'
          : '-∞'
      : 'N/A';

  const sortinoStr =
    metrics.sortino_ratio !== null
      ? Number.isFinite(metrics.sortino_ratio)
        ? metrics.sortino_ratio.toFixed(2)
        : metrics.sortino_ratio > 0
          ? '∞'
          : '0.00'
      : 'N/A';

  const cagrStr = metrics.cagr !== null ? formatPercent(metrics.cagr) : 'N/A';
  const calmarStr =
    metrics.calmar_ratio !== null && metrics.calmar_ratio !== undefined
      ? Number.isFinite(metrics.calmar_ratio)
        ? metrics.calmar_ratio.toFixed(2)
        : 'N/A'
      : null;

  // Benchmark comparisons if available
  const returnAlpha =
    benchmarkReturn !== undefined && benchmarkReturn !== null
      ? metrics.total_return - benchmarkReturn
      : null;

  const sharpeAlpha =
    benchmarkSharpe !== undefined &&
    benchmarkSharpe !== null &&
    metrics.sharpe_ratio !== null &&
    Number.isFinite(metrics.sharpe_ratio) &&
    Number.isFinite(benchmarkSharpe)
      ? metrics.sharpe_ratio - benchmarkSharpe
      : null;

  const ddDelta =
    benchmarkMaxDrawdown !== undefined && benchmarkMaxDrawdown !== null
      ? metrics.max_drawdown - benchmarkMaxDrawdown
      : null;

  return (
    <div className="metric-cards-grid">
      {/* Final Equity */}
      <div className="metric-card" title="Total ending account balance including realized and marked-to-market positions">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">Final Equity</span>
          <DollarSign size={15} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <span className="metric-value font-mono">{formatCurrency(finalEquity)}</span>
        <span className="metric-sub">Marked to market at final Close</span>
      </div>

      {/* Total Net P&L */}
      <div className={`metric-card ${pnlClass}`} title="Net profit or loss after accounting for slippage and commission friction">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">Total Net P&L</span>
          {totalPnl >= 0 ? (
            <TrendingUp size={15} style={{ color: 'var(--profit)' }} />
          ) : (
            <TrendingDown size={15} style={{ color: 'var(--loss)' }} />
          )}
        </div>
        <span className="metric-value font-mono">
          {totalPnl >= 0 ? '+' : ''}
          {formatCurrency(totalPnl)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
          <span className="metric-sub font-mono">{formatPercent(metrics.total_return)}</span>
          {returnAlpha !== null && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: returnAlpha >= 0 ? 'var(--profit)' : 'var(--loss)',
              }}
            >
              ({returnAlpha >= 0 ? '+' : ''}
              {(returnAlpha * 100).toFixed(2)}% vs B&H)
            </span>
          )}
        </div>
      </div>

      {/* Max Drawdown */}
      <div className="metric-card warning" title="Maximum observed peak-to-trough drop in account equity">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">Max Drawdown</span>
          <ShieldAlert size={15} style={{ color: 'var(--loss)' }} />
        </div>
        <span className="metric-value font-mono" style={{ color: 'var(--loss)' }}>
          {formatPercent(metrics.max_drawdown)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="metric-sub">Peak-to-trough decline</span>
          {ddDelta !== null && (
            <span
              style={{
                fontSize: '0.7rem',
                color: ddDelta <= 0 ? 'var(--profit)' : 'var(--loss)',
              }}
            >
              ({ddDelta <= 0 ? '' : '+'}
              {(ddDelta * 100).toFixed(2)}% vs B&H)
            </span>
          )}
        </div>
      </div>

      {/* Win Rate */}
      <div className="metric-card" title="Percentage of closed trades with positive net profit">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">Win Rate</span>
          <Percent size={15} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <span className="metric-value font-mono">{winRateStr}</span>
        <span className="metric-sub">{metrics.total_trades} trades executed</span>
      </div>

      {/* Profit Factor */}
      <div className="metric-card" title="Gross Profits divided by Gross Losses (values > 1.5 indicate robust edge)">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">Profit Factor</span>
          <Award size={15} style={{ color: 'var(--text-tertiary)' }} />
        </div>
        <span className="metric-value font-mono">{profitFactorStr}</span>
        <span className="metric-sub">Gross Win / Gross Loss</span>
      </div>

      {/* Sharpe Ratio */}
      <div className="metric-card accent" title="Annualized excess return per unit of total risk (Rf = 5% assumed)">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">Sharpe Ratio</span>
          <Activity size={15} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <span className="metric-value font-mono">{sharpeStr}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span className="metric-sub">Annualized (252d, Rf=5%)</span>
          {sharpeAlpha !== null && (
            <span
              style={{
                fontSize: '0.7rem',
                color: sharpeAlpha >= 0 ? 'var(--profit)' : 'var(--loss)',
              }}
            >
              ({sharpeAlpha >= 0 ? '+' : ''}
              {sharpeAlpha.toFixed(2)} vs B&H)
            </span>
          )}
        </div>
      </div>

      {/* Sortino Ratio */}
      <div className="metric-card accent" title="Risk-adjusted return focusing exclusively on harmful downside volatility">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">Sortino Ratio</span>
          <Compass size={15} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <span className="metric-value font-mono">{sortinoStr}</span>
        <span className="metric-sub">Downside volatility penalty</span>
      </div>

      {/* CAGR / Calmar Ratio */}
      <div className="metric-card accent" title="Compound Annual Growth Rate across the entire backtest period">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="metric-label">CAGR</span>
          <TrendingUp size={15} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <span className="metric-value font-mono">{cagrStr}</span>
        <span className="metric-sub">
          {calmarStr !== null ? `Calmar: ${calmarStr}` : 'Annualized return'}
        </span>
      </div>
    </div>
  );
}
