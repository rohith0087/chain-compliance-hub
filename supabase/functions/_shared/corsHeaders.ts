// Centralized CORS configuration - restrict to known domains
const ALLOWED_ORIGINS = [
  'https://compliance.tracer2c.com',
  'https://chain-compliance-hub.lovable.app',
  'https://id-preview--d13fec6e-29ed-4735-a9d4-57941fe886cc.lovable.app',
];

// Allow Lovable preview/sandbox origins (lovableproject.com, lovable.app, lovable.dev)
// so the in-editor preview can call edge functions without CORS rejection.
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('192.168.') ||
      host.endsWith('.lovableproject.com') ||
      host.endsWith('.lovable.app') ||
      host.endsWith('.lovable.dev')
    );
  } catch {
    return false;
  }
}

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers.get('Origin') || '';
  const allowedOrigin = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-correlation-id, x-idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
  };
}

export function handleCorsPreflightRequest(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: getCorsHeaders(req) });
  }
  return null;
}
