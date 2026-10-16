import { type MouseEvent, useMemo, useState } from 'react';
import { executeBasketBacktest, fetchBatchDatasetsFromAPI } from '../api/client';
import type {
  AllocationWeighting,
  BasketBacktestRequest,
  BasketBacktestResponse,
  DatasetInfo,
  RebalanceFrequency,
} from '../types';

interface BasketPanelProps {
  datasets: DatasetInfo[];
  defaultInitialCash?: number;
  defaultCommissionRate?: number;
  defaultSlippageRate?: number;
  onRefreshDatasets?: () => Promise<void>;
}

const CHART_WIDTH = 750;
const CHART_HEIGHT = 260;
const CHART_PADDING = { top: 20, right: 30, bottom: 40, left: 75 };
const PLOT_WIDTH = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const PLOT_HEIGHT = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

const ASSET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // purple
  '#06b6d4', // cyan
];

export function BasketPanel({
  datasets,
  defaultInitialCash = 100_000,
  defaultCommissionRate = 0.001,
  defaultSlippageRate = 0.0005,
  onRefreshDatasets,
}: BasketPanelProps) {
  // Available dataset filenames
  const availableFiles = useMemo(() => {
    return datasets.map((d) => d.filename);
  }, [datasets]);

  // Selected datasets
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(() => {
    if (availableFiles.length >= 2) {
      return availableFiles.slice(0, 2);
    }
    return availableFiles.length > 0 ? [availableFiles[0]] : ['reliance_daily.csv'];
  });

  const [weighting, setWeighting] = useState<AllocationWeighting>('equal_weight');
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({});
  const [rebalanceFreq, setRebalanceFreq] = useState<RebalanceFrequency>('monthly');
  const [initialCash, setInitialCash] = useState<number>(defaultInitialCash);
  const [commissionRate, setCommissionRate] = useState<number>(defaultCommissionRate);
  const [slippageRate, setSlippageRate] = useState<number>(defaultSlippageRate);
  const [riskFreeRate, setRiskFreeRate] = useState<number>(0.05);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BasketBacktestResponse | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const [showBatchInput, setShowBatchInput] = useState<boolean>(false);
  const [batchSymbolsInput, setBatchSymbolsInput] = useState<string>('');
  const [batchPeriod, setBatchPeriod] = useState<string>('2y');
  const [isBatchIngesting, setIsBatchIngesting] = useState<boolean>(false);
  const [batchFeedback, setBatchFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const handleBatchFetch = async () => {
    const symbols = batchSymbolsInput
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) return;

    setIsBatchIngesting(true);
    setBatchFeedback(null);
    try {
      const res = await fetchBatchDatasetsFromAPI(symbols, batchPeriod);
      const failText =
        res.failed_symbols.length > 0
          ? ` (${res.failed_symbols.map((f) => f.symbol).join(', ')} failed)`
          : '';
      setBatchFeedback({
        type: 'success',
        msg: `${res.message}${failText}`,
      });
      if (onRefreshDatasets) {
        await onRefreshDatasets();
      }
      const newFiles = res.datasets.map((d) => d.filename);
      setSelectedDatasets((prev) => Array.from(new Set([...prev, ...newFiles])));
      setBatchSymbolsInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch download failed.';
      setBatchFeedback({ type: 'error', msg });
    } finally {
      setIsBatchIngesting(false);
    }
  };

  // Toggle dataset selection
  const handleToggleDataset = (file: string) => {
    setSelectedDatasets((prev) => {
      if (prev.includes(file)) {
        if (prev.length <= 1) return prev; // Keep at least one
        return prev.filter((f) => f !== file);
      }
      return [...prev, file];
    });
  };

  // Helper: clean symbol name from filename
  const cleanSymbol = (file: string) =>
    file.replace('_daily.csv', '').replace('.csv', '').toUpperCase();

  // Normalize custom weights to 100%
  const handleNormalizeWeights = () => {
    const syms = selectedDatasets.map(cleanSymbol);
    const sum = syms.reduce((acc, s) => acc + (customWeights[s] || 0), 0);
    if (sum <= 0) {
      const eq = Math.round(100 / syms.length);
      const newWeights: Record<string, number> = {};
      syms.forEach((s) => {
        newWeights[s] = eq;
      });
      setCustomWeights(newWeights);
      return;
    }
    const newWeights: Record<string, number> = {};
    syms.forEach((s) => {
      const current = customWeights[s] || 0;
      newWeights[s] = Math.round((current / sum) * 100);
    });
    setCustomWeights(newWeights);
  };

  const handleRunBasket = async () => {
    if (selectedDatasets.length === 0) {
      setError('Please select at least one asset for the basket.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let formattedCustomWeights: Record<string, number> | undefined = undefined;
      if (weighting === 'custom') {
        const syms = selectedDatasets.map(cleanSymbol);
        formattedCustomWeights = {};
        for (const s of syms) {
          const raw = customWeights[s] ?? 0;
          formattedCustomWeights[s] = raw / 100.0;
        }
      }

      const req: BasketBacktestRequest = {
        datasets: selectedDatasets,
        weighting,
        custom_weights: formattedCustomWeights,
        rebalance_freq: rebalanceFreq,
        initial_cash: initialCash,
        commission_rate: commissionRate,
        slippage_rate: slippageRate,
        risk_free_rate: riskFreeRate,
      };

      const res = await executeBasketBacktest(req);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Basket backtest failed.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Portfolio Equity Curve Coordinates
  const { points, minEquity, maxEquity, pathD, areaD, baselineY } = useMemo(() => {
    if (!result || !result.equity_points || result.equity_points.length === 0) {
      return {
        points: [],
        minEquity: initialCash,
        maxEquity: initialCash,
        pathD: '',
        areaD: '',
        baselineY: CHART_HEIGHT / 2,
      };
    }

    const data = result.equity_points;
    const values = data.map((d) => d.equity);
    let min = Math.min(...values, result.initial_cash);
    let max = Math.max(...values, result.initial_cash);

    const span = max - min || 1;
    min -= span * 0.05;
    max += span * 0.05;

    const scaleX = (i: number) =>
      CHART_PADDING.left + (i / (data.length - 1 || 1)) * PLOT_WIDTH;
    const scaleY = (val: number) =>
      CHART_PADDING.top + PLOT_HEIGHT - ((val - min) / (max - min)) * PLOT_HEIGHT;

    const coords = data.map((d, i) => ({
      x: scaleX(i),
      y: scaleY(d.equity),
      equity: d.equity,
      cash: d.cash,
      timestamp: d.timestamp,
    }));

    const pathString = coords.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      '',
    );

    const firstX = coords[0]?.x || CHART_PADDING.left;
    const lastX = coords[coords.length - 1]?.x || CHART_WIDTH - CHART_PADDING.right;
    const bottomY = CHART_PADDING.top + PLOT_HEIGHT;
    const areaString = `${pathString} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    const baseY = scaleY(result.initial_cash);

    return {
      points: coords,
      minEquity: min,
      maxEquity: max,
      pathD: pathString,
      areaD: areaString,
      baselineY: baseY,
    };
  }, [result, initialCash]);

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    let closest = 0;
    let minDist = Infinity;
    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - mouseX);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });

    setHoverIndex(closest);
  };

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  return (
    <div className="tear-sheet-container">
      {/* Title & Introduction */}
      <div className="tear-sheet-header">
        <div>
          <h2>🧺 Multi-Asset Basket & Portfolio Rebalancing Engine</h2>
          <p className="subtitle">
            Simultaneously simulate multi-asset portfolios across arbitrary asset collections.
            Evaluate Equal Weight, Inverse Volatility (Risk Parity), and Custom Target Allocations
            with next-bar open execution and monthly/quarterly rebalancing friction.
          </p>
        </div>
      </div>

      {/* Configuration Controls Card */}
      <div className="card config-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
          Portfolio Basket Configuration
        </h3>

        {/* 1. Multi-Asset Selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
              Select Asset Universe ({selectedDatasets.length} selected):
            </label>
            <button
              type="button"
              onClick={() => setShowBatchInput(!showBatchInput)}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', padding: '0.2rem 0.6rem' }}
            >
              {showBatchInput ? '✕ Cancel' : '⚡ Batch Ingest Tickers'}
            </button>
          </div>

          {showBatchInput && (
            <div
              style={{
                background: 'var(--bg-secondary)',
                padding: '0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Enter symbols: e.g. TCS.NS, INFY.NS, RELIANCE.NS, HDFCBANK.NS"
                  value={batchSymbolsInput}
                  onChange={(e) => setBatchSymbolsInput(e.target.value)}
                  disabled={isBatchIngesting}
                  style={{
                    flex: 1,
                    padding: '0.4rem 0.6rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
                <select
                  value={batchPeriod}
                  onChange={(e) => setBatchPeriod(e.target.value)}
                  disabled={isBatchIngesting}
                  style={{
                    padding: '0.4rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                >
                  <option value="1y">1y</option>
                  <option value="2y">2y</option>
                  <option value="5y">5y</option>
                  <option value="max">max</option>
                </select>
                <button
                  type="button"
                  onClick={handleBatchFetch}
                  disabled={isBatchIngesting || !batchSymbolsInput.trim()}
                  className="btn btn-primary btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {isBatchIngesting ? <span className="spinner"></span> : 'Download Basket'}
                </button>
              </div>
              {batchFeedback && (
                <div
                  style={{
                    marginTop: '0.5rem',
                    fontSize: '0.8rem',
                    color:
                      batchFeedback.type === 'success'
                        ? 'var(--color-success, #10b981)'
                        : 'var(--color-danger, #ef4444)',
                  }}
                >
                  {batchFeedback.msg}
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {datasets.map((d) => {
              const isSelected = selectedDatasets.includes(d.filename);
              return (
                <button
                  key={d.filename}
                  type="button"
                  onClick={() => handleToggleDataset(d.filename)}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.82rem',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{isSelected ? '✓' : '+'}</span>
                  <span>{d.symbol}</span>
                  <span style={{ opacity: 0.7, fontSize: '0.75rem' }}>({d.bars_count} bars)</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Weighting Scheme & Rebalancing Schedule */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label>Allocation Weighting Scheme</label>
            <select
              value={weighting}
              onChange={(e) => setWeighting(e.target.value as AllocationWeighting)}
              className="form-control"
            >
              <option value="equal_weight">Equal Weight (1/N)</option>
              <option value="inverse_volatility">Inverse Volatility (Risk Parity)</option>
              <option value="custom">Custom Target Weights</option>
            </select>
          </div>

          <div className="form-group">
            <label>Rebalance Schedule</label>
            <select
              value={rebalanceFreq}
              onChange={(e) => setRebalanceFreq(e.target.value as RebalanceFrequency)}
              className="form-control"
            >
              <option value="none">Buy & Hold (Drift / No Rebalancing)</option>
              <option value="monthly">Monthly Rebalancing</option>
              <option value="quarterly">Quarterly Rebalancing</option>
            </select>
          </div>

          <div className="form-group">
            <label>Initial Capital ($)</label>
            <input
              type="number"
              value={initialCash}
              min={1000}
              step={10000}
              onChange={(e) => setInitialCash(Number(e.target.value))}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Commission Rate (0.001 = 0.1%)</label>
            <input
              type="number"
              value={commissionRate}
              min={0}
              max={0.05}
              step={0.0005}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Slippage Rate (0.0005 = 0.05%)</label>
            <input
              type="number"
              value={slippageRate}
              min={0}
              max={0.05}
              step={0.0001}
              onChange={(e) => setSlippageRate(Number(e.target.value))}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Risk-Free Rate (Annual)</label>
            <input
              type="number"
              value={riskFreeRate}
              min={0}
              max={0.2}
              step={0.01}
              onChange={(e) => setRiskFreeRate(Number(e.target.value))}
              className="form-control"
            />
          </div>
        </div>

        {/* 3. Custom Weights Configuration (if custom selected) */}
        {weighting === 'custom' && (
          <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Specify Target Weights (%):</span>
              <button
                type="button"
                onClick={handleNormalizeWeights}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.75rem' }}
              >
                ⚖️ Auto-Normalize to 100%
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              {selectedDatasets.map((d) => {
                const sym = cleanSymbol(d);
                const currentVal = customWeights[sym] ?? Math.round(100 / selectedDatasets.length);
                return (
                  <div key={d} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '80px', fontSize: '0.82rem', fontWeight: 500 }}>{sym}:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={currentVal}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setCustomWeights((prev) => ({ ...prev, [sym]: val }));
                      }}
                      className="form-control"
                      style={{ width: '70px', padding: '0.3rem 0.5rem' }}
                    />
                    <span style={{ fontSize: '0.82rem' }}>%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Execution Action Button */}
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleRunBasket}
            disabled={isLoading || selectedDatasets.length === 0}
            style={{ minWidth: '200px' }}
          >
            {isLoading ? 'Simulating Basket Portfolio...' : '🚀 Run Basket Backtest'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            {error}
          </div>
        )}
      </div>

      {/* Simulation Results */}
      {result && (
        <div className="tear-sheet-results">
          {/* Portfolio Metric Cards */}
          <div className="metric-cards-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="card metric-card">
              <span className="metric-label">Total Return</span>
              <span className={`metric-value ${result.summary.total_return >= 0 ? 'text-success' : 'text-danger'}`}>
                {(result.summary.total_return * 100).toFixed(2)}%
              </span>
              <span className="metric-sub">
                PnL: ${result.total_pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="card metric-card">
              <span className="metric-label">CAGR (Annualized)</span>
              <span className="metric-value">
                {result.summary.cagr !== null ? `${(result.summary.cagr * 100).toFixed(2)}%` : 'N/A'}
              </span>
              <span className="metric-sub">
                Vol: {result.tail_risk.annualized_volatility !== null ? `${(result.tail_risk.annualized_volatility * 100).toFixed(2)}%` : 'N/A'}
              </span>
            </div>

            <div className="card metric-card">
              <span className="metric-label">Max Drawdown</span>
              <span className="metric-value text-danger">
                {(result.summary.max_drawdown * 100).toFixed(2)}%
              </span>
              <span className="metric-sub">
                Calmar: {result.summary.calmar_ratio != null ? result.summary.calmar_ratio.toFixed(2) : 'N/A'}
              </span>
            </div>

            <div className="card metric-card">
              <span className="metric-label">Sharpe Ratio</span>
              <span className="metric-value">
                {result.summary.sharpe_ratio !== null ? result.summary.sharpe_ratio.toFixed(2) : 'N/A'}
              </span>
              <span className="metric-sub">
                Sortino: {result.summary.sortino_ratio !== null ? result.summary.sortino_ratio.toFixed(2) : 'N/A'}
              </span>
            </div>

            <div className="card metric-card">
              <span className="metric-label">Final Equity</span>
              <span className="metric-value">
                ${result.final_equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="metric-sub">
                Cash: ${result.final_cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="card metric-card">
              <span className="metric-label">Rebalance Trades</span>
              <span className="metric-value">{result.trades.length}</span>
              <span className="metric-sub">Schedule: {result.rebalance_freq}</span>
            </div>
          </div>

          {/* Allocation Breakdown Card */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Target Asset Allocations & Final Holdings
            </h3>

            {/* Visual allocation bar */}
            <div style={{ display: 'flex', height: '24px', borderRadius: '6px', overflow: 'hidden', marginBottom: '1rem' }}>
              {result.symbols.map((sym, idx) => {
                const w = (result.asset_weights[sym] || 0) * 100;
                if (w <= 0) return null;
                const color = ASSET_COLORS[idx % ASSET_COLORS.length];
                return (
                  <div
                    key={sym}
                    style={{
                      width: `${w}%`,
                      backgroundColor: color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                    title={`${sym}: ${w.toFixed(1)}%`}
                  >
                    {w >= 10 ? `${sym} ${w.toFixed(0)}%` : ''}
                  </div>
                );
              })}
            </div>

            {/* Table of holdings */}
            <div style={{ overflowX: 'auto' }}>
              <table className="comparison-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Target Weight</th>
                    <th>Final Quantity</th>
                    <th>Weighting Scheme</th>
                  </tr>
                </thead>
                <tbody>
                  {result.symbols.map((sym, idx) => {
                    const color = ASSET_COLORS[idx % ASSET_COLORS.length];
                    const weightPct = ((result.asset_weights[sym] || 0) * 100).toFixed(1);
                    const qty = result.holdings[sym] || 0;
                    return (
                      <tr key={sym}>
                        <td>
                          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, marginRight: '8px' }} />
                          <strong>{sym}</strong>
                        </td>
                        <td>{weightPct}%</td>
                        <td>{qty.toLocaleString(undefined, { maximumFractionDigits: 2 })} shares</td>
                        <td>{result.weighting}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tail-Risk & Value-at-Risk Card */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Portfolio Tail-Risk & Value-at-Risk (VaR) Diagnostics
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>95% Historical VaR</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {result.tail_risk.var_95_historical !== null ? `${(result.tail_risk.var_95_historical * 100).toFixed(2)}%` : 'N/A'}
                </strong>
                <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Parametric: {result.tail_risk.var_95_parametric !== null ? `${(result.tail_risk.var_95_parametric * 100).toFixed(2)}%` : 'N/A'}
                </span>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>99% Historical VaR</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {result.tail_risk.var_99_historical !== null ? `${(result.tail_risk.var_99_historical * 100).toFixed(2)}%` : 'N/A'}
                </strong>
                <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Parametric: {result.tail_risk.var_99_parametric !== null ? `${(result.tail_risk.var_99_parametric * 100).toFixed(2)}%` : 'N/A'}
                </span>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>95% Expected Shortfall (CVaR)</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--accent-danger, #ef4444)' }}>
                  {result.tail_risk.cvar_95 !== null ? `${(result.tail_risk.cvar_95 * 100).toFixed(2)}%` : 'N/A'}
                </strong>
                <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  99% CVaR: {result.tail_risk.cvar_99 !== null ? `${(result.tail_risk.cvar_99 * 100).toFixed(2)}%` : 'N/A'}
                </span>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '0.85rem', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>Tail Ratio (95th / 5th)</span>
                <strong style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                  {result.tail_risk.tail_ratio !== null ? result.tail_risk.tail_ratio.toFixed(2) : 'N/A'}
                </strong>
                <span style={{ fontSize: '0.72rem', display: 'block', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Skew: {result.tail_risk.skewness !== null ? result.tail_risk.skewness.toFixed(2) : 'N/A'} | Kurt: {result.tail_risk.kurtosis !== null ? result.tail_risk.kurtosis.toFixed(2) : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Interactive Equity Curve Chart */}
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                Portfolio Equity Growth & Mark-to-Market Performance
              </h3>
              {activePoint && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span style={{ marginRight: '1rem' }}>
                    📅 {new Date(activePoint.timestamp).toLocaleDateString()}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--accent-primary, #3b82f6)' }}>
                    Equity: ${activePoint.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <svg
                width={CHART_WIDTH}
                height={CHART_HEIGHT}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
                style={{ cursor: 'crosshair', userSelect: 'none' }}
              >
                <defs>
                  <linearGradient id="basketEquityGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line
                  x1={CHART_PADDING.left}
                  y1={baselineY}
                  x2={CHART_WIDTH - CHART_PADDING.right}
                  y2={baselineY}
                  stroke="var(--border-color, #334155)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />

                {/* Area and Line */}
                <path d={areaD} fill="url(#basketEquityGradient)" />
                <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" />

                {/* Y Axis Labels */}
                <text
                  x={CHART_PADDING.left - 10}
                  y={CHART_PADDING.top + 5}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-secondary, #94a3b8)"
                >
                  ${maxEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </text>
                <text
                  x={CHART_PADDING.left - 10}
                  y={baselineY + 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-secondary, #94a3b8)"
                >
                  ${result.initial_cash.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </text>
                <text
                  x={CHART_PADDING.left - 10}
                  y={CHART_PADDING.top + PLOT_HEIGHT}
                  textAnchor="end"
                  fontSize="10"
                  fill="var(--text-secondary, #94a3b8)"
                >
                  ${minEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </text>

                {/* Hover indicator */}
                {activePoint && (
                  <>
                    <line
                      x1={activePoint.x}
                      y1={CHART_PADDING.top}
                      x2={activePoint.x}
                      y2={CHART_PADDING.top + PLOT_HEIGHT}
                      stroke="var(--accent-primary, #3b82f6)"
                      strokeWidth="1.5"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={activePoint.x}
                      cy={activePoint.y}
                      r="5"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                  </>
                )}
              </svg>
            </div>
          </div>

          {/* Rebalance & Allocation Trades Table */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Executed Allocation & Rebalancing Trades ({result.trades.length})
            </h3>
            {result.trades.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No trades recorded.</p>
            ) : (
              <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="comparison-table" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Asset</th>
                      <th>Action</th>
                      <th>Price</th>
                      <th>Quantity</th>
                      <th>Commission</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.trades.map((t, idx) => (
                      <tr key={`${t.timestamp}-${t.symbol}-${idx}`}>
                        <td style={{ fontSize: '0.82rem' }}>
                          {new Date(t.timestamp).toLocaleDateString()}
                        </td>
                        <td>
                          <strong>{t.symbol}</strong>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              backgroundColor: t.side.toLowerCase() === 'buy' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: t.side.toLowerCase() === 'buy' ? '#10b981' : '#ef4444',
                            }}
                          >
                            {t.side.toUpperCase()}
                          </span>
                        </td>
                        <td>${t.price.toFixed(2)}</td>
                        <td>{t.quantity.toFixed(2)}</td>
                        <td>${t.commission.toFixed(2)}</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          {t.reason === 'initial_allocation'
                            ? 'Initial Allocation'
                            : t.reason === 'rebalance'
                              ? 'Periodic Rebalance'
                              : t.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
