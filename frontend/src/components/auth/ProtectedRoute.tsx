import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function ProtectedRoute() {
  const { isAuthenticated, isLoadingUser } = useAuth();
  const location = useLocation();

  if (isLoadingUser) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'var(--bg-app)',
          gap: '1rem',
        }}
      >
        <div className="spinner large"></div>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Authenticating session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
