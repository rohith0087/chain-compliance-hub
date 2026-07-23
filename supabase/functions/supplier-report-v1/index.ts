import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
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
      .select('id, status, due_date, created_at, category').eq('buyer_id', buyer_id).eq('supplier_id', supplier_id);
    const reqRows = (requests ?? []) as Array<{ id: string; status: string; due_date: string | null; created_at: string; category: string | null }>;
    const today = new Date().toISOString().slice(0, 10);
    const metrics = {
      total: reqRows.length,
      approved: reqRows.filter((r) => r.status === 'approved').length,
      pending: reqRows.filter((r) => r.status === 'pending').length,
      submitted: reqRows.filter((r) => r.status === 'submitted').length,
      rejected: reqRows.filter((r) => r.status === 'rejected').length,
      overdue: reqRows.filter((r) => r.status === 'pending' && r.due_date && r.due_date < today).length,
      avg_reply_days: null as number | null,
    };
    const compliance_score = metrics.total > 0 ? Math.round((metrics.approved / metrics.total) * 100) : 0;

    // Average reply time: days from a request being created to the supplier's
    // first upload against it. A concrete "how responsive is this supplier" signal.
    const reqCreatedById = new Map(reqRows.map((r) => [r.id, r.created_at]));
    const { data: uploadRows } = await admin.from('document_uploads')
      .select('created_at, request_id, document_requests!inner(buyer_id, supplier_id)')
      .eq('document_requests.buyer_id', buyer_id).eq('document_requests.supplier_id', supplier_id);
    const replyDeltas: number[] = [];
    for (const u of (uploadRows ?? []) as Array<{ created_at: string; request_id: string }>) {
      const reqCreated = reqCreatedById.get(u.request_id);
      if (!reqCreated) continue;
      const days = (new Date(u.created_at).getTime() - new Date(reqCreated).getTime()) / 86400000;
      if (days >= 0 && days < 3650) replyDeltas.push(days);
    }
    if (replyDeltas.length) metrics.avg_reply_days = Math.round((replyDeltas.reduce((a, b) => a + b, 0) / replyDeltas.length) * 10) / 10;

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

    // Per-requirement computed status
    const { data: statusRows } = await admin.from('compliance_current_status')
      .select('framework_code, requirement_key, title, outcome, explanation, effective_to')
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

    // AI executive summary — grounded in the snapshot above, and cached by a
    // fingerprint of that snapshot: it is only regenerated when the underlying
    // compliance data actually changes (a new/updated/expired document, a
    // requirement outcome flip, etc.). Unchanged supplier → cached summary,
    // no model call.
    let ai_summary: z.infer<typeof summarySchema> | null = null;
    let ai_summary_meta: { from_cache: boolean; generated_at: string | null } = { from_cache: false, generated_at: null };

    const snapshot = {
      supplier: supplier.company_name,
      industry: supplier.industry,
      compliance_score,
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
          const system = `You are a supply-chain compliance analyst writing the executive summary of a supplier compliance report for a procurement/QA leader. Be precise, factual, and grounded ONLY in the provided snapshot. Do not invent documents, dates, or statuses. Respond with strict JSON: {"headline": "one-line status verdict", "overall_assessment": "2-4 sentences", "strengths": ["..."], "risks": ["..."], "recommendations": ["concrete next action", ...]}.`;
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
      generated_at: new Date().toISOString(),
      supplier: {
        id: supplier.id, company_name: supplier.company_name, industry: supplier.industry,
        contact_email: supplier.contact_email, description: supplier.description,
        connection_status: connection ? 'Connected' : 'Not connected',
      },
      compliance_score,
      metrics,
      categories,
      frameworks_linked: coverage.map((c) => c.framework_code),
      totals: { framework_requirements: totalReq, compliant: compliantReq, open_gaps: openGaps, frameworks: coverage.length },
      framework_coverage: coverage,
      requirements: requirements.map((r) => ({
        framework_code: r.framework_code, requirement: r.title ?? r.requirement_key,
        outcome: r.outcome, valid_until: r.effective_to, explanation: r.explanation,
      })),
      recent_documents,
      ai_summary,
      ai_summary_meta,
    });
  } catch (error) {
    logEvent('error', 'supplier_report_failed', context, { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(context, { error: 'Report generation failed' }, 500);
  }
});
