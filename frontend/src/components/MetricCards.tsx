import type { MetricsDTO } from '../types';

interface MetricCardsProps {
  finalEquity: number;
  totalPnl: number;
  metrics: MetricsDTO;
}

export function MetricCards({ finalEquity, totalPnl, metrics }: MetricCardsProps) {
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

  return (
    <div className="metric-cards-grid">
      <div className="metric-card">
        <span className="metric-label">Final Equity</span>
        <span className="metric-value">{formatCurrency(finalEquity)}</span>
      </div>

      <div className={`metric-card ${pnlClass}`}>
        <span className="metric-label">Total P&L</span>
        <span className="metric-value">
          {totalPnl >= 0 ? '+' : ''}
          {formatCurrency(totalPnl)}
        </span>
        <span className="metric-sub">{formatPercent(metrics.total_return)}</span>
      </div>

      <div className="metric-card warning">
        <span className="metric-label">Max Drawdown</span>
        <span className="metric-value">{formatPercent(metrics.max_drawdown)}</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Win Rate</span>
        <span className="metric-value">{winRateStr}</span>
        <span className="metric-sub">{metrics.total_trades} trades</span>
      </div>

      <div className="metric-card">
        <span className="metric-label">Profit Factor</span>
        <span className="metric-value">{profitFactorStr}</span>
      </div>

      <div className="metric-card accent">
        <span className="metric-label">Sharpe Ratio (Rf=5%)</span>
        <span className="metric-value">{sharpeStr}</span>
        <span className="metric-sub">Annualized (252d)</span>
      </div>

      <div className="metric-card accent">
        <span className="metric-label">Sortino Ratio</span>
        <span className="metric-value">{sortinoStr}</span>
        <span className="metric-sub">Downside Risk</span>
      </div>

      <div className="metric-card accent">
        <span className="metric-label">CAGR</span>
        <span className="metric-value">{cagrStr}</span>
        <span className="metric-sub">Annualized Growth</span>
      </div>
    </div>
  );
}
