import { type ChangeEvent, useState } from 'react';
import {
  SlidersHorizontal,
  Sparkles,
  ShieldAlert,
  Play,
  RotateCcw,
  Info,
  TrendingUp,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
} from 'lucide-react';
import { fetchBatchDatasetsFromAPI, fetchDatasetFromAPI, uploadDataset } from '../api/client';
import type { BacktestRequest, DatasetInfo, PositionSizingMode, StrategyType } from '../types';
import { DEFAULT_CONFIG } from '../context/backtest-context';

interface ConfigPanelProps {
  config: BacktestRequest;
  onChange: (updated: BacktestRequest) => void;
  datasets: DatasetInfo[];
  onRefreshDatasets: () => Promise<void>;
  onRunBacktest: () => void;
  onRunComparison: () => void;
  isLoading: boolean;
  isComparing: boolean;
}

export function ConfigPanel({
  config,
  onChange,
  datasets,
  onRefreshDatasets,
  onRunBacktest,
  onRunComparison,
  isLoading,
  isComparing,
}: ConfigPanelProps) {
  const [ingestMode, setIngestMode] = useState<'fetch' | 'upload'>('fetch');
  const [tickerInput, setTickerInput] = useState<string>('');
  const [fetchPeriod, setFetchPeriod] = useState<string>('2y');
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [showRiskControls, setShowRiskControls] = useState<boolean>(
    Boolean(config.stop_loss_pct || config.take_profit_pct || config.trailing_stop_pct)
  );
  const [ingestFeedback, setIngestFeedback] = useState<{
    type: 'success' | 'error';
    msg: string;
  } | null>(null);

  const updateField = <K extends keyof BacktestRequest>(field: K, value: BacktestRequest[K]) => {
    onChange({ ...config, [field]: value });
  };

  const handleFetchTicker = async () => {
    if (!tickerInput.trim()) return;
    setIsIngesting(true);
    setIngestFeedback(null);
    try {
      const symbols = tickerInput
        .split(/[\s,]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      if (symbols.length > 1) {
        const res = await fetchBatchDatasetsFromAPI(symbols, fetchPeriod);
        const failText =
          res.failed_symbols.length > 0
            ? ` (${res.failed_symbols.map((f) => f.symbol).join(', ')} failed)`
            : '';
        setIngestFeedback({ type: 'success', msg: `${res.message}${failText}` });
        await onRefreshDatasets();
        if (res.datasets.length > 0) {
          updateField('dataset', res.datasets[0].filename);
        }
      } else if (symbols.length === 1) {
        const res = await fetchDatasetFromAPI(symbols[0], fetchPeriod);
        setIngestFeedback({ type: 'success', msg: res.message });
        await onRefreshDatasets();
        updateField('dataset', res.dataset.filename);
      }
      setTickerInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch ticker.';
      setIngestFeedback({ type: 'error', msg });
    } finally {
      setIsIngesting(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsIngesting(true);
    setIngestFeedback(null);
    try {
      const res = await uploadDataset(file);
      setIngestFeedback({ type: 'success', msg: res.message });
      await onRefreshDatasets();
      updateField('dataset', res.dataset.filename);
      e.target.value = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setIngestFeedback({ type: 'error', msg });
    } finally {
      setIsIngesting(false);
    }
  };

  const applyPreset = (presetName: string) => {
    if (presetName === 'ma_fast') {
      onChange({ ...config, strategy: 'moving_average', fast_period: 5, slow_period: 20 });
    } else if (presetName === 'ma_standard') {
      onChange({ ...config, strategy: 'moving_average', fast_period: 10, slow_period: 30 });
    } else if (presetName === 'ma_golden') {
      onChange({ ...config, strategy: 'moving_average', fast_period: 50, slow_period: 200 });
    } else if (presetName === 'rsi_standard') {
      onChange({ ...config, strategy: 'rsi', rsi_period: 14, oversold: 30, overbought: 70 });
    } else if (presetName === 'rsi_aggressive') {
      onChange({ ...config, strategy: 'rsi', rsi_period: 10, oversold: 25, overbought: 75 });
    } else if (presetName === 'bb_standard') {
      onChange({ ...config, strategy: 'bollinger', bb_period: 20, bb_std_dev: 2.0 });
    } else if (presetName === 'macd_standard') {
      onChange({
        ...config,
        strategy: 'macd',
        macd_fast: 12,
        macd_slow: 26,
        macd_signal: 9,
      });
    } else if (presetName === 'confluence_swing') {
      onChange({
        ...config,
        strategy: 'confluence',
        confluence_trend_period: 50,
        confluence_pullback_period: 14,
        confluence_oversold: 35,
        confluence_overbought: 65,
      });
    } else if (presetName === 'confluence_macro') {
      onChange({
        ...config,
        strategy: 'confluence',
        confluence_trend_period: 200,
        confluence_pullback_period: 14,
        confluence_oversold: 30,
        confluence_overbought: 70,
      });
    }
  };

  const handleResetDefaults = () => {
    onChange({
      ...DEFAULT_CONFIG,
      dataset: config.dataset, // retain selected dataset
    });
  };

  const isMaInvalid =
    config.strategy === 'moving_average' && config.fast_period >= config.slow_period;
  const isRsiInvalid =
    config.strategy === 'rsi' && config.oversold >= config.overbought;
  const isBbInvalid =
    config.strategy === 'bollinger' && (config.bb_period < 2 || config.bb_std_dev <= 0);
  const isMacdInvalid =
    config.strategy === 'macd' &&
    ((config.macd_fast ?? 12) >= (config.macd_slow ?? 26) ||
      (config.macd_fast ?? 12) < 1 ||
      (config.macd_signal ?? 9) < 1);
  const isConfluenceInvalid =
    config.strategy === 'confluence' &&
    ((config.confluence_oversold ?? 35) >= (config.confluence_overbought ?? 65) ||
      (config.confluence_trend_period ?? 50) < 2 ||
      (config.confluence_pullback_period ?? 14) < 2);

  const hasFormErrors = isMaInvalid || isRsiInvalid || isBbInvalid || isMacdInvalid || isConfluenceInvalid;

  return (
    <aside className="config-panel" style={{ width: '100%', maxWidth: '360px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
          <SlidersHorizontal size={18} style={{ color: 'var(--accent-primary)' }} />
          <span>Strategy Parameters</span>
        </h2>
        <button
          type="button"
          onClick={handleResetDefaults}
          title="Reset to default baseline parameters"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: '0.25rem',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
          }}
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      {/* Dataset Selection */}
      <div className="form-group">
        <label htmlFor="dataset-select" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Market Dataset</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            {datasets.length} available
          </span>
        </label>
        <select
          id="dataset-select"
          value={config.dataset}
          onChange={(e) => updateField('dataset', e.target.value)}
          style={{ width: '100%' }}
        >
          {datasets.map((d) => (
            <option key={d.filename} value={d.filename}>
              {d.symbol} ({d.bars_count} bars, {d.start_date.slice(0, 4)}–{d.end_date.slice(0, 4)})
            </option>
          ))}
          {datasets.length === 0 && (
            <option value="reliance_daily.csv">reliance_daily.csv (Default)</option>
          )}
        </select>
      </div>

      {/* Dataset Ingestion Drawer */}
      <div className="dataset-ingestion-box" style={{ borderRadius: '8px', border: '1px solid var(--border-color)', padding: '0.75rem', backgroundColor: 'var(--bg-elevated)' }}>
        <div className="ingestion-tabs" style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <button
            type="button"
            className={`ingestion-tab-btn ${ingestMode === 'fetch' ? 'active' : ''}`}
            onClick={() => setIngestMode('fetch')}
            style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px' }}
          >
            Fetch Ticker
          </button>
          <button
            type="button"
            className={`ingestion-tab-btn ${ingestMode === 'upload' ? 'active' : ''}`}
            onClick={() => setIngestMode('upload')}
            style={{ flex: 1, padding: '0.35rem 0.5rem', fontSize: '0.78rem', borderRadius: '4px' }}
          >
            Upload CSV
          </button>
        </div>

        {ingestMode === 'fetch' ? (
          <div className="ingest-form">
            <div className="fetch-input-row" style={{ display: 'flex', gap: '0.35rem' }}>
              <input
                type="text"
                placeholder="e.g. TCS.NS, NVDA, AAPL"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                disabled={isIngesting}
                style={{ flex: 1, fontSize: '0.8rem' }}
              />
              <select
                value={fetchPeriod}
                onChange={(e) => setFetchPeriod(e.target.value)}
                disabled={isIngesting}
                style={{ width: '65px', padding: '0.2rem', fontSize: '0.8rem' }}
              >
                <option value="1y">1y</option>
                <option value="2y">2y</option>
                <option value="5y">5y</option>
                <option value="max">max</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleFetchTicker}
                disabled={isIngesting || !tickerInput.trim()}
                style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
              >
                {isIngesting ? <span className="spinner"></span> : 'Fetch'}
              </button>
            </div>
          </div>
        ) : (
          <div className="ingest-form">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isIngesting}
              className="file-upload-input"
              style={{ fontSize: '0.8rem' }}
            />
          </div>
        )}

        {ingestFeedback && (
          <div className={`ingest-feedback ${ingestFeedback.type}`} style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>
            {ingestFeedback.msg}
          </div>
        )}
      </div>

      {/* Strategy Selector */}
      <div className="form-group">
        <label htmlFor="strategy-select" style={{ fontWeight: 600 }}>Strategy Engine</label>
        <select
          id="strategy-select"
          value={config.strategy}
          onChange={(e) => updateField('strategy', e.target.value as StrategyType)}
          style={{ width: '100%', fontWeight: 500 }}
        >
          <option value="moving_average">Moving Average Crossover</option>
          <option value="rsi">Relative Strength Index (RSI)</option>
          <option value="bollinger">Bollinger Bands (Mean Reversion)</option>
          <option value="macd">MACD (Convergence Divergence)</option>
          <option value="confluence">Confluence (Trend Filter + Momentum Pullback)</option>
        </select>
      </div>

      {/* Strategy Description & Logic Card */}
      <div
        style={{
          padding: '0.65rem 0.85rem',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          lineHeight: '1.4',
        }}
      >
        {config.strategy === 'moving_average' && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <TrendingUp size={13} style={{ color: 'var(--accent-primary)' }} />
              Dual Moving Average Trend Following
            </div>
            <div>
              Goes <strong>Long</strong> when Fast SMA crosses above Slow SMA. Exits when Fast crosses below Slow.
            </div>
          </div>
        )}
        {config.strategy === 'rsi' && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Sparkles size={13} style={{ color: 'var(--accent-primary)' }} />
              RSI Momentum Mean-Reversion
            </div>
            <div>
              Goes <strong>Long</strong> when RSI drops below Oversold ({config.oversold}). Exits when RSI rises above Overbought ({config.overbought}).
            </div>
          </div>
        )}
        {config.strategy === 'bollinger' && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Layers size={13} style={{ color: 'var(--accent-primary)' }} />
              Bollinger Bands Statistical Envelope
            </div>
            <div>
              Goes <strong>Long</strong> when Close pierces Lower Band (&mu; &minus; {config.bb_std_dev}&sigma;). Exits at Middle SMA (&mu;).
            </div>
          </div>
        )}
        {config.strategy === 'macd' && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <SlidersHorizontal size={13} style={{ color: 'var(--accent-primary)' }} />
              MACD Trend Velocity
            </div>
            <div>
              Goes <strong>Long</strong> when MACD Line (Fast EMA &minus; Slow EMA) crosses above Signal Line. Exits when crossing below.
            </div>
          </div>
        )}
        {config.strategy === 'confluence' && (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <ShieldAlert size={13} style={{ color: 'var(--accent-primary)' }} />
              Dual-Regime Trend + Momentum Confluence
            </div>
            <div>
              Goes <strong>Long</strong> when Price &gt; Trend EMA ({config.confluence_trend_period ?? 50}) AND RSI ({config.confluence_pullback_period ?? 14}) pulls back &le; {config.confluence_oversold ?? 35}. Exits when RSI &ge; {config.confluence_overbought ?? 65} or Price breaks below Trend EMA.
            </div>
          </div>
        )}
      </div>

      {/* Presets Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginRight: '0.2rem' }}>Presets:</span>
        {config.strategy === 'moving_average' && (
          <>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('ma_fast')}>
              Fast 5/20
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('ma_standard')}>
              Standard 10/30
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('ma_golden')}>
              Golden 50/200
            </button>
          </>
        )}
        {config.strategy === 'rsi' && (
          <>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('rsi_standard')}>
              Standard 14 (30/70)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('rsi_aggressive')}>
              Aggressive 10 (25/75)
            </button>
          </>
        )}
        {config.strategy === 'bollinger' && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('bb_standard')}>
            Standard 20 (2.0&sigma;)
          </button>
        )}
        {config.strategy === 'macd' && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('macd_standard')}>
            Standard 12/26/9
          </button>
        )}
        {config.strategy === 'confluence' && (
          <>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('confluence_swing')}>
              Swing 50/14 (35/65)
            </button>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }} onClick={() => applyPreset('confluence_macro')}>
              Macro 200/14 (30/70)
            </button>
          </>
        )}
      </div>

      {/* Dynamic Strategy Form Fields */}
      {config.strategy === 'moving_average' && (
        <div className="strategy-options">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fast-period">Fast MA Period</label>
              <input
                id="fast-period"
                type="number"
                min="1"
                max="200"
                value={config.fast_period}
                onChange={(e) => updateField('fast_period', Number.parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="slow-period">Slow MA Period</label>
              <input
                id="slow-period"
                type="number"
                min="2"
                max="500"
                value={config.slow_period}
                onChange={(e) => updateField('slow_period', Number.parseInt(e.target.value, 10) || 2)}
              />
            </div>
          </div>
          {isMaInvalid && (
            <div className="field-error" style={{ color: 'var(--loss)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={13} />
              Fast period must be strictly less than Slow period.
            </div>
          )}
        </div>
      )}

      {config.strategy === 'rsi' && (
        <div className="strategy-options">
          <div className="form-group">
            <label htmlFor="rsi-period">RSI Period (Bars)</label>
            <input
              id="rsi-period"
              type="number"
              min="2"
              max="100"
              value={config.rsi_period}
              onChange={(e) => updateField('rsi_period', Number.parseInt(e.target.value, 10) || 2)}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="oversold">Oversold (Buy)</label>
              <input
                id="oversold"
                type="number"
                min="1"
                max="99"
                value={config.oversold}
                onChange={(e) => updateField('oversold', Number.parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="overbought">Overbought (Sell)</label>
              <input
                id="overbought"
                type="number"
                min="1"
                max="100"
                value={config.overbought}
                onChange={(e) => updateField('overbought', Number.parseFloat(e.target.value) || 100)}
              />
            </div>
          </div>
          {isRsiInvalid && (
            <div className="field-error" style={{ color: 'var(--loss)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={13} />
              Oversold threshold must be strictly less than Overbought.
            </div>
          )}
        </div>
      )}

      {config.strategy === 'bollinger' && (
        <div className="strategy-options">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="bb-period">Lookback Period (N)</label>
              <input
                id="bb-period"
                type="number"
                min="2"
                max="200"
                value={config.bb_period}
                onChange={(e) => updateField('bb_period', Number.parseInt(e.target.value, 10) || 2)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="bb-std-dev">Std Dev Multiplier (k)</label>
              <input
                id="bb-std-dev"
                type="number"
                min="0.1"
                max="5.0"
                step="0.1"
                value={config.bb_std_dev}
                onChange={(e) => updateField('bb_std_dev', Number.parseFloat(e.target.value) || 2.0)}
              />
            </div>
          </div>
          {isBbInvalid && (
            <div className="field-error" style={{ color: 'var(--loss)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={13} />
              Period must be &ge; 2 and multiplier must be &gt; 0.
            </div>
          )}
        </div>
      )}

      {config.strategy === 'macd' && (
        <div className="strategy-options">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="macd-fast">Fast EMA</label>
              <input
                id="macd-fast"
                type="number"
                min="1"
                max="100"
                value={config.macd_fast ?? 12}
                onChange={(e) => updateField('macd_fast', Number.parseInt(e.target.value, 10) || 1)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="macd-slow">Slow EMA</label>
              <input
                id="macd-slow"
                type="number"
                min="2"
                max="200"
                value={config.macd_slow ?? 26}
                onChange={(e) => updateField('macd_slow', Number.parseInt(e.target.value, 10) || 2)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="macd-signal">Signal EMA</label>
              <input
                id="macd-signal"
                type="number"
                min="1"
                max="50"
                value={config.macd_signal ?? 9}
                onChange={(e) => updateField('macd_signal', Number.parseInt(e.target.value, 10) || 1)}
              />
            </div>
          </div>
          {isMacdInvalid && (
            <div className="field-error" style={{ color: 'var(--loss)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={13} />
              Fast EMA must be strictly less than Slow EMA, and Signal EMA &ge; 1.
            </div>
          )}
        </div>
      )}

      {config.strategy === 'confluence' && (
        <div className="strategy-options">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="confluence-trend">Trend Filter EMA</label>
              <input
                id="confluence-trend"
                type="number"
                min="2"
                max="500"
                value={config.confluence_trend_period ?? 50}
                onChange={(e) => updateField('confluence_trend_period', Number.parseInt(e.target.value, 10) || 2)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confluence-pullback">RSI Pullback</label>
              <input
                id="confluence-pullback"
                type="number"
                min="2"
                max="100"
                value={config.confluence_pullback_period ?? 14}
                onChange={(e) => updateField('confluence_pullback_period', Number.parseInt(e.target.value, 10) || 2)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="confluence-oversold">Oversold Entry (&le;)</label>
              <input
                id="confluence-oversold"
                type="number"
                min="1"
                max="99"
                value={config.confluence_oversold ?? 35}
                onChange={(e) => updateField('confluence_oversold', Number.parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="confluence-overbought">Overbought Exit (&ge;)</label>
              <input
                id="confluence-overbought"
                type="number"
                min="1"
                max="100"
                value={config.confluence_overbought ?? 65}
                onChange={(e) => updateField('confluence_overbought', Number.parseFloat(e.target.value) || 100)}
              />
            </div>
          </div>
          {isConfluenceInvalid && (
            <div className="field-error" style={{ color: 'var(--loss)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={13} />
              Oversold must be strictly less than Overbought, and periods must be &ge; 2.
            </div>
          )}
        </div>
      )}

      {/* Capital & Position Sizing */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        <div className="form-group">
          <label htmlFor="initial-cash">Initial Capital (₹)</label>
          <input
            id="initial-cash"
            type="number"
            step="10000"
            min="1000"
            value={config.initial_cash}
            onChange={(e) => updateField('initial_cash', Number.parseFloat(e.target.value) || 1000)}
          />
        </div>

        <div className="form-group" style={{ marginTop: '0.5rem' }}>
          <label htmlFor="sizing-mode">Position Sizing Mode</label>
          <select
            id="sizing-mode"
            value={config.sizing_mode}
            onChange={(e) => updateField('sizing_mode', e.target.value as PositionSizingMode)}
          >
            <option value="unit">Unit (1 Share — Unscaled Benchmark)</option>
            <option value="all_in">All-In (100% Available Capital)</option>
            <option value="fixed_quantity">Fixed Quantity (Custom Lot Size)</option>
            <option value="atr_fractional">ATR Volatility Risk Sizing (Fixed Fractional %)</option>
          </select>
        </div>

        {config.sizing_mode === 'fixed_quantity' && (
          <div className="form-group" style={{ marginTop: '0.5rem' }}>
            <label htmlFor="quantity-per-trade">Lot Size (Shares per Trade)</label>
            <input
              id="quantity-per-trade"
              type="number"
              min="1"
              value={config.quantity_per_trade}
              onChange={(e) => updateField('quantity_per_trade', Number.parseFloat(e.target.value) || 1)}
            />
          </div>
        )}

        {config.sizing_mode === 'atr_fractional' && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="risk-pct" title="Percentage of total capital risked per trade">Risk per Trade (%)</label>
                <input
                  id="risk-pct"
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="10.0"
                  value={config.risk_per_trade_pct ? config.risk_per_trade_pct * 100 : 1.0}
                  onChange={(e) => updateField('risk_per_trade_pct', (Number.parseFloat(e.target.value) || 1.0) / 100)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="atr-period" title="Lookback period for ATR volatility calculation">ATR Period</label>
                <input
                  id="atr-period"
                  type="number"
                  min="1"
                  max="100"
                  value={config.atr_period ?? 14}
                  onChange={(e) => updateField('atr_period', Number.parseInt(e.target.value, 10) || 14)}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="atr-mult-sizing" title="Multiplier distance to dynamic volatility stop">ATR Stop Multiplier (k)</label>
              <input
                id="atr-mult-sizing"
                type="number"
                step="0.5"
                min="0.5"
                max="10.0"
                value={config.atr_stop_multiplier ?? 2.0}
                onChange={(e) => updateField('atr_stop_multiplier', Number.parseFloat(e.target.value) || 2.0)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Friction Modeling */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="commission" title="Brokerage commission applied on entry and exit">
              Commission (%)
            </label>
            <input
              id="commission"
              type="number"
              step="0.01"
              min="0"
              value={Number((config.commission_rate * 100).toFixed(4))}
              onChange={(e) => updateField('commission_rate', (Number.parseFloat(e.target.value) || 0) / 100)}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
              {(config.commission_rate * 10000).toFixed(0)} bps
            </span>
          </div>
          <div className="form-group">
            <label htmlFor="slippage" title="Adverse fill slippage modeled on entry and exit">
              Slippage (%)
            </label>
            <input
              id="slippage"
              type="number"
              step="0.01"
              min="0"
              value={Number((config.slippage_rate * 100).toFixed(4))}
              onChange={(e) => updateField('slippage_rate', (Number.parseFloat(e.target.value) || 0) / 100)}
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
              {(config.slippage_rate * 10000).toFixed(0)} bps
            </span>
          </div>
        </div>
      </div>

      {/* Collapsible Risk & Exit Management Section */}
      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
        <button
          type="button"
          onClick={() => setShowRiskControls((prev) => !prev)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-primary)' }}>
            <ShieldAlert size={15} />
            Risk & Exit Management
          </span>
          {showRiskControls ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>

        {showRiskControls && (
          <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="stop-loss">Stop-Loss (%)</label>
                <input
                  id="stop-loss"
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="50"
                  placeholder="e.g. 5"
                  value={config.stop_loss_pct ? config.stop_loss_pct * 100 : ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number.parseFloat(e.target.value) / 100 : null;
                    updateField('stop_loss_pct', val);
                  }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="take-profit">Take-Profit (%)</label>
                <input
                  id="take-profit"
                  type="number"
                  step="0.5"
                  min="0.1"
                  max="100"
                  placeholder="e.g. 10"
                  value={config.take_profit_pct ? config.take_profit_pct * 100 : ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number.parseFloat(e.target.value) / 100 : null;
                    updateField('take_profit_pct', val);
                  }}
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="trailing-stop">Trailing Stop (%)</label>
              <input
                id="trailing-stop"
                type="number"
                step="0.5"
                min="0.1"
                max="50"
                placeholder="e.g. 8"
                value={config.trailing_stop_pct ? config.trailing_stop_pct * 100 : ''}
                onChange={(e) => {
                  const val = e.target.value ? Number.parseFloat(e.target.value) / 100 : null;
                  updateField('trailing_stop_pct', val);
                }}
              />
            </div>
            <div className="form-group">
              <label htmlFor="atr-stop" title="Dynamic volatility-adjusted trailing stop: peak - k*ATR">ATR Dynamic Trailing Stop (k &times; ATR)</label>
              <input
                id="atr-stop"
                type="number"
                step="0.5"
                min="0.5"
                max="10.0"
                placeholder="e.g. 2.0 (2x ATR)"
                value={config.atr_stop_multiplier ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? Number.parseFloat(e.target.value) : null;
                  updateField('atr_stop_multiplier', val);
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Execution Timing Notice Pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.45rem 0.65rem',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.72rem',
          color: 'var(--text-tertiary)',
        }}
      >
        <Clock size={13} style={{ flexShrink: 0, color: 'var(--accent-primary)' }} />
        <span>Signals computed on bar <em>t</em> Close &rarr; Executed on bar <em>t+1</em> Open</span>
      </div>

      {/* Action CTA Buttons */}
      <div className="button-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRunBacktest}
          disabled={isLoading || hasFormErrors}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.75rem 1rem',
            fontWeight: 600,
          }}
        >
          {isLoading ? (
            <span className="spinner"></span>
          ) : (
            <>
              <Play size={16} />
              <span>Run Backtest</span>
              <kbd
                style={{
                  marginLeft: 'auto',
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.4rem',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Ctrl+Enter
              </kbd>
            </>
          )}
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRunComparison}
          disabled={isComparing || hasFormErrors}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.6rem 1rem',
          }}
        >
          {isComparing ? (
            <span className="spinner"></span>
          ) : (
            <>
              <Info size={15} />
              <span>Compare All Strategies</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
