import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Database,
  ArrowRight,
  TrendingUp,
  History,
  Layers,
  CheckCircle2,
  Circle,
  X,
  HelpCircle,
} from 'lucide-react';
import { useBacktest } from '../../hooks/useBacktest';
import { useAuth } from '../../hooks/useAuth';
import { fetchExperiments } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { ExperimentSummaryDTO } from '../../types';

const ONBOARDING_DISMISS_KEY = 'quantlab_dismiss_onboarding';

export function DashboardPage() {
  const navigate = useNavigate();
  const { datasets, backtestResult } = useBacktest();
  const { currentUser } = useAuth();

  const [experiments, setExperiments] = useState<ExperimentSummaryDTO[]>([]);
  const [totalExperiments, setTotalExperiments] = useState<number>(0);
  const [isLoadingExps, setIsLoadingExps] = useState<boolean>(true);
  const [isOnboardingDismissed, setIsOnboardingDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ONBOARDING_DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    async function fetchRecentExps() {
      try {
        const resp = await fetchExperiments();
        setExperiments(resp.experiments.slice(0, 5));
        setTotalExperiments(resp.total);
      } catch {
        // Handled silently
      } finally {
        setIsLoadingExps(false);
      }
    }
    fetchRecentExps();
  }, []);

  const handleDismissOnboarding = () => {
    setIsOnboardingDismissed(true);
    try {
      localStorage.setItem(ONBOARDING_DISMISS_KEY, 'true');
    } catch {
      // Ignored
    }
  };

  const handleReopenOnboarding = () => {
    setIsOnboardingDismissed(false);
    try {
      localStorage.removeItem(ONBOARDING_DISMISS_KEY);
    } catch {
      // Ignored
    }
  };

  const hasDatasets = datasets.length > 0;
  const hasRunBacktest = backtestResult !== null;
  const hasSavedExperiment = totalExperiments > 0;
  const completedStepsCount =
    (hasDatasets ? 1 : 0) +
    1 + // Step 2 (configured strategy ready by default)
    (hasRunBacktest ? 1 : 0) +
    (hasSavedExperiment ? 1 : 0);

  const greeting = currentUser
    ? `Welcome back, ${currentUser.username}`
    : 'Welcome to QuantLab Quantitative Terminal';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Hero Welcome Banner */}
      <Card
        glass
        style={{
          background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
          border: '1px solid var(--border-medium)',
          padding: '2rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Badge variant="primary">Institutional Algorithmic Research</Badge>
              {isOnboardingDismissed && (
                <button
                  type="button"
                  onClick={handleReopenOnboarding}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                  }}
                  title="Reopen quantitative research onboarding checklist"
                >
                  <HelpCircle size={13} />
                  <span>Onboarding Guide</span>
                </button>
              )}
            </div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' }}>
              {greeting}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0, maxWidth: '650px' }}>
              High-precision simulation engine with next-bar execution, zero look-ahead bias,
              intraday risk controls, and tail-risk analytics.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              size="lg"
              icon={<FlaskConical size={18} />}
              onClick={() => navigate('/strategy-lab')}
            >
              Launch Strategy Lab
            </Button>
            <Button
              variant="secondary"
              size="lg"
              icon={<Database size={18} />}
              onClick={() => navigate('/datasets')}
            >
              Manage Datasets
            </Button>
          </div>
        </div>
      </Card>

      {/* Optional Dismissible Onboarding Checklist */}
      {!isOnboardingDismissed && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span>Research Getting Started Checklist</span>
              <Badge variant={completedStepsCount === 4 ? 'success' : 'primary'} size="sm">
                {completedStepsCount} of 4 Complete
              </Badge>
            </div>
          }
          subtitle="Follow these essential steps to execute institutional-grade algorithmic research"
          action={
            <button
              type="button"
              onClick={handleDismissOnboarding}
              style={{
                color: 'var(--text-muted)',
                padding: '0.3rem',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Dismiss checklist"
              aria-label="Dismiss checklist"
            >
              <X size={18} />
            </button>
          }
          style={{ backgroundColor: 'var(--bg-card-subtle)', border: '1px solid var(--border-medium)' }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1rem',
              marginTop: '0.5rem',
            }}
          >
            {/* Step 1 */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-elevated)',
                border: `1px solid ${hasDatasets ? 'var(--profit-border)' : 'var(--border-subtle)'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  {hasDatasets ? (
                    <CheckCircle2 size={18} style={{ color: 'var(--profit)' }} />
                  ) : (
                    <Circle size={18} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    1. Choose Market Dataset
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {hasDatasets
                    ? `${datasets.length} historical dataset(s) loaded and validated in data/ folder.`
                    : 'Download tickers from Yahoo Finance or upload custom OHLCV CSV archives.'}
                </p>
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/datasets')}
                  style={{ width: '100%' }}
                >
                  {hasDatasets ? 'Browse Datasets' : 'Upload or Fetch Data'}
                </Button>
              </div>
            </div>

            {/* Step 2 */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--profit-border)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  <CheckCircle2 size={18} style={{ color: 'var(--profit)' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    2. Select Strategy
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Moving Average, RSI, Bollinger Bands, or MACD with conservative friction & sizing controls.
                </p>
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/strategy-lab')}
                  style={{ width: '100%' }}
                >
                  Configure Parameters
                </Button>
              </div>
            </div>

            {/* Step 3 */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-elevated)',
                border: `1px solid ${hasRunBacktest ? 'var(--profit-border)' : 'var(--border-subtle)'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  {hasRunBacktest ? (
                    <CheckCircle2 size={18} style={{ color: 'var(--profit)' }} />
                  ) : (
                    <Circle size={18} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    3. Simulate & Verify
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {hasRunBacktest
                    ? 'Active simulation verified: next-bar open execution with trailing stop.'
                    : 'Execute your backtest to inspect trades, equity curve, and Buy & Hold comparison.'}
                </p>
              </div>
              <div>
                <Button
                  variant={hasRunBacktest ? 'outline' : 'primary'}
                  size="sm"
                  onClick={() => navigate('/strategy-lab')}
                  style={{ width: '100%' }}
                >
                  {hasRunBacktest ? 'View Results' : 'Run Backtest'}
                </Button>
              </div>
            </div>

            {/* Step 4 */}
            <div
              style={{
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-elevated)',
                border: `1px solid ${hasSavedExperiment ? 'var(--profit-border)' : 'var(--border-subtle)'}`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                  {hasSavedExperiment ? (
                    <CheckCircle2 size={18} style={{ color: 'var(--profit)' }} />
                  ) : (
                    <Circle size={18} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    4. Evaluate Risk & Log
                  </span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0 }}>
                  {hasSavedExperiment
                    ? `${totalExperiments} experiment(s) logged in your SQLite research database.`
                    : 'Inspect tail risk in the Tear-Sheet and save runs with research notes.'}
                </p>
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(hasSavedExperiment ? '/experiments' : '/analytics')}
                  style={{ width: '100%' }}
                >
                  {hasSavedExperiment ? 'Browse Archive' : 'Open Tear-Sheet'}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Key Stats Overview Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
        }}
      >
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
              Market Datasets
            </span>
            <div style={{ color: 'var(--brand-blue)', padding: '0.4rem', borderRadius: '6px', background: 'var(--brand-glow)' }}>
              <Database size={18} />
            </div>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {datasets.length}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>available locally</span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
              Saved Experiments
            </span>
            <div style={{ color: 'var(--accent-cyan)', padding: '0.4rem', borderRadius: '6px', background: 'var(--benchmark-bg)' }}>
              <History size={18} />
            </div>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {isLoadingExps ? '—' : totalExperiments}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>in SQLite repository</span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
              Active Strategy Engine
            </span>
            <div style={{ color: 'var(--profit)', padding: '0.4rem', borderRadius: '6px', background: 'var(--profit-bg)' }}>
              <Layers size={18} />
            </div>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              4
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MA, RSI, BB, MACD</span>
          </div>
        </Card>

        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 500 }}>
              Last Simulation
            </span>
            <div style={{ color: 'var(--warning)', padding: '0.4rem', borderRadius: '6px', background: 'var(--warning-bg)' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ marginTop: '0.5rem' }}>
            {backtestResult ? (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                <span
                  style={{
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: backtestResult.metrics.total_return >= 0 ? 'var(--profit)' : 'var(--loss)',
                  }}
                  className="tabular-nums"
                >
                  {(backtestResult.metrics.total_return * 100).toFixed(2)}%
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ({backtestResult.strategy_name})
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                No simulation run yet
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Launch & Research Modules Grid */}
      <div>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>
          Research Modules
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1rem',
          }}
        >
          <Card
            title="Strategy Lab"
            badge={<Badge variant="primary" size="sm">Core</Badge>}
            subtitle="Simulate technical strategies with next-bar execution, Stop-Loss, and trailing stops."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowRight size={15} />}
                onClick={() => navigate('/strategy-lab')}
              >
                Open
              </Button>
            }
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Supports Moving Average Crossover, RSI Mean Reversion, Bollinger Bands, and MACD.
              Benchmark against Buy-and-Hold with configurable friction.
            </div>
          </Card>

          <Card
            title="Risk Tear-Sheet"
            badge={<Badge variant="info" size="sm">Risk</Badge>}
            subtitle="Deep statistical tail risk: VaR 95/99, Expected Shortfall (CVaR), and skewness."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowRight size={15} />}
                onClick={() => navigate('/analytics')}
              >
                Open
              </Button>
            }
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Examine institutional drawdown profiles, underwater curves, and a full 12-month
              historical return matrix.
            </div>
          </Card>

          <Card
            title="Portfolio Basket"
            badge={<Badge variant="neutral" size="sm">Multi-Asset</Badge>}
            subtitle="Simulate diversified multi-ticker baskets with periodic rebalancing."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowRight size={15} />}
                onClick={() => navigate('/portfolio')}
              >
                Open
              </Button>
            }
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Equal-weight, inverse-volatility, or custom weights. Rebalance monthly or quarterly
              to track mark-to-market performance.
            </div>
          </Card>

          <Card
            title="Walk-Forward (OOS)"
            badge={<Badge variant="warning" size="sm">Overfitting</Badge>}
            subtitle="Rolling and expanding forward testing to diagnose curve-fitting."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowRight size={15} />}
                onClick={() => navigate('/walk-forward')}
              >
                Open
              </Button>
            }
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Optimizes parameters in-sample and executes out-of-sample forward tests to compute
              Walk-Forward Efficiency and Robustness Grades.
            </div>
          </Card>

          <Card
            title="Parameter Heatmap"
            badge={<Badge variant="neutral" size="sm">2D Surface</Badge>}
            subtitle="Evaluate 2D parameter stability and detect fragile sharp peaks."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowRight size={15} />}
                onClick={() => navigate('/heatmap')}
              >
                Open
              </Button>
            }
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Visualizes Fast vs. Slow moving average parameters across a color-coded matrix with
              automated plateau ratio detection.
            </div>
          </Card>

          <Card
            title="Saved Experiments"
            badge={<Badge variant="neutral" size="sm">Repository</Badge>}
            subtitle="Access logged simulations with parameters, trades, and equity curves."
            action={
              <Button
                variant="ghost"
                size="sm"
                icon={<ArrowRight size={15} />}
                onClick={() => navigate('/experiments')}
              >
                Open
              </Button>
            }
          >
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {totalExperiments > 0
                ? `${totalExperiments} experiment${totalExperiments > 1 ? 's' : ''} stored. One-click reload back into Strategy Lab.`
                : 'No experiments saved yet. Run a backtest in Strategy Lab and save it to review here.'}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Experiments Preview Table */}
      {experiments.length > 0 && (
        <Card
          title="Recent Experiments"
          subtitle="Latest research runs logged to your SQLite repository"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/experiments')}
            >
              View All ({totalExperiments})
            </Button>
          }
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Title</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Dataset</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Strategy</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Return</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Max DD</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Sharpe</th>
                  <th style={{ padding: '0.65rem 0.5rem' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {experiments.map((exp) => (
                  <tr
                    key={exp.id}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                  >
                    <td style={{ padding: '0.65rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {exp.name}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-secondary)' }}>
                      {exp.dataset}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem' }}>
                      <Badge size="sm">{exp.strategy}</Badge>
                    </td>
                    <td
                      style={{
                        padding: '0.65rem 0.5rem',
                        fontWeight: 600,
                        color: exp.total_return >= 0 ? 'var(--profit)' : 'var(--loss)',
                      }}
                      className="tabular-nums"
                    >
                      {(exp.total_return * 100).toFixed(2)}%
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--loss)' }} className="tabular-nums">
                      {(exp.max_drawdown * 100).toFixed(2)}%
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-primary)' }} className="tabular-nums">
                      {exp.sharpe_ratio !== null ? exp.sharpe_ratio.toFixed(2) : 'N/A'}
                    </td>
                    <td style={{ padding: '0.65rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {new Date(exp.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
