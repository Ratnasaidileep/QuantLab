import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Breadcrumbs } from './Breadcrumbs';
import { ResearchNotice } from '../ResearchNotice';
import { AuthModal } from '../AuthModal';
import { useAuth } from '../../hooks/useAuth';
import { fetchHealth } from '../../api/client';

export function AppLayout() {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('quantlab_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);
  const [apiStatus, setApiStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [apiVersion, setApiVersion] = useState<string>('0.1.0');

  const { isAuthModalOpen, closeAuthModal, setUser } = useAuth();

  useEffect(() => {
    try {
      localStorage.setItem('quantlab_sidebar_collapsed', isCollapsed ? 'true' : 'false');
    } catch {
      // Ignored
    }
  }, [isCollapsed]);

  useEffect(() => {
    async function checkBackend() {
      try {
        const health = await fetchHealth();
        setApiStatus('online');
        setApiVersion(health.version);
      } catch {
        setApiStatus('offline');
      }
    }
    checkBackend();
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
      }}
    >
      {/* Persistent Sidebar */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main App Workspace */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          minHeight: '100vh',
        }}
      >
        <Header
          apiStatus={apiStatus}
          apiVersion={apiVersion}
          onOpenMobileMenu={() => setIsMobileOpen(true)}
        />

        <main
          style={{
            flex: 1,
            padding: '1.5rem',
            maxWidth: '1600px',
            width: '100%',
            margin: '0 auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Breadcrumbs />

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Outlet />
          </div>

          <div style={{ marginTop: '2.5rem' }}>
            <ResearchNotice />
          </div>
        </main>
      </div>

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={closeAuthModal}
        onAuthSuccess={setUser}
      />
    </div>
  );
}
