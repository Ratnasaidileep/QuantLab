import { useState } from 'react';
import { fetchBenchmarkMatrix } from '../api/client';
import type { BenchmarkMatrixResponse, DatasetInfo } from '../types';
import {
  GraduationCap,
  Download,
  Copy,
  Check,
  Table,
  FileCode,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface BenchmarkPanelProps {
  datasets: DatasetInfo[];
  defaultInitialCash?: number;
  defaultCommissionRate?: number;
  defaultSlippageRate?: number;
}

export function BenchmarkPanel({
  datasets,
  defaultInitialCash = 100_000,
  defaultCommissionRate = 0.001,
  defaultSlippageRate = 0.001,
}: BenchmarkPanelProps) {
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>(() => {
    return datasets.map((d) => d.filename);
  });

  const [initialCash, setInitialCash] = useState<number>(defaultInitialCash);
  const [commissionRate, setCommissionRate] = useState<number>(defaultCommissionRate);
  const [slippageRate, setSlippageRate] = useState<number>(defaultSlippageRate);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BenchmarkMatrixResponse | null>(null);

  const [viewMode, setViewMode] = useState<'table' | 'markdown' | 'latex'>('table');
  const [copiedType, setCopiedType] = useState<'markdown' | 'latex' | null>(null);

  const toggleDataset = (filename: string) => {
    setSelectedDatasets((prev) => {
      if (prev.includes(filename)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((f) => f !== filename);
      }
      return [...prev, filename];
    });
  };

  const handleSelectAll = () => {
    setSelectedDatasets(datasets.map((d) => d.filename));
  };

  const handleRunBenchmark = async () => {
    if (selectedDatasets.length === 0) {
      setError('Please select at least one dataset for the benchmark evaluation.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchBenchmarkMatrix({
        datasets: selectedDatasets,
        initial_cash: initialCash,
        commission_rate: commissionRate,
        slippage_rate: slippageRate,
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Benchmark evaluation failed.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, type: 'markdown' | 'latex') => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2500);
  };

  const handleDownloadCSV = () => {
    if (!result) return;
    const blob = new Blob([result.csv_table], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'quantlab_academic_benchmark_matrix.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Intro Header */}
      <div>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <GraduationCap size={22} style={{ color: 'var(--accent-primary)' }} />
          <span>Cross-Strategy Academic Evaluation Benchmark Suite</span>
        </h2>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Automates empirical cross-asset testing across Buy &amp; Hold, Moving Average Crossover, RSI Reversal, Bollinger Bands, MACD, and Regime-Filtered Confluence. Generates publication-ready Markdown and LaTeX (booktabs) tables for thesis defenses and research dossiers.
        </p>
      </div>

      {/* Configuration Controls */}
      <div className="card" style={{ padding: '1.25rem', backgroundColor: 'var(--bg-card)' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Benchmark Assets Universe ({selectedDatasets.length} selected):
            </span>
            <button
              type="button"
              onClick={handleSelectAll}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
            >
              Select All Available ({datasets.length})
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {datasets.map((d) => {
              const isSelected = selectedDatasets.includes(d.filename);
              return (
                <button
                  key={d.filename}
                  type="button"
                  onClick={() => toggleDataset(d.filename)}
                  className={`btn ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '0.35rem 0.8rem',
                    fontSize: '0.8rem',
                    borderRadius: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <span>{isSelected ? '✓' : '+'}</span>
                  <span>{d.symbol}</span>
                  <span style={{ opacity: 0.7, fontSize: '0.72rem' }}>({d.bars_count} bars)</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="form-group">
            <label>Initial Capital ($)</label>
            <input
              type="number"
              min={1000}
              step={10000}
              value={initialCash}
              onChange={(e) => setInitialCash(Number(e.target.value))}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Broker Commission Rate</label>
            <input
              type="number"
              min={0}
              max={0.05}
              step={0.0005}
              value={commissionRate}
              onChange={(e) => setCommissionRate(Number(e.target.value))}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label>Slippage Rate</label>
            <input
              type="number"
              min={0}
              max={0.05}
              step={0.0005}
              value={slippageRate}
              onChange={(e) => setSlippageRate(Number(e.target.value))}
              className="form-control"
            />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <button
            type="button"
            onClick={handleRunBenchmark}
            disabled={isLoading || selectedDatasets.length === 0}
            className="btn btn-primary"
            style={{ minWidth: '220px' }}
          >
            {isLoading ? 'Running Cross-Asset Matrix...' : '🎓 Run Academic Benchmark Matrix'}
          </button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Benchmark Results */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Action Toolbar & View Mode Switcher */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.35rem', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'table' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'table' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: viewMode === 'table' ? 600 : 500,
                }}
              >
                <Table size={14} />
                <span>Matrix Table</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('markdown')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'markdown' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'markdown' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: viewMode === 'markdown' ? 600 : 500,
                }}
              >
                <FileText size={14} />
                <span>Markdown</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('latex')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '4px',
                  fontSize: '0.8rem',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewMode === 'latex' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'latex' ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: viewMode === 'latex' ? 600 : 500,
                }}
              >
                <FileCode size={14} />
                <span>LaTeX (Booktabs)</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => handleCopy(result.markdown_table, 'markdown')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {copiedType === 'markdown' ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                <span>{copiedType === 'markdown' ? 'Copied MD!' : 'Copy Markdown'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleCopy(result.latex_table, 'latex')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                {copiedType === 'latex' ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
                <span>{copiedType === 'latex' ? 'Copied LaTeX!' : 'Copy LaTeX'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCSV}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Download size={13} />
                <span>Download CSV</span>
              </button>
            </div>
          </div>

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="card" style={{ padding: '0.5rem', overflowX: 'auto', backgroundColor: 'var(--bg-card)' }}>
              <table className="comparison-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Strategy</th>
                    <th>Configuration</th>
                    <th style={{ textAlign: 'right' }}>Total Return</th>
                    <th style={{ textAlign: 'right' }}>CAGR</th>
                    <th style={{ textAlign: 'right' }}>Sharpe</th>
                    <th style={{ textAlign: 'right' }}>Sortino</th>
                    <th style={{ textAlign: 'right' }}>Max DD</th>
                    <th style={{ textAlign: 'right' }}>Calmar</th>
                    <th style={{ textAlign: 'right' }}>Win Rate</th>
                    <th style={{ textAlign: 'right' }}>Profit Factor</th>
                    <th style={{ textAlign: 'right' }}>Trades</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, idx) => {
                    const isBnh = row.strategy_name === 'Buy and Hold';
                    const isConf = row.strategy_name === 'Confluence Strategy';
                    return (
                      <tr
                        key={`${row.dataset}-${row.strategy_name}-${idx}`}
                        style={{
                          backgroundColor: isBnh
                            ? 'rgba(100, 116, 139, 0.05)'
                            : isConf
                              ? 'rgba(56, 189, 248, 0.06)'
                              : 'transparent',
                        }}
                      >
                        <td>
                          <strong>{row.symbol}</strong>
                        </td>
                        <td>
                          <span style={{ fontWeight: isConf ? 600 : 500, color: isConf ? 'var(--accent-primary)' : 'inherit' }}>
                            {row.strategy_name}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {row.configuration}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: row.total_return >= 0 ? 'var(--color-success, #10b981)' : 'var(--color-danger, #ef4444)' }}>
                          {(row.total_return * 100).toFixed(2)}%
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.cagr !== null ? `${(row.cagr * 100).toFixed(2)}%` : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {row.sharpe_ratio !== null ? row.sharpe_ratio.toFixed(2) : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.sortino_ratio !== null ? row.sortino_ratio.toFixed(2) : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--color-danger, #ef4444)' }}>
                          {(row.max_drawdown * 100).toFixed(2)}%
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.calmar_ratio !== null ? row.calmar_ratio.toFixed(2) : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.win_rate !== null ? `${(row.win_rate * 100).toFixed(1)}%` : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.profit_factor !== null ? row.profit_factor.toFixed(2) : 'N/A'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.total_trades}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Markdown View */}
          {viewMode === 'markdown' && (
            <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
              <pre
                style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  color: 'var(--text-primary)',
                }}
              >
                {result.markdown_table}
              </pre>
            </div>
          )}

          {/* LaTeX View */}
          {viewMode === 'latex' && (
            <div className="card" style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ marginBottom: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Requires <code>\usepackage&#123;booktabs&#125;</code> in your LaTeX preamble.
              </div>
              <pre
                style={{
                  margin: 0,
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono, monospace)',
                  overflowX: 'auto',
                  whiteSpace: 'pre',
                  color: 'var(--text-primary)',
                }}
              >
                {result.latex_table}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
