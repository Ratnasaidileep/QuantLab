import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { PublicLayout } from './components/layout/PublicLayout';
import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import './App.css';

// Public Lazy Pages
const LandingPage = lazy(() =>
  import('./features/landing/LandingPage').then((m) => ({ default: m.LandingPage }))
);
const LoginPage = lazy(() =>
  import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('./features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))
);

// Authenticated Research Lazy Pages
const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const StrategyLabPage = lazy(() =>
  import('./features/strategy-lab/StrategyLabPage').then((m) => ({ default: m.StrategyLabPage }))
);
const AnalyticsPage = lazy(() =>
  import('./features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
);
const PortfolioPage = lazy(() =>
  import('./features/portfolio/PortfolioPage').then((m) => ({ default: m.PortfolioPage }))
);
const WalkForwardPage = lazy(() =>
  import('./features/walk-forward/WalkForwardPage').then((m) => ({ default: m.WalkForwardPage }))
);
const HeatmapPage = lazy(() =>
  import('./features/heatmap/HeatmapPage').then((m) => ({ default: m.HeatmapPage }))
);
const DatasetsPage = lazy(() =>
  import('./features/datasets/DatasetsPage').then((m) => ({ default: m.DatasetsPage }))
);
const ExperimentsPage = lazy(() =>
  import('./features/experiments/ExperimentsPage').then((m) => ({ default: m.ExperimentsPage }))
);
const ProfilePage = lazy(() =>
  import('./features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage }))
);
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);

function PageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        gap: '1rem',
      }}
    >
      <div className="spinner large"></div>
      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        Loading QuantLab...
      </span>
    </div>
  );
}

export function App() {
  const { isAuthenticated, isLoadingUser } = useAuth();

  if (isLoadingUser) {
    return <PageLoadingFallback />;
  }

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public SaaS Flow (Landing, Login, Register) */}
        <Route element={<PublicLayout />}>
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />}
          />
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
          />
          <Route
            path="/register"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
          />
        </Route>

        {/* Authenticated Research Workstation (Protected by Guard) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/strategy-lab" element={<StrategyLabPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/portfolio" element={<PortfolioPage />} />
            <Route path="/walk-forward" element={<WalkForwardPage />} />
            <Route path="/heatmap" element={<HeatmapPage />} />
            <Route path="/datasets" element={<DatasetsPage />} />
            <Route path="/experiments" element={<ExperimentsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Wildcard Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
