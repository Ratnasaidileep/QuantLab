import { type MouseEvent, useMemo, useState } from 'react';
import { TrendingUp, BarChart2, Activity, Calendar } from 'lucide-react';
import type { EquityPointDTO, TradeDTO } from '../types';

interface EquityChartProps {
  data: EquityPointDTO[];
  initialCash: number;
  benchmarkData?: EquityPointDTO[];
  trades?: TradeDTO[];
}

type ChartTab = 'equity_drawdown' | 'price_trades' | 'returns_dist';
type RangePreset = '1M' | '3M' | '6M' | '1Y' | 'ALL';

const WIDTH = 820;
const EQUITY_HEIGHT = 260;
const DD_HEIGHT = 100;
const PADDING = { top: 20, right: 30, bottom: 25, left: 75 };
const CHART_WIDTH = WIDTH - PADDING.left - PADDING.right;

export function EquityChart({
  data,
  initialCash,
  benchmarkData,
  trades = [],
}: EquityChartProps) {
  const [activeTab, setActiveTab] = useState<ChartTab>('equity_drawdown');
  const [rangePreset, setRangePreset] = useState<RangePreset>('ALL');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [selectedTrade, setSelectedTrade] = useState<TradeDTO | null>(null);

  // Date range filtering
  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (rangePreset === 'ALL') return data;

    const lastDate = new Date(data[data.length - 1].timestamp);
    let daysToSubtract = 365;
    if (rangePreset === '1M') daysToSubtract = 30;
    else if (rangePreset === '3M') daysToSubtract = 90;
    else if (rangePreset === '6M') daysToSubtract = 180;
    else if (rangePreset === '1Y') daysToSubtract = 365;

    const cutoff = new Date(lastDate);
    cutoff.setDate(cutoff.getDate() - daysToSubtract);

    const filtered = data.filter((d) => new Date(d.timestamp) >= cutoff);
    return filtered.length > 5 ? filtered : data.slice(-Math.min(data.length, daysToSubtract));
  }, [data, rangePreset]);

  // Synchronized Benchmark Slicing
  const filteredBenchmark = useMemo(() => {
    if (!benchmarkData || benchmarkData.length === 0 || filteredData.length === 0) return [];
    const startTime = new Date(filteredData[0].timestamp).getTime();
    const endTime = new Date(filteredData[filteredData.length - 1].timestamp).getTime();
    return benchmarkData.filter((b) => {
      const t = new Date(b.timestamp).getTime();
      return t >= startTime && t <= endTime;
    });
  }, [benchmarkData, filteredData]);

  // Equity calculations & scaling
  const {
    points,
    minEquity,
    maxEquity,
    baselineY,
    equityPath,
    equityArea,
    hwmPath,
    ddPath,
    ddArea,
    minDrawdown,
    benchmarkPath,
  } = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      return {
        points: [],
        minEquity: initialCash,
        maxEquity: initialCash,
        baselineY: EQUITY_HEIGHT / 2,
        equityPath: '',
        equityArea: '',
        hwmPath: '',
        ddPoints: [],
        ddPath: '',
        ddArea: '',
        minDrawdown: -0.1,
        benchmarkPath: '',
      };
    }

    const n = filteredData.length;
    let runningMax = filteredData[0].equity;
    const hwmValues: number[] = [];
    const ddValues: number[] = [];

    filteredData.forEach((d) => {
      if (d.equity > runningMax) runningMax = d.equity;
      hwmValues.push(runningMax);
      const dd = runningMax > 0 ? (d.equity - runningMax) / runningMax : 0;
      ddValues.push(dd);
    });

    const values = filteredData.map((d) => d.equity);
    if (filteredBenchmark && filteredBenchmark.length > 0) {
      values.push(...filteredBenchmark.map((b) => b.equity));
    }
    let min = Math.min(...values, initialCash);
    let max = Math.max(...values, initialCash);

    const span = max - min || 1;
    min -= span * 0.05;
    max += span * 0.05;

    const plotHeight = EQUITY_HEIGHT - PADDING.top - PADDING.bottom;
    const scaleX = (i: number) => PADDING.left + (i / (n - 1 || 1)) * CHART_WIDTH;
    const scaleY = (val: number) =>
      PADDING.top + plotHeight - ((val - min) / (max - min)) * plotHeight;

    // Equity points
    const pts = filteredData.map((d, i) => ({
      x: scaleX(i),
      y: scaleY(d.equity),
      equity: d.equity,
      timestamp: d.timestamp,
      hwm: hwmValues[i],
      drawdown: ddValues[i],
    }));

    const eqPath = pts.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      ''
    );

    const firstX = pts[0]?.x || PADDING.left;
    const lastX = pts[pts.length - 1]?.x || WIDTH - PADDING.right;
    const bottomY = PADDING.top + plotHeight;
    const eqArea = `${eqPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    // High water mark path
    const hwmPts = pts.map((p, i) => ({ x: p.x, y: scaleY(hwmValues[i]) }));
    const hwmPth = hwmPts.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      ''
    );

    // Benchmark path
    let bmPth = '';
    if (filteredBenchmark && filteredBenchmark.length > 0) {
      const bn = filteredBenchmark.length;
      const bmScaleX = (i: number) => PADDING.left + (i / (bn - 1 || 1)) * CHART_WIDTH;
      bmPth = filteredBenchmark.reduce(
        (acc, b, i) =>
          `${acc} ${i === 0 ? 'M' : 'L'} ${bmScaleX(i).toFixed(1)} ${scaleY(b.equity).toFixed(1)}`,
        ''
      );
    }

    // Drawdown chart coordinates
    let minDd = Math.min(...ddValues, -0.05);
    minDd = minDd * 1.15; // padding
    const ddPlotHeight = DD_HEIGHT - 30;
    const scaleDdY = (val: number) =>
      10 + ((val - 0.0) / (minDd - 0.0)) * ddPlotHeight;

    const ddPts = pts.map((p, i) => ({
      x: p.x,
      y: scaleDdY(ddValues[i]),
      drawdown: ddValues[i],
    }));

    const ddPth = ddPts.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      ''
    );

    const ddZeroY = scaleDdY(0);
    const ddAr = `${ddPth} L ${lastX} ${ddZeroY} L ${firstX} ${ddZeroY} Z`;

    return {
      points: pts,
      minEquity: min,
      maxEquity: max,
      baselineY: scaleY(initialCash),
      equityPath: eqPath,
      equityArea: eqArea,
      hwmPath: hwmPth,
      ddPoints: ddPts,
      ddPath: ddPth,
      ddArea: ddAr,
      minDrawdown: minDd,
      benchmarkPath: bmPth,
    };
  }, [filteredData, filteredBenchmark, initialCash]);

  // Price & Trade execution overlay calculations
  const priceChartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return null;

    const hasPointPrices = filteredData.some((d) => typeof d.price === 'number' && d.price > 0);
    const validPrices = hasPointPrices
      ? filteredData.map((d) => (typeof d.price === 'number' && d.price > 0 ? d.price : 0)).filter((p) => p > 0)
      : trades.map((t) => t.price).filter((p) => p > 0);

    if (validPrices.length === 0) return null;

    let minP = Math.min(...validPrices);
    let maxP = Math.max(...validPrices);
    const pSpan = maxP - minP || 1;
    minP -= pSpan * 0.08;
    maxP += pSpan * 0.08;

    const plotHeight = EQUITY_HEIGHT - PADDING.top - PADDING.bottom;
    const n = filteredData.length;
    const scaleX = (i: number) => PADDING.left + (i / (n - 1 || 1)) * CHART_WIDTH;
    const scalePriceY = (val: number) =>
      PADDING.top + plotHeight - ((val - minP) / (maxP - minP)) * plotHeight;

    const dateToXMap = new Map<string, number>();
    const pricePoints: Array<{ x: number; y: number; price: number; timestamp: string }> = [];

    filteredData.forEach((d, i) => {
      const x = scaleX(i);
      const dateKey = d.timestamp.slice(0, 10);
      if (!dateToXMap.has(dateKey)) {
        dateToXMap.set(dateKey, x);
      }
      const pVal = typeof d.price === 'number' && d.price > 0 ? d.price : validPrices[0];
      pricePoints.push({
        x,
        y: scalePriceY(pVal),
        price: pVal,
        timestamp: d.timestamp,
      });
    });

    const pricePath = pricePoints.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      ''
    );
    const firstX = pricePoints[0]?.x || PADDING.left;
    const lastX = pricePoints[pricePoints.length - 1]?.x || WIDTH - PADDING.right;
    const bottomY = PADDING.top + plotHeight;
    const priceArea = `${pricePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    const startTime = new Date(filteredData[0].timestamp).getTime();
    const endTime = new Date(filteredData[filteredData.length - 1].timestamp).getTime();

    const mappedTrades = trades
      .filter((t) => {
        const time = new Date(t.timestamp).getTime();
        return time >= startTime && time <= endTime;
      })
      .map((t) => {
        const dateKey = t.timestamp.slice(0, 10);
        let x = dateToXMap.get(dateKey);
        if (x === undefined) {
          const tTime = new Date(t.timestamp).getTime();
          let closestDiff = Infinity;
          let closestIdx = 0;
          filteredData.forEach((d, idx) => {
            const diff = Math.abs(new Date(d.timestamp).getTime() - tTime);
            if (diff < closestDiff) {
              closestDiff = diff;
              closestIdx = idx;
            }
          });
          x = scaleX(closestIdx);
        }
        return {
          ...t,
          x,
          y: scalePriceY(t.price),
        };
      });

    const priceTicks = [0, 0.33, 0.66, 1.0].map((frac) => {
      const val = minP + frac * (maxP - minP);
      return {
        val,
        y: scalePriceY(val),
      };
    });

    return {
      pricePoints,
      pricePath,
      priceArea,
      mappedTrades,
      minPrice: minP,
      maxPrice: maxP,
      priceTicks,
      plotHeight,
      bottomY,
    };
  }, [filteredData, trades]);

  // Trade return distribution calculations
  const returnDistribution = useMemo(() => {
    if (!trades || trades.length < 2) return null;
    const returns: number[] = [];
    let entryPrice: number | null = null;

    trades.forEach((t) => {
      if (t.side.toLowerCase() === 'buy') {
        entryPrice = t.price;
      } else if (t.side.toLowerCase() === 'sell' && entryPrice !== null) {
        const ret = (t.price - entryPrice) / entryPrice;
        returns.push(ret);
        entryPrice = null;
      }
    });

    if (returns.length === 0) return null;

    // Create 10 bins
    const minR = Math.min(...returns);
    const maxR = Math.max(...returns);
    const span = maxR - minR || 0.01;
    const binCount = 8;
    const step = span / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => {
      const low = minR + i * step;
      const high = low + step;
      const count = returns.filter((r) => r >= low && (i === binCount - 1 ? r <= high : r < high)).length;
      return {
        label: `${(low * 100).toFixed(1)}% to ${(high * 100).toFixed(1)}%`,
        mid: (low + high) / 2,
        count,
        isPositive: (low + high) / 2 >= 0,
      };
    });

    const maxCount = Math.max(...bins.map((b) => b.count), 1);
    return { bins, maxCount, totalTrades: returns.length };
  }, [trades]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * WIDTH;

    if (svgX < PADDING.left || svgX > WIDTH - PADDING.right || points.length === 0) {
      setHoverIndex(null);
      return;
    }

    const ratio = (svgX - PADDING.left) / CHART_WIDTH;
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.round(ratio * (points.length - 1)))
    );
    setHoverIndex(index);
  };

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  // Y-axis ticks for Equity
  const equityTicks = useMemo(() => {
    const ticks = [];
    const count = 4;
    for (let i = 0; i < count; i++) {
      const val = minEquity + ((maxEquity - minEquity) / (count - 1)) * i;
      const plotHeight = EQUITY_HEIGHT - PADDING.top - PADDING.bottom;
      const y = PADDING.top + plotHeight - (i / (count - 1)) * plotHeight;
      ticks.push({ val, y });
    }
    return ticks;
  }, [minEquity, maxEquity]);

  // X-axis date labels
  const dateTicks = useMemo(() => {
    if (points.length === 0) return [];
    const step = Math.max(1, Math.floor(points.length / 5));
    const ticks = [];
    for (let i = 0; i < points.length; i += step) {
      ticks.push(points[i]);
    }
    if (ticks[ticks.length - 1] !== points[points.length - 1]) {
      ticks.push(points[points.length - 1]);
    }
    return ticks;
  }, [points]);

  return (
    <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Top Toolbar: View Switcher and Range Selector */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '0.75rem',
        }}
      >
        {/* Chart View Modes */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'equity_drawdown' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            onClick={() => setActiveTab('equity_drawdown')}
          >
            <TrendingUp size={14} style={{ marginRight: '0.3rem' }} />
            Equity & Drawdown
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'price_trades' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            onClick={() => setActiveTab('price_trades')}
          >
            <Activity size={14} style={{ marginRight: '0.3rem' }} />
            Price & Executions
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'returns_dist' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
            onClick={() => setActiveTab('returns_dist')}
          >
            <BarChart2 size={14} style={{ marginRight: '0.3rem' }} />
            Return Distribution
          </button>
        </div>

        {/* Date Range Selector Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Calendar size={13} style={{ color: 'var(--text-tertiary)', marginRight: '0.2rem' }} />
          {(['1M', '3M', '6M', '1Y', 'ALL'] as RangePreset[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRangePreset(r)}
              style={{
                background: rangePreset === r ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: rangePreset === r ? '#090d16' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '0.2rem 0.45rem',
                fontSize: '0.72rem',
                fontWeight: rangePreset === r ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW 1: EQUITY & DRAWDOWN UNDERWATER */}
      {activeTab === 'equity_drawdown' && (
        <div style={{ position: 'relative' }}>
          {/* Legend Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              fontSize: '0.78rem',
              marginBottom: '0.5rem',
              color: 'var(--text-secondary)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '12px', height: '3px', backgroundColor: '#38bdf8', borderRadius: '2px' }}></span>
              Strategy Equity
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: '12px', height: '1.5px', borderTop: '1.5px dashed var(--text-tertiary)' }}></span>
              High-Water Mark (Peak)
            </span>
            {benchmarkPath && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '12px', height: '2px', backgroundColor: '#f59e0b', borderRadius: '2px' }}></span>
                Buy & Hold Benchmark
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginLeft: 'auto' }}>
              <span style={{ width: '10px', height: '10px', backgroundColor: 'rgba(239, 68, 68, 0.4)', borderRadius: '2px' }}></span>
              Underwater Drawdown
            </span>
          </div>

          <div className="chart-wrapper" style={{ overflow: 'hidden' }}>
            <svg
              viewBox={`0 0 ${WIDTH} ${EQUITY_HEIGHT + DD_HEIGHT}`}
              className="equity-svg"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            >
              <defs>
                <linearGradient id="eqGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="ddGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.4" />
                </linearGradient>
              </defs>

              {/* ================= SECTION A: EQUITY CURVE ================= */}
              {/* Y Grid & Labels */}
              {equityTicks.map((t, idx) => (
                <g key={idx}>
                  <line
                    x1={PADDING.left}
                    y1={t.y}
                    x2={WIDTH - PADDING.right}
                    y2={t.y}
                    stroke="var(--border-subtle, #1e293b)"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={PADDING.left - 8}
                    y={t.y + 4}
                    fill="var(--text-tertiary, #64748b)"
                    fontSize="10"
                    textAnchor="end"
                    fontFamily="var(--font-mono)"
                  >
                    {formatCurrency(t.val)}
                  </text>
                </g>
              ))}

              {/* Initial Capital Baseline */}
              <line
                x1={PADDING.left}
                y1={baselineY}
                x2={WIDTH - PADDING.right}
                y2={baselineY}
                stroke="var(--text-tertiary, #475569)"
                strokeDasharray="4 4"
                strokeWidth="1"
              />

              {/* High Water Mark Line */}
              {hwmPath && (
                <path
                  d={hwmPath}
                  fill="none"
                  stroke="var(--text-tertiary, #475569)"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  opacity="0.6"
                />
              )}

              {/* Buy & Hold Benchmark Line */}
              {benchmarkPath && (
                <path
                  d={benchmarkPath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  opacity="0.8"
                />
              )}

              {/* Strategy Equity Fill Area */}
              {equityArea && <path d={equityArea} fill="url(#eqGradient)" />}

              {/* Strategy Equity Line */}
              {equityPath && (
                <path
                  d={equityPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* ================= SECTION B: DRAWDOWN UNDERWATER ================= */}
              <g transform={`translate(0, ${EQUITY_HEIGHT})`}>
                {/* Separator Line */}
                <line
                  x1={PADDING.left}
                  y1="0"
                  x2={WIDTH - PADDING.right}
                  y2="0"
                  stroke="var(--border-color, #334155)"
                  strokeWidth="1"
                />

                {/* Drawdown Zero Line */}
                <line
                  x1={PADDING.left}
                  y1="10"
                  x2={WIDTH - PADDING.right}
                  y2="10"
                  stroke="var(--text-tertiary, #64748b)"
                  strokeWidth="1"
                />
                <text
                  x={PADDING.left - 8}
                  y="13"
                  fill="var(--text-tertiary, #64748b)"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  0%
                </text>

                {/* Drawdown Max Drop Label */}
                <text
                  x={PADDING.left - 8}
                  y={DD_HEIGHT - 25}
                  fill="var(--loss, #ef4444)"
                  fontSize="9"
                  textAnchor="end"
                  fontFamily="var(--font-mono)"
                >
                  {formatPercent(minDrawdown)}
                </text>

                {/* Drawdown Area */}
                {ddArea && <path d={ddArea} fill="url(#ddGradient)" />}

                {/* Drawdown Line */}
                {ddPath && (
                  <path
                    d={ddPath}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="1.2"
                    opacity="0.8"
                  />
                )}

                {/* Synchronized X-axis Date Labels */}
                {dateTicks.map((p, idx) => (
                  <text
                    key={idx}
                    x={p.x}
                    y={DD_HEIGHT - 5}
                    fill="var(--text-tertiary, #64748b)"
                    fontSize="9"
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                  >
                    {p.timestamp.slice(0, 10)}
                  </text>
                ))}
              </g>

              {/* ================= CROSSHAIR OVERLAY ================= */}
              {activePoint && (
                <g>
                  {/* Vertical Crosshair Guide */}
                  <line
                    x1={activePoint.x}
                    y1={PADDING.top}
                    x2={activePoint.x}
                    y2={EQUITY_HEIGHT + DD_HEIGHT - 20}
                    stroke="var(--accent-primary, #38bdf8)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />

                  {/* Equity Dot */}
                  <circle
                    cx={activePoint.x}
                    cy={activePoint.y}
                    r="4.5"
                    fill="#38bdf8"
                    stroke="#090d16"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>

            {/* Floating Tooltip Pill */}
            {activePoint && (
              <div
                style={{
                  position: 'absolute',
                  top: '12px',
                  left: `${Math.min(75, Math.max(15, (activePoint.x / WIDTH) * 100))}%`,
                  transform: 'translateX(-50%)',
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  gap: '0.75rem',
                  pointerEvents: 'none',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                }}
              >
                <div>
                  <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.68rem' }}>Date</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{activePoint.timestamp.slice(0, 10)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.68rem' }}>Equity</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>
                    {formatCurrency(activePoint.equity)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.68rem' }}>Return</span>
                  <strong
                    style={{
                      fontFamily: 'var(--font-mono)',
                      color: activePoint.equity >= initialCash ? 'var(--profit)' : 'var(--loss)',
                    }}
                  >
                    {activePoint.equity >= initialCash ? '+' : ''}
                    {formatPercent((activePoint.equity - initialCash) / initialCash)}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '0.68rem' }}>Drawdown</span>
                  <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--loss)' }}>
                    {formatPercent(activePoint.drawdown)}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: PRICE & TRADE EXECUTIONS OVERLAY */}
      {activeTab === 'price_trades' && (
        <div style={{ position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.78rem',
              marginBottom: '0.5rem',
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: '12px', height: '2px', backgroundColor: 'var(--accent-primary, #6366f1)' }}></span>
                Asset Close Price
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--profit, #10b981)', fontWeight: 700 }}>▲</span> Buy Entry
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--loss, #ef4444)', fontWeight: 700 }}>▼</span> Sell Exit
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
              Click any trade marker for order audit details
            </span>
          </div>

          {!priceChartData || priceChartData.pricePoints.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No price or trade execution data available for the selected period.
            </div>
          ) : (
            <div className="chart-wrapper">
              <svg
                viewBox={`0 0 ${WIDTH} ${EQUITY_HEIGHT}`}
                className="equity-svg"
                style={{ width: '100%', height: 'auto', display: 'block' }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoverIndex(null)}
              >
                <defs>
                  <linearGradient id="price-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-primary, #6366f1)" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="var(--accent-primary, #6366f1)" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal price grid lines & labels */}
                {priceChartData.priceTicks.map((tick, i) => (
                  <g key={`ptick-${i}`}>
                    <line
                      x1={PADDING.left}
                      y1={tick.y}
                      x2={WIDTH - PADDING.right}
                      y2={tick.y}
                      stroke="var(--border-color, #27272a)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      opacity="0.5"
                    />
                    <text
                      x={PADDING.left - 8}
                      y={tick.y + 4}
                      textAnchor="end"
                      fill="var(--text-tertiary, #a1a1aa)"
                      fontSize="10"
                      fontFamily="var(--font-mono, monospace)"
                    >
                      {formatCurrency(tick.val)}
                    </text>
                  </g>
                ))}

                {/* X-axis date grid lines & labels */}
                {dateTicks.map((pt, i) => (
                  <g key={`pdtick-${i}`}>
                    <line
                      x1={pt.x}
                      y1={PADDING.top}
                      x2={pt.x}
                      y2={priceChartData.bottomY}
                      stroke="var(--border-color, #27272a)"
                      strokeWidth="1"
                      strokeDasharray="2 4"
                      opacity="0.3"
                    />
                    <text
                      x={pt.x}
                      y={priceChartData.bottomY + 16}
                      textAnchor="middle"
                      fill="var(--text-tertiary, #a1a1aa)"
                      fontSize="10"
                      fontFamily="var(--font-mono, monospace)"
                    >
                      {pt.timestamp.slice(0, 10)}
                    </text>
                  </g>
                ))}

                {/* Price area fill */}
                <path d={priceChartData.priceArea} fill="url(#price-gradient)" />

                {/* Price line path */}
                <path
                  d={priceChartData.pricePath}
                  fill="none"
                  stroke="var(--accent-primary, #6366f1)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Trade Execution Markers Overlay */}
                {priceChartData.mappedTrades.map((t, idx) => {
                  const isBuy = t.side.toLowerCase() === 'buy';
                  const isSelected = selectedTrade === t;

                  return (
                    <g
                      key={`trade-${idx}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedTrade(t)}
                    >
                      {/* Selection / highlight ring */}
                      {isSelected && (
                        <circle
                          cx={t.x}
                          cy={t.y}
                          r="12"
                          fill="none"
                          stroke={isBuy ? 'var(--profit, #10b981)' : 'var(--loss, #ef4444)'}
                          strokeWidth="2"
                          opacity="0.75"
                        />
                      )}

                      {/* Directional marker polygon */}
                      {isBuy ? (
                        <polygon
                          points={`${t.x},${t.y - 10} ${t.x - 7},${t.y + 4} ${t.x + 7},${t.y + 4}`}
                          fill="var(--profit, #10b981)"
                          stroke="#090d16"
                          strokeWidth="1.5"
                        />
                      ) : (
                        <polygon
                          points={`${t.x},${t.y + 10} ${t.x - 7},${t.y - 4} ${t.x + 7},${t.y - 4}`}
                          fill="var(--loss, #ef4444)"
                          stroke="#090d16"
                          strokeWidth="1.5"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Hover vertical crosshair & point indicator */}
                {hoverIndex !== null && priceChartData.pricePoints[hoverIndex] && (
                  <g>
                    <line
                      x1={priceChartData.pricePoints[hoverIndex].x}
                      y1={PADDING.top}
                      x2={priceChartData.pricePoints[hoverIndex].x}
                      y2={priceChartData.bottomY}
                      stroke="var(--accent-primary, #6366f1)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle
                      cx={priceChartData.pricePoints[hoverIndex].x}
                      cy={priceChartData.pricePoints[hoverIndex].y}
                      r="4"
                      fill="var(--accent-primary, #6366f1)"
                      stroke="#090d16"
                      strokeWidth="2"
                    />
                  </g>
                )}
              </svg>

              {/* Hover tooltip for price */}
              {hoverIndex !== null && priceChartData.pricePoints[hoverIndex] && (
                <div
                  style={{
                    position: 'absolute',
                    top: '2.5rem',
                    left: `${Math.min(Math.max(priceChartData.pricePoints[hoverIndex].x, 80), WIDTH - 180)}px`,
                    backgroundColor: 'var(--bg-elevated, #18181b)',
                    border: '1px solid var(--border-color, #27272a)',
                    borderRadius: '6px',
                    padding: '0.4rem 0.65rem',
                    fontSize: '0.75rem',
                    pointerEvents: 'none',
                    zIndex: 10,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                >
                  <div style={{ color: 'var(--text-tertiary, #a1a1aa)', fontSize: '0.7rem' }}>
                    {priceChartData.pricePoints[hoverIndex].timestamp.slice(0, 10)}
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary, #fafafa)', marginTop: '2px' }}>
                    Close: {formatCurrency(priceChartData.pricePoints[hoverIndex].price)}
                  </div>
                </div>
              )}

              {/* Selected Trade Card Drawer */}
              {selectedTrade && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                    fontSize: '0.8rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontWeight: 700,
                        padding: '0.15rem 0.4rem',
                        borderRadius: '4px',
                        backgroundColor:
                          selectedTrade.side.toLowerCase() === 'buy'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                        color:
                          selectedTrade.side.toLowerCase() === 'buy'
                            ? 'var(--profit, #10b981)'
                            : 'var(--loss, #ef4444)',
                        marginRight: '0.5rem',
                      }}
                    >
                      {selectedTrade.side.toUpperCase()} ORDER
                    </span>
                    at <strong>{formatCurrency(selectedTrade.price)}</strong> &bull;{' '}
                    {selectedTrade.quantity} shares &bull;{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {selectedTrade.timestamp.slice(0, 19).replace('T', ' ')}
                    </span>
                    {selectedTrade.exit_reason && (
                      <span
                        style={{
                          marginLeft: '0.5rem',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '3px',
                          backgroundColor: 'var(--bg-surface, #27272a)',
                          fontSize: '0.72rem',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Trigger: {selectedTrade.exit_reason.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTrade(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-tertiary)',
                      cursor: 'pointer',
                      fontSize: '1.1rem',
                      lineHeight: 1,
                    }}
                    title="Close"
                  >
                    &times;
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: RETURN DISTRIBUTION HISTOGRAM */}
      {activeTab === 'returns_dist' && (
        <div>
          {returnDistribution ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Distribution of net returns across {returnDistribution.totalTrades} completed round-trip trades.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                {returnDistribution.bins.map((bin, idx) => {
                  const pctWidth = (bin.count / returnDistribution.maxCount) * 100;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem' }}>
                      <span style={{ width: '130px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {bin.label}
                      </span>
                      <div
                        style={{
                          flex: 1,
                          height: '20px',
                          backgroundColor: 'var(--bg-elevated)',
                          borderRadius: '4px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${pctWidth}%`,
                            height: '100%',
                            backgroundColor: bin.isPositive ? 'var(--profit)' : 'var(--loss)',
                            borderRadius: '4px',
                            transition: 'width 0.3s ease',
                          }}
                        ></div>
                      </div>
                      <span style={{ width: '40px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {bin.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              At least 2 completed trade cycles are required to compute return distribution.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
