import { type FormEvent, useState } from 'react';
import { loginUser, registerUser } from '../api/client';
import type { UserDTO } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserDTO) => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError('Please enter a username.');
      return;
    }

    if (cleanUser.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginUser(cleanUser, password);
        onAuthSuccess(res.user);
        onClose();
      } else {
        const res = await registerUser(cleanUser, password);
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-secondary, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '420px',
          padding: '1.75rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
          color: 'var(--text-primary, #f8fafc)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            {mode === 'login' ? '🔐 Sign In to Workspace' : '✨ Create QuantLab Account'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary, #94a3b8)',
              fontSize: '1.25rem',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab switch */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'var(--bg-primary, #0f172a)',
            padding: '4px',
            borderRadius: '6px',
            marginBottom: '1.25rem',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.4rem',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: mode === 'login' ? 600 : 400,
              backgroundColor: mode === 'login' ? 'var(--color-primary, #2563eb)' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            style={{
              flex: 1,
              padding: '0.4rem',
              border: 'none',
              borderRadius: '4px',
              fontSize: '0.85rem',
              fontWeight: mode === 'register' ? 600 : 400,
              backgroundColor: mode === 'register' ? 'var(--color-primary, #2563eb)' : 'transparent',
              color: '#fff',
              cursor: 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--color-danger, #ef4444)',
              color: '#fca5a5',
              padding: '0.6rem 0.8rem',
              borderRadius: '6px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-secondary, #cbd5e1)' }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. quant_researcher"
              required
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #475569)',
                backgroundColor: 'var(--bg-primary, #0f172a)',
                color: '#fff',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: mode === 'register' ? '1rem' : '1.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-secondary, #cbd5e1)' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color, #475569)',
                backgroundColor: 'var(--bg-primary, #0f172a)',
                color: '#fff',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {mode === 'register' && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, #475569)',
                  backgroundColor: 'var(--bg-primary, #0f172a)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '0.6rem',
              fontSize: '0.92rem',
              fontWeight: 600,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {isLoading ? (
              <span className="spinner"></span>
            ) : mode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <p
          style={{
            marginTop: '1rem',
            marginBottom: 0,
            fontSize: '0.78rem',
            color: 'var(--text-secondary, #94a3b8)',
            textAlign: 'center',
          }}
        >
          🔐 Passwords protected with PBKDF2-HMAC-SHA256 & RFC 7519 JWT tokens.
        </p>
      </div>
    </div>
  );
}
