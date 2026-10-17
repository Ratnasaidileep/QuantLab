import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import './App.css';

// Route-level code splitting for lightning-fast initial load
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
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage }))
);
const LoginPage = lazy(() =>
  import('./features/auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const RegisterPage = lazy(() =>
  import('./features/auth/RegisterPage').then((m) => ({ default: m.RegisterPage }))
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
        Loading module...
      </span>
    </div>
  );
}

export function App() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/strategy-lab" element={<StrategyLabPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/walk-forward" element={<WalkForwardPage />} />
          <Route path="/heatmap" element={<HeatmapPage />} />
          <Route path="/datasets" element={<DatasetsPage />} />
          <Route path="/experiments" element={<ExperimentsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
