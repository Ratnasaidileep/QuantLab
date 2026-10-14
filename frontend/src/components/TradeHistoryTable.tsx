import type { TradeDTO } from '../types';

interface TradeHistoryTableProps {
  trades: TradeDTO[];
}

export function TradeHistoryTable({ trades }: TradeHistoryTableProps) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);

  if (trades.length === 0) {
    return (
      <div className="empty-state">
        <p>No trades were executed under the selected parameters.</p>
      </div>
    );
  }

  return (
    <div className="table-card">
      <div className="table-header">
        <h3>Executed Trade History</h3>
        <span className="badge">{trades.length} Trades Executed</span>
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Side</th>
              <th>Price</th>
              <th>Quantity</th>
              <th>Commission</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, idx) => (
              <tr key={idx}>
                <td className="mono">{trade.timestamp.slice(0, 19).replace('T', ' ')}</td>
                <td>
                  <span className={`side-badge ${trade.side.toLowerCase()}`}>
                    {trade.side.toUpperCase()}
                  </span>
                </td>
                <td className="mono">{formatCurrency(trade.price)}</td>
                <td className="mono">{trade.quantity.toFixed(1)}</td>
                <td className="mono">{formatCurrency(trade.commission)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
