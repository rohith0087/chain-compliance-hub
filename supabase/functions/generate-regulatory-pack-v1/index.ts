import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { transformToCpscEfilingV1, type CpscEfilingSourceSnapshot } from '../_shared/regulatoryPacks/cpscEfiling.ts';
import type { DossierContentSnapshotV1 } from '../_shared/dossier/contracts.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

const requestSchema = z.object({
  pack_code: z.string().min(1),
  dossier_version_id: z.string().uuid(),
}).strict();

const PACK_TRANSFORMS: Record<string, (snapshot: CpscEfilingSourceSnapshot) => { payload: unknown; valid: boolean; errors: string[] }> = {
  'CPSC-EFILING': transformToCpscEfilingV1,
};

async function resolveSupplierContactEmail(admin: SupabaseAdmin, subjectType: string, subjectId: string): Promise<string | null> {
  if (subjectType === 'supplier') {
    const { data } = await admin.from('suppliers').select('contact_email').eq('id', subjectId).maybeSingle();
    return data?.contact_email ?? null;
  }
  if (subjectType === 'facility') {
    const { data: branch } = await admin.from('company_branches').select('company_id').eq('id', subjectId).maybeSingle();
    if (!branch) return null;
    const { data: supplier } = await admin.from('suppliers').select('contact_email').eq('id', branch.company_id).maybeSingle();
    return supplier?.contact_email ?? null;
  }
  const { data: item } = await admin.from('supplier_items').select('supplier_id').eq('id', subjectId).maybeSingle();
  if (!item) return null;
  const { data: supplier } = await admin.from('suppliers').select('contact_email').eq('id', item.supplier_id).maybeSingle();
  return supplier?.contact_email ?? null;
}

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const startedAt = performance.now();
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse(context, { error: 'Authentication required' }, 401);

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice('Bearer '.length);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    }
    const input = parsed.data;

    const { data: pack, error: packError } = await admin.from('regulatory_packs')
      .select('pack_code, status').eq('pack_code', input.pack_code).maybeSingle();
    if (packError) throw packError;
    if (!pack || pack.status !== 'published') {
      return jsonResponse(context, { error: 'This regulatory pack is not yet available' }, 403);
    }

    const transform = PACK_TRANSFORMS[input.pack_code];
    if (!transform) {
      return jsonResponse(context, { error: 'No transform is registered for this pack' }, 500);
    }

    const { data: version, error: versionError } = await admin.from('dossier_versions')
      .select('id, dossier_id, content_snapshot, content_hash, version_number')
      .eq('id', input.dossier_version_id).maybeSingle();
    if (versionError) throw versionError;
    if (!version) return jsonResponse(context, { error: 'Dossier version not found' }, 404);

    const { data: dossier, error: dossierError } = await admin.from('compliance_dossiers')
      .select('buyer_id, subject_type, subject_id').eq('id', version.dossier_id).maybeSingle();
    if (dossierError) throw dossierError;
    if (!dossier) return jsonResponse(context, { error: 'Dossier not found' }, 404);

    if (!(await hasBuyerAccess(admin, user.id, dossier.buyer_id))) {
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }

    const snapshot = version.content_snapshot as DossierContentSnapshotV1;
    const certifierContactEmail = await resolveSupplierContactEmail(admin, dossier.subject_type, dossier.subject_id);

    const sourceSnapshot: CpscEfilingSourceSnapshot = {
      subject_type: dossier.subject_type as CpscEfilingSourceSnapshot['subject_type'],
      subject_id: dossier.subject_id,
      dossier_id: version.dossier_id,
      version_number: version.version_number,
      content_hash: version.content_hash,
      subject_display_name: snapshot.subject_display_name,
      certifier_contact_email: certifierContactEmail,
      statements: snapshot.statements.map((statement) => ({
        framework_code: statement.framework_code,
        requirement_key: statement.requirement_key,
        title: statement.title,
        outcome: statement.outcome,
        citation: statement.citation,
        evidence_claim_ids: statement.evidence_claim_ids,
      })),
    };

    const transformResult = transform(sourceSnapshot);

    const { data: submissionId, error: submissionError } = await admin.rpc('record_regulatory_pack_submission_v1', {
      p_pack_code: input.pack_code,
      p_dossier_version_id: input.dossier_version_id,
      p_buyer_id: dossier.buyer_id,
      p_subject_type: dossier.subject_type,
      p_subject_id: dossier.subject_id,
      p_payload: transformResult.payload,
      p_validation_status: transformResult.valid ? 'valid' : 'invalid',
      p_validation_errors: transformResult.errors,
      p_actor_id: user.id,
    });
    if (submissionError) throw submissionError;

    logEvent('info', 'regulatory_pack_submission_recorded', context, {
      submission_id: submissionId, pack_code: input.pack_code, buyer_id: dossier.buyer_id,
      validation_status: transformResult.valid ? 'valid' : 'invalid',
      latency_ms: Math.round(performance.now() - startedAt),
    });

    return jsonResponse(context, {
      submission_id: submissionId,
      pack_code: input.pack_code,
      validation_status: transformResult.valid ? 'valid' : 'invalid',
      validation_errors: transformResult.errors,
      payload: transformResult.payload,
      correlation_id: context.correlationId,
    });
  } catch (error) {
    logEvent('error', 'regulatory_pack_generation_failed', context, {
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Math.round(performance.now() - startedAt),
    });
    return jsonResponse(context, { error: 'Regulatory pack generation failed', correlation_id: context.correlationId }, 500);
  }
});
