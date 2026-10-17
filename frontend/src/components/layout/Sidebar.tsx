import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FlaskConical,
  FileText,
  Briefcase,
  GitCompare,
  Grid,
  Database,
  History,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/strategy-lab', label: 'Strategy Lab', icon: <FlaskConical size={18} /> },
  { to: '/analytics', label: 'Risk Tear-Sheet', icon: <FileText size={18} /> },
  { to: '/portfolio', label: 'Portfolio Basket', icon: <Briefcase size={18} /> },
  { to: '/walk-forward', label: 'Walk-Forward (OOS)', icon: <GitCompare size={18} /> },
  { to: '/heatmap', label: 'Parameter Heatmap', icon: <Grid size={18} /> },
  { to: '/datasets', label: 'Dataset Library', icon: <Database size={18} /> },
  { to: '/experiments', label: 'Saved Experiments', icon: <History size={18} /> },
  { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
];

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 998,
          }}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        style={{
          width: isCollapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width-expanded)',
          backgroundColor: 'var(--bg-card)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          position: 'sticky',
          top: 0,
          height: '100vh',
          zIndex: 999,
          transition: 'width var(--transition-normal), transform var(--transition-normal)',
          flexShrink: 0,
        }}
        className={`quantlab-sidebar ${isMobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Brand / Header in Sidebar */}
        <div
          style={{
            height: 'var(--header-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: isCollapsed ? '0' : '0 1.25rem',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <NavLink
            to="/"
            onClick={onCloseMobile}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              textDecoration: 'none',
              color: 'var(--text-primary)',
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                backgroundColor: 'var(--brand-glow)',
                border: '1px solid var(--brand-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: 'var(--brand-blue)',
                flexShrink: 0,
              }}
            >
              📈
            </div>
            {!isCollapsed && (
              <div>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', letterSpacing: '-0.02em', display: 'block' }}>
                  QuantLab
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', lineHeight: 1 }}>
                  Quantitative Terminal
                </span>
              </div>
            )}
          </NavLink>

          {/* Mobile close button */}
          <button
            type="button"
            onClick={onCloseMobile}
            className="mobile-close-btn"
            style={{
              display: 'none',
              color: 'var(--text-secondary)',
              padding: '0.25rem',
            }}
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Link List */}
        <nav
          style={{
            flex: 1,
            padding: '1rem 0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            overflowY: 'auto',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const linkContent = (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onCloseMobile}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: isCollapsed ? '0.65rem 0' : '0.65rem 0.85rem',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: '8px',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--bg-elevated)' : 'transparent',
                  border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  transition: 'all var(--transition-fast)',
                })}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'currentColor',
                  }}
                >
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.label}
                  </span>
                )}
              </NavLink>
            );

            return isCollapsed ? (
              <Tooltip key={item.to} content={item.label} position="right" delay={150}>
                {linkContent}
              </Tooltip>
            ) : (
              linkContent
            );
          })}
        </nav>

        {/* Bottom Collapse Toggle (Desktop only) */}
        <div
          style={{
            padding: '0.75rem',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: isCollapsed ? 'center' : 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              color: 'var(--text-secondary)',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color var(--transition-fast), color var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
      </aside>
    </>
  );
}
