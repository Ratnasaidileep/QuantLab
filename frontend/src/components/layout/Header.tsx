import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
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
  ChevronDown,
  Settings,
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

interface DropdownItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  desc?: string;
}

const PRIMARY_LINKS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/strategy-lab', label: 'Strategy Lab', icon: FlaskConical },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const OPTIMIZATION_ITEMS: DropdownItem[] = [
  { path: '/portfolio', label: 'Portfolio Basket', icon: Briefcase, desc: 'Multi-asset risk parity' },
  { path: '/walk-forward', label: 'Walk-Forward', icon: RefreshCw, desc: 'Out-of-sample stability' },
  { path: '/heatmap', label: 'Parameter Heatmap', icon: Grid, desc: '2D sensitivity grid' },
];

const DATA_ITEMS: DropdownItem[] = [
  { path: '/datasets', label: 'Dataset Library', icon: Database, desc: 'Curated market feeds' },
  { path: '/experiments', label: 'Saved Experiments', icon: Bookmark, desc: 'Logged backtest runs' },
];

export function Header({
  apiStatus,
  apiVersion = '0.1.0',
  onOpenMobileMenu,
}: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { currentUser, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeDropdown, setActiveDropdown] = useState<'optimization' | 'data' | 'profile' | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const profileContainerRef = useRef<HTMLDivElement>(null);

  const isOptimizationActive = OPTIMIZATION_ITEMS.some((item) =>
    location.pathname.startsWith(item.path)
  );
  const isDataActive = DATA_ITEMS.some((item) =>
    location.pathname.startsWith(item.path)
  );

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const clickedNav = navContainerRef.current?.contains(target);
      const clickedProfile = profileContainerRef.current?.contains(target);
      if (!clickedNav && !clickedProfile) {
        setActiveDropdown(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActiveDropdown(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleMouseEnter = (menu: 'optimization' | 'data') => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setActiveDropdown(menu);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveDropdown((prev) => (prev === 'profile' ? prev : null));
    }, 180);
  };

  const toggleDropdown = (menu: 'optimization' | 'data') => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setActiveDropdown((prev) => (prev === menu ? null : menu));
  };

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
      {/* Left: Mobile Hamburger & QuantLab Brand */}
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

      {/* Center: Consolidated Hover-Enabled Navigation */}
      <nav
        ref={navContainerRef}
        className="top-navbar-links"
        aria-label="Quantitative Research Navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          position: 'relative',
        }}
      >
        {/* Primary Links */}
        {PRIMARY_LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.path}
              to={link.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.4rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.82rem',
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

        {/* Dropdown 1: Optimization Tools */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => handleMouseEnter('optimization')}
          onMouseLeave={handleMouseLeave}
        >
          <button
            type="button"
            onClick={() => toggleDropdown('optimization')}
            aria-expanded={activeDropdown === 'optimization'}
            aria-haspopup="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: isOptimizationActive ? 600 : 500,
              color: isOptimizationActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              backgroundColor: isOptimizationActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              border: isOptimizationActive
                ? '1px solid rgba(56, 189, 248, 0.3)'
                : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Briefcase size={14} />
            <span>Optimization</span>
            <ChevronDown
              size={13}
              style={{
                transform: activeDropdown === 'optimization' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {activeDropdown === 'optimization' && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '240px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.4rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                zIndex: 110,
              }}
            >
              {OPTIMIZATION_ITEMS.map((item) => {
                const Icon = item.icon;
                const isCurrent = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setActiveDropdown(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      backgroundColor: isCurrent ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                      color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Icon size={16} style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.label}</span>
                      {item.desc && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {item.desc}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Dropdown 2: Data & Experiments */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => handleMouseEnter('data')}
          onMouseLeave={handleMouseLeave}
        >
          <button
            type="button"
            onClick={() => toggleDropdown('data')}
            aria-expanded={activeDropdown === 'data'}
            aria-haspopup="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              padding: '0.4rem 0.65rem',
              borderRadius: '6px',
              fontSize: '0.82rem',
              fontWeight: isDataActive ? 600 : 500,
              color: isDataActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
              backgroundColor: isDataActive ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              border: isDataActive
                ? '1px solid rgba(56, 189, 248, 0.3)'
                : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
          >
            <Database size={14} />
            <span>Data & Records</span>
            <ChevronDown
              size={13}
              style={{
                transform: activeDropdown === 'data' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>

          {activeDropdown === 'data' && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                width: '240px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.4rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                zIndex: 110,
              }}
            >
              {DATA_ITEMS.map((item) => {
                const Icon = item.icon;
                const isCurrent = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setActiveDropdown(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      padding: '0.5rem 0.65rem',
                      borderRadius: '6px',
                      textDecoration: 'none',
                      backgroundColor: isCurrent ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                      color: isCurrent ? 'var(--accent-primary)' : 'var(--text-primary)',
                      transition: 'background-color var(--transition-fast)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Icon size={16} style={{ marginTop: '0.15rem', flexShrink: 0 }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{item.label}</span>
                      {item.desc && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {item.desc}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      {/* Right: API Docs, Theme Toggle, Profile Avatar Dropdown */}
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

        {/* Profile Avatar & Interactive Dropdown Menu */}
        {isAuthenticated && currentUser ? (
          <div ref={profileContainerRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setActiveDropdown((prev) => (prev === 'profile' ? null : 'profile'))}
              aria-expanded={activeDropdown === 'profile'}
              aria-haspopup="true"
              aria-label="User Profile Menu"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.25rem 0.5rem 0.25rem 0.35rem',
                borderRadius: '20px',
                backgroundColor: activeDropdown === 'profile' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                transition: 'all var(--transition-fast)',
              }}
            >
              {/* Circular Avatar */}
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
              <ChevronDown
                size={13}
                style={{
                  color: 'var(--text-muted)',
                  transform: activeDropdown === 'profile' ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {/* Profile Dropdown Card */}
            {activeDropdown === 'profile' && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  width: '220px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '0.45rem',
                  boxShadow: '0 12px 28px -4px rgba(0, 0, 0, 0.55)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  zIndex: 120,
                }}
              >
                {/* User Info Header */}
                <div
                  style={{
                    padding: '0.5rem 0.65rem 0.6rem',
                    borderBottom: '1px solid var(--border-subtle)',
                    marginBottom: '0.2rem',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentUser.username}
                  </div>
                  <div
                    style={{
                      fontSize: '0.72rem',
                      color: 'var(--accent-primary)',
                      marginTop: '0.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <span>ID #{currentUser.id}</span>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <span style={{ color: 'var(--text-muted)' }}>Researcher</span>
                  </div>
                </div>

                {/* Profile & History Option */}
                <Link
                  to="/profile"
                  onClick={() => setActiveDropdown(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    textDecoration: 'none',
                    color: location.pathname === '/profile' ? 'var(--accent-primary)' : 'var(--text-primary)',
                    backgroundColor: location.pathname === '/profile' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== '/profile') e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== '/profile') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <User size={15} />
                  <span>Profile & History</span>
                </Link>

                {/* Settings Option */}
                <Link
                  to="/settings"
                  onClick={() => setActiveDropdown(null)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    textDecoration: 'none',
                    color: location.pathname === '/settings' ? 'var(--accent-primary)' : 'var(--text-primary)',
                    backgroundColor: location.pathname === '/settings' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    if (location.pathname !== '/settings') e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                  }}
                  onMouseLeave={(e) => {
                    if (location.pathname !== '/settings') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Settings size={15} />
                  <span>Settings</span>
                </Link>

                {/* Separator */}
                <div
                  style={{
                    height: '1px',
                    backgroundColor: 'var(--border-subtle)',
                    margin: '0.2rem 0',
                  }}
                />

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={() => {
                    setActiveDropdown(null);
                    logout();
                    navigate('/');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.55rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 500,
                    color: 'var(--loss-red, #f43f5e)',
                    backgroundColor: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'background-color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <LogOut size={15} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
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
