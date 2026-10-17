import { Trophy, CheckCircle, XCircle, ArrowUpRight, Award, Zap } from 'lucide-react';
import type { ComparisonResponse } from '../types';

interface ComparisonTableProps {
  comparison: ComparisonResponse | null;
  isLoading: boolean;
  onApplyConfig?: (parameters: Record<string, unknown>, strategy: string) => void;
}

export function ComparisonTable({ comparison, isLoading, onApplyConfig }: ComparisonTableProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  if (isLoading) {
    return (
      <div className="table-card loading-card" style={{ padding: '3rem', textAlign: 'center' }}>
        <div className="spinner large" style={{ margin: '0 auto 1rem auto' }}></div>
        <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
          Evaluating Multi-Strategy Matrix & Buy-and-Hold Benchmark
        </h4>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Simulating identical execution friction ($t+1$ Open, slippage, commission) across all strategies...
        </p>
      </div>
    );
  }

  if (!comparison || comparison.results.length === 0) {
    return null;
  }

  const { results, best_strategy } = comparison;

  // Locate the Buy & Hold benchmark item
  const buyAndHold = results.find(
    (r) =>
      r.strategy_name.toLowerCase().includes('buy') &&
      r.strategy_name.toLowerCase().includes('hold')
  );

  return (
    <div className="comparison-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
      <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Award size={18} style={{ color: 'var(--accent-primary)' }} />
            Multi-Strategy Comparison Leaderboard
          </h3>
          <p className="subtitle" style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            All candidate strategies and benchmarks simulated across <strong>{comparison.dataset}</strong> under identical friction.
          </p>
        </div>
      </div>

      {/* Best Strategy Spotlight Banner */}
      {best_strategy && (
        <div
          className="best-strategy-banner"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            padding: '1rem 1.25rem',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(168, 85, 247, 0.08) 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
              flexShrink: 0,
            }}
          >
            <Trophy size={24} />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: 'var(--accent-primary)',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                }}
              >
                Highest Final Equity
              </span>
              {buyAndHold && best_strategy.total_return > buyAndHold.total_return && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--profit)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                  }}
                >
                  <CheckCircle size={12} />
                  Outperforms Benchmark by +{formatPercent(best_strategy.total_return - buyAndHold.total_return)}
                </span>
              )}
            </div>

            <h4 style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {best_strategy.strategy_name} &bull; <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>{best_strategy.configuration}</span>
            </h4>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.25rem', fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Final Equity: </span>
                <strong className="font-mono" style={{ color: 'var(--accent-primary)' }}>{formatCurrency(best_strategy.final_equity)}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Net Return: </span>
                <strong className="font-mono" style={{ color: best_strategy.total_return >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                  {formatPercent(best_strategy.total_return)}
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Sharpe Ratio: </span>
                <strong className="font-mono">{best_strategy.sharpe_ratio !== null ? best_strategy.sharpe_ratio.toFixed(2) : 'N/A'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-tertiary)' }}>Max Drawdown: </span>
                <strong className="font-mono" style={{ color: 'var(--loss)' }}>{formatPercent(best_strategy.max_drawdown)}</strong>
              </div>
            </div>
          </div>

          {onApplyConfig && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onApplyConfig(best_strategy.parameters, best_strategy.strategy_name)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
            >
              <Zap size={14} />
              Load into Lab
            </button>
          )}
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Configuration</th>
              <th>Trades</th>
              <th>Final Equity</th>
              <th>Total Net P&L</th>
              <th>Total Return</th>
              <th>Max Drawdown</th>
              <th>Win Rate</th>
              <th>Profit Factor</th>
              <th>Sharpe (252d)</th>
              <th>Sortino</th>
              <th>CAGR</th>
              {onApplyConfig && <th>Action</th>}
            </tr>
          </thead>
          <tbody>
            {results.map((item, idx) => {
              const isBest =
                best_strategy &&
                item.strategy_name === best_strategy.strategy_name &&
                item.configuration === best_strategy.configuration;

              const isBenchmark =
                item.strategy_name.toLowerCase().includes('buy') &&
                item.strategy_name.toLowerCase().includes('hold');

              // Compare return with benchmark
              const beatsBenchmark =
                buyAndHold && !isBenchmark
                  ? item.total_return > buyAndHold.total_return
                  : null;

              return (
                <tr
                  key={idx}
                  className={isBest ? 'highlight-row' : ''}
                  style={
                    isBenchmark
                      ? { backgroundColor: 'rgba(245, 158, 11, 0.05)', borderLeft: '3px solid #f59e0b' }
                      : isBest
                        ? { backgroundColor: 'rgba(56, 189, 248, 0.06)', borderLeft: '3px solid #38bdf8' }
                        : undefined
                  }
                >
                  <td className="fw-medium" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {isBest && <Trophy size={14} style={{ color: '#38bdf8' }} />}
                    {isBenchmark && <span style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 700 }}>[BENCHMARK]</span>}
                    <span>{item.strategy_name}</span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {item.configuration}
                  </td>
                  <td className="font-mono">{item.trades}</td>
                  <td className="font-mono">{formatCurrency(item.final_equity)}</td>
                  <td
                    className="font-mono"
                    style={{ color: item.total_pnl >= 0 ? 'var(--profit)' : 'var(--loss)' }}
                  >
                    {item.total_pnl >= 0 ? '+' : ''}
                    {formatCurrency(item.total_pnl)}
                  </td>
                  <td
                    className="font-mono"
                    style={{
                      color: item.total_return >= 0 ? 'var(--profit)' : 'var(--loss)',
                      fontWeight: 600,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <span>{formatPercent(item.total_return)}</span>
                      {beatsBenchmark !== null && (
                        beatsBenchmark ? (
                          <span title="Outperforms Buy & Hold benchmark">
                            <CheckCircle size={12} style={{ color: 'var(--profit)' }} />
                          </span>
                        ) : (
                          <span title="Underperforms Buy & Hold benchmark">
                            <XCircle size={12} style={{ color: 'var(--loss)' }} />
                          </span>
                        )
                      )}
                    </div>
                  </td>
                  <td className="font-mono" style={{ color: 'var(--loss)' }}>
                    {formatPercent(item.max_drawdown)}
                  </td>
                  <td className="font-mono">
                    {item.win_rate !== null ? `${(item.win_rate * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td className="font-mono">
                    {item.profit_factor !== null
                      ? Number.isFinite(item.profit_factor)
                        ? item.profit_factor.toFixed(2)
                        : '∞'
                      : 'N/A'}
                  </td>
                  <td className="font-mono">
                    {item.sharpe_ratio !== null ? item.sharpe_ratio.toFixed(2) : 'N/A'}
                  </td>
                  <td className="font-mono">
                    {item.sortino_ratio !== null ? item.sortino_ratio.toFixed(2) : 'N/A'}
                  </td>
                  <td className="font-mono">
                    {item.cagr !== null ? formatPercent(item.cagr) : 'N/A'}
                  </td>
                  {onApplyConfig && (
                    <td>
                      {!isBenchmark ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onApplyConfig(item.parameters, item.strategy_name)}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          <span>Load</span>
                          <ArrowUpRight size={12} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>-</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
