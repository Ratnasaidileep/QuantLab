import type { ComparisonResponse } from '../types';

interface ComparisonTableProps {
  comparison: ComparisonResponse | null;
  isLoading: boolean;
}

export function ComparisonTable({ comparison, isLoading }: ComparisonTableProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  if (isLoading) {
    return (
      <div className="table-card loading-card">
        <div className="spinner large"></div>
        <p>Running multi-strategy comparison & benchmark evaluation...</p>
      </div>
    );
  }

  if (!comparison || comparison.results.length === 0) {
    return null;
  }

  const { results, best_strategy } = comparison;

  return (
    <div className="comparison-section">
      <div className="table-header">
        <div>
          <h3>Multi-Strategy Comparison Leaderboard</h3>
          <p className="subtitle">
            All strategies and benchmarks evaluated over {comparison.dataset} under
            identical friction and execution assumptions.
          </p>
        </div>
      </div>

      {best_strategy && (
        <div className="best-strategy-banner">
          <div className="trophy-icon">🏆</div>
          <div className="best-details">
            <span className="best-tag">Highest Final Equity in Tested Group</span>
            <h4>
              {best_strategy.strategy_name} — {best_strategy.configuration}
            </h4>
            <div className="best-metrics-row">
              <span>
                Final Equity: <strong>{formatCurrency(best_strategy.final_equity)}</strong>
              </span>
              <span>
                Net Return: <strong>{formatPercent(best_strategy.total_return)}</strong>
              </span>
              <span>
                Sharpe: <strong>{best_strategy.sharpe_ratio?.toFixed(2) || 'N/A'}</strong>
              </span>
              <span>
                Max Drawdown: <strong>{formatPercent(best_strategy.max_drawdown)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Configuration</th>
              <th>Trades</th>
              <th>Final Equity</th>
              <th>Total P&L</th>
              <th>Return</th>
              <th>Max Drawdown</th>
              <th>Win Rate</th>
              <th>Profit Factor</th>
              <th>Sharpe</th>
              <th>Sortino</th>
              <th>CAGR</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item, idx) => {
              const isBest =
                best_strategy &&
                item.strategy_name === best_strategy.strategy_name &&
                item.configuration === best_strategy.configuration;

              return (
                <tr key={idx} className={isBest ? 'highlight-row' : ''}>
                  <td className="fw-medium">{item.strategy_name}</td>
                  <td className="mono">{item.configuration}</td>
                  <td>{item.trades}</td>
                  <td className="mono">{formatCurrency(item.final_equity)}</td>
                  <td className={`mono ${item.total_pnl >= 0 ? 'pnl-green' : 'pnl-red'}`}>
                    {item.total_pnl >= 0 ? '+' : ''}
                    {formatCurrency(item.total_pnl)}
                  </td>
                  <td className={`mono ${item.total_return >= 0 ? 'pnl-green' : 'pnl-red'}`}>
                    {formatPercent(item.total_return)}
                  </td>
                  <td className="mono warning-text">{formatPercent(item.max_drawdown)}</td>
                  <td>
                    {item.win_rate !== null ? `${(item.win_rate * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td>
                    {item.profit_factor !== null
                      ? Number.isFinite(item.profit_factor)
                        ? item.profit_factor.toFixed(2)
                        : '∞'
                      : 'N/A'}
                  </td>
                  <td>
                    {item.sharpe_ratio !== null
                      ? Number.isFinite(item.sharpe_ratio)
                        ? item.sharpe_ratio.toFixed(2)
                        : item.sharpe_ratio > 0
                          ? '∞'
                          : '-∞'
                      : 'N/A'}
                  </td>
                  <td>
                    {item.sortino_ratio !== null
                      ? Number.isFinite(item.sortino_ratio)
                        ? item.sortino_ratio.toFixed(2)
                        : item.sortino_ratio > 0
                          ? '∞'
                          : '0.00'
                      : 'N/A'}
                  </td>
                  <td>{item.cagr !== null ? formatPercent(item.cagr) : 'N/A'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
