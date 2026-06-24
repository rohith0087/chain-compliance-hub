/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink, Loader2, PlugZap, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { publicEnvironment } from '@/config/env';
import { toast } from 'sonner';

const SUPABASE_URL = publicEnvironment.VITE_SUPABASE_URL;

// ── types ──────────────────────────────────────────────────────────────────────

type Provider = 'slack' | 'docusign' | 'notion' | 'box' | 'sharepoint';
type ConnStatus = 'active' | 'revoked' | 'error' | 'needs_reauth';

interface Connection {
  id: string;
  provider: Provider;
  status: ConnStatus;
  config: Record<string, unknown>;
  connected_at: string;
  last_synced_at: string | null;
  last_error: string | null;
}

// ── provider metadata ──────────────────────────────────────────────────────────

type Section = 'messaging' | 'esignature' | 'productivity' | 'storage';

interface ProviderMeta {
  id: Provider;
  name: string;
  tagline: string;
  logoEl: React.ReactNode;
  section: Section;
  oauthSupported: boolean;
  webhookMode?: boolean;    // Slack: paste-URL shortcut
}

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'messaging',   label: 'Messaging' },
  { id: 'esignature',  label: 'eSignature' },
  { id: 'productivity',label: 'Productivity' },
  { id: 'storage',     label: 'Cloud Storage' },
];

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'slack',
    name: 'Slack',
    tagline: 'Submit · approve · reject alerts → your #compliance channel',
    logoEl: (
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white border border-[#E8E8E8] flex-shrink-0">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.56 16.58A2.52 2.52 0 103.04 19.1h2.52v-2.52zm1.26 0A2.52 2.52 0 109.34 19.1V12.8H6.82v3.78z" fill="#E01E5A"/>
          <path d="M7.42 5.56A2.52 2.52 0 104.9 3.04v2.52h2.52zm0 1.26A2.52 2.52 0 104.9 9.34h6.3V6.82H7.42z" fill="#36C5F0"/>
          <path d="M18.44 7.42A2.52 2.52 0 1020.96 4.9h-2.52v2.52zm-1.26 0A2.52 2.52 0 1014.66 4.9v6.3h2.52V7.42z" fill="#2EB67D"/>
          <path d="M16.58 18.44A2.52 2.52 0 1019.1 20.96v-2.52h-2.52zm0-1.26A2.52 2.52 0 1019.1 14.66h-6.3v2.52h3.78z" fill="#ECB22E"/>
        </svg>
      </div>
    ),
    section: 'messaging',
    oauthSupported: false,
    webhookMode: true,
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    tagline: 'Send documents for eSignature before or during submission',
    logoEl: (
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#C9E500] flex-shrink-0">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 4v11" stroke="#111" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M7.5 11.5l4.5 4.5 4.5-4.5" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M5.5 20h13" stroke="#111" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </div>
    ),
    section: 'esignature',
    oauthSupported: true,
  },
  {
    id: 'notion',
    name: 'Notion',
    tagline: 'Sync approved docs to your compliance database in Notion',
    logoEl: (
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#F5F5F5] flex-shrink-0">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
          {/* 3D cube front face */}
          <rect x="4" y="10" width="13" height="12" rx="0.5" fill="#1A1A1A"/>
          <rect x="5" y="11" width="11" height="10" rx="0.3" fill="white"/>
          {/* Top face */}
          <path d="M4 10l4-4.5H21l-4 4.5H4z" fill="#aaa"/>
          {/* Right face */}
          <path d="M17 10l4-4.5v12l-4 4.5V10z" fill="#555"/>
          {/* N letterform on front */}
          <path d="M7.5 13.5v6M14.5 13.5v6M7.5 13.5l7 6" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    ),
    section: 'productivity',
    oauthSupported: true,
  },
  {
    id: 'box',
    name: 'Box',
    tagline: 'Pick files from Box · auto-sync approved docs to your folder',
    logoEl: (
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#009FDA] flex-shrink-0 overflow-hidden">
        <span style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: 900, fontSize: '17px', color: 'white', letterSpacing: '-0.5px', lineHeight: 1 }}>
          box
        </span>
      </div>
    ),
    section: 'storage',
    oauthSupported: true,
  },
  {
    id: 'sharepoint',
    name: 'SharePoint / OneDrive',
    tagline: 'Microsoft Graph — pick files · sync to document library',
    logoEl: (
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#038387] flex-shrink-0">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" xmlns="http://www.w3.org/2000/svg">
          {/* Background spheres */}
          <circle cx="17.5" cy="7" r="4.5" fill="white" fillOpacity="0.25"/>
          <circle cx="19.5" cy="14.5" r="3" fill="white" fillOpacity="0.2"/>
          {/* S icon tile */}
          <rect x="3" y="10" width="12" height="12" rx="2.5" fill="white"/>
          {/* S letterform */}
          <path d="M7 13.5c0-.9.9-1.5 2.1-1.5 1.1 0 2 .5 2 1.3 0 .7-.7 1.1-2 1.5-1.4.4-2.1 1-2.1 1.9 0 1 1 1.5 2.2 1.5 1 0 1.8-.4 2.1-.9" stroke="#038387" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
        </svg>
      </div>
    ),
    section: 'storage',
    oauthSupported: true,
  },
];

// ── helpers ────────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── SlackConfigForm: paste-URL connect / configure ────────────────────────────

interface SlackConfigFormProps {
  organizationId: string;
  existing: Connection | null;
  onSaved: () => void;
}

function SlackConfigForm({ organizationId, existing, onSaved }: SlackConfigFormProps) {
  const cfg = (existing?.config ?? {}) as Record<string, unknown>;
  const [webhookUrl, setWebhookUrl] = useState(String(cfg.webhook_url ?? ''));
  const [channelName, setChannelName] = useState(String(cfg.channel_name ?? ''));
  const [onSubmit, setOnSubmit] = useState(Boolean(cfg.notify_on_submit ?? true));
  const [onApprove, setOnApprove] = useState(Boolean(cfg.notify_on_approve ?? true));
  const [onReject, setOnReject] = useState(Boolean(cfg.notify_on_reject ?? true));
  const [onExpiry, setOnExpiry] = useState(Boolean(cfg.notify_on_expiry ?? true));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      toast.error('Must be a valid Slack webhook URL (https://hooks.slack.com/...)');
      return;
    }
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/integration-oauth-callback-v1`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'save_webhook',
          provider: 'slack',
          organization_id: organizationId,
          webhook_url: webhookUrl,
          channel_name: channelName,
          config: { notify_on_submit: onSubmit, notify_on_approve: onApprove, notify_on_reject: onReject, notify_on_expiry: onExpiry },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(j.error || 'Save failed');
      }
      toast.success('Slack integration saved');
      onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-[12px] border border-[#E5E7EB] bg-[#F9FAFB] p-4 space-y-4">
      <div>
        <p className="text-[12px] font-medium text-[#374151] mb-3">
          Create a Slack app with <span className="font-semibold">Incoming Webhooks</span> enabled, then paste the webhook URL below.{' '}
          <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-0.5">
            Setup guide <ExternalLink className="h-3 w-3" />
          </a>
        </p>
        <div className="space-y-3">
          <div>
            <Label className="text-[12px] text-[#374151]">Webhook URL</Label>
            <Input
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="mt-1 h-9 text-[13px] font-mono"
            />
          </div>
          <div>
            <Label className="text-[12px] text-[#374151]">Channel name (optional)</Label>
            <Input
              placeholder="#compliance"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="mt-1 h-9 text-[13px]"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-2">Notify on</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['Document submitted', onSubmit, setOnSubmit],
            ['Document approved', onApprove, setOnApprove],
            ['Document rejected', onReject, setOnReject],
            ['Expiry digest', onExpiry, setOnExpiry],
          ] as [string, boolean, (v: boolean) => void][]).map(([label, value, setter]) => (
            <label key={label} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setter(e.target.checked)}
                className="h-4 w-4 rounded border-[#D1D5DB] accent-blue-600"
              />
              <span className="text-[12px] text-[#374151]">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <Button
        size="sm"
        onClick={() => void save()}
        disabled={saving || !webhookUrl}
        className="h-8 rounded-[8px] bg-[#111827] text-white text-[12px] font-semibold hover:bg-[#374151]"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : existing ? 'Save changes' : 'Connect Slack'}
      </Button>
    </div>
  );
}

// ── integration row ────────────────────────────────────────────────────────────

interface IntegrationRowProps {
  meta: ProviderMeta;
  connection: Connection | null;
  organizationId: string;
  onRefresh: () => void;
}

function IntegrationRow({ meta, connection, organizationId, onRefresh }: IntegrationRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = connection?.status === 'active';
  const hasError = connection?.status === 'error';

  const startOAuth = async () => {
    setConnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/integration-oauth-callback-v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          action: 'start',
          provider: meta.id,
          organization_id: organizationId,
          return_url: window.location.href,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.redirect_url) {
        throw new Error(json.error || 'Could not start OAuth');
      }
      window.location.href = json.redirect_url;
    } catch (err: any) {
      toast.error(err.message || 'Connection failed');
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/integration-oauth-callback-v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'disconnect', provider: meta.id, organization_id: organizationId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: 'Unknown' }));
        throw new Error(j.error || 'Disconnect failed');
      }
      toast.success(`${meta.name} disconnected`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white">
      <div className="flex items-center gap-3 p-4">
        {meta.logoEl}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#111827]">{meta.name}</span>
            {isConnected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-100">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                Connected
              </span>
            )}
            {hasError && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 border border-red-100">
                Error
              </span>
            )}
          </div>
          <p className="text-[12px] text-[#6B7280] mt-0.5 truncate">{meta.tagline}</p>
          {isConnected && connection?.connected_at && (
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              Connected {relativeDate(connection.connected_at)}
              {connection.last_synced_at && ` · last sync ${relativeDate(connection.last_synced_at)}`}
            </p>
          )}
          {hasError && connection?.last_error && (
            <p className="text-[11px] text-red-500 mt-0.5 truncate">{connection.last_error}</p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isConnected ? (
            <>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
              >
                Configure
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => void disconnect()}
                disabled={disconnecting}
                className="flex items-center gap-1.5 rounded-[8px] border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-[12px] font-medium text-red-500 hover:bg-red-50 transition-colors"
                title="Disconnect"
              >
                {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </>
          ) : meta.webhookMode ? (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 rounded-[8px] bg-[#111827] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#374151] transition-colors"
            >
              <PlugZap className="h-3.5 w-3.5" />
              Connect
            </button>
          ) : (
            <button
              onClick={() => void startOAuth()}
              disabled={connecting}
              className="flex items-center gap-1.5 rounded-[8px] bg-[#111827] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#374151] transition-colors disabled:opacity-60"
            >
              {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
              Connect
            </button>
          )}
        </div>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="border-t border-[#F3F4F6] px-4 pb-4">
          {meta.webhookMode ? (
            <SlackConfigForm
              organizationId={organizationId}
              existing={connection}
              onSaved={() => { setExpanded(false); onRefresh(); }}
            />
          ) : (
            <div className="mt-3">
              {/* For OAuth-based integrations, show re-connect or config details */}
              {isConnected ? (
                <div className="space-y-3">
                  {meta.id === 'notion' && (
                    <div className="rounded-[10px] bg-[#F9FAFB] border border-[#E5E7EB] p-3">
                      <p className="text-[12px] font-medium text-[#374151] mb-1">Workspace</p>
                      <p className="text-[13px] text-[#111827] font-semibold">
                        {String(connection!.config.workspace_name || '—')}
                      </p>
                      {!connection!.config.target_database_id && (
                        <p className="mt-2 text-[12px] text-amber-600">
                          No target database selected. Share a Notion database with the integration to enable syncing.
                        </p>
                      )}
                    </div>
                  )}
                  {(meta.id === 'box' || meta.id === 'sharepoint') && (
                    <div className="rounded-[10px] bg-[#F9FAFB] border border-[#E5E7EB] p-3">
                      <p className="text-[12px] text-[#374151]">
                        Approved documents will be automatically synced to your {meta.name} folder.
                      </p>
                    </div>
                  )}
                  {meta.id === 'docusign' && (
                    <div className="rounded-[10px] bg-[#F9FAFB] border border-[#E5E7EB] p-3">
                      <p className="text-[12px] font-medium text-[#374151] mb-1">Account</p>
                      <p className="text-[13px] text-[#111827] font-semibold">
                        {String(connection!.config.account_id || '—')}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => void startOAuth()}
                    disabled={connecting}
                    className="text-[12px] text-[#6B7280] hover:text-[#111827] underline underline-offset-2"
                  >
                    Reconnect / reauthorize
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-[12px] text-[#6B7280]">
                  Click Connect to authorize TraceR2C to access your {meta.name} account via OAuth.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── main panel ─────────────────────────────────────────────────────────────────

interface IntegrationsPanelProps {
  organizationId: string | null;
}

export function IntegrationsPanel({ organizationId }: IntegrationsPanelProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!organizationId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from('integration_connections')
      .select('id, provider, status, config, connected_at, last_synced_at, last_error')
      .eq('organization_id', organizationId);
    setConnections((data ?? []) as Connection[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  // Handle OAuth return params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('integration_connected');
    const err = params.get('integration_error');
    if (connected) {
      toast.success(`${connected} connected successfully`);
      const url = new URL(window.location.href);
      url.searchParams.delete('integration_connected');
      window.history.replaceState({}, '', url.toString());
      void load();
    }
    if (err) {
      toast.error(`Integration error: ${decodeURIComponent(err)}`);
      const url = new URL(window.location.href);
      url.searchParams.delete('integration_error');
      window.history.replaceState({}, '', url.toString());
    }
  }, [load]);

  const getConnection = (provider: Provider) =>
    connections.find((c) => c.provider === provider) ?? null;

  const connectedCount = connections.filter((c) => c.status === 'active').length;

  if (!organizationId) {
    return (
      <div className="flex items-center justify-center py-16 text-[13px] text-[#9CA3AF]">
        Loading organization…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[16px] font-bold text-[#111827]">Integrations</h2>
            <p className="text-[13px] text-[#6B7280] mt-0.5">
              Connect your tools. Each integration is scoped to your organization.
            </p>
          </div>
          {!loading && connectedCount > 0 && (
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              {connectedCount} connected
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-[#9CA3AF]" />
        </div>
      ) : (
        <div className="space-y-6">
          {SECTIONS.map((sec) => (
            <div key={sec.id} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{sec.label}</p>
              {PROVIDERS.filter((p) => p.section === sec.id).map((meta) => (
                <IntegrationRow
                  key={meta.id}
                  meta={meta}
                  connection={getConnection(meta.id)}
                  organizationId={organizationId}
                  onRefresh={() => void load()}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
