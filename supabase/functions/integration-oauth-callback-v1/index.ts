/**
 * Handles OAuth 2.0 flows for all integrations.
 *
 * POST /integration-oauth-callback-v1   { action: 'start', provider, return_url? }
 *   → returns { redirect_url } to send the user to the provider's auth page.
 *
 * GET  /integration-oauth-callback-v1?code=xxx&state=xxx
 *   → provider redirects here; we exchange code for tokens, persist, redirect to app.
 *
 * POST /integration-oauth-callback-v1   { action: 'save_webhook', provider: 'slack', webhook_url, config? }
 *   → shortcut for Slack incoming-webhook paste (no OAuth code exchange needed).
 *
 * POST /integration-oauth-callback-v1   { action: 'disconnect', provider }
 *   → marks the connection revoked.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';

type Provider = 'slack' | 'docusign' | 'notion' | 'box' | 'sharepoint';

const SUPABASE_URL = () => requireEnv('SUPABASE_URL');
const REDIRECT_BASE = () =>
  `${SUPABASE_URL()}/functions/v1/integration-oauth-callback-v1`;

// ── per-provider OAuth endpoints ──────────────────────────────────────────────

function buildAuthUrl(provider: Provider, state: string, redirectUri: string): string {
  switch (provider) {
    case 'slack': {
      const clientId = requireEnv('SLACK_CLIENT_ID');
      const params = new URLSearchParams({
        client_id: clientId,
        scope: 'incoming-webhook',
        redirect_uri: redirectUri,
        state,
      });
      return `https://slack.com/oauth/v2/authorize?${params}`;
    }
    case 'docusign': {
      const clientId = requireEnv('DOCUSIGN_CLIENT_ID');
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        scope: 'signature',
        redirect_uri: redirectUri,
        state,
      });
      return `https://account.docusign.com/oauth/auth?${params}`;
    }
    case 'notion': {
      const clientId = requireEnv('NOTION_CLIENT_ID');
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        owner: 'user',
        redirect_uri: redirectUri,
        state,
      });
      return `https://api.notion.com/v1/oauth/authorize?${params}`;
    }
    case 'box': {
      const clientId = requireEnv('BOX_CLIENT_ID');
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: redirectUri,
        state,
      });
      return `https://account.box.com/api/oauth2/authorize?${params}`;
    }
    case 'sharepoint': {
      const clientId = requireEnv('SHAREPOINT_CLIENT_ID');
      const tenantId = Deno.env.get('SHAREPOINT_TENANT_ID') || 'common';
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        scope: 'https://graph.microsoft.com/Sites.ReadWrite.All https://graph.microsoft.com/Files.ReadWrite.All offline_access',
        redirect_uri: redirectUri,
        state,
      });
      return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
    }
  }
}

async function exchangeCode(
  provider: Provider,
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number; config: Record<string, unknown> }> {
  switch (provider) {
    case 'slack': {
      const clientId = requireEnv('SLACK_CLIENT_ID');
      const clientSecret = requireEnv('SLACK_CLIENT_SECRET');
      const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri });
      const res = await fetch('https://slack.com/api/oauth.v2.access', { method: 'POST', body });
      const json = await res.json() as Record<string, unknown>;
      if (!json.ok) throw new Error(`Slack OAuth error: ${json.error}`);
      const webhook = (json.incoming_webhook as Record<string, unknown>) ?? {};
      return {
        accessToken: (json.access_token as string) || '',
        config: {
          webhook_url: webhook.url ?? '',
          channel_name: webhook.channel ?? '',
          channel_id: webhook.channel_id ?? '',
          notify_on_submit: true,
          notify_on_approve: true,
          notify_on_reject: true,
          notify_on_expiry: true,
          expiry_warning_days: [7, 30],
        },
      };
    }
    case 'docusign': {
      const clientId = requireEnv('DOCUSIGN_CLIENT_ID');
      const clientSecret = requireEnv('DOCUSIGN_CLIENT_SECRET');
      const creds = btoa(`${clientId}:${clientSecret}`);
      const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
      const tokenRes = await fetch('https://account.docusign.com/oauth/token', {
        method: 'POST',
        headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      const tokens = await tokenRes.json() as Record<string, unknown>;
      if (tokens.error) throw new Error(`DocuSign OAuth error: ${tokens.error}`);

      // Fetch user info to get account_id and base_url
      const userRes = await fetch('https://account.docusign.com/oauth/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userRes.json() as Record<string, unknown>;
      const accounts = (userInfo.accounts as Array<Record<string, unknown>>) ?? [];
      const defaultAccount = accounts.find((a) => a.is_default) ?? accounts[0] ?? {};

      return {
        accessToken: String(tokens.access_token ?? ''),
        refreshToken: tokens.refresh_token ? String(tokens.refresh_token) : undefined,
        expiresIn: Number(tokens.expires_in ?? 28800),
        config: {
          account_id: defaultAccount.account_id ?? '',
          user_id: userInfo.sub ?? '',
          base_url: String(defaultAccount.base_uri ?? 'https://na4.docusign.net') + '/restapi',
          auto_send_on_request: false,
          default_expiry_days: 14,
        },
      };
    }
    case 'notion': {
      const clientId = requireEnv('NOTION_CLIENT_ID');
      const clientSecret = requireEnv('NOTION_CLIENT_SECRET');
      const creds = btoa(`${clientId}:${clientSecret}`);
      const body = JSON.stringify({ grant_type: 'authorization_code', code, redirect_uri: redirectUri });
      const res = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' },
        body,
      });
      const json = await res.json() as Record<string, unknown>;
      if (json.error) throw new Error(`Notion OAuth error: ${json.error}`);
      return {
        accessToken: String(json.access_token ?? ''),
        config: {
          workspace_id: json.workspace_id ?? '',
          workspace_name: json.workspace_name ?? '',
          bot_id: json.bot_id ?? '',
          target_database_id: '',
          database_name: '',
          auto_sync_on_approve: true,
          auto_sync_on_reject: false,
        },
      };
    }
    case 'box': {
      const clientId = requireEnv('BOX_CLIENT_ID');
      const clientSecret = requireEnv('BOX_CLIENT_SECRET');
      const body = new URLSearchParams({ grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });
      const res = await fetch('https://api.box.com/oauth2/token', { method: 'POST', body });
      const json = await res.json() as Record<string, unknown>;
      if (json.error) throw new Error(`Box OAuth error: ${json.error}`);
      return {
        accessToken: String(json.access_token ?? ''),
        refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
        expiresIn: Number(json.expires_in ?? 3600),
        config: {
          root_folder_id: '0',
          compliance_folder_name: 'TraceR2C Compliance',
          auto_sync_on_approve: true,
        },
      };
    }
    case 'sharepoint': {
      const clientId = requireEnv('SHAREPOINT_CLIENT_ID');
      const clientSecret = requireEnv('SHAREPOINT_CLIENT_SECRET');
      const tenantId = Deno.env.get('SHAREPOINT_TENANT_ID') || 'common';
      const body = new URLSearchParams({
        grant_type: 'authorization_code', code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: redirectUri,
        scope: 'https://graph.microsoft.com/Sites.ReadWrite.All https://graph.microsoft.com/Files.ReadWrite.All offline_access',
      });
      const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
      });
      const json = await res.json() as Record<string, unknown>;
      if (json.error) throw new Error(`SharePoint OAuth error: ${json.error}`);
      return {
        accessToken: String(json.access_token ?? ''),
        refreshToken: json.refresh_token ? String(json.refresh_token) : undefined,
        expiresIn: Number(json.expires_in ?? 3600),
        config: {
          site_id: '',
          drive_id: '',
          compliance_folder_path: '/Compliance',
          auto_sync_on_approve: true,
        },
      };
    }
  }
}

// ── main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  const admin = createClient(SUPABASE_URL(), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── GET: OAuth callback from provider ───────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const appUrl = Deno.env.get('APP_URL') || 'https://app.tracer2c.com';

    if (error) {
      logEvent('warn', 'oauth_callback_provider_error', context, { error });
      return Response.redirect(`${appUrl}/settings?integration_error=${encodeURIComponent(error)}`, 302);
    }

    if (!code || !state) {
      return Response.redirect(`${appUrl}/settings?integration_error=missing_params`, 302);
    }

    const { data: oauthState, error: stateErr } = await admin
      .from('integration_oauth_state')
      .select('*')
      .eq('state', state)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (stateErr || !oauthState) {
      return Response.redirect(`${appUrl}/settings?integration_error=invalid_state`, 302);
    }

    await admin.from('integration_oauth_state').delete().eq('state', state);

    const provider = oauthState.provider as Provider;
    const redirectUri = REDIRECT_BASE();

    try {
      const tokens = await exchangeCode(provider, code, redirectUri);
      const expiresAt = tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
        : null;

      await admin.from('integration_connections').upsert(
        {
          organization_id: oauthState.organization_id,
          provider,
          status: 'active',
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken ?? null,
          token_expires_at: expiresAt,
          config: tokens.config,
          connected_by: oauthState.initiated_by,
          connected_at: new Date().toISOString(),
          last_error: null,
        },
        { onConflict: 'organization_id,provider' },
      );

      logEvent('info', 'oauth_callback_success', context, { provider, organization_id: oauthState.organization_id });
      const returnUrl = oauthState.return_url || `${appUrl}/settings?integration_connected=${provider}`;
      return Response.redirect(returnUrl, 302);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logEvent('error', 'oauth_callback_exchange_failed', context, { provider, error: message });
      return Response.redirect(`${appUrl}/settings?integration_error=${encodeURIComponent(message)}`, 302);
    }
  }

  // ── POST: start OAuth or shortcut actions ────────────────────────────────────
  if (req.method !== 'POST') {
    return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST, GET' });
  }

  // Authenticate via Bearer JWT
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!jwt) return jsonResponse(context, { error: 'Authentication required' }, 401);

  const userClient = createClient(SUPABASE_URL(), requireEnv('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return jsonResponse(context, { error: 'Unauthorized' }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return jsonResponse(context, { error: 'Invalid JSON' }, 400); }

  const action = String(body.action ?? '');
  const provider = String(body.provider ?? '') as Provider;
  const organizationId = String(body.organization_id ?? '');

  if (!provider || !organizationId) {
    return jsonResponse(context, { error: 'Missing provider or organization_id' }, 400);
  }

  // ── save_webhook (Slack shortcut — no code exchange) ─────────────────────────
  if (action === 'save_webhook') {
    const webhookUrl = String(body.webhook_url ?? '').trim();
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      return jsonResponse(context, { error: 'Invalid Slack webhook URL' }, 400);
    }
    const extraConfig = (body.config as Record<string, unknown> | undefined) ?? {};
    const { error: upsertErr } = await admin.from('integration_connections').upsert(
      {
        organization_id: organizationId,
        provider: 'slack',
        status: 'active',
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        config: {
          webhook_url: webhookUrl,
          channel_name: String(body.channel_name ?? ''),
          notify_on_submit:  extraConfig.notify_on_submit  ?? true,
          notify_on_approve: extraConfig.notify_on_approve ?? true,
          notify_on_reject:  extraConfig.notify_on_reject  ?? true,
          notify_on_expiry:  extraConfig.notify_on_expiry  ?? true,
          expiry_warning_days: extraConfig.expiry_warning_days ?? [7, 30],
        },
        connected_by: user.id,
        connected_at: new Date().toISOString(),
        last_error: null,
      },
      { onConflict: 'organization_id,provider' },
    );
    if (upsertErr) {
      logEvent('error', 'save_webhook_failed', context, { error: upsertErr.message });
      return jsonResponse(context, { error: upsertErr.message }, 500);
    }
    logEvent('info', 'slack_webhook_saved', context, { organization_id: organizationId });
    return jsonResponse(context, { saved: true });
  }

  // ── update_config (update event toggles or other config fields) ──────────────
  if (action === 'update_config') {
    const patch = (body.config as Record<string, unknown> | undefined) ?? {};
    const { data: existing } = await admin
      .from('integration_connections')
      .select('config')
      .eq('organization_id', organizationId)
      .eq('provider', provider)
      .maybeSingle();
    const merged = { ...(existing?.config ?? {}), ...patch };
    const { error: updateErr } = await admin
      .from('integration_connections')
      .update({ config: merged })
      .eq('organization_id', organizationId)
      .eq('provider', provider);
    if (updateErr) return jsonResponse(context, { error: updateErr.message }, 500);
    return jsonResponse(context, { updated: true });
  }

  // ── disconnect ───────────────────────────────────────────────────────────────
  if (action === 'disconnect') {
    const { error: delErr } = await admin
      .from('integration_connections')
      .delete()
      .eq('organization_id', organizationId)
      .eq('provider', provider);
    if (delErr) return jsonResponse(context, { error: delErr.message }, 500);
    logEvent('info', 'integration_disconnected', context, { provider, organization_id: organizationId });
    return jsonResponse(context, { disconnected: true });
  }

  // ── start OAuth flow ─────────────────────────────────────────────────────────
  if (action === 'start') {
    const state = crypto.randomUUID().replace(/-/g, '');
    const returnUrl = String(body.return_url ?? '');
    const { error: insertErr } = await admin.from('integration_oauth_state').insert({
      state,
      organization_id: organizationId,
      provider,
      initiated_by: user.id,
      return_url: returnUrl || null,
    });
    if (insertErr) {
      logEvent('error', 'oauth_state_insert_failed', context, { error: insertErr.message });
      return jsonResponse(context, { error: 'Could not create OAuth state' }, 500);
    }

    let redirectUrl: string;
    try {
      redirectUrl = buildAuthUrl(provider, state, REDIRECT_BASE());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse(context, { error: `Provider not configured: ${message}` }, 503);
    }

    return jsonResponse(context, { redirect_url: redirectUrl });
  }

  return jsonResponse(context, { error: `Unknown action: ${action}` }, 400);
});
