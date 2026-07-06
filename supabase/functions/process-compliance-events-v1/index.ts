import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { isInternalSystemRequest } from '../_shared/systemAuth.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

const BATCH_SIZE = 20;

interface DomainEvent {
  id: string;
  buyer_id: string;
  subject_type: string | null;
  subject_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

// Edge functions in this codebase insert into notifications directly via the
// service-role client (see communication-hub, check-onboarding-deadlines)
// rather than through create_notification_v1, which is for client-originated
// calls and validates a buyer<->supplier connection that doesn't apply here -
// the system always has standing to notify a buyer's own members about their
// own compliance events.
async function notifyUser(admin: SupabaseAdmin, userId: string, type: string, title: string, message: string, referenceId: string | null) {
  await admin.from('notifications').insert({ user_id: userId, type, title, message, reference_id: referenceId, read: false });
}

async function notifyBuyerAdmins(admin: SupabaseAdmin, buyerId: string, type: string, title: string, message: string, referenceId: string | null) {
  const [{ data: owner }, { data: admins }] = await Promise.all([
    admin.from('buyers').select('profile_id').eq('id', buyerId).maybeSingle(),
    admin.from('company_users').select('profile_id')
      .eq('company_id', buyerId).eq('company_type', 'buyer')
      .eq('role', 'company_admin').eq('status', 'active'),
  ]);
  const userIds = new Set<string>();
  if (owner?.profile_id) userIds.add(owner.profile_id);
  for (const admin_ of admins || []) {
    if (admin_.profile_id) userIds.add(admin_.profile_id);
  }
  await Promise.all([...userIds].map((userId) => notifyUser(admin, userId, type, title, message, referenceId)));
}

async function dispatchEvent(admin: SupabaseAdmin, event: DomainEvent): Promise<void> {
  const payload = event.payload || {};

  switch (event.event_type) {
    case 'decision_changed': {
      const outcome = String(payload.outcome ?? '');
      if (outcome === 'noncompliant' || outcome === 'expired') {
        await notifyBuyerAdmins(
          admin, event.buyer_id, 'compliance_decision_changed',
          'Compliance status changed',
          `${String(payload.requirement_key ?? 'A requirement')} is now ${outcome}.`,
          typeof payload.decision_result_id === 'string' ? payload.decision_result_id : null,
        );
      }
      break;
    }
    case 'task_created': {
      const taskId = typeof payload.task_id === 'string' ? payload.task_id : null;
      if (typeof payload.assignee_id === 'string') {
        await notifyUser(
          admin, payload.assignee_id, 'compliance_task_assigned',
          'New compliance task assigned',
          'You have been assigned a new compliance task.',
          taskId,
        );
      } else {
        // Unassigned tasks (e.g. gap-engine corrective actions) have no owner
        // yet, so notify the buyer's admins that action is waiting.
        await notifyBuyerAdmins(
          admin, event.buyer_id, 'compliance_task_created',
          'New compliance task',
          typeof payload.title === 'string' ? payload.title : 'A compliance task needs attention.',
          taskId,
        );
      }
      break;
    }
    case 'corrective_action_due': {
      if (typeof payload.assigned_to === 'string') {
        await notifyUser(
          admin, payload.assigned_to, 'corrective_action_due',
          'Corrective action due',
          `A corrective action is due on ${String(payload.due_date ?? 'the scheduled date')}.`,
          typeof payload.corrective_action_id === 'string' ? payload.corrective_action_id : null,
        );
      }
      break;
    }
    case 'approval_requested': {
      await notifyBuyerAdmins(
        admin, event.buyer_id, 'compliance_approval_requested',
        'Compliance approval requested',
        `A ${String(payload.approval_type ?? 'compliance')} approval is awaiting your review.`,
        typeof payload.approval_id === 'string' ? payload.approval_id : null,
      );
      break;
    }
    default:
      // decision_recorded, task_completed, finding_raised, finding_resolved,
      // exception_granted, approval_decided: published with no notification
      // side-effect in this pass. The outbox makes them available for any
      // future recalculation/reporting/agent consumer.
      break;
  }
}

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // One shared door for every trusted internal caller (cron secret, env
  // secret, or service-role bearer).
  if (!(await isInternalSystemRequest(req, admin))) {
    return jsonResponse(context, { error: 'Service role required' }, 403);
  }

  const summary = { processed: 0, published: 0, failed: 0, dead_letter: 0 };

  try {
    const { data: events, error: claimError } = await admin.rpc('claim_compliance_events_v1', {
      p_batch_size: BATCH_SIZE,
    });
    if (claimError) throw claimError;

    for (const event of (events ?? []) as DomainEvent[]) {
      summary.processed += 1;
      try {
        await dispatchEvent(admin, event);
        await admin.from('compliance_domain_events').update({
          status: 'published', processed_at: new Date().toISOString(),
        }).eq('id', event.id);
        summary.published += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const attempts = event.attempts + 1;
        if (attempts >= event.max_attempts) {
          summary.dead_letter += 1;
          await admin.from('compliance_domain_events').update({
            status: 'dead_letter', attempts, last_error: message, processed_at: new Date().toISOString(),
          }).eq('id', event.id);
        } else {
          summary.failed += 1;
          await admin.from('compliance_domain_events').update({
            status: 'pending', attempts, last_error: message,
          }).eq('id', event.id);
        }
        logEvent('error', 'compliance_event_dispatch_failed', context, {
          event_id: event.id, event_type: event.event_type, attempts, error: message,
        });
      }
    }

    logEvent('info', 'compliance_event_batch_completed', context, summary);
    return jsonResponse(context, summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('error', 'compliance_event_batch_failed', context, { error: message });
    return jsonResponse(context, { error: 'Compliance event batch failed', correlation_id: context.correlationId }, 500);
  }
});
