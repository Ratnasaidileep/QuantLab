import { type MouseEvent, useMemo, useState } from 'react';
import { runMonteCarloSimulation } from '../api/client';
import type {
  MonteCarloMode,
  MonteCarloRequest,
  MonteCarloResponse,
  PositionSizingMode,
  StrategyType,
} from '../types';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import {
  Dice5,
  AlertTriangle,
  TrendingDown,
  ShieldAlert,
  Percent,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface MonteCarloPanelProps {
  dataset: string;
  initialCash: number;
  commissionRate: number;
  slippageRate: number;
  sizingMode: PositionSizingMode;
  quantityPerTrade: number;
}

const CONE_WIDTH = 750;
const CONE_HEIGHT = 260;
const PADDING = { top: 20, right: 30, bottom: 35, left: 75 };
const PLOT_W = CONE_WIDTH - PADDING.left - PADDING.right;
const PLOT_H = CONE_HEIGHT - PADDING.top - PADDING.bottom;

export function MonteCarloPanel({
  dataset,
  initialCash,
  commissionRate,
  slippageRate,
  sizingMode,
  quantityPerTrade,
}: MonteCarloPanelProps) {
  // Strategy Parameters
  const [strategy, setStrategy] = useState<StrategyType>('moving_average');
  const [fastPeriod, setFastPeriod] = useState<number>(10);
  const [slowPeriod, setSlowPeriod] = useState<number>(30);
  const [rsiPeriod, setRsiPeriod] = useState<number>(14);
  const [rsiOversold, setRsiOversold] = useState<number>(30);
  const [rsiOverbought, setRsiOverbought] = useState<number>(70);
  const [bbPeriod, setBbPeriod] = useState<number>(20);
  const [bbStdDev, setBbStdDev] = useState<number>(2.0);
  const [macdFast, setMacdFast] = useState<number>(12);
  const [macdSlow, setMacdSlow] = useState<number>(26);
  const [macdSignal, setMacdSignal] = useState<number>(9);

  // Monte Carlo Configuration
  const [numSimulations, setNumSimulations] = useState<number>(1000);
  const [ruinThreshold, setRuinThreshold] = useState<number>(0.25);
  const [mode, setMode] = useState<MonteCarloMode>('trade_shuffle');
  const [seed, setSeed] = useState<string>('42');

  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MonteCarloResponse | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const handleRun = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const parsedSeed = seed.trim() ? parseInt(seed.trim(), 10) : undefined;
      const req: MonteCarloRequest = {
        dataset,
        strategy,
        fast_period: fastPeriod,
        slow_period: slowPeriod,
        rsi_period: rsiPeriod,
        oversold: rsiOversold,
        overbought: rsiOverbought,
        bb_period: bbPeriod,
        bb_std_dev: bbStdDev,
        macd_fast: macdFast,
        macd_slow: macdSlow,
        macd_signal: macdSignal,
        initial_cash: initialCash,
        commission_rate: commissionRate,
        slippage_rate: slippageRate,
        sizing_mode: sizingMode,
        quantity_per_trade: quantityPerTrade,
        num_simulations: numSimulations,
        ruin_drawdown_pct: ruinThreshold,
        mode,
        seed: Number.isNaN(parsedSeed) ? undefined : parsedSeed,
      };

      const res = await runMonteCarloSimulation(req);
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Monte Carlo simulation failed.';
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

  const formatPct = (val: number | null | undefined) =>
    val != null ? `${(val * 100).toFixed(1)}%` : '—';

  // SVG Scaling for Percentile Confidence Cone
  const coneGeometry = useMemo(() => {
    if (!result || !result.confidence_cone || result.confidence_cone.length === 0) {
      return null;
    }

    const data = result.confidence_cone;
    const allVals = data.flatMap((d) => [d.p5, d.p25, d.p50, d.p75, d.p95, initialCash]);
    const minVal = Math.max(0, Math.min(...allVals) * 0.95);
    const maxVal = Math.max(...allVals) * 1.05;
    const valRange = maxVal - minVal || 1;

    const scaleX = (i: number) =>
      PADDING.left + (i / (data.length - 1 || 1)) * PLOT_W;
    const scaleY = (val: number) =>
      PADDING.top + (1 - (val - minVal) / valRange) * PLOT_H;

    // Build P5 to P95 outer area polygon
    let outerArea = `M ${scaleX(0)} ${scaleY(data[0].p95)}`;
    for (let i = 1; i < data.length; i++) {
      outerArea += ` L ${scaleX(i)} ${scaleY(data[i].p95)}`;
    }
    for (let i = data.length - 1; i >= 0; i--) {
      outerArea += ` L ${scaleX(i)} ${scaleY(data[i].p5)}`;
    }
    outerArea += ' Z';

    // Build P25 to P75 inner area polygon
    let innerArea = `M ${scaleX(0)} ${scaleY(data[0].p75)}`;
    for (let i = 1; i < data.length; i++) {
      innerArea += ` L ${scaleX(i)} ${scaleY(data[i].p75)}`;
    }
    for (let i = data.length - 1; i >= 0; i--) {
      innerArea += ` L ${scaleX(i)} ${scaleY(data[i].p25)}`;
    }
    innerArea += ' Z';

    // Build Median line (P50)
    let medianLine = `M ${scaleX(0)} ${scaleY(data[0].p50)}`;
    for (let i = 1; i < data.length; i++) {
      medianLine += ` L ${scaleX(i)} ${scaleY(data[i].p50)}`;
    }

    // Baseline Initial Cash Y coordinate
    const baselineY = scaleY(initialCash);

    return { minVal, maxVal, scaleX, scaleY, outerArea, innerArea, medianLine, baselineY };
  }, [result, initialCash]);

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!result || !result.confidence_cone || result.confidence_cone.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - PADDING.left;
    const ratio = Math.max(0, Math.min(1, x / PLOT_W));
    const idx = Math.round(ratio * (result.confidence_cone.length - 1));
    setHoverIndex(idx);
  };

  const hoveredPoint =
    result && result.confidence_cone && hoverIndex !== null
      ? result.confidence_cone[hoverIndex]
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Parameter & Execution Controls */}
      <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          {/* Strategy Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Trading Strategy
            </label>
            <select
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as StrategyType)}
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
            >
              <option value="moving_average">SMA Crossover</option>
              <option value="rsi">RSI Mean-Reversion</option>
              <option value="bollinger">Bollinger Bands</option>
              <option value="macd">MACD Trend</option>
              <option value="confluence">Confluence (Trend + Momentum)</option>
            </select>
          </div>

          {/* Strategy-Specific Inputs */}
          {strategy === 'moving_average' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Fast</label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  value={fastPeriod}
                  onChange={(e) => setFastPeriod(Number(e.target.value))}
                  style={{ width: '60px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Slow</label>
                <input
                  type="number"
                  min={3}
                  max={300}
                  value={slowPeriod}
                  onChange={(e) => setSlowPeriod(Number(e.target.value))}
                  style={{ width: '60px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </>
          )}

          {strategy === 'rsi' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Period</label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={rsiPeriod}
                  onChange={(e) => setRsiPeriod(Number(e.target.value))}
                  style={{ width: '60px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Oversold</label>
                <input
                  type="number"
                  min={5}
                  max={45}
                  value={rsiOversold}
                  onChange={(e) => setRsiOversold(Number(e.target.value))}
                  style={{ width: '60px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Overbought</label>
                <input
                  type="number"
                  min={55}
                  max={95}
                  value={rsiOverbought}
                  onChange={(e) => setRsiOverbought(Number(e.target.value))}
                  style={{ width: '60px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </>
          )}

          {strategy === 'bollinger' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Period</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={bbPeriod}
                  onChange={(e) => setBbPeriod(Number(e.target.value))}
                  style={{ width: '60px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>StdDev</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={4.0}
                  value={bbStdDev}
                  onChange={(e) => setBbStdDev(Number(e.target.value))}
                  style={{ width: '60px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </>
          )}

          {strategy === 'macd' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Fast</label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={macdFast}
                  onChange={(e) => setMacdFast(Number(e.target.value))}
                  style={{ width: '55px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Slow</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={macdSlow}
                  onChange={(e) => setMacdSlow(Number(e.target.value))}
                  style={{ width: '55px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Signal</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={macdSignal}
                  onChange={(e) => setMacdSignal(Number(e.target.value))}
                  style={{ width: '55px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
                />
              </div>
            </>
          )}

          {/* Monte Carlo Specific Settings */}
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Simulations (K)
            </label>
            <select
              value={numSimulations}
              onChange={(e) => setNumSimulations(Number(e.target.value))}
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
            >
              <option value={200}>200 runs (Fast)</option>
              <option value={500}>500 runs</option>
              <option value={1000}>1,000 runs (Standard)</option>
              <option value={2000}>2,000 runs (High-Res)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Ruin DD Threshold
            </label>
            <select
              value={ruinThreshold}
              onChange={(e) => setRuinThreshold(Number(e.target.value))}
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
            >
              <option value={0.15}>15% Drawdown</option>
              <option value={0.20}>20% Drawdown</option>
              <option value={0.25}>25% Drawdown (Default)</option>
              <option value={0.30}>30% Drawdown</option>
              <option value={0.50}>50% Drawdown (Severe)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Resampling Engine
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as MonteCarloMode)}
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
            >
              <option value="trade_shuffle">Trade Shuffling (Permutation)</option>
              <option value="bootstrap">Bootstrap Resampling</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              Seed
            </label>
            <input
              type="text"
              placeholder="e.g. 42"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
              style={{ width: '65px', padding: '0.35rem', borderRadius: '6px', fontSize: '0.8rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}
            />
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleRun}
            isLoading={isLoading}
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}
          >
            <Dice5 size={16} />
            <span>Simulate Futures</span>
          </Button>
        </div>
      </Card>

      {/* Error Notice */}
      {error && (
        <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: 'var(--loss-bg)', border: '1px solid var(--loss-border)', color: 'var(--loss-red)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Results Workspace */}
      {result && (
        <>
          {/* Top Scorecard Badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            {/* Probability of Ruin */}
            <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)', border: `1px solid ${result.summary.probability_of_ruin > 0.20 ? 'var(--loss-border)' : result.summary.probability_of_ruin > 0.05 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Probability of Ruin</span>
                <ShieldAlert size={16} style={{ color: result.summary.probability_of_ruin > 0.20 ? 'var(--loss-red)' : result.summary.probability_of_ruin > 0.05 ? 'var(--warning-yellow)' : 'var(--profit-green)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.3rem', color: result.summary.probability_of_ruin > 0.20 ? 'var(--loss-red)' : result.summary.probability_of_ruin > 0.05 ? 'var(--warning-yellow)' : 'var(--profit-green)' }}>
                {formatPct(result.summary.probability_of_ruin)}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                Risk of experiencing &ge; {(result.summary.ruin_threshold * 100).toFixed(0)}% Max Drawdown
              </span>
            </Card>

            {/* Worst-Case Drawdown (P95) */}
            <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>95% Confidence Max DD</span>
                <TrendingDown size={16} style={{ color: 'var(--loss-red)' }} />
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: '0.3rem', color: 'var(--loss-red)' }}>
                {formatPct(result.summary.p95_max_drawdown)}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                Median DD: {formatPct(result.summary.median_max_drawdown)} &bull; Best 5%: {formatPct(result.summary.p5_max_drawdown)}
              </span>
            </Card>

            {/* Terminal Wealth (Median vs P5) */}
            <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Median Terminal Wealth</span>
                <Percent size={16} style={{ color: 'var(--accent-primary)' }} />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.3rem', color: 'var(--text-primary)' }}>
                {formatCurrency(result.summary.median_terminal_equity)}
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                Worst 5%: {formatCurrency(result.summary.p5_terminal_equity)} &bull; Top 5%: {formatCurrency(result.summary.p95_terminal_equity)}
              </span>
            </Card>

            {/* Sample Scope */}
            <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Simulation Scope</span>
                <CheckCircle2 size={16} style={{ color: 'var(--profit-green)' }} />
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.3rem', color: 'var(--text-primary)' }}>
                {result.summary.simulations_count.toLocaleString()} paths
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.2rem' }}>
                Resampled over {result.summary.trades_resampled} closed historical trades
              </span>
            </Card>
          </div>

          {/* Visualization 1: Percentile Confidence Cone */}
          <Card style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Synthetic Equity Confidence Cone (5th to 95th Percentile)
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Shaded envelope displays the range of potential equity curves under simulated trade reordering.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '12px', height: '12px', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '2px' }}></span>
                  5%–95% Range
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '12px', height: '12px', backgroundColor: 'rgba(56, 189, 248, 0.3)', border: '1px solid rgba(56, 189, 248, 0.6)', borderRadius: '2px' }}></span>
                  25%–75% Interquartile
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '16px', height: '2px', backgroundColor: '#38bdf8' }}></span>
                  50% Median
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: '16px', height: '1px', borderTop: '1px dashed #f59e0b' }}></span>
                  Initial Capital
                </span>
              </div>
            </div>

            {coneGeometry && (
              <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
                <svg
                  viewBox={`0 0 ${CONE_WIDTH} ${CONE_HEIGHT}`}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <defs>
                    <linearGradient id="coneOuterGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.04" />
                    </linearGradient>
                    <linearGradient id="coneInnerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" />
                      <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.12" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                    const y = PADDING.top + frac * PLOT_H;
                    const val = coneGeometry.maxVal - frac * (coneGeometry.maxVal - coneGeometry.minVal);
                    return (
                      <g key={frac}>
                        <line x1={PADDING.left} y1={y} x2={CONE_WIDTH - PADDING.right} y2={y} stroke="var(--border-color)" strokeDasharray="3 3" />
                        <text x={PADDING.left - 8} y={y + 3} textAnchor="end" fontSize="10" fill="var(--text-muted)">
                          {formatCurrency(val)}
                        </text>
                      </g>
                    );
                  })}

                  {/* Initial Cash Baseline */}
                  <line
                    x1={PADDING.left}
                    y1={coneGeometry.baselineY}
                    x2={CONE_WIDTH - PADDING.right}
                    y2={coneGeometry.baselineY}
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />

                  {/* 5% to 95% Confidence Band */}
                  <path d={coneGeometry.outerArea} fill="url(#coneOuterGrad)" />

                  {/* 25% to 75% Interquartile Band */}
                  <path d={coneGeometry.innerArea} fill="url(#coneInnerGrad)" />

                  {/* Median (P50) Line */}
                  <path d={coneGeometry.medianLine} fill="none" stroke="#38bdf8" strokeWidth="2.2" />

                  {/* Interactive Crosshair & Hover Tooltip */}
                  {hoveredPoint && (
                    <g>
                      <line
                        x1={coneGeometry.scaleX(hoverIndex!)}
                        y1={PADDING.top}
                        x2={coneGeometry.scaleX(hoverIndex!)}
                        y2={CONE_HEIGHT - PADDING.bottom}
                        stroke="rgba(255, 255, 255, 0.4)"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={coneGeometry.scaleX(hoverIndex!)}
                        cy={coneGeometry.scaleY(hoveredPoint.p50)}
                        r="4"
                        fill="#38bdf8"
                        stroke="#090d16"
                        strokeWidth="1.5"
                      />
                    </g>
                  )}
                </svg>

                {/* Hover Inspector Tooltip */}
                {hoveredPoint && (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '1rem',
                      fontSize: '0.78rem',
                    }}
                  >
                    <span><strong>Trade Step:</strong> #{hoveredPoint.step}</span>
                    <span><strong>5% (Worst):</strong> {formatCurrency(hoveredPoint.p5)}</span>
                    <span><strong>25%:</strong> {formatCurrency(hoveredPoint.p25)}</span>
                    <span style={{ color: 'var(--accent-primary)' }}><strong>Median (50%):</strong> {formatCurrency(hoveredPoint.p50)}</span>
                    <span><strong>75%:</strong> {formatCurrency(hoveredPoint.p75)}</span>
                    <span><strong>95% (Best):</strong> {formatCurrency(hoveredPoint.p95)}</span>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Visualization 2: Max Drawdown Distribution Histogram */}
          <Card style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Maximum Drawdown Frequency Distribution
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  Histogram of maximum drawdowns across {result.summary.simulations_count} simulated paths. Bars exceeding {formatPct(result.summary.ruin_threshold)} ruin threshold are highlighted in red.
                </span>
              </div>
              <Badge variant={result.summary.probability_of_ruin > 0.15 ? 'danger' : 'info'}>
                Ruin Threshold: {formatPct(result.summary.ruin_threshold)}
              </Badge>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(70px, 1fr))', gap: '0.5rem', alignItems: 'flex-end', height: '160px', padding: '0.5rem 0' }}>
              {result.drawdown_histogram.map((bin, i) => {
                const isRuin = bin.bin_start >= result.summary.ruin_threshold;
                const maxPct = Math.max(...result.drawdown_histogram.map((b) => b.percentage)) || 1;
                const heightPct = Math.max(8, (bin.percentage / maxPct) * 100);

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                      {(bin.percentage * 100).toFixed(0)}%
                    </span>
                    <div
                      style={{
                        width: '100%',
                        height: `${heightPct}%`,
                        backgroundColor: isRuin ? 'rgba(239, 68, 68, 0.8)' : 'rgba(56, 189, 248, 0.75)',
                        border: `1px solid ${isRuin ? '#ef4444' : '#38bdf8'}`,
                        borderRadius: '4px 4px 0 0',
                        transition: 'all var(--transition-fast)',
                      }}
                      title={`Range: ${formatPct(bin.bin_start)} - ${formatPct(bin.bin_end)} (${bin.count} runs)`}
                    />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.3rem', whiteSpace: 'nowrap' }}>
                      {(bin.bin_start * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Academic Evaluation & Quantitative Commentary */}
          <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <Info size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '0.1rem' }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                <strong style={{ color: 'var(--text-primary)' }}>Quantitative Interpretation: </strong>
                {result.summary.probability_of_ruin < 0.05 ? (
                  <span>
                    The strategy exhibits <strong>low sequence risk</strong>. In {((1 - result.summary.probability_of_ruin) * 100).toFixed(1)}% of simulated permutations, drawdowns never violated the {formatPct(result.summary.ruin_threshold)} ruin boundary. Realized edge is statistically robust against trade order clustering.
                  </span>
                ) : result.summary.probability_of_ruin < 0.20 ? (
                  <span>
                    The strategy demonstrates <strong>moderate path dependency</strong>. In {formatPct(result.summary.probability_of_ruin)} of runs, unfavorable clustering of losing trades produced drawdowns exceeding {formatPct(result.summary.ruin_threshold)}. Consider reducing position sizing or tightening stop-losses to mitigate sequence risk.
                  </span>
                ) : (
                  <span>
                    <strong>High sequence risk warning</strong>: {formatPct(result.summary.probability_of_ruin)} of simulated futures encountered catastrophic drawdown exceeding {formatPct(result.summary.ruin_threshold)}. The historical equity curve was heavily reliant on favorable trade sequencing.
                  </span>
                )}
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
