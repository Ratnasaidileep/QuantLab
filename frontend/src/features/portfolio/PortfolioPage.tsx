import { useBacktest } from '../../hooks/useBacktest';
import { BasketPanel } from '../../components/BasketPanel';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Briefcase, Sparkles } from 'lucide-react';

export function PortfolioPage() {
  const { datasets, config, refreshDatasets } = useBacktest();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Title & Toolbar */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={22} style={{ color: 'var(--accent-primary)' }} />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Multi-Asset Portfolio Basket Backtest
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Simulate multi-symbol portfolios with equal-weight, inverse-volatility, or custom weights and periodic rebalancing.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Badge variant="neutral">Available Assets: {datasets.length}</Badge>
          <Badge variant="info">Mark-to-Market: Daily Close</Badge>
          <Badge variant="success">Friction-Adjusted</Badge>
        </div>
      </div>

      {/* Modern Portfolio Theory Context Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.4',
        }}
      >
        <Sparkles size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Diversification Principle: </strong>
          Combining low-correlation assets reduces portfolio variance without sacrificing expected return. QuantLab computes full pairwise Pearson correlation matrices and models cash drag during scheduled monthly or quarterly rebalancing.
        </div>
      </div>

      {/* Main Basket Workspace */}
      <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
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
