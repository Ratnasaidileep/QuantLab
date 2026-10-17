import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Menu,
  Moon,
  Sun,
  User,
  LogOut,
  ExternalLink,
  Activity,
  BarChart3,
  FlaskConical,
  Briefcase,
  RefreshCw,
  Grid,
  Database,
  Bookmark,
  LayoutDashboard,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';

export interface HeaderProps {
  apiStatus: 'online' | 'offline' | 'checking';
  apiVersion?: string;
  onOpenMobileMenu: () => void;
}

const NAV_LINKS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/strategy-lab', label: 'Strategy Lab', icon: FlaskConical },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { path: '/walk-forward', label: 'Walk-Forward', icon: RefreshCw },
  { path: '/heatmap', label: 'Heatmap', icon: Grid },
  { path: '/datasets', label: 'Datasets', icon: Database },
  { path: '/experiments', label: 'Experiments', icon: Bookmark },
];

export function Header({
  apiStatus,
  apiVersion = '0.1.0',
  onOpenMobileMenu,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Extract initial for user avatar
  const userInitial = currentUser?.username
    ? currentUser.username.charAt(0).toUpperCase()
    : 'U';

  return (
    <header
      style={{
        height: 'var(--header-height)',
        backgroundColor: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1.25rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        gap: '1rem',
      }}
    >
      {/* Left Area: Mobile Menu & Engine Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="mobile-hamburger-btn"
          aria-label="Open mobile navigation"
          style={{
            display: 'none',
            padding: '0.4rem',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Menu size={22} />
        </button>

        <Link
          to="/dashboard"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            color: 'var(--text-primary)',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
            }}
          >
            <Activity size={18} />
          </div>
          <span style={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.02em' }}>
            Quant<span style={{ color: 'var(--accent-primary)' }}>Lab</span>
          </span>
        </Link>

        <Badge
          variant={apiStatus === 'online' ? 'success' : apiStatus === 'checking' ? 'warning' : 'danger'}
          dot
          size="sm"
        >
          {apiStatus === 'online'
            ? `v${apiVersion}`
            : apiStatus === 'checking'
              ? 'Connecting'
              : 'Offline'}
        </Badge>
      </div>

      {/* Center Area: Top Navigation Bar with All QuantLab Options */}
      <nav
        className="top-navbar-links"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          overflowX: 'auto',
          padding: '0.2rem 0',
        }}
      >
        {NAV_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.path}
              to={link.path}
              end={link.path === '/'}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                border: isActive
                  ? '1px solid rgba(56, 189, 248, 0.3)'
                  : '1px solid transparent',
                transition: 'all var(--transition-fast)',
              })}
            >
              <Icon size={14} />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Right Area: Theme Toggle & Profile Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
        {/* Swagger Docs Link */}
        <a
          href="/docs"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.2rem',
            textDecoration: 'none',
            padding: '0.3rem 0.5rem',
            borderRadius: '4px',
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
          }}
          title="Open FastAPI Swagger Docs"
        >
          <span>API</span>
          <ExternalLink size={10} />
        </a>

        {/* Theme Toggle Button */}
        <Tooltip content={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} position="bottom">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            style={{
              width: '32px',
              height: '32px',
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

        {/* Profile Avatar & Redirection */}
        {isAuthenticated && currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <Tooltip content={`Profile & History (${currentUser.username})`} position="bottom">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.25rem 0.6rem 0.25rem 0.35rem',
                  borderRadius: '20px',
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  transition: 'all var(--transition-fast)',
                }}
              >
                {/* Circular Profile Avatar */}
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#090d16',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                  }}
                >
                  {userInitial}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{currentUser.username}</span>
              </button>
            </Tooltip>

            {/* Logout Shortcut */}
            <Tooltip content="Sign Out" position="bottom">
              <button
                type="button"
                onClick={logout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '0.35rem',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                }}
                aria-label="Log Out"
              >
                <LogOut size={15} />
              </button>
            </Tooltip>
          </div>
        ) : (
          <Link
            to="/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              backgroundColor: 'var(--accent-primary)',
              color: '#090d16',
              fontWeight: 600,
              fontSize: '0.78rem',
              textDecoration: 'none',
            }}
          >
            <User size={14} />
            <span>Sign In</span>
          </Link>
        )}
      </div>
    </header>
  );
}
