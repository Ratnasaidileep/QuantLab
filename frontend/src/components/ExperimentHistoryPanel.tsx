import { useEffect, useState, useMemo } from 'react';
import {
  Search,
  ArrowUpDown,
  Trash2,
  Play,
  Eye,
  X,
  Layers,
  Sparkles,
  CheckSquare,
  Square,
  FileText,
  RotateCcw,
} from 'lucide-react';
import { deleteExperiment, fetchExperimentById, fetchExperiments } from '../api/client';
import type {
  DatasetInfo,
  ExperimentDetailDTO,
  ExperimentSummaryDTO,
  UserDTO,
} from '../types';

interface ExperimentHistoryPanelProps {
  datasets: DatasetInfo[];
  onLoadExperiment: (experiment: ExperimentDetailDTO) => void;
  currentUser?: UserDTO | null;
}

type SortField = 'created_at' | 'total_return' | 'sharpe_ratio' | 'max_drawdown';
type SortDirection = 'asc' | 'desc';

const COMPARISON_COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#a855f7'];

export function ExperimentHistoryPanel({
  datasets,
  onLoadExperiment,
  currentUser,
}: ExperimentHistoryPanelProps) {
  const [experiments, setExperiments] = useState<ExperimentSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Inspection Modal State
  const [inspectId, setInspectId] = useState<number | null>(null);
  const [inspectDetail, setInspectDetail] = useState<ExperimentDetailDTO | null>(null);
  const [isInspectLoading, setIsInspectLoading] = useState<boolean>(false);

  // Multi-Selection Comparison State
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isComparingModalOpen, setIsComparingModalOpen] = useState<boolean>(false);
  const [comparedDetails, setComparedDetails] = useState<ExperimentDetailDTO[]>([]);
  const [isComparingLoading, setIsComparingLoading] = useState<boolean>(false);

  const [loadingId, setLoadingId] = useState<number | null>(null);

  const loadList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchExperiments(
        selectedDataset || undefined,
        selectedStrategy || undefined
      );
      setExperiments(res.experiments);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load experiments.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const res = await fetchExperiments(
          selectedDataset || undefined,
          selectedStrategy || undefined
        );
        if (!ignore) {
          setExperiments(res.experiments);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load experiments.';
          setError(msg);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      ignore = true;
    };
  }, [selectedDataset, selectedStrategy, currentUser]);

  const handleLoad = async (id: number) => {
    setLoadingId(id);
    try {
      const detail = await fetchExperimentById(id);
      onLoadExperiment(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load experiment detail.';
      setError(msg);
    } finally {
      setLoadingId(null);
    }
  };

  const handleInspect = async (id: number) => {
    setInspectId(id);
    setIsInspectLoading(true);
    try {
      const detail = await fetchExperimentById(id);
      setInspectDetail(detail);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load experiment details.';
      setError(msg);
      setInspectId(null);
    } finally {
      setIsInspectLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Are you sure you want to delete Experiment #${id}? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteExperiment(id);
      setExperiments((prev) => prev.filter((exp) => exp.id !== id));
      setSelectedIds((prev) => prev.filter((itemId) => itemId !== id));
      if (inspectId === id) {
        setInspectId(null);
        setInspectDetail(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete experiment.';
      setError(msg);
    }
  };

  // Toggle multi-select checkbox
  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((i) => i !== id);
      }
      if (prev.length >= 4) {
        alert('You can select a maximum of 4 experiments for simultaneous overlay comparison.');
        return prev;
      }
      return [...prev, id];
    });
  };

  // Open multi-comparison modal
  const handleOpenComparison = async () => {
    if (selectedIds.length < 2) return;
    setIsComparingLoading(true);
    setIsComparingModalOpen(true);
    try {
      const details = await Promise.all(selectedIds.map((id) => fetchExperimentById(id)));
      setComparedDetails(details);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load comparison experiments.';
      setError(msg);
      setIsComparingModalOpen(false);
    } finally {
      setIsComparingLoading(false);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  // Summary Metrics
  const repositoryStats = useMemo(() => {
    if (experiments.length === 0) return null;
    let profitable = 0;
    let bestReturn = experiments[0];
    let bestSharpe = experiments[0];

    experiments.forEach((exp) => {
      if (exp.total_pnl > 0) profitable++;
      if (exp.total_return > bestReturn.total_return) bestReturn = exp;
      if (
        (exp.sharpe_ratio ?? -Infinity) >
        (bestSharpe.sharpe_ratio ?? -Infinity)
      ) {
        bestSharpe = exp;
      }
    });

    return {
      total: experiments.length,
      profitable,
      winPct: ((profitable / experiments.length) * 100).toFixed(0),
      bestReturn,
      bestSharpe,
    };
  }, [experiments]);

  // Filtering & Sorting
  const filteredExperiments = useMemo(() => {
    let result = [...experiments];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (exp) =>
          exp.name.toLowerCase().includes(q) ||
          exp.dataset.toLowerCase().includes(q) ||
          exp.strategy.toLowerCase().includes(q) ||
          (exp.notes && exp.notes.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => {
      let valA: number | string = a[sortField] ?? -Infinity;
      let valB: number | string = b[sortField] ?? -Infinity;

      if (sortField === 'created_at') {
        valA = new Date(a.created_at).getTime();
        valB = new Date(b.created_at).getTime();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [experiments, searchQuery, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Header Strip */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Quantitative Experiment Archive
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background: currentUser ? 'rgba(56, 189, 248, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                color: currentUser ? 'var(--accent-primary)' : 'var(--text-secondary)',
                border: '1px solid currentColor',
                fontWeight: 600,
              }}
            >
              {currentUser ? `🔒 ${currentUser.username}'s Isolated Workspace` : '🌐 Guest Workspace (Global)'}
            </span>
          </div>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            Reproducible research repository backed by SQLite. Inspect parameters, overlay equity curves, and compare runs.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadList}
          disabled={isLoading}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
        >
          <RotateCcw size={14} />
          <span>Refresh Database</span>
        </button>
      </div>

      {/* Summary KPI Cards Strip */}
      {repositoryStats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.75rem',
          }}
        >
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Saved Runs</span>
            <strong className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              {repositoryStats.total}
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
              {repositoryStats.profitable} profitable ({repositoryStats.winPct}%)
            </span>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Highest Net Return</span>
            <strong className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--profit)' }}>
              {formatPercent(repositoryStats.bestReturn.total_return)}
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
              Exp #{repositoryStats.bestReturn.id} &bull; {repositoryStats.bestReturn.strategy}
            </span>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
            }}
          >
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Top Sharpe Ratio</span>
            <strong className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
              {repositoryStats.bestSharpe.sharpe_ratio !== null ? repositoryStats.bestSharpe.sharpe_ratio.toFixed(2) : 'N/A'}
            </strong>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
              Exp #{repositoryStats.bestSharpe.id} &bull; {repositoryStats.bestSharpe.name.slice(0, 18)}...
            </span>
          </div>
        </div>
      )}

      {/* Floating Action Strip for Multi-Select Comparison */}
      {selectedIds.length > 0 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.65rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            color: 'var(--text-primary)',
            fontSize: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
            <span>
              <strong>{selectedIds.length}</strong> experiment{selectedIds.length > 1 ? 's' : ''} selected
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedIds([])}
              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleOpenComparison}
              disabled={selectedIds.length < 2 || isComparingLoading}
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Sparkles size={14} />
              <span>Compare Selected ({selectedIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
          {/* Search Input */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)',
              }}
            />
            <input
              type="text"
              placeholder="Search experiments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.35rem 0.5rem 0.35rem 1.6rem',
                fontSize: '0.78rem',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {/* Dataset Dropdown */}
          <select
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.78rem',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All Datasets</option>
            {datasets.map((d) => (
              <option key={d.filename} value={d.filename}>
                {d.symbol} ({d.filename})
              </option>
            ))}
          </select>

          {/* Strategy Dropdown */}
          <select
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.78rem',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="">All Strategies</option>
            <option value="moving_average">Moving Average Crossover</option>
            <option value="rsi">Relative Strength Index (RSI)</option>
            <option value="bollinger">Bollinger Bands</option>
            <option value="macd">MACD</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--loss-bg)', color: 'var(--loss)', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      {/* Main Table */}
      {isLoading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner large" style={{ margin: '0 auto 1rem auto' }}></div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading experiments from repository...</p>
        </div>
      ) : filteredExperiments.length === 0 ? (
        <div
          style={{
            padding: '3rem 1.5rem',
            textAlign: 'center',
            backgroundColor: 'var(--bg-card)',
            borderRadius: '8px',
            border: '1px dashed var(--border-color)',
          }}
        >
          <FileText size={28} style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem' }} />
          <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>No experiments found</h4>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            Run a simulation in the Strategy Lab and click <strong>Save Experiment</strong> to archive your findings.
          </p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '35px' }}>
                  <span title="Select for multi-comparison">✓</span>
                </th>
                <th style={{ width: '45px' }}>#</th>
                <th
                  onClick={() => handleSort('created_at')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Date
                    <ArrowUpDown size={12} />
                  </span>
                </th>
                <th>Experiment Title & Research Notes</th>
                <th>Asset / Strategy</th>
                <th
                  onClick={() => handleSort('total_return')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Return
                    <ArrowUpDown size={12} />
                  </span>
                </th>
                <th>Net P&L</th>
                <th
                  onClick={() => handleSort('sharpe_ratio')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Sharpe
                    <ArrowUpDown size={12} />
                  </span>
                </th>
                <th
                  onClick={() => handleSort('max_drawdown')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    Max DD
                    <ArrowUpDown size={12} />
                  </span>
                </th>
                <th>Trades</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExperiments.map((exp) => {
                const isProfitable = exp.total_pnl >= 0;
                const isSelected = selectedIds.includes(exp.id);

                return (
                  <tr
                    key={exp.id}
                    style={isSelected ? { backgroundColor: 'rgba(56, 189, 248, 0.08)' } : undefined}
                  >
                    <td>
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(exp.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelected ? 'var(--accent-primary)' : 'var(--text-tertiary)', padding: 0 }}
                      >
                        {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    </td>
                    <td className="font-mono" style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                      #{exp.id}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      <div>{new Date(exp.created_at).toLocaleDateString()}</div>
                      <div style={{ color: 'var(--text-tertiary)', fontSize: '0.7rem' }}>
                        {new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                        {exp.name}
                      </div>
                      {exp.notes && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          📝 {exp.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>
                        <span className="meta-pill" style={{ marginRight: '0.35rem', fontSize: '0.7rem' }}>
                          {exp.dataset.replace('_daily.csv', '').toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{exp.strategy}</span>
                      </div>
                    </td>
                    <td
                      className="font-mono"
                      style={{
                        color: isProfitable ? 'var(--profit)' : 'var(--loss)',
                        fontWeight: 600,
                      }}
                    >
                      {formatPercent(exp.total_return)}
                    </td>
                    <td
                      className="font-mono"
                      style={{ color: isProfitable ? 'var(--profit)' : 'var(--loss)' }}
                    >
                      {isProfitable ? '+' : ''}
                      {formatCurrency(exp.total_pnl)}
                    </td>
                    <td className="font-mono">
                      {exp.sharpe_ratio !== null ? exp.sharpe_ratio.toFixed(2) : '—'}
                    </td>
                    <td className="font-mono" style={{ color: 'var(--loss)' }}>
                      {formatPercent(exp.max_drawdown)}
                    </td>
                    <td className="font-mono" style={{ fontSize: '0.78rem' }}>
                      {exp.total_trades}
                      {exp.win_rate !== null && (
                        <span style={{ color: 'var(--text-tertiary)', marginLeft: '0.25rem', fontSize: '0.7rem' }}>
                          ({(exp.win_rate * 100).toFixed(0)}%)
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleInspect(exp.id)}
                          title="Inspect complete parameter breakdown and charts"
                          style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem' }}
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleLoad(exp.id)}
                          disabled={loadingId === exp.id}
                          title="Load this run directly into Strategy Lab"
                          style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                        >
                          {loadingId === exp.id ? <span className="spinner"></span> : <Play size={12} />}
                          <span>Restore</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDelete(exp.id)}
                          title="Delete from SQLite database"
                          style={{ color: 'var(--loss)', padding: '0.25rem 0.45rem', fontSize: '0.75rem' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ================= MODAL 1: EXPERIMENT INSPECTION DRAWER ================= */}
      {inspectId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '750px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            {isInspectLoading || !inspectDetail ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner large" style={{ margin: '0 auto 1rem auto' }}></div>
                <p>Loading experiment #{inspectId} details...</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                      {inspectDetail.name}
                    </h3>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      Exp #{inspectDetail.id} &bull; {new Date(inspectDetail.created_at).toLocaleString()} &bull; Dataset: {inspectDetail.dataset}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setInspectId(null);
                      setInspectDetail(null);
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.25rem' }}
                  >
                    <X size={20} />
                  </button>
                </div>

                {inspectDetail.notes && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border-color)',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <strong>Research Notes: </strong>
                    {inspectDetail.notes}
                  </div>
                )}

                {/* Scorecard */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    backgroundColor: 'var(--bg-elevated)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Net Return</span>
                    <strong className="font-mono" style={{ color: inspectDetail.total_return >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                      {formatPercent(inspectDetail.total_return)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Final Equity</span>
                    <strong className="font-mono">{formatCurrency(inspectDetail.final_equity)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Sharpe Ratio</span>
                    <strong className="font-mono">{inspectDetail.sharpe_ratio?.toFixed(2) ?? 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Max Drawdown</span>
                    <strong className="font-mono" style={{ color: 'var(--loss)' }}>{formatPercent(inspectDetail.max_drawdown)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Win Rate</span>
                    <strong className="font-mono">{inspectDetail.win_rate !== null ? `${(inspectDetail.win_rate * 100).toFixed(1)}%` : 'N/A'}</strong>
                  </div>
                </div>

                {/* Parameter Details */}
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    Strategy Parameters & Execution Frictions
                  </h4>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                      gap: '0.5rem',
                      fontSize: '0.78rem',
                    }}
                  >
                    {Object.entries(inspectDetail.parameters).map(([k, v]) => (
                      <div key={k} style={{ padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '4px' }}>
                        <span style={{ color: 'var(--text-tertiary)' }}>{k}: </span>
                        <strong className="font-mono">{String(v)}</strong>
                      </div>
                    ))}
                    <div style={{ padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Commission: </span>
                      <strong className="font-mono">{(inspectDetail.commission_rate * 10000).toFixed(0)} bps</strong>
                    </div>
                    <div style={{ padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Slippage: </span>
                      <strong className="font-mono">{(inspectDetail.slippage_rate * 10000).toFixed(0)} bps</strong>
                    </div>
                    <div style={{ padding: '0.4rem 0.6rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '4px' }}>
                      <span style={{ color: 'var(--text-tertiary)' }}>Sizing: </span>
                      <strong className="font-mono">{inspectDetail.sizing_mode}</strong>
                    </div>
                  </div>
                </div>

                {/* Modal Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setInspectId(null);
                      setInspectDetail(null);
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      onLoadExperiment(inspectDetail);
                      setInspectId(null);
                      setInspectDetail(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Play size={14} />
                    <span>Restore into Strategy Lab</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= MODAL 2: MULTI-EXPERIMENT COMPARISON ================= */}
      {isComparingModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '850px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
                  Multi-Experiment Side-by-Side Comparison
                </h3>
                <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Comparing {comparedDetails.length} runs across returns, risk, and parameter differences.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsComparingModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            {isComparingLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <div className="spinner large" style={{ margin: '0 auto 1rem auto' }}></div>
                <p>Loading experiments for comparison...</p>
              </div>
            ) : (
              <>
                {/* Side-by-Side Metrics Table */}
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Metric</th>
                        {comparedDetails.map((exp, idx) => (
                          <th key={exp.id} style={{ color: COMPARISON_COLORS[idx % COMPARISON_COLORS.length] }}>
                            #{exp.id} &bull; {exp.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Dataset</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id} className="font-mono">{exp.dataset}</td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Strategy</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id} className="font-mono">{exp.strategy}</td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Total Net Return</strong></td>
                        {comparedDetails.map((exp) => (
                          <td
                            key={exp.id}
                            className="font-mono"
                            style={{ color: exp.total_return >= 0 ? 'var(--profit)' : 'var(--loss)', fontWeight: 700 }}
                          >
                            {formatPercent(exp.total_return)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Final Equity</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id} className="font-mono">{formatCurrency(exp.final_equity)}</td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Sharpe Ratio (252d)</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id} className="font-mono">{exp.sharpe_ratio?.toFixed(2) ?? 'N/A'}</td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Max Drawdown</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id} className="font-mono" style={{ color: 'var(--loss)' }}>
                            {formatPercent(exp.max_drawdown)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Win Rate</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id} className="font-mono">
                            {exp.win_rate !== null ? `${(exp.win_rate * 100).toFixed(1)}%` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Total Trades</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id} className="font-mono">{exp.total_trades}</td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Profit Factor</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id} className="font-mono">
                            {exp.profit_factor !== null
                              ? Number.isFinite(exp.profit_factor)
                                ? exp.profit_factor.toFixed(2)
                                : '∞'
                              : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td><strong>Action</strong></td>
                        {comparedDetails.map((exp) => (
                          <td key={exp.id}>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                onLoadExperiment(exp);
                                setIsComparingModalOpen(false);
                              }}
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                            >
                              Restore
                            </button>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsComparingModalOpen(false)}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
