// Generates each buyer's AI compliance briefing. Runs on a 2-hourly cron over
// all active buyers, and can be invoked for a single buyer by that buyer (the
// dashboard's refresh control).
//
// Cost control: the facts are fingerprinted before any model call. If nothing
// has changed since the last run we bump checked_at and return -- a quiet
// account costs one cheap query per cycle, not a completion.
//
// Accuracy: every number is computed here from the database and handed to the
// model as read-only facts; enforceNumbers() then discards any bullet quoting a
// figure that isn't in that set. The model chooses wording and priority only.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { isInternalSystemRequest } from '../_shared/systemAuth.ts';
import { resolveAiConfig, aiComplete } from '../_shared/ai/complete.ts';
import {
  SYSTEM_PROMPT,
  buildUserPrompt,
  enforceNumbers,
  fingerprint,
  isDormant,
  parseAiOutput,
  type SummaryFacts,
} from './logic.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const DAY = 86_400_000;

/** Buyer-scoped metrics. Mirrors src/components/dashboard/useBuyerDashboardData.ts. */
async function computeFacts(buyerId: string): Promise<SummaryFacts> {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();
  const today = now.toISOString().split('T')[0];
  const in90 = new Date(Date.now() + 90 * DAY).toISOString().split('T')[0];

  const [requestsRes, uploadsRes, connRes, pendingConnRes, onboardingRes, riskRes] = await Promise.all([
    admin.from('document_requests')
      .select('id, title, status, created_at, due_date, supplier_id')
      .eq('buyer_id', buyerId).gte('created_at', sixMonthsAgo),
    admin.from('document_uploads')
      .select('id, expiration_date, document_requests!inner(buyer_id)')
      .eq('document_requests.buyer_id', buyerId)
      .eq('status', 'approved')
      .not('expiration_date', 'is', null)
      .gte('expiration_date', today).lte('expiration_date', in90),
    admin.from('buyer_supplier_connections').select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId).eq('status', 'approved'),
    admin.from('buyer_supplier_connections').select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId).eq('status', 'pending'),
    admin.from('supplier_onboarding_requests').select('id', { count: 'exact', head: true })
      .eq('buyer_id', buyerId).in('status', ['pending', 'invited', 'onboarding_initiated']),
    admin.from('supplier_risk_scores')
      .select('supplier_id, overall_score, calculated_at')
      .eq('buyer_id', buyerId).order('calculated_at', { ascending: false }),
  ]);

  const requests = requestsRes.data ?? [];
  const uploads = uploadsRes.data ?? [];
  const riskRows = riskRes.error ? [] : (riskRes.data ?? []);

  const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / DAY);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const windows = (uploads as any[]).map((u) => daysLeft(u.expiration_date));
  const inWindow = (lo: number, hi: number) => windows.filter((d) => d >= lo && d <= hi).length;

  const overdueReqs = requests.filter(
    (r) => r.status === 'pending' && r.due_date && new Date(r.due_date) < now,
  );
  overdueReqs.sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());

  const approvedTotal = requests.filter((r) => r.status === 'approved').length;
  const complianceScore = requests.length ? Math.round((approvedTotal / requests.length) * 100) : 0;

  // Same cumulative basis as the dashboard, so the two never disagree.
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const prior = requests.filter((r) => r.created_at && new Date(r.created_at) < startOfThisMonth);
  const priorScore = prior.length >= 5
    ? Math.round((prior.filter((r) => r.status === 'approved').length / prior.length) * 100)
    : null;

  const approvedThisMonth = requests.filter(
    (r) => r.status === 'approved' && r.created_at && new Date(r.created_at) >= startOfThisMonth,
  ).length;

  // Latest score per supplier, then name the top few.
  const latest = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of riskRows as any[]) {
    if (!latest.has(row.supplier_id)) latest.set(row.supplier_id, row.overall_score);
  }
  const nameById = new Map<string, string>();
  if (latest.size) {
    const { data: sup } = await admin.from('suppliers')
      .select('id, company_name').in('id', [...latest.keys()]);
    for (const s of sup ?? []) nameById.set(s.id, s.company_name ?? 'Unknown supplier');
  }
  const topRisk = [...latest.entries()]
    .map(([id, score]) => ({ name: nameById.get(id) ?? 'Unknown supplier', score: Math.round(score) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    awaitingReview: requests.filter((r) => r.status === 'submitted').length,
    overdue: overdueReqs.length,
    expiring0_30: inWindow(0, 30),
    expiring31_60: inWindow(31, 60),
    expiring61_90: inWindow(61, 90),
    complianceScore,
    priorScore,
    approvedTotal,
    requestTotal: requests.length,
    approvedThisMonth,
    connectedSuppliers: connRes.count ?? 0,
    pendingConnections: pendingConnRes.count ?? 0,
    onboardingCount: onboardingRes.count ?? 0,
    topRisk,
    oldestOverdue: overdueReqs[0]?.title ?? null,
  };
}

type Outcome = 'generated' | 'skipped_unchanged' | 'skipped_dormant' | 'error';

async function processBuyer(buyerId: string, force: boolean): Promise<Outcome> {
  const facts = await computeFacts(buyerId);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = admin as any;
  const { data: existing } = await client
    .from('buyer_ai_summaries')
    .select('input_fingerprint')
    .eq('buyer_id', buyerId)
    .maybeSingle();

  if (isDormant(facts)) {
    await client.from('buyer_ai_summaries').upsert(
      { buyer_id: buyerId, checked_at: new Date().toISOString() },
      { onConflict: 'buyer_id' },
    );
    return 'skipped_dormant';
  }

  const fp = await fingerprint(facts);
  if (!force && existing?.input_fingerprint === fp) {
    await client.from('buyer_ai_summaries')
      .update({ checked_at: new Date().toISOString() })
      .eq('buyer_id', buyerId);
    return 'skipped_unchanged';
  }

  try {
    const config = await resolveAiConfig(admin, buyerId);
    if (!config) throw new Error('No usable AI key for this buyer');

    const raw = await aiComplete(config, {
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(facts),
      jsonMode: true,
      maxTokens: 900,
    });

    const { bullets, followUps } = parseAiOutput(raw);
    const safe = enforceNumbers(bullets, facts);
    if (safe.length === 0) throw new Error('No bullets survived the number guard');

    await client.from('buyer_ai_summaries').upsert(
      {
        buyer_id: buyerId,
        bullets: safe.slice(0, 7),
        follow_ups: followUps.slice(0, 3),
        input_fingerprint: fp,
        model: `${config.provider}:${config.model}`,
        generated_at: new Date().toISOString(),
        checked_at: new Date().toISOString(),
        error: null,
      },
      { onConflict: 'buyer_id' },
    );
    return 'generated';
  } catch (e) {
    // Record the failure but leave any previous good summary in place --
    // a stale-but-true briefing beats an empty card.
    const message = e instanceof Error ? e.message : String(e);
    console.error(`buyer-ai-summary failed for ${buyerId}:`, message);
    await client.from('buyer_ai_summaries').upsert(
      { buyer_id: buyerId, checked_at: new Date().toISOString(), error: message },
      { onConflict: 'buyer_id' },
    );
    return 'error';
  }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const requestedBuyerId: string | undefined = body?.buyerId;
    const force: boolean = body?.force === true;

    const isSystem = await isInternalSystemRequest(req, admin);

    if (!isSystem) {
      // User-initiated refresh: must be a member of the buyer they name.
      if (!requestedBuyerId) {
        return json({ error: 'buyerId is required for user-initiated refresh' }, 400);
      }
      const authHeader = req.headers.get('Authorization') ?? '';
      const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const { data: buyerIds } = await userClient.rpc('get_user_buyer_ids');
      const ids = (buyerIds ?? []) as string[];
      if (!ids.includes(requestedBuyerId)) return json({ error: 'Forbidden' }, 403);

      const outcome = await processBuyer(requestedBuyerId, force);
      return json({ ok: true, outcome });
    }

    // System/cron path.
    if (requestedBuyerId) {
      const outcome = await processBuyer(requestedBuyerId, force);
      return json({ ok: true, outcome });
    }

    const { data: buyers, error } = await admin.from('buyers').select('id');
    if (error) throw error;

    const tally: Record<Outcome, number> = {
      generated: 0, skipped_unchanged: 0, skipped_dormant: 0, error: 0,
    };
    // Sequential: this is a background job, and serializing keeps us well
    // inside provider rate limits.
    for (const b of buyers ?? []) {
      tally[await processBuyer(b.id, force)] += 1;
    }
    console.log('buyer-ai-summary batch complete', tally);
    return json({ ok: true, buyers: (buyers ?? []).length, ...tally });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('buyer-ai-summary fatal:', message);
    return json({ error: message }, 500);
  }
});
