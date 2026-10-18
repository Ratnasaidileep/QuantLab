import { Link } from 'react-router-dom';
import {
  Activity,
  ShieldCheck,
  TrendingUp,
  Dice5,
  RefreshCw,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';

export function LandingPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1.5rem',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%',
        gap: '3.5rem',
      }}
    >
      {/* Hero Section */}
      <div style={{ textAlign: 'center', maxWidth: '820px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '20px',
            backgroundColor: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--accent-primary)',
            marginBottom: '1.25rem',
          }}
        >
          <Activity size={14} />
          <span>Institutional Quantitative Workstation</span>
        </div>

        <h1
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          Rigorous Algorithmic Trading Research &{' '}
          <span style={{ color: 'var(--accent-primary)' }}>Backtesting</span>
        </h1>

        <p
          style={{
            fontSize: '1.05rem',
            color: 'var(--text-secondary)',
            marginTop: '1.25rem',
            lineHeight: 1.6,
          }}
        >
          Design, backtest, and validate quantitative strategies with zero look-ahead bias,
          realistic transaction friction, PyFolio-grade risk tear-sheets, and 1,000-path Monte Carlo simulations.
        </p>

        {/* Action CTAs */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
            marginTop: '2rem',
          }}
        >
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.75rem',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 700,
              backgroundColor: 'var(--accent-primary)',
              color: '#090d16',
              textDecoration: 'none',
              boxShadow: 'var(--shadow-md)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span>Sign In to Platform</span>
            <ArrowRight size={16} />
          </Link>

          <Link
            to="/register"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.75rem',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              textDecoration: 'none',
              transition: 'all var(--transition-fast)',
            }}
          >
            <span>Create Free Account</span>
          </Link>
        </div>

        {/* Guest Demo Bypass Link */}
        <div style={{ marginTop: '1.25rem' }}>
          <Link
            to="/dashboard"
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            <span>Evaluator / Academic Demo Access &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Feature Pillar Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1.25rem',
          width: '100%',
        }}
      >
        <Card style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              marginBottom: '1rem',
            }}
          >
            <ShieldCheck size={20} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            Zero Look-Ahead Bias
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Strict event-driven architecture executes orders at bar <em>t+1</em> Open based on bar <em>t</em> Close signals with basis-point slippage and commission accounting.
          </p>
        </Card>

        <Card style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid var(--profit-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--profit-green)',
              marginBottom: '1rem',
            }}
          >
            <TrendingUp size={20} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            PyFolio Risk Tear-Sheets
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Institutional tail-risk diagnostics: Parametric & Historical VaR (95%, 99%), Expected Shortfall (CVaR), Skewness, Kurtosis, and monthly calendar matrices.
          </p>
        </Card>

        <Card style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid #a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#a855f7',
              marginBottom: '1rem',
            }}
          >
            <Dice5 size={20} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            Monte Carlo Simulations
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Simulate 1,000+ synthetic paths using trade shuffling and bootstrapping to quantify sequence risk, ruin probability, and percentile confidence cones.
          </p>
        </Card>

        <Card style={{ padding: '1.5rem', backgroundColor: 'var(--bg-card)' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid #f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b',
              marginBottom: '1rem',
            }}
          >
            <RefreshCw size={20} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
            Walk-Forward Optimization
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Rolling & expanding in-sample and out-of-sample forward testing calculating Walk-Forward Efficiency (WFE) ratios to diagnose and prevent curve-fitting.
          </p>
        </Card>
      </div>

      {/* Quantitative Architecture Specifications Card */}
      <Card
        style={{
          width: '100%',
          padding: '1.5rem',
          backgroundColor: 'var(--bg-elevated)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
          <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
            Platform Technology & Architecture
          </h3>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            fontSize: '0.8rem',
            color: 'var(--text-secondary)',
          }}
        >
          <div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'block' }}>Backend Engine</span>
            <span>FastAPI, NumPy, Pandas, Pydantic v2</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'block' }}>Frontend Workstation</span>
            <span>React 19, TypeScript, Vite 8, Pure CSS Tokens</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'block' }}>Persistence Layer</span>
            <span>SQLite 3 with isolated user workspaces</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600, display: 'block' }}>Authentication</span>
            <span>Argon2 password hashing & signed JWT tokens</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
