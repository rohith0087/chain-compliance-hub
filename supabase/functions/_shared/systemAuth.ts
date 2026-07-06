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

interface CronAuthClient {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{
    data: unknown;
    error: unknown;
  }>;
}

/**
 * Authorizes scheduled processors without placing a platform service-role key
 * in cron SQL. Direct service-role calls remain supported for manual recovery.
 */
export async function isAuthorizedCronRequest(
  req: Request,
  admin: CronAuthClient,
): Promise<boolean> {
  if (isServiceRoleRequest(req)) return true;

  const secret = req.headers.get('X-System-Secret');
  if (!secret) return false;

  const { data, error } = await admin.rpc('verify_system_cron_secret_v1', {
    p_secret: secret,
  });
  return !error && data === true;
}

/**
 * Single door for trusted internal/system invocations. Superset of every
 * mechanism, so one edge function calling another (or a cron job) is accepted
 * whether it presents a service-role bearer, the SYSTEM_INVOCATION_SECRET env
 * secret, or the vault-backed cron secret. Callees should prefer this over
 * hand-rolling a subset of checks — mismatches between a caller's chosen
 * mechanism and a callee's accepted subset have repeatedly caused silent 401s.
 */
export async function isInternalSystemRequest(req: Request, admin: CronAuthClient): Promise<boolean> {
  if (isServiceRoleRequest(req)) return true;
  if (validateSystemSecret(req)) return true;
  return isAuthorizedCronRequest(req, admin);
}

/**
 * Standard headers for one edge function to call another as a trusted internal
 * caller. The Authorization bearer (publishable key) is only there to satisfy
 * the platform's verify_jwt gateway; X-System-Secret is what isInternalSystemRequest
 * actually trusts. Pass the publishable key from the caller (env import kept out
 * of this module to avoid a cycle).
 */
export function internalInvokeHeaders(publishableKey: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${publishableKey}`,
    'X-System-Secret': Deno.env.get('SYSTEM_INVOCATION_SECRET') ?? '',
    ...extra,
  };
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
