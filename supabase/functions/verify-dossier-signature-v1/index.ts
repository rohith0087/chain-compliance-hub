import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { requirementRequestHash as canonicalContentHash } from '../_shared/requirements/requestContract.ts';
import { hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { verifySignature } from '../_shared/dossier/signing.ts';

const requestSchema = z.object({
  dossier_id: z.string().uuid(),
  version_id: z.string().uuid(),
}).strict();

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

    const { data: dossier, error: dossierError } = await admin.from('compliance_dossiers')
      .select('id, buyer_id').eq('id', input.dossier_id).maybeSingle();
    if (dossierError) throw dossierError;
    if (!dossier) return jsonResponse(context, { error: 'Dossier not found' }, 404);

    if (!(await hasBuyerAccess(admin, user.id, dossier.buyer_id))) {
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }

    const { data: version, error: versionError } = await admin.from('dossier_versions')
      .select('id, content_snapshot, content_hash, signature, signing_key_id')
      .eq('id', input.version_id).eq('dossier_id', input.dossier_id).maybeSingle();
    if (versionError) throw versionError;
    if (!version) return jsonResponse(context, { error: 'Dossier version not found' }, 404);

    const { data: signingKey, error: signingKeyError } = await admin.from('dossier_signing_keys')
      .select('public_key_jwk').eq('id', version.signing_key_id).maybeSingle();
    if (signingKeyError) throw signingKeyError;
    if (!signingKey) return jsonResponse(context, { error: 'Signing key not found' }, 404);

    const recomputedHash = await canonicalContentHash(version.content_snapshot);
    const contentMatches = recomputedHash === version.content_hash;
    const signatureValid = contentMatches
      && await verifySignature(signingKey.public_key_jwk as JsonWebKey, version.content_hash, version.signature);

    const { data: chainResult, error: chainError } = await admin.rpc('verify_dossier_audit_chain_v1', {
      p_dossier_id: input.dossier_id,
    });
    if (chainError) throw chainError;

    await admin.from('dossier_audit_log').insert({
      dossier_id: input.dossier_id,
      version_id: input.version_id,
      event_type: 'verified',
      actor_id: user.id,
      metadata: { content_matches: contentMatches, signature_valid: signatureValid, audit_chain_valid: chainResult.valid },
    });

    logEvent('info', 'dossier_signature_verified', context, {
      dossier_id: input.dossier_id, version_id: input.version_id, actor_id: user.id,
      content_matches: contentMatches, signature_valid: signatureValid, audit_chain_valid: chainResult.valid,
      latency_ms: Math.round(performance.now() - startedAt),
    });

    return jsonResponse(context, {
      dossier_id: input.dossier_id,
      version_id: input.version_id,
      content_matches: contentMatches,
      signature_valid: signatureValid,
      audit_chain: chainResult,
      correlation_id: context.correlationId,
    });
  } catch (error) {
    logEvent('error', 'dossier_signature_verification_failed', context, {
      error: error instanceof Error ? error.message : String(error),
      latency_ms: Math.round(performance.now() - startedAt),
    });
    return jsonResponse(context, { error: 'Dossier signature verification failed', correlation_id: context.correlationId }, 500);
  }
});
