import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  style,
  ...props
}: BadgeProps) {
  const getVariantStyles = (): { bg: string; text: string; border: string; dotColor: string } => {
    switch (variant) {
      case 'success':
        return {
          bg: 'var(--profit-bg)',
          text: 'var(--profit)',
          border: 'var(--profit-border)',
          dotColor: 'var(--profit)',
        };
      case 'danger':
        return {
          bg: 'var(--loss-bg)',
          text: 'var(--loss)',
          border: 'var(--loss-border)',
          dotColor: 'var(--loss)',
        };
      case 'warning':
        return {
          bg: 'var(--warning-bg)',
          text: 'var(--warning)',
          border: 'rgba(245, 158, 11, 0.25)',
          dotColor: 'var(--warning)',
        };
      case 'info':
        return {
          bg: 'var(--benchmark-bg)',
          text: 'var(--benchmark)',
          border: 'rgba(56, 189, 248, 0.25)',
          dotColor: 'var(--benchmark)',
        };
      case 'primary':
        return {
          bg: 'var(--brand-glow)',
          text: 'var(--brand-blue)',
          border: 'rgba(59, 130, 246, 0.3)',
          dotColor: 'var(--brand-blue)',
        };
      case 'neutral':
      default:
        return {
          bg: 'var(--bg-elevated)',
          text: 'var(--text-secondary)',
          border: 'var(--border-subtle)',
          dotColor: 'var(--text-muted)',
        };
    }
  };

  const { bg, text, border, dotColor } = getVariantStyles();

  const isSmall = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: isSmall ? '0.15rem 0.45rem' : '0.25rem 0.65rem',
        fontSize: isSmall ? '0.72rem' : '0.8rem',
        fontWeight: 600,
        borderRadius: '9999px',
        backgroundColor: bg,
        color: text,
        border: `1px solid ${border}`,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        ...style,
      }}
      className={`quantlab-badge ${className}`}
      {...props}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: dotColor,
          }}
        />
      )}
      {children}
    </span>
  );
}
