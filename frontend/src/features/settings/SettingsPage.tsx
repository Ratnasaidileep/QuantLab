import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { User, Moon, Sun, Shield, Database, LogOut } from 'lucide-react';

export function SettingsPage() {
  const { currentUser, isAuthenticated, logout, openAuthModal } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', maxWidth: '900px' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Settings & Profile
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
          Manage your research workspace, appearance preferences, and platform environment.
        </p>
      </div>

      {/* Account / Workspace Section */}
      <Card
        title="Research Identity & Authentication"
        subtitle="User sessions and experiment ownership"
      >
        {isAuthenticated && currentUser ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--brand-glow)',
                  border: '1px solid var(--brand-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--brand-blue)',
                }}
              >
                <User size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {currentUser.username}
                  </span>
                  <Badge variant="primary" size="sm">Active Account</Badge>
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  User ID: {currentUser.id} • Registered: {new Date(currentUser.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Button
                variant="danger"
                size="sm"
                icon={<LogOut size={15} />}
                onClick={logout}
              >
                Sign Out of Workspace
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
              You are currently using QuantLab in <strong>Guest Mode</strong>. You can simulate strategies,
              analyze risk, and inspect data. To save private experiments isolated to your personal
              workspace, sign in or create an account.
            </p>
            <div>
              <Button variant="primary" size="sm" onClick={openAuthModal}>
                Sign In / Register Account
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Visual Appearance & Theme */}
      <Card
        title="Visual Appearance"
        subtitle="Toggle between dark institutional mode and high-contrast light mode"
      >
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div
            onClick={() => setTheme('dark')}
            style={{
              flex: 1,
              minWidth: '180px',
              padding: '1rem',
              borderRadius: '8px',
              border: `2px solid ${theme === 'dark' ? 'var(--brand-blue)' : 'var(--border-color)'}`,
              backgroundColor: 'var(--bg-elevated)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'border-color var(--transition-fast)',
            }}
          >
            <div style={{ color: theme === 'dark' ? 'var(--brand-blue)' : 'var(--text-secondary)' }}>
              <Moon size={22} />
            </div>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                Dark Terminal
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Institutional slate theme (Default)
              </span>
            </div>
          </div>

          <div
            onClick={() => setTheme('light')}
            style={{
              flex: 1,
              minWidth: '180px',
              padding: '1rem',
              borderRadius: '8px',
              border: `2px solid ${theme === 'light' ? 'var(--brand-blue)' : 'var(--border-color)'}`,
              backgroundColor: 'var(--bg-elevated)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              transition: 'border-color var(--transition-fast)',
            }}
          >
            <div style={{ color: theme === 'light' ? 'var(--brand-blue)' : 'var(--text-secondary)' }}>
              <Sun size={22} />
            </div>
            <div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>
                Light Terminal
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                High-contrast daytime presentation
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Platform Architecture & Specifications */}
      <Card
        title="Architecture & Environment"
        subtitle="Underlying quantitative infrastructure components"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
          <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <Shield size={14} style={{ color: 'var(--profit)' }} />
              <span>Execution Engine</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              Next-Bar Open ($t+1$)
            </span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Zero look-ahead bias guarantee
            </span>
          </div>

          <div style={{ padding: '0.75rem', borderRadius: '6px', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <Database size={14} style={{ color: 'var(--brand-blue)' }} />
              <span>Persistence Layer</span>
            </div>
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              SQLite 3 (quantlab.db)
            </span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Foreign key cascades & user isolation
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
