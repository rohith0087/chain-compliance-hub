import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { getSupabaseSecretKey, requireEnv } from '../_shared/env.ts';
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimiter.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';

interface SpeechRequest {
  text?: unknown;
  voice?: unknown;
}

const DEFAULT_VOICE = 'EXAVITQu4vr4xnSDxMaL';
const VOICE_ID_PATTERN = /^[A-Za-z0-9_-]{10,64}$/;

Deno.serve(async (req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  if (req.method !== 'POST') {
    return jsonResponse(context, { error: 'Method not allowed' }, 405, { Allow: 'POST' });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse(context, { error: 'Authentication required' }, 401);
    }

    const supabase = createClient(requireEnv('SUPABASE_URL'), getSupabaseSecretKey());
    const token = authHeader.slice('Bearer '.length);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse(context, { error: 'Invalid authentication' }, 401);
    }

    const rateLimit = checkRateLimit(`elevenlabs-tts:${user.id}`, 10, 60_000);
    if (!rateLimit.allowed) {
      return rateLimitResponse(context.corsHeaders, rateLimit.retryAfterMs);
    }

    const body = await req.json() as SpeechRequest;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const voice = typeof body.voice === 'string' ? body.voice.trim() : DEFAULT_VOICE;

    if (!text || text.length > 5_000) {
      return jsonResponse(context, { error: 'Text must contain between 1 and 5000 characters' }, 400);
    }
    if (!VOICE_ID_PATTERN.test(voice)) {
      return jsonResponse(context, { error: 'Invalid voice identifier' }, 400);
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': requireEnv('ELEVENLABS_API_KEY'),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      logEvent('error', 'tts_provider_failed', context, { user_id: user.id, status: response.status });
      return jsonResponse(context, { error: 'Speech provider request failed' }, 502);
    }

    const audio = await response.arrayBuffer();
    logEvent('info', 'tts_completed', context, { user_id: user.id, bytes: audio.byteLength });
    return new Response(audio, {
      headers: {
        ...context.corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, no-store',
        'x-correlation-id': context.correlationId,
      },
    });
  } catch (error) {
    logEvent('error', 'tts_failed', context, {
      error: error instanceof Error ? error.message : 'unknown error',
    });
    return jsonResponse(context, { error: 'Unable to generate speech' }, 500);
  }
});
