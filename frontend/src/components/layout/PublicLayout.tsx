import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Activity, Moon, Sun, Lock, UserPlus } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { fetchHealth } from '../../api/client';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';

export function PublicLayout() {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [apiVersion, setApiVersion] = useState<string>('0.1.0');

  useEffect(() => {
    let isMounted = true;
    async function checkBackend() {
      try {
        const health = await fetchHealth();
        if (isMounted) {
          setApiStatus('online');
          setApiVersion(health.version);
        }
      } catch {
        if (isMounted) {
          setApiStatus('offline');
        }
      }
    }
    void checkBackend();
    return () => {
      isMounted = false;
    };
  }, []);

  const isLoginPage = location.pathname === '/login';
  const isRegisterPage = location.pathname === '/register';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
      }}
    >
      {/* Public Header */}
      <header
        style={{
          height: '64px',
          backgroundColor: 'var(--glass-bg)',
          backdropFilter: 'var(--glass-blur)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 1.5rem',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Brand Logo */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            textDecoration: 'none',
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}
          >
            <Activity size={19} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.15rem', letterSpacing: '-0.02em' }}>
            Quant<span style={{ color: 'var(--accent-primary)' }}>Lab</span>
          </span>
        </Link>

        {/* Public Header Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Badge
            variant={apiStatus === 'online' ? 'success' : apiStatus === 'checking' ? 'warning' : 'danger'}
            dot
            size="sm"
          >
            {apiStatus === 'online' ? `Engine v${apiVersion}` : apiStatus === 'checking' ? 'Connecting' : 'Engine Offline'}
          </Badge>

          <Tooltip content={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} position="bottom">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
              }}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </Tooltip>

          {!isLoginPage && (
            <Link
              to="/login"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-color)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <Lock size={13} />
              <span>Sign In</span>
            </Link>
          )}

          {!isRegisterPage && (
            <Link
              to="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.4rem 0.95rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
                color: '#090d16',
                backgroundColor: 'var(--accent-primary)',
                border: '1px solid var(--accent-primary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              <UserPlus size={14} />
              <span>Create Account</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Public Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </main>

      {/* Public Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '1.25rem 1.5rem',
          backgroundColor: 'var(--bg-card)',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>QuantLab</span> &bull; Full-Stack Quantitative Research Platform
        </div>
        <div>
          Academic Major Project &bull; Powered by FastAPI & React 19 &bull; Zero Look-Ahead Bias Guarantee
        </div>
      </footer>
    </div>
  );
}
