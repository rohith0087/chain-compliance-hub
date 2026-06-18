import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';

// Retained temporarily so the deployed function can be replaced without leaving
// an unmanaged endpoint. API credentials must never be returned to a client.
Deno.serve((req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  logEvent('warn', 'deprecated_secret_endpoint_called', context);
  return jsonResponse(
    context,
    { error: 'This endpoint has been permanently disabled.' },
    410,
    { 'Cache-Control': 'no-store' },
  );
});
