import { ReactNode } from 'react';
import { AdminCard } from './AdminCard';

interface AdminStatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  /** Optional delta line, e.g. "+12 this week". */
  delta?: { value: string; tone?: 'positive' | 'danger' | 'neutral' };
}

// Compact KPI tile: label, oversized monospace number, optional icon + delta.
export function AdminStatCard({ label, value, hint, icon, delta }: AdminStatCardProps) {
  const deltaColor =
    delta?.tone === 'positive'
      ? 'hsl(var(--admin-positive))'
      : delta?.tone === 'danger'
      ? 'hsl(var(--admin-danger))'
      : 'hsl(var(--admin-text-muted))';

  return (
    <AdminCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'hsl(var(--admin-text-muted))' }}>
          {label}
        </span>
        {icon && <span style={{ color: 'hsl(var(--admin-accent-blue))' }}>{icon}</span>}
      </div>
      <div className="admin-num text-3xl font-semibold leading-none" style={{ color: 'hsl(var(--admin-text))' }}>
        {value}
      </div>
      {(hint || delta) && (
        <div className="flex items-center gap-2 text-xs">
          {delta && <span style={{ color: deltaColor }} className="font-medium">{delta.value}</span>}
          {hint && <span style={{ color: 'hsl(var(--admin-text-muted))' }}>{hint}</span>}
        </div>
      )}
    </AdminCard>
  );
}
