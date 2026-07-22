import { ReactNode } from 'react';

export interface AdminColumn<T> {
  key: string;
  header: ReactNode;
  render?: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  /** Render this cell in tabular monospace. */
  mono?: boolean;
  width?: string | number;
}

interface AdminDataTableProps<T> {
  columns: AdminColumn<T>[];
  rows: T[];
  rowKey: (row: T, i: number) => string;
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}

// Dense, hairline-bordered data table for the Enterprise-Light admin theme.
export function AdminDataTable<T>({
  columns, rows, rowKey, loading = false, empty = 'No records.', onRowClick, className = '',
}: AdminDataTableProps<T>) {
  const border = '1px solid hsl(var(--admin-border))';

  return (
    <div className={`w-full overflow-x-auto ${className}`}>
      <table className="w-full border-collapse text-sm" style={{ color: 'hsl(var(--admin-text))' }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className="whitespace-nowrap px-3 py-2.5 text-xs font-semibold uppercase tracking-wide"
                style={{
                  textAlign: c.align ?? 'left',
                  color: 'hsl(var(--admin-text-muted))',
                  borderBottom: border,
                  background: 'hsl(var(--admin-surface))',
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                Loading…
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'cursor-pointer transition-colors' : ''}
                style={{ borderBottom: border }}
                onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background = 'hsl(var(--admin-surface))'; }}
                onMouseLeave={(e) => { if (onRowClick) e.currentTarget.style.background = 'transparent'; }}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2.5 align-middle ${c.mono ? 'admin-num' : ''}`}
                    style={{ textAlign: c.align ?? 'left' }}
                  >
                    {c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
