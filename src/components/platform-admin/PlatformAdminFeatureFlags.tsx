import { useCallback, useEffect, useState } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { AdminPageHeader, AdminCard, AdminBadge, type AdminTone } from './ui';

interface FlagRow { key: string; description: string; default_enabled: boolean; lifecycle: string; override_count: number; }
interface OverrideRow { feature_key: string; organization_id: string; organization_type: string; company_name: string; enabled: boolean; expires_at: string | null; }

const lifecycleTone = (l: string): AdminTone =>
  l === 'ga' || l === 'general_availability' ? 'positive' : l === 'beta' ? 'info' : l === 'deprecated' ? 'danger' : 'warning';

export function PlatformAdminFeatureFlags() {
  const { toast } = useToast();
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = supabase as any;
    const [{ data: f, error: fe }, { data: o, error: oe }] = await Promise.all([
      client.rpc('admin_list_feature_flags'),
      client.rpc('admin_list_org_feature_flags'),
    ]);
    if (fe || oe) toast({ title: 'Error', description: (fe || oe)?.message ?? 'Failed to load flags', variant: 'destructive' });
    setFlags((f ?? []) as FlagRow[]);
    setOverrides((o ?? []) as OverrideRow[]);
    setLoading(false);
  }, [toast]);

  useEffect(() => { void load(); }, [load]);

  const toggleGlobal = async (key: string, enabled: boolean) => {
    setBusy(key);
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, default_enabled: enabled } : f))); // optimistic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('admin_set_global_feature_flag', { p_key: key, p_enabled: enabled });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, default_enabled: !enabled } : f))); // revert
    } else {
      toast({ title: 'Saved', description: `${key} default ${enabled ? 'enabled' : 'disabled'}.` });
    }
    setBusy(null);
  };

  const toggleOverride = async (row: OverrideRow, enabled: boolean) => {
    const id = `${row.organization_id}:${row.feature_key}`;
    setBusy(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('admin_set_org_feature_flag', {
      p_org_id: row.organization_id, p_org_type: row.organization_type, p_key: row.feature_key,
      p_enabled: enabled, p_expires: row.expires_at,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Saved', description: `Override updated for ${row.company_name}.` }); await load(); }
    setBusy(null);
  };

  const deleteOverride = async (row: OverrideRow) => {
    const id = `${row.organization_id}:${row.feature_key}`;
    setBusy(id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).rpc('admin_delete_org_feature_flag', {
      p_org_id: row.organization_id, p_org_type: row.organization_type, p_key: row.feature_key,
    });
    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Removed', description: `Override removed for ${row.company_name}.` }); await load(); }
    setBusy(null);
  };

  return (
    <div>
      <AdminPageHeader
        title="Feature Flags"
        description="Global defaults and per-organization overrides. Changes persist immediately."
        icon={<Flag className="h-5 w-5" />}
      />

      <AdminCard flush className="mb-5">
        <div className="border-b px-5 py-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Global defaults</h2>
        </div>
        <div>
          {loading ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Loading…</p>
          ) : flags.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-4 border-b px-5 py-3 last:border-b-0"
              style={{ borderColor: 'hsl(var(--admin-border))' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="admin-num text-sm font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{f.key}</span>
                  <AdminBadge tone={lifecycleTone(f.lifecycle)}>{f.lifecycle}</AdminBadge>
                  {f.override_count > 0 && <AdminBadge tone="neutral">{f.override_count} override{f.override_count === 1 ? '' : 's'}</AdminBadge>}
                </div>
                <p className="mt-0.5 truncate text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>{f.description}</p>
              </div>
              <Switch checked={f.default_enabled} disabled={busy === f.key} onCheckedChange={(v) => toggleGlobal(f.key, v)} />
            </div>
          ))}
        </div>
      </AdminCard>

      <AdminCard flush>
        <div className="border-b px-5 py-3" style={{ borderColor: 'hsl(var(--admin-border))' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'hsl(var(--admin-text))' }}>Per-organization overrides</h2>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>Loading…</p>
        ) : overrides.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm" style={{ color: 'hsl(var(--admin-text-muted))' }}>No overrides configured.</p>
        ) : overrides.map((o) => {
          const id = `${o.organization_id}:${o.feature_key}`;
          return (
            <div key={id} className="flex items-center justify-between gap-4 border-b px-5 py-3 last:border-b-0"
              style={{ borderColor: 'hsl(var(--admin-border))' }}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: 'hsl(var(--admin-text))' }}>{o.company_name}</span>
                  <AdminBadge tone="neutral">{o.organization_type}</AdminBadge>
                </div>
                <p className="admin-num mt-0.5 truncate text-xs" style={{ color: 'hsl(var(--admin-text-muted))' }}>
                  {o.feature_key}{o.expires_at ? ` · expires ${new Date(o.expires_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={o.enabled} disabled={busy === id} onCheckedChange={(v) => toggleOverride(o, v)} />
                <button onClick={() => deleteOverride(o)} disabled={busy === id}
                  className="rounded-md p-1.5 transition-colors hover:bg-[hsl(var(--admin-surface))]"
                  style={{ color: 'hsl(var(--admin-danger))' }} title="Remove override">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </AdminCard>
    </div>
  );
}
