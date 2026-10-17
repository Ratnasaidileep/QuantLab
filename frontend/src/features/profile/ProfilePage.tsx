import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  LogOut,
  Layers,
  Play,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useBacktest } from '../../hooks/useBacktest';
import { fetchExperiments, fetchExperimentById, deleteExperiment } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { ExperimentSummaryDTO } from '../../types';

export function ProfilePage() {
  const { currentUser, isAuthenticated, logout } = useAuth();
  const { loadExperiment } = useBacktest();
  const navigate = useNavigate();

  const [experiments, setExperiments] = useState<ExperimentSummaryDTO[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchExperiments();
      setExperiments(res.experiments);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load research history.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const loadData = async () => {
      try {
        const res = await fetchExperiments();
        if (!ignore) {
          setExperiments(res.experiments);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const msg = err instanceof Error ? err.message : 'Failed to load research history.';
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
  }, [currentUser]);

  const handleRestore = async (id: number) => {
    setLoadingId(id);
    try {
      const detail = await fetchExperimentById(id);
      loadExperiment(detail);
      navigate('/strategy-lab');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restore experiment.';
      setError(msg);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(`Delete Experiment #${id} from your research history?`)) return;
    try {
      await deleteExperiment(id);
      setExperiments((prev) => prev.filter((e) => e.id !== id));
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

  // Summary statistics
  const stats = useMemo(() => {
    if (experiments.length === 0) return null;
    let profitable = 0;
    let bestReturn = experiments[0];
    let bestSharpe = experiments[0];

    experiments.forEach((exp) => {
      if (exp.total_pnl > 0) profitable++;
      if (exp.total_return > bestReturn.total_return) bestReturn = exp;
      if ((exp.sharpe_ratio ?? -Infinity) > (bestSharpe.sharpe_ratio ?? -Infinity)) {
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

  const userInitial = currentUser?.username
    ? currentUser.username.charAt(0).toUpperCase()
    : 'U';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            User Profile & Research Workspace
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Account security credentials, active session status, and personal backtest research history.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {isAuthenticated && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleRefresh}
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem' }}
            >
              <RotateCcw size={13} />
              <span>Refresh History</span>
            </button>
          )}
        </div>
      </div>

      {/* Account Identity Card */}
      {isAuthenticated && currentUser ? (
        <Card style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              {/* Glowing Avatar */}
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#090d16',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  boxShadow: '0 0 16px rgba(56, 189, 248, 0.35)',
                }}
              >
                {userInitial}
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentUser.username}
                  </h2>
                  <Badge variant="primary" size="sm">Active Account</Badge>
                  <Badge variant="success" size="sm">SQLite Isolated</Badge>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  User ID: <span className="font-mono">#{currentUser.id}</span> &bull; Member Since: {new Date(currentUser.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={logout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  color: 'var(--loss)',
                  borderColor: 'var(--loss-border)',
                  fontSize: '0.8rem',
                }}
              >
                <LogOut size={14} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Card style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', textAlign: 'center', padding: '2.5rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              margin: '0 auto 1rem auto',
            }}
          >
            <User size={24} />
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>Guest Workspace</h3>
          <p style={{ margin: '0 0 1.25rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem', maxWidth: '480px', marginInline: 'auto' }}>
            You are currently operating in Guest Mode. Experiments you save are stored in the global shared database. Sign in or register to claim your personal, private research workspace.
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary" style={{ textDecoration: 'none' }}>
              Sign In to Account
            </Link>
            <Link to="/register" className="btn btn-secondary" style={{ textDecoration: 'none' }}>
              Register Free
            </Link>
          </div>
        </Card>
      )}

      {/* User's Research History Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Personal Research & Experiment History
            </h3>
            <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Historical simulations saved under your account in SQLite repository.
            </p>
          </div>
        </div>

        {/* Stats Strip */}
        {stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Total Runs Saved</span>
              <strong className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>{stats.total}</strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                {stats.profitable} profitable ({stats.winPct}%)
              </span>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Best Net Return</span>
              <strong className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--profit)' }}>
                {formatPercent(stats.bestReturn.total_return)}
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                Exp #{stats.bestReturn.id} &bull; {stats.bestReturn.strategy}
              </span>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', display: 'block' }}>Top Sharpe Ratio</span>
              <strong className="font-mono" style={{ fontSize: '1.1rem', color: 'var(--accent-primary)' }}>
                {stats.bestSharpe.sharpe_ratio !== null ? stats.bestSharpe.sharpe_ratio.toFixed(2) : 'N/A'}
              </strong>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.2rem' }}>
                Exp #{stats.bestSharpe.id}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--loss-bg)', color: 'var(--loss)', fontSize: '0.8rem', marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* History Table */}
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner large" style={{ margin: '0 auto 1rem auto' }}></div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading user history...</p>
          </div>
        ) : experiments.length === 0 ? (
          <div
            style={{
              padding: '2.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px dashed var(--border-color)',
            }}
          >
            <Layers size={28} style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem' }} />
            <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>No experiments in your history</h4>
            <p style={{ margin: '0 0 1rem 0', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              Run simulations in the Strategy Lab and click "Save Experiment" to record your hypotheses.
            </p>
            <Link to="/strategy-lab" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
              Open Strategy Lab
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '45px' }}>#</th>
                  <th>Date</th>
                  <th>Experiment Title & Notes</th>
                  <th>Asset / Strategy</th>
                  <th>Total Return</th>
                  <th>Total Net P&L</th>
                  <th>Sharpe</th>
                  <th>Max DD</th>
                  <th>Trades</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => {
                  const isProfitable = exp.total_pnl >= 0;
                  return (
                    <tr key={exp.id}>
                      <td className="font-mono" style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                        #{exp.id}
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {new Date(exp.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.82rem' }}>
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
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{exp.strategy}</span>
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
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handleRestore(exp.id)}
                            disabled={loadingId === exp.id}
                            title="Restore into Strategy Lab"
                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                          >
                            {loadingId === exp.id ? <span className="spinner"></span> : <Play size={11} />}
                            <span>Restore</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDelete(exp.id)}
                            title="Delete from SQLite database"
                            style={{ color: 'var(--loss)', padding: '0.2rem 0.4rem', fontSize: '0.72rem' }}
                          >
                            <Trash2 size={12} />
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
    </div>
  );
}
