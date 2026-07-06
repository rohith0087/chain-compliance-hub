import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse } from '../_shared/requestContext.ts';

// Reports which AI providers we have a PLATFORM key for, so the Settings UI can
// enable "use our key" per provider. Returns booleans only — never a key value.
// Any authenticated user may read this (it exposes no secret material).

Deno.serve((req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  return jsonResponse(context, {
    openai: Boolean(Deno.env.get('OPENAI_API_KEY')),
    anthropic: Boolean(Deno.env.get('ANTHROPIC_API_KEY')),
    xai: Boolean(Deno.env.get('XAI_API_KEY')),
  });
});
