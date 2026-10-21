import { type MouseEvent, useMemo, useState } from 'react';
import { executeBasketBacktest, fetchBatchDatasetsFromAPI, fetchEfficientFrontier } from '../api/client';
import type {
  AllocationWeighting,
  BasketBacktestRequest,
  BasketBacktestResponse,
  DatasetInfo,
  EfficientFrontierResponse,
  PortfolioPointDTO,
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

const F_WIDTH = 750;
const F_HEIGHT = 340;
const F_PADDING = { top: 30, right: 35, bottom: 45, left: 75 };
const F_PLOT_W = F_WIDTH - F_PADDING.left - F_PADDING.right;
const F_PLOT_H = F_HEIGHT - F_PADDING.top - F_PADDING.bottom;

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

  // Modern Portfolio Theory & Efficient Frontier State
  const [frontierData, setFrontierData] = useState<EfficientFrontierResponse | null>(null);
  const [isFrontierLoading, setIsFrontierLoading] = useState<boolean>(false);
  const [frontierError, setFrontierError] = useState<string | null>(null);
  const [selectedFrontierPoint, setSelectedFrontierPoint] = useState<PortfolioPointDTO | null>(null);
  const [hoveredFrontierPoint, setHoveredFrontierPoint] = useState<PortfolioPointDTO | null>(null);
  const [frontierPointsCount, setFrontierPointsCount] = useState<number>(25);
  const [frontierSimCount, setFrontierSimCount] = useState<number>(500);
  const [applyNotification, setApplyNotification] = useState<string | null>(null);

  const handleComputeFrontier = async () => {
    if (selectedDatasets.length < 2) {
      setFrontierError('Please select at least 2 assets to construct the Markowitz Efficient Frontier.');
      return;
    }
    setIsFrontierLoading(true);
    setFrontierError(null);
    try {
      const res = await fetchEfficientFrontier({
        datasets: selectedDatasets,
        num_points: frontierPointsCount,
        num_simulations: frontierSimCount,
        risk_free_rate: riskFreeRate,
      });
      setFrontierData(res);
      setSelectedFrontierPoint(res.max_sharpe);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to compute Efficient Frontier.';
      setFrontierError(msg);
    } finally {
      setIsFrontierLoading(false);
    }
  };

  const handleApplyPortfolioWeights = (p: PortfolioPointDTO, name: string) => {
    const formatted: Record<string, number> = {};
    selectedDatasets.forEach((d) => {
      const sym = cleanSymbol(d);
      const raw = p.weights[sym] ?? 0;
      formatted[sym] = Math.round(raw * 100);
    });
    setWeighting('custom');
    setCustomWeights(formatted);
    setApplyNotification(`✓ Applied ${name} allocation (${Object.entries(formatted).map(([s, w]) => `${s}: ${w}%`).join(', ')}) to Custom Target Weights.`);
    setTimeout(() => setApplyNotification(null), 5000);
  };

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

  // Efficient Frontier Chart Geometry

  const frontierChartData = useMemo(() => {
    if (!frontierData) return null;
    const allPoints: PortfolioPointDTO[] = [
      ...frontierData.simulated_portfolios,
      ...frontierData.frontier_curve,
      frontierData.max_sharpe,
      frontierData.min_variance,
      frontierData.equal_weight,
      frontierData.inverse_volatility,
    ];

    const vols = allPoints.map((p) => p.volatility);
    const rets = allPoints.map((p) => p.expected_return);

    let minV = Math.min(...vols);
    let maxV = Math.max(...vols);
    let minR = Math.min(...rets);
    let maxR = Math.max(...rets);

    const spanV = maxV - minV || 0.05;
    const spanR = maxR - minR || 0.05;

    minV = Math.max(0, minV - spanV * 0.08);
    maxV = maxV + spanV * 0.08;
    minR = minR - spanR * 0.08;
    maxR = maxR + spanR * 0.08;

    const scaleX = (vol: number) =>
      F_PADDING.left + ((vol - minV) / (maxV - minV)) * F_PLOT_W;
    const scaleY = (ret: number) =>
      F_PADDING.top + F_PLOT_H - ((ret - minR) / (maxR - minR)) * F_PLOT_H;

    // Frontier curve polyline path
    const sortedCurve = [...frontierData.frontier_curve].sort((a, b) => a.volatility - b.volatility);
    const curvePath = sortedCurve.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${scaleX(p.volatility).toFixed(1)} ${scaleY(p.expected_return).toFixed(1)}`,
      '',
    );

    return {
      minV,
      maxV,
      minR,
      maxR,
      scaleX,
      scaleY,
      curvePath,
      sortedCurve,
    };
  }, [frontierData]);

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
                  className="form-control form-control-sm"
                  style={{ width: 'auto' }}
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
              <option value="max_sharpe">Max Sharpe Ratio (Tangency Portfolio)</option>
              <option value="min_variance">Minimum Variance (Min Volatility)</option>
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

      {/* Modern Portfolio Theory: Markowitz Efficient Frontier */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📈</span> Markowitz Efficient Frontier & MPT Optimizer
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Computes mean-variance optimal allocations via constrained convex quadratic optimization (exact simplex projection).
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Curve Points:</label>
              <input
                type="number"
                min={10}
                max={50}
                value={frontierPointsCount}
                onChange={(e) => setFrontierPointsCount(Number(e.target.value))}
                className="form-control form-control-sm"
                style={{ width: '60px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Simulations:</label>
              <input
                type="number"
                min={100}
                max={2000}
                step={100}
                value={frontierSimCount}
                onChange={(e) => setFrontierSimCount(Number(e.target.value))}
                className="form-control form-control-sm"
                style={{ width: '70px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }}
              />
            </div>
            <button
              type="button"
              onClick={handleComputeFrontier}
              disabled={isFrontierLoading || selectedDatasets.length < 2}
              className="btn btn-secondary btn-sm"
              style={{ padding: '0.35rem 0.8rem', whiteSpace: 'nowrap' }}
            >
              {isFrontierLoading ? (
                <span>Optimizing...</span>
              ) : (
                <span>⚡ Compute Efficient Frontier</span>
              )}
            </button>
          </div>
        </div>

        {frontierError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            {frontierError}
          </div>
        )}

        {applyNotification && (
          <div className="alert alert-success" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
            {applyNotification}
          </div>
        )}

        {frontierData && frontierChartData && (
          <div>
            {/* 4 MPT Benchmark Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#f59e0b' }}>🌟 Max Sharpe (Tangency)</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPortfolioWeights(frontierData.max_sharpe, 'Max Sharpe')}
                    className="btn btn-sm"
                    style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#f59e0b', color: '#000', border: 'none' }}
                  >
                    Apply
                  </button>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>
                  Sharpe: {frontierData.max_sharpe.sharpe_ratio.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Ret: {(frontierData.max_sharpe.expected_return * 100).toFixed(1)}% | Vol: {(frontierData.max_sharpe.volatility * 100).toFixed(1)}%
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#10b981' }}>🛡️ Minimum Variance</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPortfolioWeights(frontierData.min_variance, 'Min Variance')}
                    className="btn btn-sm"
                    style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#10b981', color: '#fff', border: 'none' }}
                  >
                    Apply
                  </button>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>
                  Sharpe: {frontierData.min_variance.sharpe_ratio.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Ret: {(frontierData.min_variance.expected_return * 100).toFixed(1)}% | Vol: {(frontierData.min_variance.volatility * 100).toFixed(1)}%
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#3b82f6' }}>⚖️ Equal Weight (1/N)</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPortfolioWeights(frontierData.equal_weight, 'Equal Weight')}
                    className="btn btn-sm"
                    style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#3b82f6', color: '#fff', border: 'none' }}
                  >
                    Apply
                  </button>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>
                  Sharpe: {frontierData.equal_weight.sharpe_ratio.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Ret: {(frontierData.equal_weight.expected_return * 100).toFixed(1)}% | Vol: {(frontierData.equal_weight.volatility * 100).toFixed(1)}%
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(168, 85, 247, 0.08)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: '6px',
                  padding: '0.75rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#a855f7' }}>📊 Inverse Volatility</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPortfolioWeights(frontierData.inverse_volatility, 'Inverse Volatility')}
                    className="btn btn-sm"
                    style={{ fontSize: '0.7rem', padding: '1px 6px', background: '#a855f7', color: '#fff', border: 'none' }}
                  >
                    Apply
                  </button>
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 700, margin: '4px 0', color: 'var(--text-primary)' }}>
                  Sharpe: {frontierData.inverse_volatility.sharpe_ratio.toFixed(2)}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Ret: {(frontierData.inverse_volatility.expected_return * 100).toFixed(1)}% | Vol: {(frontierData.inverse_volatility.volatility * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Interactive SVG Scatter Plot */}
            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <svg
                width={F_WIDTH}
                height={F_HEIGHT}
                style={{ background: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)', userSelect: 'none' }}
              >
                <defs>
                  <linearGradient id="frontierCurveGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#3b82f6" />
                  </linearGradient>
                </defs>

                {/* Gridlines */}
                {[0.2, 0.4, 0.6, 0.8].map((ratio) => {
                  const y = F_PADDING.top + F_PLOT_H * ratio;
                  const retVal = frontierChartData.maxR - ratio * (frontierChartData.maxR - frontierChartData.minR);
                  return (
                    <g key={`ygrid-${ratio}`}>
                      <line
                        x1={F_PADDING.left}
                        y1={y}
                        x2={F_WIDTH - F_PADDING.right}
                        y2={y}
                        stroke="var(--border-color, #334155)"
                        strokeDasharray="3 3"
                        strokeWidth="0.8"
                      />
                      <text
                        x={F_PADDING.left - 8}
                        y={y + 3}
                        textAnchor="end"
                        fontSize="10"
                        fill="var(--text-secondary, #94a3b8)"
                      >
                        {(retVal * 100).toFixed(1)}%
                      </text>
                    </g>
                  );
                })}

                {[0.25, 0.5, 0.75].map((ratio) => {
                  const x = F_PADDING.left + F_PLOT_W * ratio;
                  const volVal = frontierChartData.minV + ratio * (frontierChartData.maxV - frontierChartData.minV);
                  return (
                    <g key={`xgrid-${ratio}`}>
                      <line
                        x1={x}
                        y1={F_PADDING.top}
                        x2={x}
                        y2={F_PADDING.top + F_PLOT_H}
                        stroke="var(--border-color, #334155)"
                        strokeDasharray="3 3"
                        strokeWidth="0.8"
                      />
                      <text
                        x={x}
                        y={F_PADDING.top + F_PLOT_H + 16}
                        textAnchor="middle"
                        fontSize="10"
                        fill="var(--text-secondary, #94a3b8)"
                      >
                        {(volVal * 100).toFixed(1)}%
                      </text>
                    </g>
                  );
                })}

                {/* Axes Labels */}
                <text
                  x={F_PADDING.left + F_PLOT_W / 2}
                  y={F_HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--text-secondary, #94a3b8)"
                >
                  Annualized Volatility (Risk, σ)
                </text>
                <text
                  x={-F_PADDING.top - F_PLOT_H / 2}
                  y={18}
                  transform="rotate(-90)"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--text-secondary, #94a3b8)"
                >
                  Expected Annual Return (μ)
                </text>

                {/* 1. Monte Carlo Random Cloud */}
                {frontierData.simulated_portfolios.map((p, idx) => {
                  const cx = frontierChartData.scaleX(p.volatility);
                  const cy = frontierChartData.scaleY(p.expected_return);
                  return (
                    <circle
                      key={`sim-${idx}`}
                      cx={cx}
                      cy={cy}
                      r="2.5"
                      fill="#64748b"
                      opacity="0.3"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredFrontierPoint(p)}
                      onMouseLeave={() => setHoveredFrontierPoint(null)}
                      onClick={() => setSelectedFrontierPoint(p)}
                    />
                  );
                })}

                {/* 2. Markowitz Efficient Frontier Line */}
                <path
                  d={frontierChartData.curvePath}
                  fill="none"
                  stroke="url(#frontierCurveGrad)"
                  strokeWidth="2.8"
                />

                {/* 3. Frontier optimal points */}
                {frontierChartData.sortedCurve.map((p, idx) => {
                  const cx = frontierChartData.scaleX(p.volatility);
                  const cy = frontierChartData.scaleY(p.expected_return);
                  return (
                    <circle
                      key={`f-pt-${idx}`}
                      cx={cx}
                      cy={cy}
                      r="3.5"
                      fill="#06b6d4"
                      stroke="#ffffff"
                      strokeWidth="1"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredFrontierPoint(p)}
                      onMouseLeave={() => setHoveredFrontierPoint(null)}
                      onClick={() => setSelectedFrontierPoint(p)}
                    />
                  );
                })}

                {/* 4. Special Key Portfolios */}
                {/* Equal Weight */}
                {(() => {
                  const p = frontierData.equal_weight;
                  const cx = frontierChartData.scaleX(p.volatility);
                  const cy = frontierChartData.scaleY(p.expected_return);
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="6"
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredFrontierPoint(p)}
                      onMouseLeave={() => setHoveredFrontierPoint(null)}
                      onClick={() => setSelectedFrontierPoint(p)}
                    />
                  );
                })()}

                {/* Inverse Volatility */}
                {(() => {
                  const p = frontierData.inverse_volatility;
                  const cx = frontierChartData.scaleX(p.volatility);
                  const cy = frontierChartData.scaleY(p.expected_return);
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="6"
                      fill="#a855f7"
                      stroke="#ffffff"
                      strokeWidth="2"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredFrontierPoint(p)}
                      onMouseLeave={() => setHoveredFrontierPoint(null)}
                      onClick={() => setSelectedFrontierPoint(p)}
                    />
                  );
                })()}

                {/* Min Variance */}
                {(() => {
                  const p = frontierData.min_variance;
                  const cx = frontierChartData.scaleX(p.volatility);
                  const cy = frontierChartData.scaleY(p.expected_return);
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="7.5"
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredFrontierPoint(p)}
                      onMouseLeave={() => setHoveredFrontierPoint(null)}
                      onClick={() => setSelectedFrontierPoint(p)}
                    />
                  );
                })()}

                {/* Max Sharpe (Tangency) */}
                {(() => {
                  const p = frontierData.max_sharpe;
                  const cx = frontierChartData.scaleX(p.volatility);
                  const cy = frontierChartData.scaleY(p.expected_return);
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="8"
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="2.5"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredFrontierPoint(p)}
                      onMouseLeave={() => setHoveredFrontierPoint(null)}
                      onClick={() => setSelectedFrontierPoint(p)}
                    />
                  );
                })()}

                {/* Active/Hovered Ring */}
                {(hoveredFrontierPoint || selectedFrontierPoint) && (() => {
                  const active = hoveredFrontierPoint || selectedFrontierPoint!;
                  const cx = frontierChartData.scaleX(active.volatility);
                  const cy = frontierChartData.scaleY(active.expected_return);
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r="12"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  );
                })()}
              </svg>
            </div>

            {/* Selected / Hovered Portfolio Inspector Drawer */}
            {(() => {
              const active = hoveredFrontierPoint || selectedFrontierPoint;
              if (!active) return null;
              const isMaxSharpe = active === frontierData.max_sharpe;
              const isMinVar = active === frontierData.min_variance;
              const isEq = active === frontierData.equal_weight;
              const isInvVol = active === frontierData.inverse_volatility;
              const tag = isMaxSharpe
                ? '🌟 Tangency (Max Sharpe)'
                : isMinVar
                  ? '🛡️ Minimum Variance'
                  : isEq
                    ? '⚖️ Equal Weight'
                    : isInvVol
                      ? '📊 Inverse Volatility'
                      : 'Efficient Frontier Allocation';

              return (
                <div
                  style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    padding: '0.85rem 1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{tag}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Ret: <strong>{(active.expected_return * 100).toFixed(2)}%</strong> | Vol: <strong>{(active.volatility * 100).toFixed(2)}%</strong> | Sharpe: <strong>{active.sharpe_ratio.toFixed(2)}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleApplyPortfolioWeights(active, tag)}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.76rem', padding: '0.25rem 0.75rem' }}
                    >
                      🚀 Apply this Allocation to Basket
                    </button>
                  </div>

                  {/* Weights Breakdown Bar & Pills */}
                  <div style={{ display: 'flex', height: '14px', borderRadius: '4px', overflow: 'hidden' }}>
                    {frontierData.symbols.map((sym, idx) => {
                      const w = (active.weights[sym] || 0) * 100;
                      if (w <= 0.01) return null;
                      const col = ASSET_COLORS[idx % ASSET_COLORS.length];
                      return (
                        <div
                          key={`bar-${sym}`}
                          style={{
                            width: `${w}%`,
                            backgroundColor: col,
                          }}
                          title={`${sym}: ${w.toFixed(1)}%`}
                        />
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {frontierData.symbols.map((sym, idx) => {
                      const w = (active.weights[sym] || 0) * 100;
                      const col = ASSET_COLORS[idx % ASSET_COLORS.length];
                      return (
                        <span
                          key={`pill-${sym}`}
                          style={{
                            fontSize: '0.75rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'var(--bg-primary)',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-color)',
                          }}
                        >
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col }} />
                          <span>{sym}:</span>
                          <strong>{w.toFixed(1)}%</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
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
