import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  glass?: boolean;
}

export function Card({
  title,
  subtitle,
  action,
  badge,
  glass = false,
  children,
  className = '',
  style,
  ...props
}: CardProps) {
  const cardStyle: React.CSSProperties = {
    backgroundColor: glass ? 'var(--glass-bg)' : 'var(--bg-card)',
    backdropFilter: glass ? 'var(--glass-blur)' : undefined,
    border: `1px solid ${glass ? 'var(--glass-border)' : 'var(--border-color)'}`,
    borderRadius: '10px',
    padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)',
    transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
    ...style,
  };

  const hasHeader = title || subtitle || action || badge;

  return (
    <div style={cardStyle} className={`quantlab-card ${className}`} {...props}>
      {hasHeader && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '1rem',
            paddingBottom: '0.75rem',
            borderBottom: '1px solid var(--border-subtle)',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {title && (
                <h3
                  style={{
                    fontSize: '1.05rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    margin: 0,
                  }}
                >
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && (
              <p
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.2rem',
                  margin: 0,
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
