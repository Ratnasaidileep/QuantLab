import { useBacktest } from '../../hooks/useBacktest';
import { WalkForwardPanel } from '../../components/WalkForwardPanel';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { RefreshCw, Database, AlertTriangle } from 'lucide-react';

export function WalkForwardPage() {
  const { config, setConfig, datasets } = useBacktest();

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
            <RefreshCw size={22} style={{ color: 'var(--accent-primary)' }} />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Walk-Forward Optimization & Out-of-Sample Diagnostics
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Rolling and expanding window forward testing to measure Walk-Forward Efficiency (WFE) and systematically detect curve-fitting.
          </p>
        </div>

        {/* Dataset Switcher & Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
            <Database size={14} style={{ color: 'var(--text-tertiary)' }} />
            <label htmlFor="wf-dataset-select" style={{ color: 'var(--text-secondary)' }}>Dataset:</label>
            <select
              id="wf-dataset-select"
              value={config.dataset}
              onChange={(e) => setConfig((prev) => ({ ...prev, dataset: e.target.value }))}
              style={{
                padding: '0.3rem 0.6rem',
                fontSize: '0.8rem',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            >
              {datasets.map((d) => (
                <option key={d.filename} value={d.filename}>
                  {d.symbol} ({d.bars_count} bars)
                </option>
              ))}
              {datasets.length === 0 && (
                <option value="reliance_daily.csv">reliance_daily.csv (Default)</option>
              )}
            </select>
          </div>

          <Badge variant="warning">Diagnostic: Overfitting Defense</Badge>
        </div>
      </div>

      {/* Walk Forward Methodology Context Card */}
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
        <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Curve-Fitting Prevention: </strong>
          A strategy optimized over the entire dataset suffers from hindsight bias. Walk-Forward analysis trains parameters exclusively on past In-Sample (IS) data, and validates performance on subsequent Out-of-Sample (OOS) bars. A WFE ratio &gt; 50% indicates genuine edge.
        </div>
      </div>

      {/* Main Walk-Forward Workspace */}
      <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
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
