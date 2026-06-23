import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { isAuthorizedCronRequest } from '../_shared/systemAuth.ts';

// Scheduled calls authenticate with the Vault-backed SYSTEM_INVOCATION_SECRET
// through isAuthorizedCronRequest; service-role recovery calls remain valid.
// Decoupled from extraction/finalization: this is a periodic batch pass over
// already-extracted, already-validated evidence, not part of the upload path.

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });
  const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  if (!(await isAuthorizedCronRequest(req, admin))) return jsonResponse(context, { error: 'System authorization required' }, 403);

  const summary = { processed: 0, auto_verified: 0, skipped: 0, failed: 0 };
  try {
    const { data: candidates, error: listError } = await admin.rpc('list_unattested_evidence_versions_v1', { p_limit: 50 });
    if (listError) throw listError;

    for (const row of (candidates || []) as { evidence_version_id: string }[]) {
      summary.processed += 1;
      try {
        const { data: result, error: verifyError } = await admin.rpc('auto_verify_evidence_v1', { p_evidence_version_id: row.evidence_version_id });
        if (verifyError) throw verifyError;
        if (result?.verified) {
          summary.auto_verified += 1;
        } else {
          summary.skipped += 1;
        }
      } catch (error) {
        summary.failed += 1;
        logEvent('error', 'evidence_auto_verification_failed', context, {
          evidence_version_id: row.evidence_version_id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return jsonResponse(context, summary);
  } catch (error) {
    logEvent('error', 'evidence_auto_verification_batch_failed', context, { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(context, { error: 'Evidence auto-verification processor failed' }, 500);
  }
});
