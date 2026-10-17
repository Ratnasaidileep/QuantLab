import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  CloudDownload,
  Search,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { useBacktest } from '../../hooks/useBacktest';
import {
  uploadDataset,
  fetchDatasetFromAPI,
  fetchBatchDatasetsFromAPI,
} from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import type { FailedSymbolDTO } from '../../types';

export function DatasetsPage() {
  const navigate = useNavigate();
  const { datasets, config, setConfig, refreshDatasets } = useBacktest();

  // Search filter
  const [searchTerm, setSearchTerm] = useState('');

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Single fetch state
  const [singleSymbol, setSingleSymbol] = useState('');
  const [singlePeriod, setSinglePeriod] = useState('2y');
  const [isSingleFetching, setIsSingleFetching] = useState(false);

  // Batch fetch state
  const [batchSymbols, setBatchSymbols] = useState('AAPL, MSFT, GOOGL, NVDA');
  const [batchPeriod, setBatchPeriod] = useState('2y');
  const [isBatchFetching, setIsBatchFetching] = useState(false);
  const [batchErrors, setBatchErrors] = useState<FailedSymbolDTO[]>([]);

  // CSV Drag and Drop
  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setUploadFeedback({ type: 'error', text: 'Only .csv format files are supported.' });
      return;
    }

    setIsUploading(true);
    setUploadFeedback(null);
    try {
      const resp = await uploadDataset(file);
      setUploadFeedback({ type: 'success', text: `Successfully uploaded ${resp.dataset.filename} (${resp.dataset.bars_count} bars).` });
      await refreshDatasets();
      setConfig((prev) => ({ ...prev, dataset: resp.dataset.filename }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setUploadFeedback({ type: 'error', text: msg });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSingleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleSymbol.trim()) return;

    setIsSingleFetching(true);
    setUploadFeedback(null);
    try {
      const resp = await fetchDatasetFromAPI(singleSymbol.trim().toUpperCase(), singlePeriod);
      setUploadFeedback({ type: 'success', text: `Downloaded ${resp.dataset.filename} (${resp.dataset.bars_count} bars).` });
      setSingleSymbol('');
      await refreshDatasets();
      setConfig((prev) => ({ ...prev, dataset: resp.dataset.filename }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fetch failed.';
      setUploadFeedback({ type: 'error', text: msg });
    } finally {
      setIsSingleFetching(false);
    }
  };

  const handleBatchFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbols = batchSymbols
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s.length > 0);

    if (symbols.length === 0) return;

    setIsBatchFetching(true);
    setBatchErrors([]);
    setUploadFeedback(null);
    try {
      const resp = await fetchBatchDatasetsFromAPI(symbols, batchPeriod);
      setBatchErrors(resp.failed_symbols);
      const successCount = resp.datasets.length;
      const failCount = resp.failed_symbols.length;

      setUploadFeedback({
        type: failCount === 0 ? 'success' : 'error',
        text: `Batch completed: ${successCount} downloaded, ${failCount} failed.`,
      });
      await refreshDatasets();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Batch fetch failed.';
      setUploadFeedback({ type: 'error', text: msg });
    } finally {
      setIsBatchFetching(false);
    }
  };

  const filteredDatasets = datasets.filter(
    (d) =>
      d.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Title & Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Market Datasets & Ingestion
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage local OHLCV CSV archives and fetch historical market data via Yahoo Finance.
          </p>
        </div>

        <Badge variant="primary">
          {datasets.length} Dataset{datasets.length !== 1 ? 's' : ''} Ready
        </Badge>
      </div>

      {uploadFeedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            backgroundColor: uploadFeedback.type === 'success' ? 'var(--profit-bg)' : 'var(--loss-bg)',
            border: `1px solid ${uploadFeedback.type === 'success' ? 'var(--profit-border)' : 'var(--loss-border)'}`,
            color: uploadFeedback.type === 'success' ? 'var(--profit)' : 'var(--loss)',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {uploadFeedback.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span>{uploadFeedback.text}</span>
        </div>
      )}

      {/* Ingestion Panels: Upload & Yahoo Finance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* CSV Drag & Drop Upload */}
        <Card
          title="Upload Local CSV"
          subtitle="Required headers: Date, Open, High, Low, Close, Volume"
        >
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            style={{
              border: '2px dashed var(--border-medium)',
              borderRadius: '8px',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              backgroundColor: 'var(--bg-elevated)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'border-color var(--transition-fast)',
            }}
            onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = '.csv';
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) handleFileUpload(file);
              };
              input.click();
            }}
          >
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--brand-glow)',
                color: 'var(--brand-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Upload size={22} />
            </div>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                {isUploading ? 'Validating and importing CSV...' : 'Click or drag & drop CSV file here'}
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Maximum size 50 MB • Chronologically verified
              </span>
            </div>
          </div>
        </Card>

        {/* Yahoo Finance Downloaders */}
        <Card
          title="Download from Yahoo Finance"
          subtitle="Fetch adjusted daily OHLCV bars by ticker symbol"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Single Ticker */}
            <form onSubmit={handleSingleFetch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Ticker (e.g. TCS.NS, AAPL)"
                value={singleSymbol}
                onChange={(e) => setSingleSymbol(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.45rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
                disabled={isSingleFetching}
              />
              <select
                value={singlePeriod}
                onChange={(e) => setSinglePeriod(e.target.value)}
                style={{
                  padding: '0.45rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-elevated)',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                }}
                disabled={isSingleFetching}
              >
                <option value="6mo">6 Mo</option>
                <option value="1y">1 Yr</option>
                <option value="2y">2 Yrs</option>
                <option value="5y">5 Yrs</option>
                <option value="max">Max</option>
              </select>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSingleFetching}
                disabled={isSingleFetching || !singleSymbol.trim()}
                icon={<CloudDownload size={14} />}
              >
                Fetch
              </Button>
            </form>

            {/* Batch Ticker */}
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, display: 'block', marginBottom: '0.35rem' }}>
                Batch Download (Comma-Separated)
              </span>
              <form onSubmit={handleBatchFetch} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="e.g. TCS.NS, INFY.NS, RELIANCE.NS"
                  value={batchSymbols}
                  onChange={(e) => setBatchSymbols(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                  }}
                  disabled={isBatchFetching}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <select
                    value={batchPeriod}
                    onChange={(e) => setBatchPeriod(e.target.value)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-elevated)',
                      color: 'var(--text-primary)',
                      fontSize: '0.8rem',
                    }}
                    disabled={isBatchFetching}
                  >
                    <option value="1y">1 Year</option>
                    <option value="2y">2 Years</option>
                    <option value="5y">5 Years</option>
                  </select>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    isLoading={isBatchFetching}
                    disabled={isBatchFetching || !batchSymbols.trim()}
                    icon={<Layers size={14} />}
                  >
                    Batch Fetch
                  </Button>
                </div>
              </form>
            </div>

            {batchErrors.length > 0 && (
              <div style={{ padding: '0.5rem', backgroundColor: 'var(--loss-bg)', borderRadius: '6px', fontSize: '0.78rem' }}>
                <strong style={{ color: 'var(--loss)' }}>Failed Symbols:</strong>
                <ul style={{ margin: '0.25rem 0 0 1rem', color: 'var(--text-secondary)' }}>
                  {batchErrors.map((err) => (
                    <li key={err.symbol}>
                      <strong>{err.symbol}:</strong> {err.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Dataset Inventory Library */}
      <Card
        title="Dataset Library"
        subtitle="Historical datasets currently available in data/ directory"
        action={
          <div style={{ position: 'relative', width: '220px' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.65rem 0.4rem 2rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: '0.8rem',
              }}
            />
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Filename</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Symbol</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Bars Count</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Date Range</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Size</th>
                <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDatasets.map((d) => {
                const isSelected = config.dataset === d.filename;

                return (
                  <tr
                    key={d.filename}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--bg-elevated)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <FileSpreadsheet size={16} style={{ color: 'var(--brand-blue)' }} />
                        <span>{d.filename}</span>
                        {isSelected && <Badge variant="primary" size="sm">Active</Badge>}
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <Badge size="sm">{d.symbol}</Badge>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-primary)' }} className="tabular-nums">
                      {d.bars_count.toLocaleString()} bars
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>{d.start_date} → {d.end_date}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }} className="tabular-nums">
                      {(d.file_size_bytes / 1024).toFixed(1)} KB
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                      <Button
                        variant={isSelected ? 'success' : 'outline'}
                        size="sm"
                        onClick={() => {
                          setConfig((prev) => ({ ...prev, dataset: d.filename }));
                          navigate('/strategy-lab');
                        }}
                        icon={<ArrowRight size={13} />}
                      >
                        {isSelected ? 'Selected' : 'Use in Lab'}
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {filteredDatasets.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    No matching datasets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
