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
 * Constant-time string comparison to prevent timing attacks on credential checks.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Returns the platform's real full-privilege credentials that are legitimate
 * as a service-role bearer: the classic service_role JWT (SUPABASE_SERVICE_ROLE_KEY)
 * and any modern secret keys (SUPABASE_SECRET_KEYS, same credentials env.ts uses).
 */
function getTrustedServiceKeys(): string[] {
  const keys: string[] = [];
  const legacyKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (legacyKey) keys.push(legacyKey);

  const rawModern = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (rawModern) {
    try {
      const parsed = JSON.parse(rawModern) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const value of Object.values(parsed as Record<string, unknown>)) {
          if (typeof value === 'string' && value.trim()) keys.push(value.trim());
        }
      }
    } catch {
      console.warn('SUPABASE_SECRET_KEYS is not valid JSON - ignoring for service-role verification');
    }
  }
  return keys;
}

/**
 * Confirms the bearer token presented to a verify_jwt=false function is a
 * genuine service-role credential.
 *
 * SECURITY: this MUST NOT decode-and-trust the JWT payload — anyone can forge
 * an unsigned JWT with {"role":"service_role"}. Local HMAC verification is not
 * possible (no JWT secret env is available in hosted edge functions) and
 * auth.getUser() rejects the userless service_role key, so the robust check is
 * a constant-time comparison against the real platform credentials from env.
 * Every legitimate caller (pg_cron/pg_net jobs sending the platform-managed
 * app.supabase_service_role_key, and edge functions forwarding their
 * SUPABASE_SERVICE_ROLE_KEY env) presents exactly one of those keys; a forged
 * token cannot match. Fails closed when no service key is configured.
 */
export function isServiceRoleRequest(req: Request): boolean {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return false;

  const trustedKeys = getTrustedServiceKeys();
  if (trustedKeys.length === 0) {
    console.warn('No service-role key configured - denying service-role bearer auth');
    return false;
  }
  return trustedKeys.some((key) => constantTimeEqual(token, key));
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
