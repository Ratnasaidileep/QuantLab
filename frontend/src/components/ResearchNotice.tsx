export function ResearchNotice() {
  return (
    <footer className="research-notice">
      <div className="notice-icon">ℹ️</div>
      <div className="notice-body">
        <h4>Academic & Quantitative Research Methodology</h4>
        <p>
          QuantLab simulates historical market execution for quantitative research and educational evaluation.
          Signals are derived at bar <em>t</em>'s close and simulated at bar <em>t+1</em>'s open with explicit
          bid-ask slippage and broker commissions to mitigate look-ahead bias and unrealistic execution assumptions.
          Simulated past performance does not guarantee future financial market results.
        </p>
      </div>
    </footer>
  );
}
