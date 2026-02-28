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

export function systemAuthErrorResponse(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: 'Unauthorized: Invalid or missing system secret' }),
    {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
