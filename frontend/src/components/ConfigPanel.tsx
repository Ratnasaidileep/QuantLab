import { type ChangeEvent, useState } from 'react';
import { fetchBatchDatasetsFromAPI, fetchDatasetFromAPI, uploadDataset } from '../api/client';
import type { BacktestRequest, DatasetInfo, PositionSizingMode, StrategyType } from '../types';

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

  return (
    <aside className="config-panel">
      <h2>Simulation Parameters</h2>

      <div className="form-group">
        <label htmlFor="dataset-select">Market Dataset</label>
        <select
          id="dataset-select"
          value={config.dataset}
          onChange={(e) => updateField('dataset', e.target.value)}
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

      {/* Dataset Ingestion Box */}
      <div className="dataset-ingestion-box">
        <div className="ingestion-tabs">
          <button
            type="button"
            className={`ingestion-tab-btn ${ingestMode === 'fetch' ? 'active' : ''}`}
            onClick={() => setIngestMode('fetch')}
          >
            🌐 Download Ticker
          </button>
          <button
            type="button"
            className={`ingestion-tab-btn ${ingestMode === 'upload' ? 'active' : ''}`}
            onClick={() => setIngestMode('upload')}
          >
            📁 Upload CSV
          </button>
        </div>

        {ingestMode === 'fetch' ? (
          <div className="ingest-form">
            <div className="fetch-input-row">
              <input
                type="text"
                placeholder="e.g. TCS.NS, AAPL, NVDA"
                value={tickerInput}
                onChange={(e) => setTickerInput(e.target.value)}
                disabled={isIngesting}
              />
              <select
                value={fetchPeriod}
                onChange={(e) => setFetchPeriod(e.target.value)}
                disabled={isIngesting}
                style={{ width: '70px', padding: '0.2rem' }}
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
              >
                {isIngesting ? <span className="spinner"></span> : 'Fetch'}
              </button>
            </div>
            <span className="ingest-hint">
              Yahoo Finance live: Indian (TCS.NS, INFY.NS), US (AAPL, SPY), Crypto.
            </span>
          </div>
        ) : (
          <div className="ingest-form">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={isIngesting}
              className="file-upload-input"
            />
            <span className="ingest-hint">
              Drop any CSV with columns: Date, Open, High, Low, Close, Volume.
            </span>
          </div>
        )}

        {ingestFeedback && (
          <div className={`ingest-feedback ${ingestFeedback.type}`}>
            {ingestFeedback.msg}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="strategy-select">Trading Strategy</label>
        <select
          id="strategy-select"
          value={config.strategy}
          onChange={(e) => updateField('strategy', e.target.value as StrategyType)}
        >
          <option value="moving_average">Moving Average Crossover</option>
          <option value="rsi">Relative Strength Index (RSI)</option>
          <option value="bollinger">Bollinger Bands (Mean Reversion)</option>
          <option value="macd">MACD (Convergence Divergence)</option>
        </select>
      </div>

      {config.strategy === 'moving_average' && (
        <div className="strategy-options">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="fast-period">Fast MA</label>
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
              <label htmlFor="slow-period">Slow MA</label>
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
            <div className="field-error">Fast period must be smaller than slow period.</div>
          )}
        </div>
      )}

      {config.strategy === 'rsi' && (
        <div className="strategy-options">
          <div className="form-group">
            <label htmlFor="rsi-period">RSI Period</label>
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
            <div className="field-error">Oversold threshold must be less than overbought.</div>
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
          <span className="ingest-hint" style={{ marginTop: '0.25rem', display: 'block' }}>
            Statistical mean reversion: Buys when price touches Lower Band (μ - kσ), exits at Middle SMA (μ).
          </span>
          {isBbInvalid && (
            <div className="field-error">Period must be ≥ 2 and Std Dev multiplier must be &gt; 0.</div>
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
          <span className="ingest-hint" style={{ marginTop: '0.25rem', display: 'block' }}>
            Trend & Momentum: Triggers Long when MACD Line (Fast EMA − Slow EMA) crosses above Signal Line.
          </span>
          {isMacdInvalid && (
            <div className="field-error">Fast period must be strictly less than Slow period, and Signal period ≥ 1.</div>
          )}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="sizing-mode">Position Sizing</label>
        <select
          id="sizing-mode"
          value={config.sizing_mode}
          onChange={(e) => updateField('sizing_mode', e.target.value as PositionSizingMode)}
        >
          <option value="unit">Unit Trade (1 share — Baseline)</option>
          <option value="all_in">Full Capital (All-in — Max Deployment)</option>
          <option value="fixed_quantity">Fixed Quantity (Custom Lot)</option>
        </select>
      </div>

      {config.sizing_mode === 'fixed_quantity' && (
        <div className="form-group">
          <label htmlFor="quantity-per-trade">Shares per Trade</label>
          <input
            id="quantity-per-trade"
            type="number"
            min="1"
            value={config.quantity_per_trade}
            onChange={(e) => updateField('quantity_per_trade', Number.parseFloat(e.target.value) || 1)}
          />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="initial-cash">Initial Capital (₹)</label>
        <input
          id="initial-cash"
          type="number"
          step="5000"
          min="1000"
          value={config.initial_cash}
          onChange={(e) => updateField('initial_cash', Number.parseFloat(e.target.value) || 1000)}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="commission">Commission (%)</label>
          <input
            id="commission"
            type="number"
            step="0.01"
            min="0"
            value={config.commission_rate * 100}
            onChange={(e) => updateField('commission_rate', (Number.parseFloat(e.target.value) || 0) / 100)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="slippage">Slippage (%)</label>
          <input
            id="slippage"
            type="number"
            step="0.01"
            min="0"
            value={config.slippage_rate * 100}
            onChange={(e) => updateField('slippage_rate', (Number.parseFloat(e.target.value) || 0) / 100)}
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color, #2a2e39)', paddingTop: '0.75rem', marginTop: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-color, #38bdf8)', display: 'block', marginBottom: '0.5rem' }}>
          🛡️ Risk & Exit Management (Optional)
        </span>
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
      </div>

      <div className="button-group">
        <button
          type="button"
          className="btn btn-primary"
          onClick={onRunBacktest}
          disabled={isLoading || isMaInvalid || isRsiInvalid || isBbInvalid || isMacdInvalid}
        >
          {isLoading ? <span className="spinner"></span> : '▶ Run Backtest'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onRunComparison}
          disabled={isComparing}
        >
          {isComparing ? <span className="spinner"></span> : '⚡ Compare Strategies'}
        </button>
      </div>
    </aside>
  );
}
