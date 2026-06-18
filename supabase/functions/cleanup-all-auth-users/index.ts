import { handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { createRequestContext, jsonResponse, logEvent } from '../_shared/requestContext.ts';

// Bulk deletion of production identities is intentionally unavailable over HTTP.
// Incident cleanup must use an approved, audited runbook with an explicit user list.
Deno.serve((req) => {
  const context = createRequestContext(req);
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;

  logEvent('warn', 'bulk_auth_cleanup_endpoint_called', context);
  return jsonResponse(
    context,
    { error: 'Bulk authentication cleanup is disabled.' },
    410,
    { 'Cache-Control': 'no-store' },
  );
});
