import { useBacktest } from '../../hooks/useBacktest';
import { TearSheetPanel } from '../../components/TearSheetPanel';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function AnalyticsPage() {
  const { config } = useBacktest();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Risk Tear-Sheet & Tail Risk Analytics
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Parametric & Historical VaR, Conditional VaR (Expected Shortfall), Skewness, Kurtosis, and monthly return matrices.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant="neutral">Active Dataset: {config.dataset}</Badge>
          <Badge variant="info">Strategy: {config.strategy}</Badge>
        </div>
      </div>

      <Card style={{ padding: '0.5rem' }}>
        <TearSheetPanel
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
