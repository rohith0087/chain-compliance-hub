import { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, Search, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader, AdminCard, AdminBadge, AdminDataTable, type AdminColumn } from './ui';

interface TableInfo { table_name: string; approx_rows: number; }
interface ColInfo { column_name: string; data_type: string; }
type Row = Record<string, unknown>;

const PAGE = 50;

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function PlatformAdminDataExplorer() {
  const { toast } = useToast();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [filter, setFilter] = useState('');
  const [active, setActive] = useState<string | null>(null);
  const [cols, setCols] = useState<ColInfo[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [searchCol, setSearchCol] = useState<string>('');
  const [searchText, setSearchText] = useState('');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = supabase as any;

  useEffect(() => {
    rpc.rpc('admin_list_tables').then(({ data, error }: { data: TableInfo[] | null; error: { message: string } | null }) => {
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else setTables(data ?? []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadRows = useCallback(async (table: string, pg: number, sCol: string, sText: string) => {
    setLoading(true);
    const { data, error } = await rpc.rpc('admin_query_table', {
      p_table: table, p_limit: PAGE, p_offset: pg * PAGE,
      p_order_by: null, p_order_dir: 'asc',
      p_search_col: sCol || null, p_search: sText || null,
    });
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); setRows([]); }
    else setRows((data ?? []) as Row[]);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const openTable = useCallback(async (table: string) => {
    setActive(table); setPage(0); setSearchCol(''); setSearchText('');
    const { data } = await rpc.rpc('admin_table_columns', { p_table: table });
    setCols((data ?? []) as ColInfo[]);
    await loadRows(table, 0, '', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadRows]);

  const runSearch = () => { if (active) { setPage(0); loadRows(active, 0, searchCol, searchText); } };
  const changePage = (next: number) => { if (active && next >= 0) { setPage(next); loadRows(active, next, searchCol, searchText); } };

  const filtered = useMemo(
    () => tables.filter((t) => t.table_name.toLowerCase().includes(filter.toLowerCase())),
    [tables, filter],
  );

  const columns: AdminColumn<Row>[] = useMemo(
    () => cols.map((c) => ({
      key: c.column_name,
      header: c.column_name,
      mono: true,
      render: (row: Row) => {
        const txt = cellText(row[c.column_name]);
        return <span title={txt} className="block max-w-[280px] truncate">{txt}</span>;
      },
    })),
    [cols],
  );

  return (
    <div>
      <AdminPageHeader
        title="Data Explorer"
        description="Browse any table in the database."
        icon={<Database className="h-5 w-5" />}
        actions={<AdminBadge tone="info"><Lock className="mr-1 h-3 w-3" /> Read-only</AdminBadge>}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr]">
        {/* Table list */}
        <AdminCard flush className="h-fit">
          <div className="border-b p-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))' }}>
              <Search className="h-4 w-4" style={{ color: 'hsl(var(--admin-text-muted))' }} />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter tables…"
                className="w-full bg-transparent text-sm outline-none" style={{ color: 'hsl(var(--admin-text))' }} />
            </div>
          </div>
          <div className="max-h-[62vh] overflow-y-auto py-1">
            {filtered.map((t) => (
              <button key={t.table_name} onClick={() => openTable(t.table_name)}
                className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm transition-colors"
                style={{
                  background: active === t.table_name ? 'hsl(var(--admin-accent-weak))' : 'transparent',
                  color: active === t.table_name ? 'hsl(var(--admin-accent-blue))' : 'hsl(var(--admin-text))',
                }}>
                <span className="admin-num truncate">{t.table_name}</span>
                <span className="admin-num text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  {Math.round(t.approx_rows).toLocaleString()}
                </span>
              </button>
            ))}
          </div>
        </AdminCard>

        {/* Data grid */}
        <AdminCard flush className="min-w-0">
          {!active ? (
            <p className="px-5 py-16 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>
              Select a table to browse its rows.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b p-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
                <span className="admin-num text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>{active}</span>
                <div className="ml-auto flex items-center gap-2">
                  <select value={searchCol} onChange={(e) => setSearchCol(e.target.value)}
                    className="rounded-md px-2 py-1 text-xs outline-none"
                    style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                    <option value="">Search column…</option>
                    {cols.map((c) => <option key={c.column_name} value={c.column_name}>{c.column_name}</option>)}
                  </select>
                  <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()} placeholder="contains…"
                    className="rounded-md px-2 py-1 text-xs outline-none"
                    style={{ background: 'hsl(var(--admin-surface))', border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }} />
                  <button onClick={runSearch} disabled={!searchCol}
                    className="rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50"
                    style={{ background: 'hsl(var(--admin-accent-blue))', color: 'white' }}>Search</button>
                </div>
              </div>

              <AdminDataTable columns={columns} rows={rows} rowKey={(_, i) => String(page * PAGE + i)}
                loading={loading} empty="No rows." />

              <div className="flex items-center justify-between border-t p-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
                <span className="admin-num text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  rows {page * PAGE + 1}–{page * PAGE + rows.length}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => changePage(page - 1)} disabled={page === 0 || loading}
                    className="rounded-md p-1.5 disabled:opacity-40" style={{ border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => changePage(page + 1)} disabled={rows.length < PAGE || loading}
                    className="rounded-md p-1.5 disabled:opacity-40" style={{ border: '1px solid hsl(var(--admin-border))', color: 'hsl(var(--admin-text))' }}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
