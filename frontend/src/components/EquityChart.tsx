import { type MouseEvent, useMemo, useState } from 'react';
import type { EquityPointDTO } from '../types';

interface EquityChartProps {
  data: EquityPointDTO[];
  initialCash: number;
}

const WIDTH = 800;
const HEIGHT = 320;
const PADDING = { top: 20, right: 30, bottom: 40, left: 75 };
const CHART_WIDTH = WIDTH - PADDING.left - PADDING.right;
const CHART_HEIGHT = HEIGHT - PADDING.top - PADDING.bottom;

export function EquityChart({ data, initialCash }: EquityChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const { points, minEquity, maxEquity, baselineY, pathD, areaD } = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        points: [],
        minEquity: initialCash,
        maxEquity: initialCash,
        baselineY: CHART_HEIGHT / 2,
        pathD: '',
        areaD: '',
      };
    }

    const values = data.map((d) => d.equity);
    let min = Math.min(...values, initialCash);
    let max = Math.max(...values, initialCash);

    // Give 5% breathing room
    const span = max - min || 1;
    min -= span * 0.05;
    max += span * 0.05;

    const scaleX = (index: number) =>
      PADDING.left + (index / (data.length - 1 || 1)) * CHART_WIDTH;
    const scaleY = (val: number) =>
      PADDING.top + CHART_HEIGHT - ((val - min) / (max - min)) * CHART_HEIGHT;

    const coords = data.map((d, i) => ({
      x: scaleX(i),
      y: scaleY(d.equity),
      equity: d.equity,
      timestamp: d.timestamp,
    }));

    const pathString = coords.reduce(
      (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
      '',
    );

    const firstX = coords[0]?.x || PADDING.left;
    const lastX = coords[coords.length - 1]?.x || WIDTH - PADDING.right;
    const bottomY = PADDING.top + CHART_HEIGHT;

    const areaString = `${pathString} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
    const bY = scaleY(initialCash);

    return {
      points: coords,
      minEquity: min,
      maxEquity: max,
      baselineY: bY,
      pathD: pathString,
      areaD: areaString,
    };
  }, [data, initialCash]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

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
      Math.max(0, Math.round(ratio * (points.length - 1))),
    );
    setHoverIndex(index);
  };

  const activePoint = hoverIndex !== null && points[hoverIndex] ? points[hoverIndex] : null;

  // Y-axis grid ticks (4 ticks)
  const yTicks = [0, 0.33, 0.66, 1].map((pct) => {
    const val = minEquity + pct * (maxEquity - minEquity);
    const y = PADDING.top + CHART_HEIGHT - pct * CHART_HEIGHT;
    return { val, y };
  });

  // X-axis date ticks (first, middle, last)
  const xTicks =
    data.length > 2
      ? [
          { label: data[0].timestamp.slice(0, 10), x: PADDING.left },
          {
            label: data[Math.floor(data.length / 2)].timestamp.slice(0, 10),
            x: PADDING.left + CHART_WIDTH / 2,
          },
          {
            label: data[data.length - 1].timestamp.slice(0, 10),
            x: PADDING.left + CHART_WIDTH,
          },
        ]
      : [];

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3>Portfolio Equity Curve</h3>
        {activePoint && (
          <div className="chart-tooltip-badge">
            <span>Date: {activePoint.timestamp.slice(0, 10)}</span>
            <span>Equity: {formatCurrency(activePoint.equity)}</span>
            <span
              className={
                activePoint.equity >= initialCash ? 'pnl-green' : 'pnl-red'
              }
            >
              P&L: {activePoint.equity >= initialCash ? '+' : ''}
              {formatCurrency(activePoint.equity - initialCash)}
            </span>
          </div>
        )}
      </div>

      <svg
        className="equity-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Y Axis Grid Lines */}
        {yTicks.map((tick, idx) => (
          <g key={idx}>
            <line
              x1={PADDING.left}
              y1={tick.y}
              x2={WIDTH - PADDING.right}
              y2={tick.y}
              stroke="var(--border-subtle)"
              strokeDasharray="3 3"
            />
            <text
              x={PADDING.left - 8}
              y={tick.y + 4}
              textAnchor="end"
              className="axis-text"
            >
              {formatCurrency(tick.val)}
            </text>
          </g>
        ))}

        {/* Initial Capital Baseline */}
        {baselineY >= PADDING.top && baselineY <= PADDING.top + CHART_HEIGHT && (
          <line
            x1={PADDING.left}
            y1={baselineY}
            x2={WIDTH - PADDING.right}
            y2={baselineY}
            stroke="#94a3b8"
            strokeDasharray="5 5"
            strokeWidth="1.5"
          />
        )}

        {/* Area and Line */}
        <path d={areaD} fill="url(#equityGradient)" />
        <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="2.5" />

        {/* X Axis Date Labels */}
        {xTicks.map((tick, idx) => (
          <text
            key={idx}
            x={tick.x}
            y={HEIGHT - 12}
            textAnchor={idx === 0 ? 'start' : idx === 2 ? 'end' : 'middle'}
            className="axis-text"
          >
            {tick.label}
          </text>
        ))}

        {/* Hover Crosshair & Marker */}
        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={PADDING.top}
              x2={activePoint.x}
              y2={PADDING.top + CHART_HEIGHT}
              stroke="#cbd5e1"
              strokeDasharray="2 2"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="5"
              fill="#38bdf8"
              stroke="#0f172a"
              strokeWidth="2"
            />
          </g>
        )}
      </svg>
    </div>
  );
}
