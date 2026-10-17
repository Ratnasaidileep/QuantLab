import { useBacktest } from '../../hooks/useBacktest';
import { ParameterHeatmap } from '../../components/ParameterHeatmap';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function HeatmapPage() {
  const { config } = useBacktest();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            2D Parameter Sensitivity & Plateau Heatmap
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Evaluate return topology across Fast vs. Slow moving average parameters to identify robust plateaus versus curve-fitted spikes.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant="neutral">Dataset: {config.dataset}</Badge>
          <Badge variant="info">Plateau Detection: Active</Badge>
        </div>
      </div>

      <Card style={{ padding: '0.5rem' }}>
        <ParameterHeatmap
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
