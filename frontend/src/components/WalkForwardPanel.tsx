import { type MouseEvent, useMemo, useState } from 'react';
import { executeWalkForward } from '../api/client';
import type {
  PositionSizingMode,
  StrategyType,
  WalkForwardRequest,
  WalkForwardResponse,
} from '../types';

interface WalkForwardPanelProps {
  dataset: string;
  initialCash: number;
  commissionRate: number;
  slippageRate: number;
  sizingMode: PositionSizingMode;
  quantityPerTrade: number;
}

const CHART_WIDTH = 750;
const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 20, right: 30, bottom: 35, left: 75 };
const PLOT_WIDTH = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

export function WalkForwardPanel({
  dataset,
  initialCash,
  commissionRate,
  slippageRate,
  sizingMode,
  quantityPerTrade,
}: WalkForwardPanelProps) {
  const [strategy, setStrategy] = useState<StrategyType>('moving_average');
  const [numWindows, setNumWindows] = useState<number>(3);
  const [windowMode, setWindowMode] = useState<'rolling' | 'expanding'>('rolling');
  const [optimizationMetric, setOptimizationMetric] = useState<
    'sharpe_ratio' | 'profit_factor' | 'total_return'
  >('sharpe_ratio');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WalkForwardResponse | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleRun = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const req: WalkForwardRequest = {
        dataset,
        strategy,
        num_windows: numWindows,
        window_mode: windowMode,
        initial_cash: initialCash,
        commission_rate: commissionRate,
        slippage_rate: slippageRate,
        sizing_mode: sizingMode,
        quantity_per_trade: quantityPerTrade,
        optimization_metric: optimizationMetric,
      };
      const res = await executeWalkForward(req);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Walk-Forward Optimization failed.';
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

  // SVG Chart points for stitched out-of-sample equity curve
  const chartData = useMemo(() => {
    if (!result || !result.stitched_equity_curve || result.stitched_equity_curve.length === 0) {
      return null;
    }
    const curve = result.stitched_equity_curve;
    let min = Math.min(...curve, initialCash);
    let max = Math.max(...curve, initialCash);
    const span = max - min || 1;
    min -= span * 0.05;
    max += span * 0.05;

    const scaleX = (i: number) =>
      CHART_PADDING.left + (i / (curve.length - 1 || 1)) * PLOT_WIDTH;
    const scaleY = (v: number) =>
      CHART_PADDING.top + PLOT_HEIGHT - ((v - min) / (max - min)) * PLOT_HEIGHT;

    const coords = curve.map((val, i) => ({
      x: scaleX(i),
      y: scaleY(val),
      val,
      barIndex: i,
    }));

    const pathString = coords.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      '',
    );
    const firstX = coords[0]?.x || CHART_PADDING.left;
    const lastX = coords[coords.length - 1]?.x || CHART_WIDTH - CHART_PADDING.right;
    const bottomY = CHART_PADDING.top + PLOT_HEIGHT;
    const areaString = `${pathString} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    const baselineY = scaleY(initialCash);

    return { coords, min, max, pathString, areaString, baselineY, count: curve.length };
  }, [result, initialCash]);

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!chartData || chartData.coords.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * CHART_WIDTH;

    if (
      svgX < CHART_PADDING.left ||
      svgX > CHART_WIDTH - CHART_PADDING.right
    ) {
      setHoverIndex(null);
      return;
    }

    const ratio = (svgX - CHART_PADDING.left) / PLOT_WIDTH;
    const idx = Math.min(
      chartData.coords.length - 1,
      Math.max(0, Math.round(ratio * (chartData.coords.length - 1))),
    );
    setHoverIndex(idx);
  };

  const activePoint =
    hoverIndex !== null && chartData?.coords[hoverIndex]
      ? chartData.coords[hoverIndex]
      : null;

  const gradeBadgeClass = (grade: string) => {
    if (grade.includes('ROBUST')) return 'badge-robust';
    if (grade.includes('MODERATE')) return 'badge-moderate';
    return 'badge-overfitted';
  };

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <div>
          <h3>Walk-Forward Out-of-Sample Optimization (WFO)</h3>
          <p className="analytics-subtitle">
            Pardo (2008) rolling walk-forward test to detect curve-fitting and measure out-of-sample efficiency.
          </p>
        </div>
      </div>

      {/* Controls row */}
      <div className="analytics-controls">
        <div className="control-field">
          <label htmlFor="wfo-strategy">Strategy</label>
          <select
            id="wfo-strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as StrategyType)}
          >
            <option value="moving_average">Dual Moving Average</option>
            <option value="rsi">Relative Strength Index (RSI)</option>
            <option value="bollinger">Bollinger Bands (Mean Reversion)</option>
          </select>
        </div>

        <div className="control-field">
          <label htmlFor="wfo-windows">Windows ({numWindows})</label>
          <select
            id="wfo-windows"
            value={numWindows}
            onChange={(e) => setNumWindows(Number(e.target.value))}
          >
            <option value={2}>2 Forward Windows</option>
            <option value={3}>3 Forward Windows</option>
            <option value={4}>4 Forward Windows</option>
            <option value={5}>5 Forward Windows</option>
          </select>
        </div>

        <div className="control-field">
          <label htmlFor="wfo-mode">Window Mode</label>
          <select
            id="wfo-mode"
            value={windowMode}
            onChange={(e) => setWindowMode(e.target.value as 'rolling' | 'expanding')}
          >
            <option value="rolling">Rolling (Fixed In-Sample)</option>
            <option value="expanding">Expanding (Cumulative In-Sample)</option>
          </select>
        </div>

        <div className="control-field">
          <label htmlFor="wfo-metric">IS Target Metric</label>
          <select
            id="wfo-metric"
            value={optimizationMetric}
            onChange={(e) =>
              setOptimizationMetric(
                e.target.value as 'sharpe_ratio' | 'profit_factor' | 'total_return',
              )
            }
          >
            <option value="sharpe_ratio">Sharpe Ratio</option>
            <option value="profit_factor">Profit Factor</option>
            <option value="total_return">Total Return</option>
          </select>
        </div>

        <div className="control-action">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRun}
            disabled={isLoading}
          >
            {isLoading ? <span className="spinner"></span> : '▶ Run Walk-Forward'}
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          <strong>WFO Error:</strong> {error}
        </div>
      )}

      {result && (
        <div className="wfo-results-container">
          {/* Robustness Grade Banner */}
          <div className={`wfo-grade-banner ${gradeBadgeClass(result.robustness_grade)}`}>
            <div className="grade-badge-pill">{result.robustness_grade}</div>
            <div className="grade-details">
              <h4>
                Walk-Forward Efficiency (WFE):{' '}
                {result.overall_efficiency !== null
                  ? `${(result.overall_efficiency * 100).toFixed(1)}%`
                  : 'N/A'}
              </h4>
              <p>{result.explanation}</p>
            </div>
          </div>

          {/* Stitched Performance Summary */}
          {result.stitched_metrics && (
            <div className="metric-cards-grid" style={{ marginTop: '1rem' }}>
              <div className="metric-card">
                <span className="metric-label">Stitched OOS Return</span>
                <span
                  className={`metric-value ${
                    result.stitched_metrics.total_return >= 0 ? 'pnl-green' : 'pnl-red'
                  }`}
                >
                  {result.stitched_metrics.total_return >= 0 ? '+' : ''}
                  {formatPercent(result.stitched_metrics.total_return)}
                </span>
                <span className="metric-sub">
                  Total P&L: {result.stitched_metrics.total_pnl >= 0 ? '+' : ''}
                  {formatCurrency(result.stitched_metrics.total_pnl)}
                </span>
              </div>

              <div className="metric-card warning">
                <span className="metric-label">Stitched Max Drawdown</span>
                <span className="metric-value">
                  {formatPercent(result.stitched_metrics.max_drawdown)}
                </span>
                <span className="metric-sub">Out-of-sample peak-to-trough</span>
              </div>

              <div className="metric-card accent">
                <span className="metric-label">Stitched Sharpe Ratio</span>
                <span className="metric-value">
                  {result.stitched_metrics.sharpe_ratio !== null
                    ? result.stitched_metrics.sharpe_ratio.toFixed(2)
                    : 'N/A'}
                </span>
                <span className="metric-sub">Annualized (Rf=5%)</span>
              </div>

              <div className="metric-card">
                <span className="metric-label">OOS Trades Executed</span>
                <span className="metric-value">{result.stitched_metrics.total_trades}</span>
                <span className="metric-sub">
                  Win Rate:{' '}
                  {result.stitched_metrics.win_rate !== null
                    ? `${(result.stitched_metrics.win_rate * 100).toFixed(1)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          )}

          {/* Stitched Equity Curve Chart */}
          {chartData && (
            <div className="chart-container" style={{ marginTop: '1.25rem' }}>
              <div className="chart-header">
                <div>
                  <h4>Stitched Out-of-Sample Cumulative Equity Curve</h4>
                  <span className="chart-subtitle">
                    Concatenated forward testing across {result.windows.length} sequential out-of-sample segments ({chartData.count} bars).
                  </span>
                </div>
                {activePoint && (
                  <div className="chart-tooltip-badge">
                    <span>OOS Bar #{activePoint.barIndex}</span>
                    <span>Equity: {formatCurrency(activePoint.val)}</span>
                    <span className={activePoint.val >= initialCash ? 'pnl-green' : 'pnl-red'}>
                      P&L: {activePoint.val >= initialCash ? '+' : ''}
                      {formatCurrency(activePoint.val - initialCash)}
                    </span>
                  </div>
                )}
              </div>

              <svg
                className="equity-svg"
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="wfoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Initial Capital Baseline */}
                {chartData.baselineY >= CHART_PADDING.top &&
                  chartData.baselineY <= CHART_PADDING.top + PLOT_HEIGHT && (
                    <line
                      x1={CHART_PADDING.left}
                      y1={chartData.baselineY}
                      x2={CHART_WIDTH - CHART_PADDING.right}
                      y2={chartData.baselineY}
                      stroke="#94a3b8"
                      strokeDasharray="5 5"
                      strokeWidth="1.5"
                    />
                  )}

                {/* Area and Line */}
                <path d={chartData.areaString} fill="url(#wfoGradient)" />
                <path d={chartData.pathString} fill="none" stroke="#10b981" strokeWidth="2.5" />

                {/* Hover line and dot */}
                {activePoint && (
                  <g>
                    <line
                      x1={activePoint.x}
                      y1={CHART_PADDING.top}
                      x2={activePoint.x}
                      y2={CHART_PADDING.top + PLOT_HEIGHT}
                      stroke="#cbd5e1"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="5"
                      fill="#10b981"
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>
            </div>
          )}

          {/* Windows Breakdown Table */}
          <div className="table-card" style={{ marginTop: '1.25rem' }}>
            <div className="table-header">
              <h4>Walk-Forward Window Decomposition</h4>
              <span className="table-subtitle">
                In-Sample parameter discovery vs. Out-of-Sample verification
              </span>
            </div>
            <div className="table-scroll">
              <table className="quant-table">
                <thead>
                  <tr>
                    <th>Window</th>
                    <th>In-Sample Period</th>
                    <th>Optimal Parameters</th>
                    <th>In-Sample Return</th>
                    <th>Out-of-Sample Period</th>
                    <th>Out-of-Sample Return</th>
                    <th>WFE ($R_{'{oos}'} / R_{'{is}'}$)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.windows.map((w) => {
                    const isPos = w.out_of_sample_return >= 0;
                    const effStr =
                      w.efficiency_ratio !== null
                        ? `${(w.efficiency_ratio * 100).toFixed(1)}%`
                        : 'N/A';
                    const paramStr = Object.entries(w.best_parameters)
                      .map(([k, v]) => `${k}=${v}`)
                      .join(', ');

                    return (
                      <tr key={w.window_index}>
                        <td>
                          <strong>#{w.window_index + 1}</strong>
                        </td>
                        <td>
                          <span className="date-cell">
                            {w.in_sample_start} → {w.in_sample_end}
                          </span>
                          <span className="sub-cell">({w.in_sample_bars_count} bars)</span>
                        </td>
                        <td>
                          <code className="code-pill">{paramStr}</code>
                        </td>
                        <td className="number-cell font-mono">
                          {formatPercent(w.in_sample_return)}
                        </td>
                        <td>
                          <span className="date-cell">
                            {w.out_of_sample_start} → {w.out_of_sample_end}
                          </span>
                          <span className="sub-cell">({w.out_of_sample_bars_count} bars)</span>
                        </td>
                        <td
                          className={`number-cell font-mono font-bold ${
                            isPos ? 'pnl-green' : 'pnl-red'
                          }`}
                        >
                          {isPos ? '+' : ''}
                          {formatPercent(w.out_of_sample_return)}
                        </td>
                        <td className="number-cell font-mono">
                          <span
                            className={`efficiency-tag ${
                              w.efficiency_ratio !== null && w.efficiency_ratio >= 0.5
                                ? 'eff-good'
                                : 'eff-poor'
                            }`}
                          >
                            {effStr}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
