import { type MouseEvent, useMemo, useState, useRef, useEffect } from 'react';
import { Download, FileText, Printer, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { executeTearSheet } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { downloadHtmlReport, downloadMetricsCsv, printTearSheet } from '../utils/reportGenerator';
import type {
  PositionSizingMode,
  StrategyType,
  TearSheetRequest,
  TearSheetResponse,
} from '../types';

interface TearSheetPanelProps {
  dataset: string;
  initialCash: number;
  commissionRate: number;
  slippageRate: number;
  sizingMode: PositionSizingMode;
  quantityPerTrade: number;
}

const CHART_WIDTH = 750;
const CHART_HEIGHT = 240;
const CHART_PADDING = { top: 20, right: 30, bottom: 35, left: 75 };
const PLOT_WIDTH = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

const MONTH_COLS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function TearSheetPanel({
  dataset,
  initialCash,
  commissionRate,
  slippageRate,
  sizingMode,
  quantityPerTrade,
}: TearSheetPanelProps) {
  const [strategy, setStrategy] = useState<StrategyType>('moving_average');
  const [fastPeriod, setFastPeriod] = useState<number>(10);
  const [slowPeriod, setSlowPeriod] = useState<number>(30);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [rsiOversold, setRsiOversold] = useState<number>(30);
  const [rsiOverbought, setRsiOverbought] = useState<number>(70);
  const [bbPeriod, setBbPeriod] = useState<number>(20);
  const [bbStdDev, setBbStdDev] = useState<number>(2.0);
  const [riskFreeRate, setRiskFreeRate] = useState<number>(0.05);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TearSheetResponse | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();
  const analystName = currentUser?.username || 'Quantitative Researcher';

  useEffect(() => {
    function handleClickOutside(e: globalThis.MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setIsExportOpen(false);
      }
    }
    if (isExportOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportOpen]);

  const handleRun = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const req: TearSheetRequest = {
        dataset,
        strategy,
        fast_period: fastPeriod,
        slow_period: slowPeriod,
        rsi_period: rsiPeriod,
        oversold: rsiOversold,
        overbought: rsiOverbought,
        bb_period: bbPeriod,
        bb_std_dev: bbStdDev,
        initial_cash: initialCash,
        commission_rate: commissionRate,
        slippage_rate: slippageRate,
        sizing_mode: sizingMode,
        quantity_per_trade: quantityPerTrade,
        risk_free_rate: riskFreeRate,
      };
      const res = await executeTearSheet(req);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Tear-sheet execution failed.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Underwater Drawdown Chart Coordinate Processing
  const { points, minDrawdown, pathD, areaD } = useMemo(() => {
    if (!result || !result.underwater_curve || result.underwater_curve.length === 0) {
      return { points: [], minDrawdown: -0.1, pathD: '', areaD: '' };
    }

    const data = result.underwater_curve;
    const values = data.map((d) => d.drawdown);
    let min = Math.min(...values, -0.05);
    // Give 10% breathing room on the bottom
    min = min * 1.1;

    const scaleX = (i: number) =>
      CHART_PADDING.left + (i / (data.length - 1 || 1)) * PLOT_WIDTH;
    const scaleY = (val: number) =>
      CHART_PADDING.top + ((val - 0.0) / (min - 0.0)) * PLOT_HEIGHT;

    const coords = data.map((d, i) => ({
      x: scaleX(i),
      y: scaleY(d.drawdown),
      drawdown: d.drawdown,
      timestamp: d.timestamp,
    }));

    const pathString = coords.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      '',
    );

    const firstX = coords[0]?.x || CHART_PADDING.left;
    const lastX = coords[coords.length - 1]?.x || CHART_WIDTH - CHART_PADDING.right;
    const topY = CHART_PADDING.top;

    const areaString = `${pathString} L ${lastX} ${topY} L ${firstX} ${topY} Z`;

    return {
      points: coords,
      minDrawdown: min,
      pathD: pathString,
      areaD: areaString,
    };
  }, [result]);

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * CHART_WIDTH;

    if (svgX < CHART_PADDING.left || svgX > CHART_WIDTH - CHART_PADDING.right || points.length === 0) {
      setHoverIndex(null);
      return;
    }

    const ratio = (svgX - CHART_PADDING.left) / PLOT_WIDTH;
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.round(ratio * (points.length - 1))),
    );
    setHoverIndex(index);
  };

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  const formatPct = (val: number | null | undefined, digits = 2) => {
    if (val === null || val === undefined) return 'N/A';
    return `${(val * 100).toFixed(digits)}%`;
  };

  const formatNum = (val: number | null | undefined, digits = 2) => {
    if (val === null || val === undefined) return 'N/A';
    return val.toFixed(digits);
  };

  const getMonthBg = (val: number | null) => {
    if (val === null) return 'transparent';
    if (val > 0) {
      const alpha = Math.min(0.5, Math.max(0.08, val * 3));
      return `rgba(34, 197, 94, ${alpha.toFixed(2)})`;
    }
    if (val < 0) {
      const alpha = Math.min(0.5, Math.max(0.08, Math.abs(val) * 3));
      return `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
    }
    return 'rgba(148, 163, 184, 0.08)';
  };

  return (
    <div className="tearsheet-container">
      <div className="tearsheet-header">
        <div>
          <h2>📊 Quantitative Tear-Sheet & Tail-Risk Diagnostics</h2>
          <p className="subtitle">
            PyFolio-grade risk analytics, historical & parametric Value-at-Risk (VaR), Expected
            Shortfall (CVaR), Calmar ratio, monthly return heatmap, and underwater drawdown curves.
          </p>
        </div>
      </div>

      <div className="config-grid tearsheet-controls">
        <div className="control-group">
          <label>Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as StrategyType)}
            className="form-control"
          >
            <option value="moving_average">Moving Average Crossover</option>
            <option value="rsi">Relative Strength Index (RSI)</option>
            <option value="bollinger">Bollinger Bands (Mean Reversion)</option>
          </select>
        </div>

        {strategy === 'moving_average' && (
          <>
            <div className="control-group">
              <label>Fast MA Period</label>
              <input
                type="number"
                min="1"
                value={fastPeriod}
                onChange={(e) => setFastPeriod(Number(e.target.value))}
                className="form-control"
              />
            </div>
            <div className="control-group">
              <label>Slow MA Period</label>
              <input
                type="number"
                min="2"
                value={slowPeriod}
                onChange={(e) => setSlowPeriod(Number(e.target.value))}
                className="form-control"
              />
            </div>
          </>
        )}

        {strategy === 'rsi' && (
          <>
            <div className="control-group">
              <label>RSI Period</label>
              <input
                type="number"
                min="2"
                value={rsiPeriod}
                onChange={(e) => setRsiPeriod(Number(e.target.value))}
                className="form-control"
              />
            </div>
            <div className="control-group">
              <label>Oversold / Overbought</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  value={rsiOversold}
                  onChange={(e) => setRsiOversold(Number(e.target.value))}
                  className="form-control"
                  style={{ width: '50%' }}
                />
                <input
                  type="number"
                  value={rsiOverbought}
                  onChange={(e) => setRsiOverbought(Number(e.target.value))}
                  className="form-control"
                  style={{ width: '50%' }}
                />
              </div>
            </div>
          </>
        )}

        {strategy === 'bollinger' && (
          <>
            <div className="control-group">
              <label>BB Period (N)</label>
              <input
                type="number"
                min="2"
                value={bbPeriod}
                onChange={(e) => setBbPeriod(Number(e.target.value))}
                className="form-control"
              />
            </div>
            <div className="control-group">
              <label>Multiplier (k)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={bbStdDev}
                onChange={(e) => setBbStdDev(Number(e.target.value))}
                className="form-control"
              />
            </div>
          </>
        )}

        <div className="control-group">
          <label>Risk-Free Rate (Annual)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            max="0.2"
            value={riskFreeRate}
            onChange={(e) => setRiskFreeRate(Number(e.target.value))}
            className="form-control"
          />
        </div>

        <div className="control-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            className="btn btn-primary"
            onClick={handleRun}
            disabled={isLoading}
            style={{ width: '100%', height: '38px' }}
          >
            {isLoading ? 'Computing Tear-Sheet...' : '▶ Generate Tear-Sheet'}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {result && (
        <div className="tearsheet-results">
          {/* Top Level Summary Cards */}
          <div
            className="results-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1.25rem',
            }}
          >
            <div>
              <h3>
                {result.strategy_name} — <code>{result.configuration}</code>
              </h3>
              <p className="caption">
                Dataset: <strong>{result.dataset}</strong> | Bars Processed: <strong>{result.bars_processed}</strong> | Final Equity: <strong>₹{result.final_equity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
              </p>
            </div>

            {/* Export Research Report Action Menu */}
            <div ref={exportRef} style={{ position: 'relative' }} className="no-print">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsExportOpen(!isExportOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  backgroundColor: isExportOpen ? 'var(--bg-elevated)' : 'var(--bg-card)',
                  borderColor: isExportOpen ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  color: isExportOpen ? 'var(--accent-primary)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
                title="Export Quantitative Research Report"
              >
                <Download size={15} style={{ color: 'var(--accent-primary)' }} />
                <span>Export Report</span>
                <ChevronDown
                  size={13}
                  style={{
                    transform: isExportOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>

              {isExportOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '270px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.45rem',
                    boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.65)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.3rem',
                    zIndex: 110,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportOpen(false);
                      downloadHtmlReport(result, analystName);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <FileText size={17} style={{ color: 'var(--accent-primary)', marginTop: '0.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Standalone HTML Dossier</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Self-contained offline file with embedded SVG</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportOpen(false);
                      printTearSheet();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Printer size={17} style={{ color: 'var(--profit)', marginTop: '0.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Print / Save as PDF</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Formatted high-contrast document for PDF export</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsExportOpen(false);
                      downloadMetricsCsv(result);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      padding: '0.55rem 0.65rem',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <FileSpreadsheet size={17} style={{ color: 'var(--benchmark)', marginTop: '0.1rem', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Metrics CSV Spreadsheet</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tabular metrics & monthly returns in CSV</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>

          <h4 className="section-title">Executive Performance Scorecard</h4>
          <div className="metric-cards-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="metric-card">
              <div className="metric-label">Total Return</div>
              <div className={`metric-value ${result.summary.total_return >= 0 ? 'text-green' : 'text-red'}`}>
                {formatPct(result.summary.total_return)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">CAGR</div>
              <div className="metric-value">{formatPct(result.summary.cagr)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Max Drawdown</div>
              <div className="metric-value text-red">{formatPct(result.summary.max_drawdown)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Calmar Ratio</div>
              <div className="metric-value">{formatNum(result.summary.calmar_ratio)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Sharpe Ratio</div>
              <div className="metric-value">{formatNum(result.summary.sharpe_ratio)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Sortino Ratio</div>
              <div className="metric-value">{formatNum(result.summary.sortino_ratio)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Win Rate</div>
              <div className="metric-value">{formatPct(result.summary.win_rate, 1)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Profit Factor</div>
              <div className="metric-value">{formatNum(result.summary.profit_factor)}</div>
            </div>
          </div>

          {/* Tail-Risk Diagnostics Grid */}
          <h4 className="section-title">Tail-Risk & Extreme Loss Diagnostics</h4>
          <div className="tail-risk-grid" style={{ marginBottom: '2rem' }}>
            <div className="risk-metric-box">
              <span className="risk-title">Historical VaR (95%)</span>
              <span className="risk-num text-red">{formatPct(result.tail_risk.var_95_historical)}</span>
              <span className="risk-desc">Daily loss exceeded only 5% of trading days</span>
            </div>
            <div className="risk-metric-box">
              <span className="risk-title">Parametric VaR (95%)</span>
              <span className="risk-num text-red">{formatPct(result.tail_risk.var_95_parametric)}</span>
              <span className="risk-desc">Gaussian loss model: -(μ - 1.645σ)</span>
            </div>
            <div className="risk-metric-box">
              <span className="risk-title">Expected Shortfall (CVaR 95%)</span>
              <span className="risk-num text-red" style={{ fontWeight: 700 }}>
                {formatPct(result.tail_risk.cvar_95)}
              </span>
              <span className="risk-desc">Average expected loss when 95% VaR is breached</span>
            </div>
            <div className="risk-metric-box">
              <span className="risk-title">Historical VaR (99%)</span>
              <span className="risk-num text-red">{formatPct(result.tail_risk.var_99_historical)}</span>
              <span className="risk-desc">1-in-100 day extreme crash threshold</span>
            </div>
            <div className="risk-metric-box">
              <span className="risk-title">Expected Shortfall (CVaR 99%)</span>
              <span className="risk-num text-red" style={{ fontWeight: 700 }}>
                {formatPct(result.tail_risk.cvar_99)}
              </span>
              <span className="risk-desc">Mean catastrophic loss in worst 1% tail</span>
            </div>
            <div className="risk-metric-box">
              <span className="risk-title">Annualized Volatility</span>
              <span className="risk-num">{formatPct(result.tail_risk.annualized_volatility)}</span>
              <span className="risk-desc">Standard deviation scaled by √252</span>
            </div>
            <div className="risk-metric-box">
              <span className="risk-title">Tail Ratio</span>
              <span className="risk-num">{formatNum(result.tail_risk.tail_ratio)}</span>
              <span className="risk-desc">P95 / |P5| (&gt; 1.0 implies upside skew)</span>
            </div>
            <div className="risk-metric-box">
              <span className="risk-title">Skewness</span>
              <span className="risk-num">{formatNum(result.tail_risk.skewness)}</span>
              <span className="risk-desc">Third standardized moment asymmetry</span>
            </div>
            <div className="risk-metric-box">
              <span className="risk-title">Excess Kurtosis</span>
              <span className="risk-num">{formatNum(result.tail_risk.kurtosis)}</span>
              <span className="risk-desc">&gt; 0 indicates fat leptokurtic tail risk</span>
            </div>
          </div>

          {/* Monthly Calendar Returns Heatmap Matrix */}
          <h4 className="section-title">Calendar Monthly & Annual Return Heatmap</h4>
          <div className="table-responsive" style={{ marginBottom: '2rem' }}>
            <table className="comparison-table monthly-matrix-table">
              <thead>
                <tr>
                  <th>Year</th>
                  {MONTH_COLS.map((m) => (
                    <th key={m} style={{ textAlign: 'center' }}>
                      {m}
                    </th>
                  ))}
                  <th style={{ textAlign: 'right' }}>Year Total</th>
                </tr>
              </thead>
              <tbody>
                {result.monthly_matrix.map((row) => (
                  <tr key={row.year}>
                    <td style={{ fontWeight: 700 }}>{row.year}</td>
                    {MONTH_COLS.map((m) => {
                      const val = row.months[m] ?? null;
                      return (
                        <td
                          key={m}
                          style={{
                            textAlign: 'center',
                            backgroundColor: getMonthBg(val),
                            fontWeight: val !== null ? 600 : 400,
                            color: val !== null ? (val >= 0 ? '#15803d' : '#b91c1c') : '#94a3b8',
                          }}
                        >
                          {val !== null ? `${(val * 100).toFixed(1)}%` : '—'}
                        </td>
                      );
                    })}
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        backgroundColor: getMonthBg(row.year_total),
                        color: row.year_total >= 0 ? '#15803d' : '#b91c1c',
                      }}
                    >
                      {formatPct(row.year_total, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Underwater Drawdown Chart */}
          <h4 className="section-title">Underwater Portfolio Drawdown Curve</h4>
          <div className="chart-card" style={{ marginBottom: '1.5rem' }}>
            <div className="chart-header">
              <span className="chart-title">Peak-to-Trough Drawdown Depth</span>
              {activePoint && (
                <span className="chart-badge text-red">
                  {activePoint.timestamp.slice(0, 10)}: {(activePoint.drawdown * 100).toFixed(2)}%
                </span>
              )}
            </div>
            <div className="chart-body" style={{ overflowX: 'auto' }}>
              <svg
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                className="equity-svg"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="underwaterGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
                  </linearGradient>
                </defs>

                {/* Y-axis grid ticks */}
                {[0.0, -0.05, -0.1, -0.15, -0.2, minDrawdown]
                  .filter((v, idx, arr) => arr.indexOf(v) === idx && v >= minDrawdown)
                  .map((tickVal) => {
                    const y = CHART_PADDING.top + ((tickVal - 0.0) / (minDrawdown - 0.0)) * PLOT_HEIGHT;
                    return (
                      <g key={tickVal}>
                        <line
                          x1={CHART_PADDING.left}
                          y1={y}
                          x2={CHART_WIDTH - CHART_PADDING.right}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray={tickVal === 0 ? undefined : '3 3'}
                        />
                        <text
                          x={CHART_PADDING.left - 8}
                          y={y + 3}
                          textAnchor="end"
                          fontSize="10"
                          fill="#64748b"
                        >
                          {(tickVal * 100).toFixed(0)}%
                        </text>
                      </g>
                    );
                  })}

                {/* Underwater Area Fill */}
                {areaD && <path d={areaD} fill="url(#underwaterGrad)" />}

                {/* Drawdown Curve Line */}
                {pathD && (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {/* Hover line & dot */}
                {activePoint && (
                  <>
                    <line
                      x1={activePoint.x}
                      y1={CHART_PADDING.top}
                      x2={activePoint.x}
                      y2={CHART_HEIGHT - CHART_PADDING.bottom}
                      stroke="#94a3b8"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="4"
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </>
                )}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
