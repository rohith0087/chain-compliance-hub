import { ReactNode } from 'react';

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (buttons, filters). */
  actions?: ReactNode;
  icon?: ReactNode;
}

// Consistent page title row for every admin tab.
export function AdminPageHeader({ title, description, actions, icon }: AdminPageHeaderProps) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        {icon && (
          <div
            className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: 'hsl(var(--admin-accent-weak))', color: 'hsl(var(--admin-accent-blue))' }}
          >
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
