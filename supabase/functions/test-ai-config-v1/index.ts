import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';
import { hasBuyerAccess } from '../_shared/requirements/applicability.ts';
import { aiComplete, resolveAiConfig } from '../_shared/ai/complete.ts';

// Validates a buyer's saved AI configuration with a tiny live completion, so
// the Settings UI can confirm the provider/model/key actually work before the
// user relies on them.

const requestSchema = z.object({ buyer_id: z.string().uuid() }).strict();

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse(context, { error: 'Authentication required' }, 401);
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse(context, { error: 'Invalid request' }, 400);
    const input = parsed.data;

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice('Bearer '.length));
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);
    if (!(await hasBuyerAccess(admin, user.id, input.buyer_id))) {
      return jsonResponse(context, { error: 'Buyer access required' }, 403);
    }

    const aiConfig = await resolveAiConfig(admin, input.buyer_id);
    if (!aiConfig) {
      return jsonResponse(context, { ok: false, error: 'No usable key for the selected provider. Bring your own key, or pick a provider we have a platform key for.' });
    }

    try {
      const reply = await aiComplete(aiConfig, {
        system: 'You are a connection test. Reply with exactly the word: OK',
        user: 'ping',
        maxTokens: 5,
      });
      const ok = reply.toLowerCase().includes('ok');
      logEvent('info', 'ai_config_tested', context, { buyer_id: input.buyer_id, provider: aiConfig.provider, ok });
      return jsonResponse(context, {
        ok, provider: aiConfig.provider, model: aiConfig.model, own_key: aiConfig.ownKey,
        sample: reply.slice(0, 40),
      });
    } catch (callError) {
      return jsonResponse(context, {
        ok: false, provider: aiConfig.provider, model: aiConfig.model, own_key: aiConfig.ownKey,
        error: callError instanceof Error ? callError.message : String(callError),
      });
    }
  } catch (error) {
    logEvent('error', 'ai_config_test_failed', context, { error: error instanceof Error ? error.message : String(error) });
    return jsonResponse(context, { error: 'AI config test failed' }, 500);
  }
});
