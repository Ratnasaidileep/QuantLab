import { useBacktest } from '../../hooks/useBacktest';
import { ParameterHeatmap } from '../../components/ParameterHeatmap';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Grid, Database, Eye } from 'lucide-react';

export function HeatmapPage() {
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
            <Grid size={22} style={{ color: 'var(--accent-primary)' }} />
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              2D Parameter Sensitivity & Plateau Heatmap
            </h1>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Evaluate return topology across Fast vs. Slow moving average parameters to identify robust plateaus versus curve-fitted spikes.
          </p>
        </div>

        {/* Dataset Switcher & Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
            <Database size={14} style={{ color: 'var(--text-tertiary)' }} />
            <label htmlFor="heatmap-dataset-select" style={{ color: 'var(--text-secondary)' }}>Dataset:</label>
            <select
              id="heatmap-dataset-select"
              value={config.dataset}
              onChange={(e) => setConfig((prev) => ({ ...prev, dataset: e.target.value }))}
              className="form-control form-control-sm"
              style={{ width: 'auto' }}
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

          <Badge variant="info">Plateau Detection: Active</Badge>
        </div>
      </div>

      {/* Parameter Plateau Context Card */}
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
        <Eye size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>Plateau vs. Spike: </strong>
          Robust algorithmic strategies reside in broad, gently sloping regions of profitability (plateaus). If changing a moving average period by $\pm 1$ bar causes returns to plunge, that parameter set is a curve-fitted statistical fluke.
        </div>
      </div>

      {/* Main Heatmap Workspace */}
      <Card style={{ padding: '1rem', backgroundColor: 'var(--bg-card)' }}>
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
