import type { TearSheetResponse } from '../types';

/**
 * Helper to format percentage values safely.
 */
function formatPct(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return `${(val * 100).toFixed(digits)}%`;
}

/**
 * Helper to format numerical metrics safely.
 */
function formatNum(val: number | null | undefined, digits = 2): string {
  if (val === null || val === undefined || isNaN(val)) return 'N/A';
  return val.toFixed(digits);
}

/**
 * Helper to format Indian rupee currency.
 */
function formatCurrency(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '₹0.00';
  return `₹${val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/**
 * Generate an embedded SVG string of the underwater drawdown curve.
 */
function generateUnderwaterSvg(curve: TearSheetResponse['underwater_curve']): string {
  if (!curve || curve.length === 0) {
    return `<div style="padding: 2rem; text-align: center; color: #64748b;">No drawdown curve data available.</div>`;
  }

  const width = 800;
  const height = 240;
  const pad = { top: 25, right: 35, bottom: 40, left: 75 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const drawdowns = curve.map((d) => d.drawdown);
  let minVal = Math.min(...drawdowns, -0.05);
  minVal = minVal * 1.1; // 10% bottom padding

  const scaleX = (i: number) => pad.left + (i / Math.max(curve.length - 1, 1)) * plotW;
  const scaleY = (val: number) => pad.top + ((val - 0.0) / (minVal - 0.0)) * plotH;

  const points = curve.map((d, i) => ({
    x: scaleX(i),
    y: scaleY(d.drawdown),
  }));

  const pathD = points.reduce(
    (acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`,
    '',
  );

  const firstX = points[0]?.x || pad.left;
  const lastX = points[points.length - 1]?.x || width - pad.right;
  const zeroY = scaleY(0);

  const areaD = `${pathD} L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} L ${firstX.toFixed(1)} ${zeroY.toFixed(1)} Z`;

  // Y-axis gridlines
  const yTicks = [0, minVal * 0.25, minVal * 0.5, minVal * 0.75, minVal];
  const gridLines = yTicks
    .map((val) => {
      const y = scaleY(val);
      return `
        <line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${(width - pad.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#334155" stroke-dasharray="3 3" stroke-width="0.75" />
        <text x="${(pad.left - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" fill="#94a3b8" font-size="10" text-anchor="end" font-family="monospace">${(val * 100).toFixed(1)}%</text>
      `;
    })
    .join('');

  // Date labels along X-axis
  const numXTicks = 5;
  const xLabels = Array.from({ length: numXTicks }).map((_, idx) => {
    const dataIdx = Math.floor((idx / (numXTicks - 1)) * (curve.length - 1));
    const pt = curve[dataIdx];
    if (!pt) return '';
    const x = scaleX(dataIdx);
    const dateStr = pt.timestamp.slice(0, 10);
    return `
      <text x="${x.toFixed(1)}" y="${(height - 12).toFixed(1)}" fill="#94a3b8" font-size="10" text-anchor="middle" font-family="monospace">${dateStr}</text>
    `;
  }).join('');

  return `
    <svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" style="overflow: visible; background-color: #0f172a; border-radius: 8px; border: 1px solid #1e293b;">
      <defs>
        <linearGradient id="drawdownGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ef4444" stop-opacity="0.35" />
          <stop offset="100%" stop-color="#ef4444" stop-opacity="0.05" />
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${areaD}" fill="url(#drawdownGradient)" />
      <path d="${pathD}" fill="none" stroke="#ef4444" stroke-width="1.8" />
      <line x1="${pad.left}" y1="${zeroY.toFixed(1)}" x2="${(width - pad.right).toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="#10b981" stroke-width="1.2" stroke-dasharray="4 4" />
      ${xLabels}
    </svg>
  `;
}

/**
 * Generate a standalone, self-contained HTML research report.
 */
export function generateHtmlReport(result: TearSheetResponse, analyst = 'Quantitative Researcher'): string {
  const generatedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Monthly table rows
  const monthlyRowsHtml = result.monthly_matrix
    .map((row) => {
      const monthCells = monthNames
        .map((m) => {
          const val = row.months[m];
          if (val === null || val === undefined) {
            return `<td style="color: #64748b; background: transparent; text-align: center;">-</td>`;
          }
          const isPos = val >= 0;
          const bgAlpha = Math.min(0.4, Math.max(0.08, Math.abs(val) * 3)).toFixed(2);
          const bg = isPos ? `rgba(16, 185, 129, ${bgAlpha})` : `rgba(239, 68, 68, ${bgAlpha})`;
          const color = isPos ? '#34d399' : '#f87171';
          return `<td style="background-color: ${bg}; color: ${color}; text-align: right; font-weight: 500;">${formatPct(val, 1)}</td>`;
        })
        .join('');

      const totalPos = row.year_total >= 0;
      const totalColor = totalPos ? '#34d399' : '#f87171';
      const totalBg = totalPos ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)';

      return `
        <tr>
          <td style="font-weight: 700; color: #f8fafc; text-align: left;">${row.year}</td>
          ${monthCells}
          <td style="background-color: ${totalBg}; color: ${totalColor}; font-weight: 700; text-align: right;">${formatPct(row.year_total, 1)}</td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>QuantLab Research Tear-Sheet — ${result.strategy_name} (${result.dataset})</title>
  <style>
    :root {
      --bg-page: #090d16;
      --bg-card: #111827;
      --bg-card-subtle: #151f32;
      --border-color: #1e293b;
      --border-subtle: #2d3c52;
      --accent: #38bdf8;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --green: #10b981;
      --red: #ef4444;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background-color: var(--bg-page);
      color: var(--text-main);
      font-family: var(--font-sans);
      line-height: 1.5;
      padding: 2.5rem 1.5rem;
    }

    .container {
      max-width: 1000px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid var(--border-color);
      padding-bottom: 1.5rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .brand-title {
      font-size: 1.5rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: var(--text-main);
    }

    .brand-title span { color: var(--accent); }

    .subtitle {
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    .meta-box {
      font-size: 0.78rem;
      color: var(--text-muted);
      text-align: right;
      line-height: 1.4;
    }

    .card {
      background-color: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 1.25rem;
    }

    .section-heading {
      font-size: 1rem;
      font-weight: 700;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 0.85rem;
    }

    .metric-box {
      background-color: var(--bg-card-subtle);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 0.85rem 1rem;
    }

    .metric-label {
      font-size: 0.72rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .metric-value {
      font-size: 1.25rem;
      font-weight: 700;
      font-family: var(--font-mono);
      margin-top: 0.25rem;
      color: var(--text-main);
    }

    .val-green { color: var(--green) !important; }
    .val-red { color: var(--red) !important; }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
      font-family: var(--font-mono);
    }

    th, td {
      padding: 0.5rem 0.65rem;
      border: 1px solid var(--border-color);
    }

    th {
      background-color: var(--bg-card-subtle);
      color: var(--text-muted);
      text-transform: uppercase;
      font-size: 0.7rem;
      letter-spacing: 0.04em;
    }

    .disclaimer {
      font-size: 0.75rem;
      color: var(--text-dim);
      border-top: 1px solid var(--border-color);
      padding-top: 1rem;
      line-height: 1.4;
      text-align: justify;
    }

    .print-btn {
      background-color: var(--accent);
      color: #090d16;
      border: none;
      padding: 0.45rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }

    @media print {
      body {
        background-color: #ffffff !important;
        color: #0f172a !important;
        padding: 0 !important;
      }
      .no-print { display: none !important; }
      .container { max-width: 100% !important; }
      .card {
        background-color: #ffffff !important;
        border: 1px solid #cbd5e1 !important;
        page-break-inside: avoid;
      }
      .metric-box {
        background-color: #f8fafc !important;
        border: 1px solid #e2e8f0 !important;
      }
      .metric-value { color: #0f172a !important; }
      th { background-color: #f1f5f9 !important; color: #475569 !important; }
      td { border: 1px solid #cbd5e1 !important; }
      svg { background-color: #f8fafc !important; border-color: #e2e8f0 !important; }
      svg text { fill: #475569 !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="report-header">
      <div>
        <div class="brand-title">Quant<span>Lab</span> &bull; Quantitative Strategy Tear-Sheet</div>
        <div class="subtitle">${result.strategy_name} &bull; ${result.configuration}</div>
      </div>
      <div class="meta-box">
        <div><strong>Dataset:</strong> ${result.dataset} (${result.bars_processed} bars)</div>
        <div><strong>Period:</strong> ${result.underwater_curve[0]?.timestamp.slice(0, 10) || 'N/A'} to ${result.underwater_curve[result.underwater_curve.length - 1]?.timestamp.slice(0, 10) || 'N/A'}</div>
        <div><strong>Analyst:</strong> ${analyst}</div>
        <div><strong>Generated:</strong> ${generatedAt}</div>
        <div class="no-print" style="margin-top: 0.5rem;">
          <button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
        </div>
      </div>
    </div>

    <!-- Executive Performance Scorecard -->
    <div class="card">
      <div class="section-heading">1. Executive Performance Scorecard</div>
      <div class="summary-grid">
        <div class="metric-box">
          <div class="metric-label">Initial Capital</div>
          <div class="metric-value">${formatCurrency(result.initial_cash)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Final Equity</div>
          <div class="metric-value ${result.final_equity >= result.initial_cash ? 'val-green' : 'val-red'}">
            ${formatCurrency(result.final_equity)}
          </div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Total Net Return</div>
          <div class="metric-value ${result.summary.total_return >= 0 ? 'val-green' : 'val-red'}">
            ${formatPct(result.summary.total_return)}
          </div>
        </div>
        <div class="metric-box">
          <div class="metric-label">CAGR</div>
          <div class="metric-value">${formatPct(result.summary.cagr)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Max Drawdown</div>
          <div class="metric-value val-red">${formatPct(result.summary.max_drawdown)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Calmar Ratio</div>
          <div class="metric-value">${formatNum(result.summary.calmar_ratio)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Sharpe Ratio (Rf=5%)</div>
          <div class="metric-value">${formatNum(result.summary.sharpe_ratio)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Sortino Ratio</div>
          <div class="metric-value">${formatNum(result.summary.sortino_ratio)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Win Rate</div>
          <div class="metric-value">${formatPct(result.summary.win_rate, 1)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Profit Factor</div>
          <div class="metric-value">${formatNum(result.summary.profit_factor)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Total Completed Trades</div>
          <div class="metric-value">${result.summary.total_trades}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Annualized Volatility</div>
          <div class="metric-value">${formatPct(result.tail_risk.annualized_volatility)}</div>
        </div>
      </div>
    </div>

    <!-- Tail Risk & Extreme Loss Diagnostics -->
    <div class="card">
      <div class="section-heading">2. Tail-Risk & Extreme Loss Diagnostics</div>
      <div class="summary-grid">
        <div class="metric-box">
          <div class="metric-label">Historical VaR (95%)</div>
          <div class="metric-value">${formatPct(result.tail_risk.var_95_historical)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Parametric VaR (95%)</div>
          <div class="metric-value">${formatPct(result.tail_risk.var_95_parametric)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Historical VaR (99%)</div>
          <div class="metric-value">${formatPct(result.tail_risk.var_99_historical)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Parametric VaR (99%)</div>
          <div class="metric-value">${formatPct(result.tail_risk.var_99_parametric)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Expected Shortfall (CVaR 95%)</div>
          <div class="metric-value">${formatPct(result.tail_risk.cvar_95)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Expected Shortfall (CVaR 99%)</div>
          <div class="metric-value">${formatPct(result.tail_risk.cvar_99)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Fisher-Pearson Skewness</div>
          <div class="metric-value">${formatNum(result.tail_risk.skewness)}</div>
        </div>
        <div class="metric-box">
          <div class="metric-label">Excess Kurtosis</div>
          <div class="metric-value">${formatNum(result.tail_risk.kurtosis)}</div>
        </div>
      </div>
    </div>

    <!-- Calendar Monthly Returns Matrix -->
    <div class="card">
      <div class="section-heading">3. Calendar Monthly & Annual Returns Matrix (%)</div>
      <div style="overflow-x: auto;">
        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Year</th>
              <th>Jan</th><th>Feb</th><th>Mar</th><th>Apr</th><th>May</th><th>Jun</th>
              <th>Jul</th><th>Aug</th><th>Sep</th><th>Oct</th><th>Nov</th><th>Dec</th>
              <th style="text-align: right;">Year Total</th>
            </tr>
          </thead>
          <tbody>
            ${monthlyRowsHtml}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Underwater Drawdown Curve Chart -->
    <div class="card">
      <div class="section-heading">4. Underwater Drawdown Profile</div>
      ${generateUnderwaterSvg(result.underwater_curve)}
      <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 0.5rem; text-align: right;">
        Peak-to-Trough Drawdown Curve &bull; Green Dashed = Zero Baseline &bull; Red Solid = Underwater Path
      </div>
    </div>

    <!-- Regulatory & Academic Compliance Notice -->
    <div class="disclaimer">
      <strong>Academic & Quantitative Compliance Disclaimer:</strong> This tear-sheet is generated automatically by the QuantLab Quantitative Engine for academic, research, and educational purposes. Historical simulated performance is no guarantee of future profits. All executions enforce strict next-bar opening execution realism with zero look-ahead bias, accounting for specified broker commission rates and slippage friction penalties.
    </div>
  </div>
</body>
</html>`;
}

/**
 * Triggers client-side download of the standalone HTML research dossier.
 */
export function downloadHtmlReport(result: TearSheetResponse, analyst?: string): void {
  const htmlContent = generateHtmlReport(result, analyst);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanStrategy = result.strategy_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cleanDataset = result.dataset.replace('.csv', '').toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `quantlab_report_${cleanStrategy}_${cleanDataset}_${dateStr}.html`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports all key metrics and monthly performance rows into a formatted CSV spreadsheet.
 */
export function downloadMetricsCsv(result: TearSheetResponse): void {
  const lines: string[] = [];

  // Header & Strategy details
  lines.push('QUANTLAB RESEARCH TEAR-SHEET METRICS');
  lines.push(`Strategy,${result.strategy_name}`);
  lines.push(`Configuration,"${result.configuration}"`);
  lines.push(`Dataset,${result.dataset}`);
  lines.push(`Bars Processed,${result.bars_processed}`);
  lines.push(`Start Date,${result.underwater_curve[0]?.timestamp.slice(0, 10) || 'N/A'}`);
  lines.push(`End Date,${result.underwater_curve[result.underwater_curve.length - 1]?.timestamp.slice(0, 10) || 'N/A'}`);
  lines.push(`Initial Cash,${result.initial_cash}`);
  lines.push(`Final Equity,${result.final_equity}`);
  lines.push('');

  // Performance Summary
  lines.push('EXECUTIVE PERFORMANCE METRICS,VALUE');
  lines.push(`Total Return,${result.summary.total_return}`);
  lines.push(`CAGR,${result.summary.cagr ?? ''}`);
  lines.push(`Max Drawdown,${result.summary.max_drawdown}`);
  lines.push(`Calmar Ratio,${result.summary.calmar_ratio ?? ''}`);
  lines.push(`Sharpe Ratio (Rf=5%),${result.summary.sharpe_ratio ?? ''}`);
  lines.push(`Sortino Ratio,${result.summary.sortino_ratio ?? ''}`);
  lines.push(`Win Rate,${result.summary.win_rate ?? ''}`);
  lines.push(`Profit Factor,${result.summary.profit_factor ?? ''}`);
  lines.push(`Total Trades,${result.summary.total_trades}`);
  lines.push('');

  // Tail-Risk
  lines.push('TAIL-RISK & VALUE-AT-RISK METRICS,VALUE');
  lines.push(`Historical VaR (95%),${result.tail_risk.var_95_historical ?? ''}`);
  lines.push(`Parametric VaR (95%),${result.tail_risk.var_95_parametric ?? ''}`);
  lines.push(`Historical VaR (99%),${result.tail_risk.var_99_historical ?? ''}`);
  lines.push(`Parametric VaR (99%),${result.tail_risk.var_99_parametric ?? ''}`);
  lines.push(`Expected Shortfall (CVaR 95%),${result.tail_risk.cvar_95 ?? ''}`);
  lines.push(`Expected Shortfall (CVaR 99%),${result.tail_risk.cvar_99 ?? ''}`);
  lines.push(`Annualized Volatility,${result.tail_risk.annualized_volatility ?? ''}`);
  lines.push(`Skewness,${result.tail_risk.skewness ?? ''}`);
  lines.push(`Excess Kurtosis,${result.tail_risk.kurtosis ?? ''}`);
  lines.push(`Tail Ratio,${result.tail_risk.tail_ratio ?? ''}`);
  lines.push('');

  // Monthly Matrix
  lines.push('MONTHLY RETURNS MATRIX (%),Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec,Year Total');
  for (const row of result.monthly_matrix) {
    const monthVals = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      .map((m) => {
        const val = row.months[m];
        return val !== null && val !== undefined ? (val * 100).toFixed(2) : '';
      })
      .join(',');
    lines.push(`${row.year},${monthVals},${(row.year_total * 100).toFixed(2)}`);
  }

  const csvContent = lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const cleanStrategy = result.strategy_name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const cleanDataset = result.dataset.replace('.csv', '').toLowerCase();
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `quantlab_metrics_${cleanStrategy}_${cleanDataset}_${dateStr}.csv`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Triggers browser native print dialog formatted for research report PDF printing.
 */
export function printTearSheet(): void {
  window.print();
}
