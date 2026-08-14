import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { aiComplete, resolveAiConfig } from '../_shared/ai/complete.ts';

// Assembles everything a first-class supplier compliance report needs — the real
// computed compliance snapshot plus an AI executive summary grounded in it — and
// returns clean JSON that the client renders into a branded PDF. AI is advisory
// (summary/narrative only); the numbers come straight from the SSOT.

const requestSchema = z.object({
  buyer_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  // When true, bypass the fingerprint cache and force a fresh AI summary.
  force: z.boolean().optional().default(false),
}).strict();

// Stable JSON (sorted keys) so the fingerprint is order-independent.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>).sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const summarySchema = z.object({
  headline: z.string().max(300),
  overall_assessment: z.string().max(1200),
  strengths: z.array(z.string().max(240)).max(6).default([]),
  risks: z.array(z.string().max(240)).max(6).default([]),
  recommendations: z.array(z.string().max(240)).max(6).default([]),
});

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse(context, { error: 'Authentication required' }, 401);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    const { buyer_id, supplier_id, force } = parsed.data;

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice('Bearer '.length));
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);
    if (!(await hasBuyerAccess(admin, user.id, buyer_id))) {
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }

    // Supplier + connection
    const { data: supplier } = await admin.from('suppliers')
      .select('id, company_name, industry, contact_email, description, company_logo_url')
      .eq('id', supplier_id).maybeSingle();
    if (!supplier) return jsonResponse(context, { error: 'Supplier not found' }, 404);
    const { data: connection } = await admin.from('buyer_supplier_connections')
      .select('status, responded_at, requested_at').eq('buyer_id', buyer_id).eq('supplier_id', supplier_id)
      .eq('status', 'approved').maybeSingle();

    // Request metrics
    const { data: requests } = await admin.from('document_requests')
      .select('id, title, document_type, status, due_date, created_at, category').eq('buyer_id', buyer_id).eq('supplier_id', supplier_id);
    const reqRows = (requests ?? []) as Array<{ id: string; title: string | null; document_type: string | null; status: string; due_date: string | null; created_at: string; category: string | null }>;
    const today = new Date().toISOString().slice(0, 10);
    const metrics = {
      total: reqRows.length,
      approved: reqRows.filter((r) => r.status === 'approved').length,
      pending: reqRows.filter((r) => r.status === 'pending').length,
      submitted: reqRows.filter((r) => r.status === 'submitted').length,
      rejected: reqRows.filter((r) => r.status === 'rejected').length,
      overdue: reqRows.filter((r) => r.status === 'pending' && r.due_date && r.due_date < today).length,
      avg_reply_days: null as number | null,
      on_time_rate: null as number | null,
      fastest_reply_days: null as number | null,
      slowest_reply_days: null as number | null,
    };
    const compliance_score = metrics.total > 0 ? Math.round((metrics.approved / metrics.total) * 100) : 0;

    // Responsiveness, measured on each request's FIRST upload: days from the
    // request being raised to the supplier's first response. Plus the share of
    // those first responses that landed on or before the due date.
    const reqById = new Map(reqRows.map((r) => [r.id, r]));
    const { data: uploadRows } = await admin.from('document_uploads')
      .select('created_at, request_id, document_requests!inner(buyer_id, supplier_id)')
      .eq('document_requests.buyer_id', buyer_id).eq('document_requests.supplier_id', supplier_id);
    const uploads = (uploadRows ?? []) as Array<{ created_at: string; request_id: string }>;

    const firstUploadByRequest = new Map<string, string>();
    for (const u of uploads) {
      const prev = firstUploadByRequest.get(u.request_id);
      if (!prev || new Date(u.created_at).getTime() < new Date(prev).getTime()) {
        firstUploadByRequest.set(u.request_id, u.created_at);
      }
    }

    const replyDeltas: number[] = [];
    let dueConsidered = 0;
    let onTime = 0;
    for (const [requestId, firstAt] of firstUploadByRequest) {
      const req = reqById.get(requestId);
      if (!req) continue;
      const days = (new Date(firstAt).getTime() - new Date(req.created_at).getTime()) / 86400000;
      if (days >= 0 && days < 3650) replyDeltas.push(days);
      if (req.due_date) {
        dueConsidered++;
        if (firstAt.slice(0, 10) <= req.due_date) onTime++;
      }
    }
    if (replyDeltas.length) {
      metrics.avg_reply_days = Math.round((replyDeltas.reduce((a, b) => a + b, 0) / replyDeltas.length) * 10) / 10;
      metrics.fastest_reply_days = Math.round(Math.min(...replyDeltas) * 10) / 10;
      metrics.slowest_reply_days = Math.round(Math.max(...replyDeltas) * 10) / 10;
    }
    if (dueConsidered > 0) metrics.on_time_rate = Math.round((onTime / dueConsidered) * 100);

    // Six-month operational trend: requests raised vs. documents received.
    const activity_trend: Array<{ month: string; requested: number; received: number }> = [];
    {
      const now = new Date();
      const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      const requestedBy = new Map<string, number>();
      const receivedBy = new Map<string, number>();
      for (const r of reqRows) requestedBy.set(key(new Date(r.created_at)), (requestedBy.get(key(new Date(r.created_at))) ?? 0) + 1);
      for (const u of uploads) receivedBy.set(key(new Date(u.created_at)), (receivedBy.get(key(new Date(u.created_at))) ?? 0) + 1);
      for (let i = 5; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const k = key(d);
        activity_trend.push({
          month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
          requested: requestedBy.get(k) ?? 0,
          received: receivedBy.get(k) ?? 0,
        });
      }
    }

    // Categories requested from this supplier.
    const categories = [...new Set(reqRows.map((r) => r.category).filter((c): c is string => Boolean(c)))].slice(0, 20);

    // Framework coverage (SSOT)
    const { data: cov } = await admin.rpc('framework_coverage_v1', { p_buyer_id: buyer_id });
    const coverage = (((cov as { coverage?: unknown[] } | null)?.coverage ?? []) as Array<Record<string, unknown>>)
      .filter((r) => r.supplier_id === supplier_id)
      .map((r) => ({
        framework_code: r.framework_code as string,
        total: Number(r.total ?? 0), compliant: Number(r.compliant ?? 0),
        gaps: Number(r.gaps ?? 0), pending: Number(r.pending ?? 0),
      }));

    // Per-requirement computed status. evidence_claim_ids is what ties a
    // requirement to the evidence that satisfied it -- that linkage is the
    // difference between "trust us, it's compliant" and an auditable record.
    const { data: statusRows } = await admin.from('compliance_current_status')
      .select('framework_code, framework_version, requirement_key, title, outcome, explanation, effective_from, effective_to, evaluated_at, evidence_claim_ids, is_overridden')
      .eq('buyer_id', buyer_id).eq('subject_type', 'supplier').eq('subject_id', supplier_id)
      .order('framework_code', { ascending: true }).limit(120);
    const requirements = (statusRows ?? []) as Array<Record<string, unknown>>;

    // Recent documents
    const { data: recentDocs } = await admin.from('document_uploads')
      .select('status, expiration_date, created_at, document_requests!inner(title, document_type, buyer_id, supplier_id)')
      .eq('document_requests.buyer_id', buyer_id).eq('document_requests.supplier_id', supplier_id)
      .order('created_at', { ascending: false }).limit(12);
    const recent_documents = ((recentDocs ?? []) as Array<Record<string, unknown>>).map((d) => ({
      title: (d.document_requests as Record<string, unknown>)?.title ?? (d.document_requests as Record<string, unknown>)?.document_type ?? 'Document',
      document_type: (d.document_requests as Record<string, unknown>)?.document_type ?? null,
      status: d.status, expiration_date: d.expiration_date, created_at: d.created_at,
    }));

    const totalReq = coverage.reduce((a, r) => a + r.total, 0);
    const compliantReq = coverage.reduce((a, r) => a + r.compliant, 0);
    const openGaps = coverage.reduce((a, r) => a + r.gaps, 0);
    const pendingReq = coverage.reduce((a, r) => a + r.pending, 0);

    // ---- The three distinct scores, named so they can never be conflated ----
    // A single field called "compliance_score" previously meant one thing to the
    // renderer (requirements met) and another to the AI (requests approved),
    // which is how a report could claim 0% and 64 on the same page.
    const requirement_completion = {
      compliant: compliantReq,
      total: totalReq,
      pending: pendingReq,
      gaps: openGaps,
      pct: totalReq > 0 ? Math.round((compliantReq / totalReq) * 100) : null,
    };
    const document_approval = {
      approved: metrics.approved,
      total: metrics.total,
      pct: metrics.total > 0 ? Math.round((metrics.approved / metrics.total) * 100) : null,
    };

    // ---- Risk engine (already computed elsewhere; the report simply reports it)
    // NOTE: overall_score is a RISK score -- higher is worse. Banding must match
    // riskLevelOf() in src/features/supplier-risk/templates.ts (>=67 High,
    // >=34 Medium, else Low) or the same supplier reads differently per surface.
    const { data: riskRow } = await admin.from('supplier_risk_scores')
      .select('overall_score, previous_score, dimension_scores, change_reasons, policy_version, engine_version, calculated_at')
      .eq('buyer_id', buyer_id).eq('supplier_id', supplier_id)
      .order('calculated_at', { ascending: false }).limit(1).maybeSingle();

    const bandOf = (s: number): 'High' | 'Medium' | 'Low' => (s >= 67 ? 'High' : s >= 34 ? 'Medium' : 'Low');
    const risk = riskRow
      ? {
          score: Number(riskRow.overall_score),
          level: bandOf(Number(riskRow.overall_score)),
          previous_score: riskRow.previous_score != null ? Number(riskRow.previous_score) : null,
          delta: riskRow.previous_score != null ? Number(riskRow.overall_score) - Number(riskRow.previous_score) : null,
          dimension_scores: (riskRow.dimension_scores ?? null) as Record<string, number> | null,
          change_reasons: (riskRow.change_reasons ?? null) as unknown,
          policy_version: riskRow.policy_version ?? null,
          engine_version: riskRow.engine_version ?? null,
          calculated_at: riskRow.calculated_at ?? null,
        }
      : null;

    // ---- Document & evidence register: what needs action, not just a log ----
    const in90 = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
    const expiring_soon = recent_documents
      .filter((d) => d.status === 'approved' && d.expiration_date && String(d.expiration_date) <= in90)
      .map((d) => ({
        title: d.title,
        document_type: d.document_type,
        expiration_date: d.expiration_date,
        days_remaining: Math.ceil((new Date(String(d.expiration_date)).getTime() - Date.now()) / 86400000),
      }))
      .sort((a, b) => a.days_remaining - b.days_remaining);

    const overdue_requests = reqRows
      .filter((r) => r.status === 'pending' && r.due_date && r.due_date < today)
      .map((r) => ({
        title: r.title ?? r.document_type ?? 'Document request',
        document_type: r.document_type,
        due_date: r.due_date,
        days_overdue: Math.ceil((Date.now() - new Date(String(r.due_date)).getTime()) / 86400000),
      }))
      .sort((a, b) => b.days_overdue - a.days_overdue)
      .slice(0, 25);

    // A stable, human-quotable identifier for this point-in-time assessment.
    const generated_at = new Date().toISOString();
    const report_id = `SCR-${generated_at.slice(0, 10).replace(/-/g, '')}-${supplier_id.slice(0, 6).toUpperCase()}`;

    // AI executive summary — grounded in the snapshot above, and cached by a
    // fingerprint of that snapshot: it is only regenerated when the underlying
    // compliance data actually changes (a new/updated/expired document, a
    // requirement outcome flip, etc.). Unchanged supplier → cached summary,
    // no model call.
    let ai_summary: z.infer<typeof summarySchema> | null = null;
    let ai_summary_meta: { from_cache: boolean; generated_at: string | null } = { from_cache: false, generated_at: null };

    // Every metric handed to the model is explicitly named and scoped. The
    // model must never invent a single blended "compliance score" -- that is
    // exactly how the report ended up asserting two different numbers.
    const snapshot = {
      supplier: supplier.company_name,
      industry: supplier.industry,
      requirement_completion: {
        ...requirement_completion,
        meaning: 'Framework requirements with accepted evidence. Higher is better. `pending` are awaiting verification and are NOT failures.',
      },
      document_approval: {
        ...document_approval,
        meaning: 'Document requests approved out of those raised. Higher is better. Distinct from requirement completion.',
      },
      risk: risk
        ? { ...risk, meaning: 'Risk score 0-100 where HIGHER MEANS MORE RISK (>=67 High, >=34 Medium, else Low).' }
        : { meaning: 'No risk assessment has been run for this supplier yet.' },
      request_metrics: metrics,
      framework_coverage: coverage,
      requirement_status: requirements.map((r) => ({ framework: r.framework_code, requirement: r.title ?? r.requirement_key, outcome: r.outcome, valid_until: r.effective_to })),
    };
    const fingerprint = await sha256Hex(stableStringify(snapshot));

    // Reuse the cached summary when the inputs are unchanged (unless forced).
    if (!force) {
      const { data: cached } = await admin.from('supplier_report_ai_summaries')
        .select('summary, input_fingerprint, generated_at')
        .eq('buyer_id', buyer_id).eq('supplier_id', supplier_id).maybeSingle();
      if (cached && cached.input_fingerprint === fingerprint) {
        const reuse = summarySchema.safeParse(cached.summary);
        if (reuse.success) {
          ai_summary = reuse.data;
          ai_summary_meta = { from_cache: true, generated_at: (cached.generated_at as string) ?? null };
          await admin.from('supplier_report_ai_summaries')
            .update({ checked_at: new Date().toISOString() })
            .eq('buyer_id', buyer_id).eq('supplier_id', supplier_id);
        }
      }
    }

    // Nothing usable cached (or forced) → generate a fresh summary and cache it.
    if (!ai_summary) {
      const aiConfig = await resolveAiConfig(admin, buyer_id);
      if (aiConfig) {
        try {
          const system = `You are a supply-chain compliance analyst writing the executive summary of a supplier compliance report for a procurement/QA leader. Be precise, factual, and grounded ONLY in the provided snapshot.

HARD RULES:
1. Never invent documents, dates, statuses, owners, or figures. Only cite numbers present in the snapshot.
2. Never merge the distinct metrics into a single "compliance score". requirement_completion, document_approval, and risk.score are SEPARATE measures on different bases. If you cite a number, name which measure it is (e.g. "8 of 12 requirements met", "risk score 64/100").
3. risk.score is a RISK score: higher means MORE risk. Never describe a high risk score as good performance.
4. Requirements with outcome "pending"/"under review" are AWAITING VERIFICATION, not failures. Do not call them non-compliant.
5. Do not assert regulatory or legal consequences unless the snapshot identifies a requirement as regulatory. Prefer "may create certification, contractual, operational, or regulatory exposure depending on the applicable requirement".

Respond with strict JSON: {"headline": "one-line status verdict", "overall_assessment": "2-4 sentences", "strengths": ["..."], "risks": ["..."], "recommendations": ["concrete next action", ...]}.`;
          const raw = await aiComplete(aiConfig, { system, user: JSON.stringify(snapshot), jsonMode: true, maxTokens: 900 });
          ai_summary = summarySchema.parse(JSON.parse(raw));
          const nowIso = new Date().toISOString();
          ai_summary_meta = { from_cache: false, generated_at: nowIso };
          await admin.from('supplier_report_ai_summaries').upsert({
            buyer_id, supplier_id, summary: ai_summary, input_fingerprint: fingerprint,
            model: `${aiConfig.provider}:${aiConfig.model}`, generated_at: nowIso, checked_at: nowIso,
          });
          await admin.from('agent_activities').insert({
            agent_type: 'supplier_report_writer', action_type: 'generate_summary',
            entity_id: supplier_id, entity_type: 'supplier',
            reasoning: ai_summary.headline, details: { model: `${aiConfig.provider}:${aiConfig.model}` }, success: true,
          });
        } catch (e) {
          logEvent('warn', 'supplier_report_ai_summary_failed', context, { error: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    logEvent('info', 'supplier_report_generated', context, { actor_id: user.id, buyer_id, supplier_id });
    return jsonResponse(context, {
      report_id,
      generated_at,
      supplier: {
        id: supplier.id, company_name: supplier.company_name, industry: supplier.industry,
        contact_email: supplier.contact_email, description: supplier.description,
        connection_status: connection ? 'Connected' : 'Not connected',
        connected_since: connection?.responded_at ?? connection?.requested_at ?? null,
      },
      // Retained for backwards compatibility with older clients. New code should
      // read document_approval / requirement_completion, which say what they mean.
      compliance_score,
      requirement_completion,
      document_approval,
      risk,
      metrics,
      categories,
      frameworks_linked: coverage.map((c) => c.framework_code),
      totals: { framework_requirements: totalReq, compliant: compliantReq, open_gaps: openGaps, frameworks: coverage.length },
      framework_coverage: coverage,
      requirements: requirements.map((r) => ({
        framework_code: r.framework_code, framework_version: r.framework_version,
        requirement: r.title ?? r.requirement_key, requirement_key: r.requirement_key,
        outcome: r.outcome, valid_until: r.effective_to, explanation: r.explanation,
        evidence_count: Array.isArray(r.evidence_claim_ids) ? (r.evidence_claim_ids as unknown[]).length : 0,
        is_overridden: Boolean(r.is_overridden),
        evaluated_at: r.evaluated_at,
      })),
      recent_documents,
      expiring_soon,
      overdue_requests,
      activity_trend,
      ai_summary,
      ai_summary_meta,
    });
  } catch (error) {
    logEvent('error', 'supplier_report_failed', context, { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(context, { error: 'Report generation failed' }, 500);
  }
});
