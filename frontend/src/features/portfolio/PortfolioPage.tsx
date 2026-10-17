import { useBacktest } from '../../hooks/useBacktest';
import { BasketPanel } from '../../components/BasketPanel';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function PortfolioPage() {
  const { datasets, config, refreshDatasets } = useBacktest();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Multi-Asset Portfolio Basket Backtest
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Equal-weight, inverse-volatility, or custom weights with periodic monthly/quarterly rebalancing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant="neutral">Available Tickers: {datasets.length}</Badge>
          <Badge variant="info">Mark-to-Market: Daily</Badge>
        </div>
      </div>

      <Card style={{ padding: '0.5rem' }}>
        <BasketPanel
          datasets={datasets}
          defaultInitialCash={config.initial_cash}
          defaultCommissionRate={config.commission_rate}
          defaultSlippageRate={config.slippage_rate}
          onRefreshDatasets={refreshDatasets}
        />
      </Card>
    </div>
  );
}
