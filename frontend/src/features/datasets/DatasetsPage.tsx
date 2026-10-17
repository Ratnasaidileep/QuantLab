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
  Eye,
  X,
  FileCheck,
  ArrowUpDown,
  FlaskConical,
  FileText,
  Briefcase,
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
import type { DatasetInfo, FailedSymbolDTO } from '../../types';

interface CsvPreviewRow {
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface CsvValidationResult {
  hasRequiredColumns: boolean;
  missingColumns: string[];
  totalRowsParsed: number;
  sampleRows: CsvPreviewRow[];
  isMonotonic: boolean;
  file: File;
}

type SortField = 'filename' | 'bars_count' | 'end_date' | 'file_size_bytes';
type SortOrder = 'asc' | 'desc';

export function DatasetsPage() {
  const navigate = useNavigate();
  const { datasets, config, setConfig, refreshDatasets } = useBacktest();

  // Search & Sorting filter
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('filename');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Upload & File Inspection state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [previewData, setPreviewData] = useState<CsvValidationResult | null>(null);

  // Dataset Inspector Modal
  const [inspectedDataset, setInspectedDataset] = useState<DatasetInfo | null>(null);

  // Single fetch state
  const [singleSymbol, setSingleSymbol] = useState('');
  const [singlePeriod, setSinglePeriod] = useState('2y');
  const [isSingleFetching, setIsSingleFetching] = useState(false);

  // Batch fetch state
  const [batchSymbols, setBatchSymbols] = useState('AAPL, MSFT, GOOGL, NVDA');
  const [batchPeriod, setBatchPeriod] = useState('2y');
  const [isBatchFetching, setIsBatchFetching] = useState(false);
  const [batchErrors, setBatchErrors] = useState<FailedSymbolDTO[]>([]);

  // CSV Drag and Drop & Client-Side Verification Preview
  const handleFileSelect = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadFeedback({ type: 'error', text: 'Only .csv format files are supported.' });
      return;
    }

    setUploadFeedback(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        setUploadFeedback({ type: 'error', text: 'Uploaded file is empty.' });
        return;
      }

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length < 2) {
        setUploadFeedback({ type: 'error', text: 'CSV must contain at least a header row and data rows.' });
        return;
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const required = ['open', 'high', 'low', 'close', 'volume'];
      const dateHeader = headers.find((h) => h === 'date' || h === 'timestamp');

      const missing: string[] = [];
      if (!dateHeader) missing.push('date/timestamp');
      for (const req of required) {
        if (!headers.includes(req)) missing.push(req);
      }

      const dateIdx = dateHeader ? headers.indexOf(dateHeader) : -1;
      const openIdx = headers.indexOf('open');
      const highIdx = headers.indexOf('high');
      const lowIdx = headers.indexOf('low');
      const closeIdx = headers.indexOf('close');
      const volIdx = headers.indexOf('volume');

      const sampleRows: CsvPreviewRow[] = [];
      let isMonotonic = true;
      let prevDate: Date | null = null;

      for (let i = 1; i < Math.min(lines.length, 16); i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        const dStr = dateIdx >= 0 ? cols[dateIdx] : 'N/A';
        const currentDate = new Date(dStr);

        if (prevDate && !isNaN(currentDate.getTime()) && !isNaN(prevDate.getTime())) {
          if (currentDate <= prevDate) {
            isMonotonic = false;
          }
        }
        if (!isNaN(currentDate.getTime())) {
          prevDate = currentDate;
        }

        sampleRows.push({
          date: dStr,
          open: openIdx >= 0 ? cols[openIdx] : 'N/A',
          high: highIdx >= 0 ? cols[highIdx] : 'N/A',
          low: lowIdx >= 0 ? cols[lowIdx] : 'N/A',
          close: closeIdx >= 0 ? cols[closeIdx] : 'N/A',
          volume: volIdx >= 0 ? cols[volIdx] : 'N/A',
        });
      }

      setPreviewData({
        hasRequiredColumns: missing.length === 0,
        missingColumns: missing,
        totalRowsParsed: lines.length - 1,
        sampleRows,
        isMonotonic,
        file,
      });
    };

    reader.readAsText(file.slice(0, 50000)); // Read first 50KB for rapid preview
  };

  const handleConfirmUpload = async () => {
    if (!previewData) return;

    setIsUploading(true);
    setUploadFeedback(null);
    try {
      const resp = await uploadDataset(previewData.file);
      setUploadFeedback({
        type: 'success',
        text: `Successfully uploaded ${resp.dataset.filename} (${resp.dataset.bars_count} bars).`,
      });
      setPreviewData(null);
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
      setUploadFeedback({
        type: 'success',
        text: `Downloaded ${resp.dataset.filename} (${resp.dataset.bars_count} bars).`,
      });
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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredDatasets = datasets
    .filter(
      (d) =>
        d.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === 'filename') {
        comparison = a.filename.localeCompare(b.filename);
      } else if (sortField === 'bars_count') {
        comparison = a.bars_count - b.bars_count;
      } else if (sortField === 'end_date') {
        comparison = a.end_date.localeCompare(b.end_date);
      } else if (sortField === 'file_size_bytes') {
        comparison = a.file_size_bytes - b.file_size_bytes;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Title & Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Market Datasets & Ingestion Library
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
            Manage local daily OHLCV archives, preview raw rows, and download real-world ticker data via Yahoo Finance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Badge variant="primary">{datasets.length} Local CSVs</Badge>
          <Badge variant="info">Format: Date, Open, High, Low, Close, Volume</Badge>
        </div>
      </div>

      {/* Global Feedback Banner */}
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

      {/* Ingestion Section: Drag & Drop CSV and Yahoo Downloader */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* CSV Drag & Drop Upload with Preview Trigger */}
        <Card
          title="Upload Custom Market Data"
          subtitle="Drag & drop a .csv file to inspect raw rows and validate headers before committing"
        >
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileSelect(e.dataTransfer.files[0]);
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
                if (file) handleFileSelect(file);
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
                Click or drag & drop CSV file to inspect
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Client-side schema validation • Max 50 MB
              </span>
            </div>
          </div>
        </Card>

        {/* Yahoo Finance Downloaders */}
        <Card
          title="Download Market Data from Yahoo Finance"
          subtitle="Fetch validated historical daily OHLCV bars by ticker symbol"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Single Ticker */}
            <form onSubmit={handleSingleFetch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="Ticker (e.g. TCS.NS, NVDA)"
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
                Batch Multi-Ticker Download (Comma-Separated)
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

      {/* Interactive Raw CSV Preview Modal / Panel */}
      {previewData && (
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <FileCheck size={20} style={{ color: previewData.hasRequiredColumns ? 'var(--profit)' : 'var(--loss)' }} />
              <span>Raw CSV Data Preview: {previewData.file.name}</span>
            </div>
          }
          subtitle={`Showing first ${previewData.sampleRows.length} parsed rows out of ${previewData.totalRowsParsed.toLocaleString()} total rows`}
          action={
            <button
              type="button"
              onClick={() => setPreviewData(null)}
              style={{ color: 'var(--text-muted)', padding: '0.3rem' }}
              aria-label="Close CSV preview"
            >
              <X size={18} />
            </button>
          }
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-medium)' }}
        >
          {/* Validation Checklist */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <Badge variant={previewData.hasRequiredColumns ? 'success' : 'danger'}>
              {previewData.hasRequiredColumns ? 'Required Columns Present' : `Missing: ${previewData.missingColumns.join(', ')}`}
            </Badge>
            <Badge variant={previewData.isMonotonic ? 'success' : 'warning'}>
              {previewData.isMonotonic ? 'Chronological Monotonicity' : 'Chronology Warning (Sorted on server)'}
            </Badge>
            <Badge variant="info">Size: {(previewData.file.size / 1024).toFixed(1)} KB</Badge>
          </div>

          {/* Raw Rows Table */}
          <div style={{ overflowX: 'auto', maxHeight: '300px', overflowY: 'auto', marginBottom: '1rem', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-card)' }}>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '0.5rem 0.75rem' }}>#</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Date</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Open</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>High</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Low</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Close</th>
                  <th style={{ padding: '0.5rem 0.75rem' }}>Volume</th>
                </tr>
              </thead>
              <tbody>
                {previewData.sampleRows.map((r, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.date}</td>
                    <td style={{ padding: '0.45rem 0.75rem' }} className="tabular-nums">{r.open}</td>
                    <td style={{ padding: '0.45rem 0.75rem' }} className="tabular-nums">{r.high}</td>
                    <td style={{ padding: '0.45rem 0.75rem' }} className="tabular-nums">{r.low}</td>
                    <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600 }} className="tabular-nums">{r.close}</td>
                    <td style={{ padding: '0.45rem 0.75rem', color: 'var(--text-secondary)' }} className="tabular-nums">{r.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <Button variant="ghost" size="sm" onClick={() => setPreviewData(null)} disabled={isUploading}>
              Discard
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmUpload}
              isLoading={isUploading}
              disabled={!previewData.hasRequiredColumns || isUploading}
              icon={<Upload size={14} />}
            >
              Confirm & Save to Server data/
            </Button>
          </div>
        </Card>
      )}

      {/* Dataset Inventory Library with Sorting & Search */}
      <Card
        title="Dataset Library"
        subtitle="Historical datasets currently available in data/ directory"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
          </div>
        }
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th
                  style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('filename')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Filename</span>
                    <ArrowUpDown size={12} style={{ color: sortField === 'filename' ? 'var(--brand-blue)' : 'var(--text-muted)' }} />
                  </div>
                </th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Symbol</th>
                <th
                  style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('bars_count')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Bars Count</span>
                    <ArrowUpDown size={12} style={{ color: sortField === 'bars_count' ? 'var(--brand-blue)' : 'var(--text-muted)' }} />
                  </div>
                </th>
                <th
                  style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('end_date')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Date Range</span>
                    <ArrowUpDown size={12} style={{ color: sortField === 'end_date' ? 'var(--brand-blue)' : 'var(--text-muted)' }} />
                  </div>
                </th>
                <th
                  style={{ padding: '0.75rem 0.5rem', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => toggleSort('file_size_bytes')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>Size</span>
                    <ArrowUpDown size={12} style={{ color: sortField === 'file_size_bytes' ? 'var(--brand-blue)' : 'var(--text-muted)' }} />
                  </div>
                </th>
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye size={13} />}
                          onClick={() => setInspectedDataset(d)}
                          title="Inspect dataset metadata and parameters"
                        >
                          Inspect
                        </Button>
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
                      </div>
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

      {/* Dataset Inspector Modal / Drawer */}
      {inspectedDataset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
          onClick={() => setInspectedDataset(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-medium)',
              borderRadius: '10px',
              width: '100%',
              maxWidth: '520px',
              padding: '1.75rem',
              boxShadow: 'var(--shadow-lg)',
              color: 'var(--text-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                    {inspectedDataset.filename}
                  </h2>
                  <Badge variant="primary">{inspectedDataset.symbol}</Badge>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Verified Historical Market Dataset
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedDataset(null)}
                style={{ color: 'var(--text-muted)', padding: '0.25rem' }}
                aria-label="Close dataset inspector"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Total Bars Count</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700 }} className="tabular-nums">
                  {inspectedDataset.bars_count.toLocaleString()}
                </span>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>File Size</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 700 }} className="tabular-nums">
                  {(inspectedDataset.file_size_bytes / 1024).toFixed(1)} KB
                </span>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Start Date</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{inspectedDataset.start_date}</span>
              </div>

              <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '6px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>End Date</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>{inspectedDataset.end_date}</span>
              </div>
            </div>

            <div style={{ padding: '0.85rem', backgroundColor: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border-subtle)', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--profit)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <CheckCircle size={16} />
                <span>Backend Validation Verified</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                Stored at <code>data/{inspectedDataset.filename}</code>. Clean OHLCV series sorted chronologically
                with positive non-zero prices, valid timestamps, and zero look-ahead bias compatibility.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <Button
                variant="primary"
                size="md"
                icon={<FlaskConical size={16} />}
                onClick={() => {
                  setConfig((prev) => ({ ...prev, dataset: inspectedDataset.filename }));
                  setInspectedDataset(null);
                  navigate('/strategy-lab');
                }}
              >
                Launch in Strategy Lab
              </Button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FileText size={14} />}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setConfig((prev) => ({ ...prev, dataset: inspectedDataset.filename }));
                    setInspectedDataset(null);
                    navigate('/analytics');
                  }}
                >
                  Tear-Sheet Risk
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Briefcase size={14} />}
                  style={{ flex: 1 }}
                  onClick={() => {
                    setInspectedDataset(null);
                    navigate('/portfolio');
                  }}
                >
                  Portfolio Basket
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
