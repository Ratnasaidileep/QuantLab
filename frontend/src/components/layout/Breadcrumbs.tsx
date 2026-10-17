import { ChevronRight, Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const ROUTE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  'strategy-lab': 'Strategy Lab',
  'analytics': 'Risk Tear-Sheet',
  'portfolio': 'Portfolio Basket',
  'walk-forward': 'Walk-Forward Optimization',
  'heatmap': 'Parameter Heatmap',
  'datasets': 'Dataset Library',
  'experiments': 'Saved Experiments',
  'settings': 'Settings & Profile',
  'login': 'Sign In',
  'register': 'Create Account',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
        marginBottom: '1rem',
      }}
    >
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          color: pathnames.length === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontWeight: pathnames.length === 0 ? 600 : 400,
        }}
      >
        <Home size={14} />
        <span>QuantLab</span>
      </Link>

      {pathnames.map((segment, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const label = ROUTE_LABELS[segment] || decodeURIComponent(segment);

        return (
          <div key={to} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ChevronRight size={13} style={{ color: 'var(--text-dim)' }} />
            {isLast ? (
              <span
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                }}
                aria-current="page"
              >
                {label}
              </span>
            ) : (
              <Link
                to={to}
                style={{
                  color: 'var(--text-secondary)',
                  fontWeight: 400,
                }}
              >
                {label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
