import { useNavigate } from 'react-router-dom';
import { useBacktest } from '../../hooks/useBacktest';
import { useAuth } from '../../hooks/useAuth';
import { ExperimentHistoryPanel } from '../../components/ExperimentHistoryPanel';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { ExperimentDetailDTO } from '../../types';

export function ExperimentsPage() {
  const navigate = useNavigate();
  const { datasets, loadExperiment } = useBacktest();
  const { currentUser } = useAuth();

  const handleLoadAndNavigate = (exp: ExperimentDetailDTO) => {
    loadExperiment(exp);
    navigate('/strategy-lab');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Saved Research Experiments
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Persistent SQLite backtest archive with full trade logs, equity curves, parameter sets, and user workspace isolation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {currentUser ? (
            <Badge variant="primary">Workspace: {currentUser.username}</Badge>
          ) : (
            <Badge variant="neutral">Workspace: Guest (Global)</Badge>
          )}
          <Badge variant="info">Storage: SQLite 3</Badge>
        </div>
      </div>

      <Card style={{ padding: '0.5rem' }}>
        <ExperimentHistoryPanel
          datasets={datasets}
          onLoadExperiment={handleLoadAndNavigate}
          currentUser={currentUser}
        />
      </Card>
    </div>
  );
}
