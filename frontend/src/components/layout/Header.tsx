import { Menu, Moon, Sun, User, LogOut, ExternalLink } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Tooltip } from '../ui/Tooltip';

export interface HeaderProps {
  apiStatus: 'online' | 'offline' | 'checking';
  apiVersion?: string;
  onOpenMobileMenu: () => void;
}

export function Header({
  apiStatus,
  apiVersion = '0.1.0',
  onOpenMobileMenu,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, openAuthModal } = useAuth();

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
        padding: '0 1.5rem',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        transition: 'background-color var(--transition-normal), border-color var(--transition-normal)',
      }}
    >
      {/* Left Area: Mobile hamburger & Context */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
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
          }}
        >
          <Menu size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Badge
            variant={apiStatus === 'online' ? 'success' : apiStatus === 'checking' ? 'warning' : 'danger'}
            dot
            size="sm"
          >
            {apiStatus === 'online'
              ? `Engine v${apiVersion}`
              : apiStatus === 'checking'
                ? 'Connecting...'
                : 'Engine Offline'}
          </Badge>

          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              textDecoration: 'none',
            }}
            title="Open OpenAPI Swagger Documentation in new tab"
          >
            <span>Swagger API</span>
            <ExternalLink size={11} />
          </a>
        </div>
      </div>

      {/* Right Area: Theme Toggle & User Account */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {/* Theme Toggle Button */}
        <Tooltip content={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`} position="bottom">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle visual color theme"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'var(--border-medium)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
            }}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </Tooltip>

        {/* User Account / Sign In */}
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              <User size={15} style={{ color: 'var(--brand-blue)' }} />
              <span>{currentUser.username}</span>
            </div>

            <Tooltip content="Sign out of current workspace" position="bottom">
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                icon={<LogOut size={14} />}
                aria-label="Log out"
              >
                Logout
              </Button>
            </Tooltip>
          </div>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={openAuthModal}
            icon={<User size={14} />}
          >
            Sign In / Register
          </Button>
        )}
      </div>
    </header>
  );
}
