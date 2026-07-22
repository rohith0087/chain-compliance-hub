import { ReactNode } from 'react';

export type AdminTone = 'neutral' | 'info' | 'positive' | 'warning' | 'danger';

const TONE: Record<AdminTone, { bg: string; fg: string; bd: string }> = {
  neutral: { bg: 'hsl(var(--admin-surface))', fg: 'hsl(var(--admin-text-muted))', bd: 'hsl(var(--admin-border))' },
  info:    { bg: 'hsl(var(--admin-accent-weak))', fg: 'hsl(var(--admin-accent-blue))', bd: 'hsl(var(--admin-accent-blue) / 0.25)' },
  positive:{ bg: 'hsl(var(--admin-positive) / 0.10)', fg: 'hsl(var(--admin-positive))', bd: 'hsl(var(--admin-positive) / 0.25)' },
  warning: { bg: 'hsl(var(--admin-warning) / 0.12)', fg: 'hsl(var(--admin-warning))', bd: 'hsl(var(--admin-warning) / 0.28)' },
  danger:  { bg: 'hsl(var(--admin-danger) / 0.10)', fg: 'hsl(var(--admin-danger))', bd: 'hsl(var(--admin-danger) / 0.28)' },
};

interface AdminBadgeProps {
  children: ReactNode;
  tone?: AdminTone;
  className?: string;
}

// Small status pill used across the admin portal.
export function AdminBadge({ children, tone = 'neutral', className = '' }: AdminBadgeProps) {
  const t = TONE[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.bd}` }}
    >
      {children}
    </span>
  );
}
