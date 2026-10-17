import { useBacktest } from '../../hooks/useBacktest';
import { WalkForwardPanel } from '../../components/WalkForwardPanel';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function WalkForwardPage() {
  const { config } = useBacktest();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Walk-Forward Optimization & Out-of-Sample Diagnostics
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Rolling & expanding window forward testing to measure Walk-Forward Efficiency (WFE) and evaluate overfitting.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant="neutral">Dataset: {config.dataset}</Badge>
          <Badge variant="warning">Methodology: In-Sample vs OOS</Badge>
        </div>
      </div>

      <Card style={{ padding: '0.5rem' }}>
        <WalkForwardPanel
          dataset={config.dataset}
          initialCash={config.initial_cash}
          commissionRate={config.commission_rate}
          slippageRate={config.slippage_rate}
          sizingMode={config.sizing_mode}
          quantityPerTrade={config.quantity_per_trade}
        />
      </Card>
    </div>
  );
}
