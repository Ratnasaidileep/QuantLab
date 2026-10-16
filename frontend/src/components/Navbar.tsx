import type { UserDTO } from '../types';

interface NavbarProps {
  apiStatus: 'online' | 'offline' | 'checking';
  apiVersion?: string;
  currentUser: UserDTO | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

export function Navbar({
  apiStatus,
  apiVersion,
  currentUser,
  onOpenAuth,
  onLogout,
}: NavbarProps) {
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

        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary, #f8fafc)',
                background: 'var(--bg-secondary, #1e293b)',
                padding: '0.35rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #334155)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <span>👤</span>
              <span>{currentUser.username}</span>
            </span>
            <button
              type="button"
              onClick={onLogout}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
              title="Sign out of your workspace"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '0.82rem', padding: '0.35rem 0.75rem' }}
          >
            🔐 Sign In / Register
          </button>
        )}
      </div>
    </header>
  );
}
