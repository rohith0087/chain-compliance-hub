/**
 * Validates system-level invocations (cron jobs, internal triggers).
 * Checks for a shared secret in the X-System-Secret header.
 */
export function validateSystemSecret(req: Request): boolean {
  const systemSecret = Deno.env.get('SYSTEM_INVOCATION_SECRET');
  if (!systemSecret) {
    console.warn('SYSTEM_INVOCATION_SECRET not configured - denying system access');
    return false;
  }

  const providedSecret = req.headers.get('X-System-Secret');
  if (!providedSecret) {
    return false;
  }

  // Constant-time comparison to prevent timing attacks
  if (systemSecret.length !== providedSecret.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < systemSecret.length; i++) {
    mismatch |= systemSecret.charCodeAt(i) ^ providedSecret.charCodeAt(i);
  }

  return mismatch === 0;
}

/**
 * Confirms the bearer token presented to a verify_jwt=true function is a
 * service-role key, not just any signed JWT (a regular user's session JWT
 * also passes the gateway's verify_jwt check). Use for cron-only endpoints
 * that perform expensive or batch operations and must not be triggerable by
 * an arbitrary authenticated user.
 */
export function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length);
  const segments = token.split('.');
  if (segments.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(segments[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload?.role === 'service_role';
  } catch {
    return false;
  }
}

export function systemAuthErrorResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized: Invalid or missing system secret' }),
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
