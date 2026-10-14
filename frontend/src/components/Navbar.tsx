interface NavbarProps {
  apiStatus: 'online' | 'offline' | 'checking';
  apiVersion?: string;
}

export function Navbar({ apiStatus, apiVersion }: NavbarProps) {
  return (
    <header className="navbar">
      <div className="nav-brand">
        <span className="brand-icon">📈</span>
        <div className="brand-titles">
          <h1>QuantLab</h1>
          <span className="brand-subtitle">
            Quantitative Research & Algorithmic Backtesting Platform
          </span>
        </div>
      </div>
      <div className="nav-actions">
        <div className={`status-badge ${apiStatus}`}>
          <span className="status-dot"></span>
          <span>
            {apiStatus === 'online'
              ? `FastAPI Engine: Active (v${apiVersion || '0.1.0'})`
              : apiStatus === 'checking'
                ? 'Connecting to Engine...'
                : 'FastAPI Engine: Offline'}
          </span>
        </div>
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          className="api-docs-link"
          title="Open interactive Swagger OpenAPI Documentation"
        >
          API Docs ↗
        </a>
      </div>
    </header>
  );
}
