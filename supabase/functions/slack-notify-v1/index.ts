import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';

export type SlackEvent =
  | 'document_submitted'
  | 'document_approved'
  | 'document_rejected'
  | 'document_expiring';

interface SlackPayload {
  organization_id: string;
  event: SlackEvent;
  data: {
    request_id?: string;
    doc_name?: string;
    supplier_name?: string;
    reason?: string;
    days_until_expiry?: number;
    platform_url?: string;
  };
}

interface IntegrationRow {
  id: string;
  access_token: string | null;
  config: Record<string, unknown>;
  status: string;
}

function configFlag(config: Record<string, unknown>, key: string, defaultValue = true): boolean {
  if (key in config) return Boolean(config[key]);
  return defaultValue;
}

function buildSlackBlocks(event: SlackEvent, data: SlackPayload['data']): unknown[] {
  const docName = data.doc_name || 'Document';
  const supplier = data.supplier_name || 'a supplier';
  const url = data.platform_url || '';
  const linkText = url ? `<${url}|View in TraceR2C>` : 'TraceR2C';

  switch (event) {
    case 'document_submitted':
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📤 *New document submitted*\n*${docName}* was submitted by ${supplier}.\n${linkText}`,
          },
        },
      ];

    case 'document_approved':
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `✅ *Document approved*\n*${docName}* from ${supplier} has been approved.\n${linkText}`,
          },
        },
      ];

    case 'document_rejected':
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `❌ *Document rejected*\n*${docName}* from ${supplier} was rejected${data.reason ? `: _${data.reason}_` : ''}.\n${linkText}`,
          },
        },
      ];

    case 'document_expiring': {
      const days = data.days_until_expiry;
      const urgency = days != null && days <= 7 ? '🚨' : '⏰';
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${urgency} *Document expiring soon*\n*${docName}* from ${supplier} expires in *${days ?? '?'} days*.\n${linkText}`,
          },
        },
      ];
    }

    default:
      return [{ type: 'section', text: { type: 'mrkdwn', text: `TraceR2C: ${event}` } }];
  }
}

function eventConfigKey(event: SlackEvent): string {
  const map: Record<SlackEvent, string> = {
    document_submitted: 'notify_on_submit',
    document_approved:  'notify_on_approve',
    document_rejected:  'notify_on_reject',
    document_expiring:  'notify_on_expiry',
  };
  return map[event];
}

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: SlackPayload;
  try {
    body = await req.json() as SlackPayload;
  } catch {
    return jsonResponse(context, { error: 'Invalid JSON body' }, 400);
  }

  const { organization_id, event, data } = body;
  if (!organization_id || !event) {
    return jsonResponse(context, { error: 'Missing organization_id or event' }, 400);
  }

  const { data: conn, error: connErr } = await admin
    .from('integration_connections')
    .select('id, access_token, config, status')
    .eq('organization_id', organization_id)
    .eq('provider', 'slack')
    .eq('status', 'active')
    .maybeSingle<IntegrationRow>();

  if (connErr || !conn) {
    logEvent('info', 'slack_notify_skip_no_connection', context, { organization_id, event });
    return jsonResponse(context, { skipped: true, reason: 'no_active_slack_connection' });
  }

  const configKey = eventConfigKey(event);
  if (!configFlag(conn.config, configKey)) {
    return jsonResponse(context, { skipped: true, reason: `${configKey} disabled` });
  }

  const webhookUrl = (conn.config.webhook_url as string | undefined) || (conn.access_token ?? '');
  if (!webhookUrl) {
    return jsonResponse(context, { skipped: true, reason: 'no_webhook_url' });
  }

  const blocks = buildSlackBlocks(event, data);
  let slackStatus = 0;
  let slackBody = '';
  try {
    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocks }),
    });
    slackStatus = slackRes.status;
    slackBody = await slackRes.text();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await admin.from('integration_sync_log').insert({
      connection_id: conn.id,
      event_type: event,
      request_id: data.request_id ?? null,
      status: 'failed',
      payload: { error: message },
    });
    await admin.from('integration_connections')
      .update({ last_error: message, status: 'error' })
      .eq('id', conn.id);
    logEvent('error', 'slack_notify_fetch_failed', context, { organization_id, event, error: message });
    return jsonResponse(context, { error: 'Slack request failed', detail: message }, 500);
  }

  const success = slackStatus === 200 && slackBody === 'ok';
  await admin.from('integration_sync_log').insert({
    connection_id: conn.id,
    event_type: event,
    request_id: data.request_id ?? null,
    status: success ? 'success' : 'failed',
    payload: { http_status: slackStatus, slack_response: slackBody },
  });

  if (success) {
    await admin.from('integration_connections')
      .update({ last_synced_at: new Date().toISOString(), last_error: null })
      .eq('id', conn.id);
    logEvent('info', 'slack_notify_sent', context, { organization_id, event });
    return jsonResponse(context, { sent: true });
  } else {
    const detail = `Slack returned ${slackStatus}: ${slackBody}`;
    await admin.from('integration_connections')
      .update({ last_error: detail })
      .eq('id', conn.id);
    logEvent('error', 'slack_notify_slack_error', context, { organization_id, event, detail });
    return jsonResponse(context, { error: detail }, 502);
  }
});
