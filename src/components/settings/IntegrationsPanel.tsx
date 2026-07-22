/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, AlertTriangle, Plug, Unplug, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { AiIntegrationSection } from './AiIntegrationSection';
import {
  COMPOSIO_CATALOG,
  COMPOSIO_ROADMAP,
  type ComposioToolkitSlug,
} from './composioCatalog';
import { friendlyInvokeError, friendlyCallbackError } from './integrationErrors';

// Connection status as stored in composio_connections. No tokens ever reach the
// client -- this is metadata only.
type ComposioStatus = 'initiated' | 'active' | 'failed' | 'expired' | 'revoked';

interface ComposioConnectionRow {
  toolkit: string;
  status: ComposioStatus;
  connected_at: string | null;
  last_error: string | null;
}

interface IntegrationsPanelProps {
  /** Buyer org id — used only for the AI-provider section, which is org-scoped. */
  organizationId: string | null;
}

const STATUS_STYLES: Record<ComposioStatus, { label: string; className: string }> = {
  active: { label: 'Connected', className: 'text-success' },
  initiated: { label: 'Pending…', className: 'text-warning' },
  failed: { label: 'Failed', className: 'text-danger' },
  expired: { label: 'Reconnect needed', className: 'text-warning' },
  revoked: { label: 'Disconnected', className: 'text-muted-foreground' },
};

function relativeDate(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString();
}

/* ------------------------------------------------------------------ one row */

function ToolkitRow({
  slug,
  name,
  capability,
  logo,
  connection,
  onChanged,
}: {
  slug: ComposioToolkitSlug;
  name: string;
  capability: string;
  logo: React.ReactNode;
  connection: ComposioConnectionRow | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState<null | 'connect' | 'disconnect'>(null);
  const status = connection?.status;
  const isActive = status === 'active';

  const connect = async () => {
    setBusy('connect');
    const { data, error } = await supabase.functions.invoke('composio-connect', {
      body: { toolkit: slug },
    });
    if (!error && data?.redirectUrl) {
      // Hand off to the provider's consent screen. Composio returns the user
      // here (composio-callback) which redirects back into the app.
      window.location.href = data.redirectUrl as string;
      return;
    }
    toast.error(await friendlyInvokeError(error, data, `We couldn’t start the ${name} connection. Please try again.`));
    setBusy(null);
  };

  const disconnect = async () => {
    setBusy('disconnect');
    const { data, error } = await supabase.functions.invoke('composio-disconnect', {
      body: { toolkit: slug },
    });
    if (!error && !(data as any)?.error) {
      toast.success(`${name} disconnected`);
      onChanged();
    } else {
      toast.error(await friendlyInvokeError(error, data, `We couldn’t disconnect ${name}. Please try again.`));
    }
    setBusy(null);
  };

  const statusStyle = status ? STATUS_STYLES[status] : null;

  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-border bg-card p-3.5">
      {logo}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-body font-semibold text-foreground">{name}</span>
          {statusStyle && (
            <span className={`inline-flex items-center gap-1 text-micro font-medium ${statusStyle.className}`}>
              {isActive && <CheckCircle2 className="h-3 w-3" />}
              {statusStyle.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{capability}</p>
        {connection?.last_error && !isActive && (
          <p className="mt-1 flex items-center gap-1 text-micro text-danger">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {connection.last_error}
          </p>
        )}
        {isActive && connection?.connected_at && (
          <p className="mt-0.5 font-mono text-micro text-muted-foreground/80">
            Connected {relativeDate(connection.connected_at)}
          </p>
        )}
      </div>

      {isActive ? (
        <button
          onClick={disconnect}
          disabled={busy !== null}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] border border-border px-3 py-1.5 text-[12.5px] font-semibold text-foreground/80 transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          {busy === 'disconnect' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
          Disconnect
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={busy !== null}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-primary px-3.5 py-1.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {busy === 'connect' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
          {status === 'expired' ? 'Reconnect' : 'Connect'}
        </button>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- main panel */

export function IntegrationsPanel({ organizationId }: IntegrationsPanelProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ComposioConnectionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    // RLS scopes this to the caller; no org filter needed. Only metadata columns
    // are readable — auth_config_id / connected_account_id are withheld by grant.
    const { data } = await (supabase as any)
      .from('composio_connections')
      .select('toolkit, status, connected_at, last_error');
    setRows((data ?? []) as ComposioConnectionRow[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  // OAuth return: composio-callback redirects to /?composio_connected=<toolkit>
  // (or composio_error). Toast, refresh, and clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('composio_connected');
    const err = params.get('composio_error');
    if (!connected && !err) return;

    if (connected) {
      const name = COMPOSIO_CATALOG.find((c) => c.slug === connected)?.name ?? connected;
      toast.success(`${name} connected`);
      void load();
    }
    if (err) {
      toast.error(friendlyCallbackError(err));
    }
    const url = new URL(window.location.href);
    url.searchParams.delete('composio_connected');
    url.searchParams.delete('composio_error');
    window.history.replaceState({}, '', url.toString());
  }, [load]);

  const connectionByToolkit = useMemo(() => {
    const m = new Map<string, ComposioConnectionRow>();
    for (const r of rows) m.set(r.toolkit, r);
    return m;
  }, [rows]);

  const activeCount = rows.filter((r) => r.status === 'active').length;

  // Group the live catalogue by its `group` field.
  const groups = useMemo(() => {
    const g = new Map<string, typeof COMPOSIO_CATALOG>();
    for (const entry of COMPOSIO_CATALOG) {
      if (!g.has(entry.group)) g.set(entry.group, []);
      g.get(entry.group)!.push(entry);
    }
    return [...g.entries()];
  }, []);

  return (
    <div className="space-y-8">
      {/* AI provider — org-scoped, unchanged. Kept above the personal
          connections because it configures the assistant itself. */}
      {organizationId && (
        <section className="space-y-3">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Assistant
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              The AI model behind mapping, extraction, and the compliance assistant. Scoped to your organization.
            </p>
          </div>
          <AiIntegrationSection organizationId={organizationId} />
        </section>
      )}

      {/* Personal connections — the Composio part. */}
      <section className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-micro font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Your connections
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Apps the assistant can use <span className="font-medium text-foreground/80">as you</span>.
              Each person connects their own — your colleagues can’t see or use these.
            </p>
          </div>
          {!loading && activeCount > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 text-caption font-medium text-success">
              <CheckCircle2 className="h-4 w-4" />
              {activeCount} connected
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/70" />
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map(([group, entries]) => (
              <div key={group} className="space-y-2">
                <p className="text-micro font-medium text-muted-foreground/70">{group}</p>
                {entries.map((entry) => (
                  <ToolkitRow
                    key={entry.slug}
                    slug={entry.slug}
                    name={entry.name}
                    capability={entry.capability}
                    logo={entry.logo}
                    connection={connectionByToolkit.get(entry.slug) ?? null}
                    onChanged={() => void load()}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Ask-the-assistant nudge — the two-way link to /chat. */}
        {!loading && activeCount > 0 && (
          <button
            onClick={() =>
              navigate('/chat', {
                state: {
                  initialPrompt: 'Find supplier certificates in my connected OneDrive that are missing from my records.',
                  autoSend: false,
                },
              })
            }
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            Ask the assistant to use these <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </section>

      {/* Coming soon — sets expectation without dead Connect buttons. */}
      {COMPOSIO_ROADMAP.length > 0 && (
        <section className="space-y-2">
          <p className="text-micro font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Coming soon
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {COMPOSIO_ROADMAP.map((r) => (
              <div
                key={r.name}
                className="flex items-center gap-3 rounded-[14px] border border-dashed border-border/70 bg-muted/30 p-3"
              >
                <div className="opacity-60">{r.logo}</div>
                <div className="min-w-0">
                  <p className="text-small font-medium text-foreground/70">{r.name}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">{r.capability}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
