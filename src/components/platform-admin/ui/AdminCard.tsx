import { ReactNode, CSSProperties } from 'react';

interface AdminCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Removes inner padding (e.g. when wrapping a full-bleed table). */
  flush?: boolean;
}

// White, hairline-bordered card with a soft shadow — the Enterprise-Light base surface.
export function AdminCard({ children, className = '', style, flush = false }: AdminCardProps) {
  return (
    <div
      className={`rounded-xl ${flush ? '' : 'p-5'} ${className}`}
      style={{
        background: 'hsl(var(--admin-card))',
        border: '1px solid hsl(var(--admin-border))',
        boxShadow: 'var(--admin-shadow)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
