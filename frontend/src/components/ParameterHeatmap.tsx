import { useMemo, useState } from 'react';
import { executeParameterHeatmap } from '../api/client';
import type {
  ParameterGridPointDTO,
  ParameterHeatmapRequest,
  ParameterHeatmapResponse,
  PositionSizingMode,
} from '../types';

interface ParameterHeatmapProps {
  dataset: string;
  initialCash: number;
  commissionRate: number;
  slippageRate: number;
  sizingMode: PositionSizingMode;
  quantityPerTrade: number;
}

const DEFAULT_FAST_PERIODS = [2, 5, 8, 10, 12, 15, 20];
const DEFAULT_SLOW_PERIODS = [15, 20, 25, 30, 40, 50, 60];

export function ParameterHeatmap({
  dataset,
  initialCash,
  commissionRate,
  slippageRate,
  sizingMode,
  quantityPerTrade,
}: ParameterHeatmapProps) {
  const [fastInput, setFastInput] = useState<string>(DEFAULT_FAST_PERIODS.join(', '));
  const [slowInput, setSlowInput] = useState<string>(DEFAULT_SLOW_PERIODS.join(', '));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParameterHeatmapResponse | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<ParameterGridPointDTO | null>(null);

  const parsePeriods = (input: string): number[] => {
    return Array.from(
      new Set(
        input
          .split(',')
          .map((s) => Number.parseInt(s.trim(), 10))
          .filter((n) => !Number.isNaN(n) && n > 0),
      ),
    ).sort((a, b) => a - b);
  };

  const handleRun = async () => {
    const fastList = parsePeriods(fastInput);
    const slowList = parsePeriods(slowInput);

    if (fastList.length === 0 || slowList.length === 0) {
      setError('Please provide at least one valid positive period for both Fast and Slow MA.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSelectedPoint(null);

    try {
      const req: ParameterHeatmapRequest = {
        dataset,
        fast_periods: fastList,
        slow_periods: slowList,
        initial_cash: initialCash,
        commission_rate: commissionRate,
        slippage_rate: slippageRate,
        sizing_mode: sizingMode,
        quantity_per_trade: quantityPerTrade,
      };
      const res = await executeParameterHeatmap(req);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Heatmap execution failed.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  // Build 2D lookup map: `${fast}_${slow}` -> ParameterGridPointDTO
  const { gridMap, fastList, slowList } = useMemo(() => {
    if (!result) return { gridMap: new Map(), fastList: [], slowList: [] };
    const map = new Map<string, ParameterGridPointDTO>();
    const fSet = new Set<number>();
    const sSet = new Set<number>();

    for (const pt of result.grid) {
      map.set(`${pt.fast_period}_${pt.slow_period}`, pt);
      fSet.add(pt.fast_period);
      sSet.add(pt.slow_period);
    }

    return {
      gridMap: map,
      fastList: Array.from(fSet).sort((a, b) => a - b),
      slowList: Array.from(sSet).sort((a, b) => a - b),
    };
  }, [result]);

  const getCellColor = (ret: number) => {
    if (ret > 0.3) return '#047857'; // vibrant green
    if (ret > 0.15) return '#065f46'; // rich emerald
    if (ret > 0.05) return '#0f766e'; // teal green
    if (ret > 0.0) return '#1e3a2b'; // subtle positive green
    if (ret === 0.0) return '#1e293b'; // slate dark
    if (ret > -0.05) return '#3a1e1e'; // subtle loss
    if (ret > -0.15) return '#831843'; // reddish pink
    return '#991b1b'; // strong loss red
  };

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <div>
          <h3>2D Parameter Surface & Stability Analysis</h3>
          <p className="analytics-subtitle">
            Evaluate sensitivity across parameter neighborhoods. Robust trading strategies form continuous profitable plateaus; brittle curve-fits appear as isolated spikes.
          </p>
        </div>
      </div>

      <div className="analytics-controls">
        <div className="control-field flex-grow">
          <label htmlFor="fast-periods">Fast MA Periods (comma-separated)</label>
          <input
            id="fast-periods"
            type="text"
            value={fastInput}
            onChange={(e) => setFastInput(e.target.value)}
            placeholder="e.g. 2, 5, 8, 10, 12, 15, 20"
          />
        </div>

        <div className="control-field flex-grow">
          <label htmlFor="slow-periods">Slow MA Periods (comma-separated)</label>
          <input
            id="slow-periods"
            type="text"
            value={slowInput}
            onChange={(e) => setSlowInput(e.target.value)}
            placeholder="e.g. 15, 20, 25, 30, 40, 50, 60"
          />
        </div>

        <div className="control-action">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRun}
            disabled={isLoading}
          >
            {isLoading ? <span className="spinner"></span> : '▶ Run Stability Analysis'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          <strong>Heatmap Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="heatmap-results-container" style={{ marginTop: '1.25rem' }}>
          {/* Stability Verdict Banner */}
          <div
            className={`wfo-grade-banner ${
              result.stability_verdict.includes('STABLE')
                ? 'badge-robust'
                : 'badge-overfitted'
            }`}
          >
            <div className="grade-badge-pill">{result.stability_verdict}</div>
            <div className="grade-details">
              <h4>
                Plateau Ratio: {(result.plateau_ratio * 100).toFixed(1)}% (
                {result.profitable_combinations} of {result.total_combinations} profitable pairs)
              </h4>
              <p>
                {result.stability_verdict.includes('STABLE')
                  ? 'High neighborhood continuity confirmed: adjacent parameter configurations also generate positive returns, indicating structural market behavior rather than statistical luck.'
                  : 'Warning: Profitable configurations are predominantly isolated spikes. Slight changes in market regime or parameter calibration will likely degrade performance.'}
              </p>
            </div>
          </div>

          {/* Legend */}
          <div className="heatmap-legend">
            <span className="legend-title">Legend:</span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: '#047857' }}></span> &gt; +30% Return
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: '#065f46' }}></span> +15% to +30%
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: '#1e3a2b' }}></span> 0% to +15%
            </span>
            <span className="legend-item">
              <span className="legend-swatch" style={{ background: '#991b1b' }}></span> Negative Loss
            </span>
            <span className="legend-item">
              <span className="plateau-dot">●</span> Robust Plateau Cluster
            </span>
          </div>

          {/* 2D Heatmap Grid */}
          <div className="heatmap-grid-scroll">
            <table className="heatmap-table">
              <thead>
                <tr>
                  <th className="heatmap-axis-label">Fast \ Slow</th>
                  {slowList.map((slow) => (
                    <th key={slow} className="heatmap-col-header">
                      {slow}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fastList.map((fast) => (
                  <tr key={fast}>
                    <th className="heatmap-row-header">{fast}</th>
                    {slowList.map((slow) => {
                      if (fast >= slow) {
                        return (
                          <td key={slow} className="heatmap-cell cell-invalid">
                            <span className="invalid-label">—</span>
                          </td>
                        );
                      }

                      const pt = gridMap.get(`${fast}_${slow}`);
                      if (!pt) {
                        return <td key={slow} className="heatmap-cell cell-empty">—</td>;
                      }

                      const isSelected =
                        selectedPoint?.fast_period === fast &&
                        selectedPoint?.slow_period === slow;

                      return (
                        <td
                          key={slow}
                          className={`heatmap-cell ${isSelected ? 'cell-selected' : ''}`}
                          style={{ backgroundColor: getCellColor(pt.total_return) }}
                          onClick={() => setSelectedPoint(pt)}
                        >
                          <div className="cell-content">
                            {pt.is_plateau && <span className="plateau-indicator" title="Robust Plateau Point">●</span>}
                            <span className="cell-return">
                              {pt.total_return >= 0 ? '+' : ''}
                              {(pt.total_return * 100).toFixed(1)}%
                            </span>
                            <span className="cell-sub">
                              {pt.sharpe_ratio !== null ? `Sh: ${pt.sharpe_ratio.toFixed(1)}` : 'Sh: -'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Point Inspector */}
          {selectedPoint ? (
            <div className="point-inspector-card">
              <div className="inspector-header">
                <h4>
                  Configuration Inspector: Fast MA {selectedPoint.fast_period} / Slow MA{' '}
                  {selectedPoint.slow_period}
                </h4>
                <span
                  className={`efficiency-tag ${
                    selectedPoint.is_plateau ? 'eff-good' : 'eff-poor'
                  }`}
                >
                  {selectedPoint.is_plateau ? 'Robust Plateau Member' : 'Isolated Configuration'}
                </span>
              </div>
              <div className="metric-cards-grid">
                <div className="metric-card">
                  <span className="metric-label">Total Return</span>
                  <span
                    className={`metric-value ${
                      selectedPoint.total_return >= 0 ? 'pnl-green' : 'pnl-red'
                    }`}
                  >
                    {selectedPoint.total_return >= 0 ? '+' : ''}
                    {formatPercent(selectedPoint.total_return)}
                  </span>
                  <span className="metric-sub">
                    P&L: {selectedPoint.total_pnl >= 0 ? '+' : ''}
                    {formatCurrency(selectedPoint.total_pnl)}
                  </span>
                </div>

                <div className="metric-card accent">
                  <span className="metric-label">Sharpe Ratio</span>
                  <span className="metric-value">
                    {selectedPoint.sharpe_ratio !== null
                      ? selectedPoint.sharpe_ratio.toFixed(2)
                      : 'N/A'}
                  </span>
                  <span className="metric-sub">Annualized (Rf=5%)</span>
                </div>

                <div className="metric-card warning">
                  <span className="metric-label">Max Drawdown</span>
                  <span className="metric-value">{formatPercent(selectedPoint.max_drawdown)}</span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">Trades & Win Rate</span>
                  <span className="metric-value">{selectedPoint.trades_count} trades</span>
                  <span className="metric-sub">
                    Win Rate:{' '}
                    {selectedPoint.win_rate !== null
                      ? `${(selectedPoint.win_rate * 100).toFixed(1)}%`
                      : 'N/A'}{' '}
                    | PF:{' '}
                    {selectedPoint.profit_factor !== null
                      ? selectedPoint.profit_factor.toFixed(2)
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <p className="inspector-hint">
              💡 Click any grid cell to inspect detailed Sharpe, Drawdown, Win Rate, and Profit Factor metrics.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
