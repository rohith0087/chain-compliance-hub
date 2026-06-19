import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { checkRateLimit } from '../_shared/rateLimiter.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { requirementRequestHash as canonicalContentHash } from '../_shared/requirements/requestContract.ts';
import { parseIdempotencyKey } from '../_shared/requirements/requestContract.ts';
import { hasBuyerAccess, loadSubject } from '../_shared/requirements/applicability.ts';
import { isBuyerFeatureEnabled } from '../_shared/featureFlags.ts';
import {
  generateDossierRequestV1Schema,
  generateDossierResponseV1Schema,
  type DossierContentSnapshotV1,
  type DossierStatementV1,
} from '../_shared/dossier/contracts.ts';
import { signDigest } from '../_shared/dossier/signing.ts';

type SupabaseAdmin = ReturnType<typeof createClient>;

function subjectDisplayName(subjectType: string, subject: Record<string, unknown>): string {
  if (subjectType === 'supplier') return String(subject.company_name ?? 'Unknown supplier');
  if (subjectType === 'facility') return String(subject.branch_name ?? 'Unknown facility');
  return String(subject.item_name ?? 'Unknown product');
}

async function buildStatements(admin: SupabaseAdmin, buyerId: string, subjectType: string, subjectId: string): Promise<DossierStatementV1[]> {
  const { data: statusRows, error: statusError } = await admin.from('compliance_current_status')
    .select('*').eq('buyer_id', buyerId).eq('subject_type', subjectType).eq('subject_id', subjectId);
  if (statusError) throw statusError;
  if (!statusRows || statusRows.length === 0) return [];

  const requirementVersionIds = [...new Set(statusRows.map((row) => row.requirement_version_id).filter(Boolean))];
  const legacyMappingIds = [...new Set(statusRows.map((row) => row.legacy_mapping_id).filter(Boolean))];
  const evidenceClaimIds = [...new Set(statusRows.flatMap((row) => row.evidence_claim_ids || []))];

  const [versionsResult, legacyResult, evidenceResult] = await Promise.all([
    requirementVersionIds.length
      ? admin.from('requirement_versions').select('id, citation, source_url').in('id', requirementVersionIds)
      : Promise.resolve({ data: [], error: null }),
    legacyMappingIds.length
      ? admin.from('legacy_requirement_mappings').select('id').in('id', legacyMappingIds)
      : Promise.resolve({ data: [], error: null }),
    evidenceClaimIds.length
      ? admin.from('evidence_claims').select('id, document_type, issuer, certificate_number, issue_date, expiry_date, status').in('id', evidenceClaimIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (versionsResult.error) throw versionsResult.error;
  if (legacyResult.error) throw legacyResult.error;
  if (evidenceResult.error) throw evidenceResult.error;

  const versionById = new Map((versionsResult.data || []).map((row) => [row.id, row]));
  const evidenceById = new Map((evidenceResult.data || []).map((row) => [row.id, row]));

  return statusRows.map((row): DossierStatementV1 => {
    const version = row.requirement_version_id ? versionById.get(row.requirement_version_id) : null;
    const claimIds: string[] = row.evidence_claim_ids || [];
    return {
      decision_result_id: row.decision_result_id,
      requirement_version_id: row.requirement_version_id,
      legacy_mapping_id: row.legacy_mapping_id,
      framework_code: row.framework_code,
      framework_version: row.framework_version,
      requirement_key: row.requirement_key,
      title: row.title,
      outcome: row.outcome,
      is_overridden: row.is_overridden,
      applicability_outcome: row.applicability_outcome,
      explanation: row.explanation,
      citation: version?.citation ?? null,
      source_url: version?.source_url ?? null,
      evidence_claim_ids: claimIds,
      evidence: claimIds.flatMap((id) => {
        const claim = evidenceById.get(id);
        return claim ? [claim] : [];
      }),
      decision_version: row.decision_version,
      effective_from: row.effective_from,
      effective_to: row.effective_to,
      evaluated_at: row.evaluated_at,
    };
  });
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

    const idempotencyKey = parseIdempotencyKey(req);
    if (!idempotencyKey) {
      return jsonResponse(context, { error: 'A valid x-idempotency-key header is required' }, 400);
    }

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authHeader.slice('Bearer '.length);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);

    const limit = checkRateLimit(`dossier:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      return jsonResponse(context, { error: 'Too many requests' }, 429, {
        'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)),
      });
    }

    const parsed = generateDossierRequestV1Schema.safeParse(await req.json());
    if (!parsed.success) {
      return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);
    }
    const input = parsed.data;

    if (!(await hasBuyerAccess(admin, user.id, input.buyer_id))) {
      logEvent('warn', 'dossier_generation_forbidden', context, { actor_id: user.id, buyer_id: input.buyer_id });
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }
    if (!(await isBuyerFeatureEnabled(admin, input.buyer_id, 'compliance_dossiers_v1'))) {
      logEvent('warn', 'dossier_generation_feature_disabled', context, { actor_id: user.id, buyer_id: input.buyer_id });
      return jsonResponse(context, { error: 'Dossier generation is disabled for this organization' }, 403);
    }

    const requestHash = await canonicalContentHash(input);
    const { data: existingDossier } = await admin.from('compliance_dossiers')
      .select('id').eq('buyer_id', input.buyer_id).eq('subject_type', input.subject_type).eq('subject_id', input.subject_id)
      .maybeSingle();
    if (existingDossier) {
      const { data: existingVersion } = await admin.from('dossier_versions')
        .select('*').eq('dossier_id', existingDossier.id).eq('actor_id', user.id).eq('idempotency_key', idempotencyKey)
        .maybeSingle();
      if (existingVersion) {
        if (existingVersion.request_hash !== requestHash) {
          return jsonResponse(context, { error: 'Idempotency key was already used for a different request' }, 409);
        }
        const replayResponse = generateDossierResponseV1Schema.parse({
          dossier_id: existingDossier.id,
          version_id: existingVersion.id,
          version_number: existingVersion.version_number,
          idempotent_replay: true,
          content_hash: existingVersion.content_hash,
          signature: existingVersion.signature,
          signing_key_id: existingVersion.signing_key_id,
          correlation_id: context.correlationId,
          content_snapshot: existingVersion.content_snapshot,
        });
        logEvent('info', 'dossier_generation_replayed', context, {
          dossier_id: existingDossier.id, version_id: existingVersion.id,
          latency_ms: Math.round(performance.now() - startedAt),
        });
        return jsonResponse(context, replayResponse);
      }
    }

    const subjectContext = await loadSubject(admin, input.buyer_id, input.subject_type, input.subject_id);
    if (!subjectContext) return jsonResponse(context, { error: 'Subject not found or not accessible' }, 404);

    const statements = await buildStatements(admin, input.buyer_id, input.subject_type, input.subject_id);

    const contentSnapshot: DossierContentSnapshotV1 = {
      schema_version: 'dossier-v1',
      buyer_id: input.buyer_id,
      subject_type: input.subject_type,
      subject_id: input.subject_id,
      subject_display_name: subjectDisplayName(input.subject_type, subjectContext.subject),
      effective_at: input.effective_at,
      generated_at: new Date().toISOString(),
      statements,
    };

    const contentHash = await canonicalContentHash(contentSnapshot);

    const { data: signingKey, error: signingKeyError } = await admin.from('dossier_signing_keys')
      .select('id').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (signingKeyError) throw signingKeyError;
    if (!signingKey) {
      return jsonResponse(context, { error: 'No active dossier signing key is registered' }, 503);
    }

    const { data: privateKeyJwkText, error: privateKeyError } = await admin.rpc('get_dossier_signing_private_key_v1', {
      p_signing_key_id: signingKey.id,
    });
    if (privateKeyError) throw privateKeyError;
    const signature = await signDigest(JSON.parse(privateKeyJwkText as string), contentHash);

    const { data: recorded, error: recordError } = await admin.rpc('record_dossier_version_v1', {
      p_buyer_id: input.buyer_id,
      p_subject_type: input.subject_type,
      p_subject_id: input.subject_id,
      p_effective_at: input.effective_at,
      p_content_snapshot: contentSnapshot,
      p_content_hash: contentHash,
      p_signature: signature,
      p_signing_key_id: signingKey.id,
      p_actor_id: user.id,
      p_idempotency_key: idempotencyKey,
      p_request_hash: requestHash,
    });
    if (recordError) throw recordError;

    const recordedResult = recorded as { dossier_id: string; version_id: string; version_number: number };

    logEvent('info', 'dossier_generated', context, {
      dossier_id: recordedResult.dossier_id,
      version_id: recordedResult.version_id,
      version_number: recordedResult.version_number,
      actor_id: user.id,
      buyer_id: input.buyer_id,
      statement_count: statements.length,
      latency_ms: Math.round(performance.now() - startedAt),
    });

    const response = generateDossierResponseV1Schema.parse({
      dossier_id: recordedResult.dossier_id,
      version_id: recordedResult.version_id,
      version_number: recordedResult.version_number,
      idempotent_replay: false,
      content_hash: contentHash,
      signature,
      signing_key_id: signingKey.id,
      correlation_id: context.correlationId,
      content_snapshot: contentSnapshot,
    });
    return jsonResponse(context, response);
  } catch (error) {
    logEvent('error', 'dossier_generation_failed', context, {
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Math.round(performance.now() - startedAt),
    });
    return jsonResponse(context, { error: 'Dossier generation failed', correlation_id: context.correlationId }, 500);
  }
});
