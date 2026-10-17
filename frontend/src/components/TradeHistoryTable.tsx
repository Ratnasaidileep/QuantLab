import { useState, useMemo } from 'react';
import {
  Download,
  Search,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Radio,
  Clock,
} from 'lucide-react';
import type { TradeDTO } from '../types';

interface TradeHistoryTableProps {
  trades: TradeDTO[];
}

type TradeFilter = 'all' | 'buy' | 'sell' | 'stop_loss' | 'take_profit' | 'signal';
type SortField = 'timestamp' | 'price' | 'quantity' | 'commission';
type SortDirection = 'asc' | 'desc';

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  const [filter, setFilter] = useState<TradeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);

  // Summary Metrics
  const summary = useMemo(() => {
    let totalComm = 0;
    let buyCount = 0;
    let sellCount = 0;
    let stopLossCount = 0;
    let takeProfitCount = 0;

    trades.forEach((t) => {
      totalComm += t.commission;
      if (t.side.toLowerCase() === 'buy') {
        buyCount++;
      } else {
        sellCount++;
        if (t.exit_reason === 'stop_loss') stopLossCount++;
        else if (t.exit_reason === 'take_profit') takeProfitCount++;
      }
    });

    return { totalComm, buyCount, sellCount, stopLossCount, takeProfitCount };
  }, [trades]);

  // Filtering & Sorting
  const filteredTrades = useMemo(() => {
    let result = [...trades];

    // Category Filter
    if (filter === 'buy') {
      result = result.filter((t) => t.side.toLowerCase() === 'buy');
    } else if (filter === 'sell') {
      result = result.filter((t) => t.side.toLowerCase() === 'sell');
    } else if (filter === 'stop_loss') {
      result = result.filter((t) => t.exit_reason === 'stop_loss');
    } else if (filter === 'take_profit') {
      result = result.filter((t) => t.exit_reason === 'take_profit');
    } else if (filter === 'signal') {
      result = result.filter((t) => !t.exit_reason || t.exit_reason === 'signal');
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.timestamp.toLowerCase().includes(q) ||
          t.price.toString().includes(q) ||
          t.side.toLowerCase().includes(q) ||
          (t.exit_reason && t.exit_reason.toLowerCase().includes(q))
      );
    }

    // Sorting
    result.sort((a, b) => {
      let valA: string | number = a[sortField];
      let valB: string | number = b[sortField];

      if (sortField === 'timestamp') {
        valA = new Date(a.timestamp).getTime();
        valB = new Date(b.timestamp).getTime();
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [trades, filter, searchQuery, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTrades.length / pageSize));
  const paginatedTrades = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTrades.slice(start, start + pageSize);
  }, [filteredTrades, currentPage, pageSize]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    if (trades.length === 0) return;
    const headers = ['#', 'Timestamp', 'Side', 'Price', 'Quantity', 'Commission', 'Trigger_Reason'];
    const rows = trades.map((t, i) => [
      i + 1,
      t.timestamp,
      t.side.toUpperCase(),
      t.price.toFixed(4),
      t.quantity.toFixed(4),
      t.commission.toFixed(4),
      t.exit_reason || (t.side.toLowerCase() === 'buy' ? 'entry' : 'signal'),
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `quantlab_trades_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (trades.length === 0) {
    return (
      <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <Clock size={28} style={{ color: 'var(--text-tertiary)', marginBottom: '0.5rem' }} />
        <h4 style={{ margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>No Trades Executed</h4>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          No buy or sell orders were generated under the selected parameter set and friction criteria.
        </p>
      </div>
    );
  }

  return (
    <div className="table-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Table Header & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Executed Trade History
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
            Audited execution log filled at $t+1$ Open with slippage and commission deducted.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}
        >
          <Download size={14} />
          Export CSV
        </button>
      </div>

      {/* Summary Stats Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.5rem',
          padding: '0.65rem 0.85rem',
          backgroundColor: 'var(--bg-elevated)',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          fontSize: '0.75rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Total Trades</span>
          <strong className="font-mono" style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
            {trades.length}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Buy Entries</span>
          <strong className="font-mono" style={{ color: 'var(--profit)', fontSize: '0.85rem' }}>
            {summary.buyCount}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Sell Exits</span>
          <strong className="font-mono" style={{ color: 'var(--loss)', fontSize: '0.85rem' }}>
            {summary.sellCount}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Stop-Loss Exits</span>
          <strong className="font-mono" style={{ color: summary.stopLossCount > 0 ? 'var(--loss)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {summary.stopLossCount}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Take-Profit Exits</span>
          <strong className="font-mono" style={{ color: summary.takeProfitCount > 0 ? 'var(--profit)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
            {summary.takeProfitCount}
          </strong>
        </div>
        <div>
          <span style={{ color: 'var(--text-tertiary)', display: 'block' }}>Total Friction Paid</span>
          <strong className="font-mono" style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>
            {formatCurrency(summary.totalComm)}
          </strong>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all', label: `All (${trades.length})` },
              { id: 'buy', label: `Buy (${summary.buyCount})` },
              { id: 'sell', label: `Sell (${summary.sellCount})` },
              { id: 'stop_loss', label: `Stop-Loss (${summary.stopLossCount})` },
              { id: 'take_profit', label: `Take-Profit (${summary.takeProfitCount})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setFilter(item.id);
                setCurrentPage(1);
              }}
              style={{
                background: filter === item.id ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                color: filter === item.id ? '#090d16' : 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '0.25rem 0.55rem',
                fontSize: '0.72rem',
                fontWeight: filter === item.id ? 700 : 500,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '200px' }}>
          <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search date or price..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '0.3rem 0.5rem 0.3rem 1.6rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      {/* Responsive Data Table */}
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>#</th>
              <th
                onClick={() => handleSort('timestamp')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Execution Date
                  <ArrowUpDown size={12} />
                </span>
              </th>
              <th>Side</th>
              <th
                onClick={() => handleSort('price')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Fill Price
                  <ArrowUpDown size={12} />
                </span>
              </th>
              <th
                onClick={() => handleSort('quantity')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Shares
                  <ArrowUpDown size={12} />
                </span>
              </th>
              <th
                onClick={() => handleSort('commission')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Commission
                  <ArrowUpDown size={12} />
                </span>
              </th>
              <th>Trigger / Exit Reason</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTrades.map((trade, idx) => {
              const globalIdx = (currentPage - 1) * pageSize + idx + 1;
              const isBuy = trade.side.toLowerCase() === 'buy';

              return (
                <tr key={idx}>
                  <td className="font-mono" style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
                    {globalIdx}
                  </td>
                  <td className="font-mono">
                    {trade.timestamp.slice(0, 19).replace('T', ' ')}
                  </td>
                  <td>
                    <span className={`side-badge ${trade.side.toLowerCase()}`}>
                      {trade.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="font-mono">{formatCurrency(trade.price)}</td>
                  <td className="font-mono">{trade.quantity.toFixed(2)}</td>
                  <td className="font-mono" style={{ color: 'var(--text-tertiary)' }}>
                    {formatCurrency(trade.commission)}
                  </td>
                  <td>
                    {isBuy ? (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Radio size={12} style={{ color: 'var(--profit)' }} />
                        Strategy Entry
                      </span>
                    ) : trade.exit_reason === 'stop_loss' ? (
                      <span style={{ color: 'var(--loss)', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <XCircle size={12} />
                        Stop-Loss Hit
                      </span>
                    ) : trade.exit_reason === 'take_profit' ? (
                      <span style={{ color: 'var(--profit)', fontWeight: 600, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <CheckCircle2 size={12} />
                        Take-Profit Hit
                      </span>
                    ) : (
                      <span style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Radio size={12} />
                        Strategy Signal
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.78rem',
          color: 'var(--text-secondary)',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              padding: '0.2rem 0.4rem',
              fontSize: '0.75rem',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–
            {Math.min(currentPage * pageSize, filteredTrades.length)} of {filteredTrades.length} trades
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            Prev
          </button>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontFamily: 'var(--font-mono)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
