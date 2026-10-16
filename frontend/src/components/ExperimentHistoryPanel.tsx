import { useEffect, useState } from 'react';
import { deleteExperiment, fetchExperimentById, fetchExperiments } from '../api/client';
import type { DatasetInfo, ExperimentDetailDTO, ExperimentSummaryDTO, UserDTO } from '../types';

interface ExperimentHistoryPanelProps {
  datasets: DatasetInfo[];
  onLoadExperiment: (experiment: ExperimentDetailDTO) => void;
  currentUser?: UserDTO | null;
}

export function ExperimentHistoryPanel({
  datasets,
  onLoadExperiment,
  currentUser,
}: ExperimentHistoryPanelProps) {
  const [experiments, setExperiments] = useState<ExperimentSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDataset, setSelectedDataset] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const loadList = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchExperiments(
        selectedDataset || undefined,
        selectedStrategy || undefined,
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
          selectedStrategy || undefined,
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

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Are you sure you want to delete Experiment #${id}?`)) {
      return;
    }
    try {
      await deleteExperiment(id);
      setExperiments((prev) => prev.filter((exp) => exp.id !== id));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete experiment.';
      setError(msg);
    }
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);

  const formatPercent = (val: number) => `${(val * 100).toFixed(2)}%`;

  return (
    <div className="analytics-card">
      <div className="analytics-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <h3>Saved Research Experiments & Run History</h3>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '4px',
                background: currentUser ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                color: currentUser ? 'var(--color-primary, #60a5fa)' : 'var(--text-secondary, #94a3b8)',
                border: '1px solid currentColor',
                fontWeight: 600,
              }}
            >
              {currentUser ? `🔒 Workspace: ${currentUser.username}` : '🌐 Guest Workspace'}
            </span>
          </div>
          <p className="analytics-subtitle">
            Permanent local database of historical simulations, parameters, and trade logs for reproducible research.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={loadList}
          disabled={isLoading}
        >
          {isLoading ? <span className="spinner"></span> : '🔄 Refresh'}
        </button>
      </div>

      {/* Filter Row */}
      <div className="analytics-controls" style={{ marginBottom: '1.25rem' }}>
        <div className="control-field">
          <label htmlFor="filter-dataset">Filter Asset</label>
          <select
            id="filter-dataset"
            value={selectedDataset}
            onChange={(e) => setSelectedDataset(e.target.value)}
          >
            <option value="">All Datasets</option>
            {datasets.map((d) => (
              <option key={d.filename} value={d.filename}>
                {d.symbol} ({d.filename})
              </option>
            ))}
          </select>
        </div>

        <div className="control-field">
          <label htmlFor="filter-strategy">Filter Strategy</label>
          <select
            id="filter-strategy"
            value={selectedStrategy}
            onChange={(e) => setSelectedStrategy(e.target.value)}
          >
            <option value="">All Strategies</option>
            <option value="moving_average">Moving Average Crossover</option>
            <option value="rsi">Relative Strength Index (RSI)</option>
            <option value="bollinger">Bollinger Bands</option>
          </select>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {isLoading ? (
        <div className="loading-state">
          <span className="spinner"></span>
          <p>Loading experiments from database...</p>
        </div>
      ) : experiments.length === 0 ? (
        <div className="empty-state">
          <p>No saved experiments found.</p>
          <span className="empty-state-hint">
            Run a backtest in the <strong>Simulation</strong> tab and click <strong>💾 Save Experiment</strong> to record your simulation.
          </span>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Date</th>
                <th>Experiment Name & Notes</th>
                <th>Asset / Strategy</th>
                <th>Return</th>
                <th>P&L</th>
                <th>Sharpe</th>
                <th>Max DD</th>
                <th>Trades</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {experiments.map((exp) => {
                const isProfitable = exp.total_pnl >= 0;
                return (
                  <tr key={exp.id}>
                    <td>
                      <span className="badge-window">#{exp.id}</span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {new Date(exp.created_at).toLocaleDateString()}
                      <br />
                      {new Date(exp.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <strong>{exp.name}</strong>
                      {exp.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                          📝 {exp.notes}
                        </div>
                      )}
                    </td>
                    <td>
                      <div>
                        <span className="badge-dataset" style={{ marginRight: '0.35rem' }}>
                          {exp.dataset.replace('_daily.csv', '').toUpperCase()}
                        </span>
                        <span style={{ fontSize: '0.85rem' }}>{exp.strategy}</span>
                      </div>
                    </td>
                    <td className={isProfitable ? 'metric-positive' : 'metric-negative'}>
                      <strong>{formatPercent(exp.total_return)}</strong>
                    </td>
                    <td className={isProfitable ? 'metric-positive' : 'metric-negative'}>
                      {formatCurrency(exp.total_pnl)}
                    </td>
                    <td>
                      {exp.sharpe_ratio !== null ? exp.sharpe_ratio.toFixed(2) : '—'}
                    </td>
                    <td>{formatPercent(exp.max_drawdown)}</td>
                    <td>
                      {exp.total_trades}
                      {exp.win_rate !== null && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.25rem' }}>
                          ({(exp.win_rate * 100).toFixed(0)}% win)
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleLoad(exp.id)}
                          disabled={loadingId === exp.id}
                          title="Load this experiment into the dashboard"
                        >
                          {loadingId === exp.id ? <span className="spinner"></span> : '▶ Load'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          onClick={() => handleDelete(exp.id)}
                          title="Delete from database"
                        >
                          🗑️
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
    </div>
  );
}
