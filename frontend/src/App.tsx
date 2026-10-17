import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { StrategyLabPage } from './features/strategy-lab/StrategyLabPage';
import { AnalyticsPage } from './features/analytics/AnalyticsPage';
import { PortfolioPage } from './features/portfolio/PortfolioPage';
import { WalkForwardPage } from './features/walk-forward/WalkForwardPage';
import { HeatmapPage } from './features/heatmap/HeatmapPage';
import { DatasetsPage } from './features/datasets/DatasetsPage';
import { ExperimentsPage } from './features/experiments/ExperimentsPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import './App.css';

export function App() {
  return (
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
  );
}

export default App;
