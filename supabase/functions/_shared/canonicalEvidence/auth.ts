import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getSupabasePublishableKey, getSupabaseSecretKey, requireEnv } from '../env.ts';

export async function createCanonicalEvidenceClients(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new Error('Authentication required');

  const url = requireEnv('SUPABASE_URL');
  const admin = createClient(url, getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authHeader.slice('Bearer '.length);
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new Error('Invalid authentication');

  const client = createClient(url, getSupabasePublishableKey(), {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, client, user };
}

export function canonicalEvidenceErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (/authentication/i.test(message)) return 401;
  if (/access required|connection is required|not authorized/i.test(message)) return 403;
  if (/not found/i.test(message)) return 404;
  if (/required|invalid|unsupported|must be/i.test(message)) return 400;
  return 500;
}
