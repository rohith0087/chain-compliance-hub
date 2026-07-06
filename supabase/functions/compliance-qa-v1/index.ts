import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { hasApprovedConnection, hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { aiComplete, resolveAiConfig } from '../_shared/ai/complete.ts';
import { extractTextFromStorage } from '../_shared/ai/extractText.ts';

const MAX_EVIDENCE_DOCS = 4;
const EVIDENCE_EXCERPT_CHARS = 4000;

// Phase 5C (final_output.md §11.6, §13.1 "Verify it"): grounded Q&A over ONE
// supplier's *computed* compliance state — active requirements, their outcomes,
// approved evidence mappings, and open gaps. Retrieval is structured (the
// compliance chain itself), so answers cite requirement keys and cannot drift
// into ungrounded document text. The model is instructed to answer only from
// the provided state and say when it doesn't know.

const requestSchema = z.object({
  buyer_id: z.string().uuid(),
  supplier_id: z.string().uuid(),
  question: z.string().min(3).max(1000),
}).strict();

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
    const input = parsed.data;

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice('Bearer '.length));
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);
    if (!(await hasBuyerAccess(admin, user.id, input.buyer_id))) {
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }
    if (!(await hasApprovedConnection(admin, input.buyer_id, input.supplier_id))) {
      return jsonResponse(context, { error: 'No approved connection with this supplier' }, 403);
    }

    const aiConfig = await resolveAiConfig(admin, input.buyer_id);
    if (!aiConfig) return jsonResponse(context, { error: 'AI is not configured — set a provider key in Settings → Integrations → AI' }, 503);

    // --- Retrieval: the supplier's computed compliance chain (the scope) ---
    const [{ data: supplier }, { data: statuses }, { data: mappings }, { data: signals }] = await Promise.all([
      admin.from('suppliers').select('company_name').eq('id', input.supplier_id).maybeSingle(),
      admin.from('compliance_current_status')
        .select('framework_code, framework_version, requirement_key, title, outcome, explanation, effective_to')
        .eq('buyer_id', input.buyer_id).eq('subject_type', 'supplier').eq('subject_id', input.supplier_id),
      admin.from('requirement_evidence_mappings')
        .select('framework_code, requirement_key, requirement_title, evidence_document_type, status, decided_at, ai_verdict, ai_confidence')
        .eq('buyer_id', input.buyer_id).eq('subject_id', input.supplier_id).eq('status', 'approved'),
      admin.from('risk_signals')
        .select('framework_code, requirement_key, signal_type, weight')
        .eq('buyer_id', input.buyer_id).eq('supplier_id', input.supplier_id).eq('status', 'open'),
    ]);

    const supplierName = supplier?.company_name ?? 'this supplier';
    const scope = {
      supplier: supplierName,
      requirements: (statuses ?? []).map((s) => ({
        framework: `${s.framework_code} ${s.framework_version}`,
        key: s.requirement_key, title: s.title, status: s.outcome,
        valid_until: s.effective_to, explanation: s.explanation,
      })),
      approved_evidence: (mappings ?? []).map((m) => ({
        requirement: m.requirement_key, evidence_type: m.evidence_document_type,
        approved_at: m.decided_at, ai_verdict: m.ai_verdict,
      })),
      open_gaps: (signals ?? []).map((g) => ({ requirement: g.requirement_key, gap: g.signal_type })),
      evidence_documents: [] as Array<{ requirement: string; document: string; excerpt: string }>,
    };

    // Document-text grounding: pull the actual text of a few approved evidence
    // documents so the assistant can answer questions about their contents
    // (e.g. "what does the certificate scope say"), not just computed status.
    // Scoped strictly to this supplier's approved evidence.
    const approvedVersionIds = [...new Set((mappings ?? []).map((m) => m.evidence_version_id).filter(Boolean))].slice(0, MAX_EVIDENCE_DOCS);
    if (approvedVersionIds.length) {
      const { data: versions } = await admin.from('evidence_versions')
        .select('id, document_asset_id, record:evidence_records!inner(display_name)')
        .in('id', approvedVersionIds);
      const assetIds = [...new Set((versions ?? []).map((v) => v.document_asset_id).filter(Boolean))];
      const { data: assets } = assetIds.length
        ? await admin.from('document_assets').select('id, storage_bucket, storage_path, mime_type, original_file_name').in('id', assetIds)
        : { data: [] };
      const assetById = new Map((assets ?? []).map((a) => [a.id, a]));
      const versionToRequirement = new Map((mappings ?? []).map((m) => [m.evidence_version_id, m.requirement_key]));

      for (const version of versions ?? []) {
        const asset = version.document_asset_id ? assetById.get(version.document_asset_id) : null;
        if (!asset) continue;
        const record = Array.isArray(version.record) ? version.record[0] : version.record;
        const text = await extractTextFromStorage(
          admin, asset.storage_bucket, asset.storage_path, asset.mime_type, EVIDENCE_EXCERPT_CHARS);
        if (text.trim().length > 0) {
          scope.evidence_documents.push({
            requirement: (versionToRequirement.get(version.id) as string) ?? 'unknown',
            document: (record as { display_name?: string })?.display_name ?? asset.original_file_name ?? 'evidence document',
            excerpt: text,
          });
        }
      }
    }

    const systemPrompt = `You answer questions about ONE supplier's compliance state for a buyer. You are given: the supplier's active requirements (with computed status and explanations), approved evidence, open gaps, and — under evidence_documents — excerpts of the ACTUAL approved evidence document text. Rules: answer ONLY from the provided material; for status/coverage questions cite the requirement key in brackets like [SQF-FOOD-SAFETY-CERT]; for questions about a document's contents, quote/cite the document by its name; if the material does not contain the answer, say "I don't have that in ${supplierName}'s current compliance record"; never invent certificates, dates, scopes, or clauses not present. Be concise and factual — a compliance manager is reading this.`;

    const answer = await aiComplete(aiConfig, {
      system: systemPrompt,
      user: `Compliance state:\n${JSON.stringify(scope)}\n\nQuestion: ${input.question}`,
      maxTokens: 600,
      temperature: 0.1,
    }) || 'No answer produced.';

    await admin.from('agent_activities').insert({
      agent_type: 'compliance_qa', action_type: 'answer_question',
      entity_type: 'supplier', entity_id: input.supplier_id,
      details: { question: input.question, requirements_in_scope: scope.requirements.length, model: `${aiConfig.provider}:${aiConfig.model}` },
      reasoning: answer.slice(0, 2000), success: true,
    });

    logEvent('info', 'compliance_qa_answered', context, {
      actor_id: user.id, buyer_id: input.buyer_id, supplier_id: input.supplier_id,
      scope_size: scope.requirements.length,
    });
    return jsonResponse(context, {
      answer,
      scope_summary: {
        requirements: scope.requirements.length,
        approved_evidence: scope.approved_evidence.length,
        open_gaps: scope.open_gaps.length,
        documents_read: scope.evidence_documents.length,
      },
    });
  } catch (error) {
    logEvent('error', 'compliance_qa_failed', context, {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(context, { error: 'Compliance Q&A failed' }, 500);
  }
});
