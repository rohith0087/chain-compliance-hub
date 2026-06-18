import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { z } from 'zod';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';

const requestSchema = z.object({ framework_version_id: z.string().uuid() }).strict();

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  if (req.method !== 'POST') return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return jsonResponse(context, { error: 'Authentication required' }, 401);

    const admin = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await admin.auth.getUser(authHeader.slice('Bearer '.length));
    if (authError || !user) return jsonResponse(context, { error: 'Invalid authentication' }, 401);

    const { data: platformAdmin } = await admin.from('platform_administrators').select('id')
      .eq('auth_user_id', user.id).eq('is_active', true).maybeSingle();
    if (!platformAdmin) {
      logEvent('warn', 'requirement_publication_forbidden', context, { actor_id: user.id });
      return jsonResponse(context, { error: 'Active platform administrator access required' }, 403);
    }

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return jsonResponse(context, { error: 'Invalid request', details: parsed.error.flatten() }, 400);

    const { error } = await admin.rpc('publish_requirement_framework_version_v1', {
      p_framework_version_id: parsed.data.framework_version_id,
      p_actor_id: user.id,
    });
    if (error) throw error;

    logEvent('info', 'requirement_framework_published', context, {
      actor_id: user.id,
      framework_version_id: parsed.data.framework_version_id,
    });
    return jsonResponse(context, {
      framework_version_id: parsed.data.framework_version_id,
      status: 'published',
      correlation_id: context.correlationId,
    });
  } catch (error) {
    logEvent('error', 'requirement_publication_failed', context, {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(context, { error: 'Requirement publication failed', correlation_id: context.correlationId }, 500);
  }
});
