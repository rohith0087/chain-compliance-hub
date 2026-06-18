type NamedKeys = Record<string, string>;

function parseNamedKeys(raw: string | undefined, variableName: string): NamedKeys {
  if (!raw) return {};

  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('expected a JSON object');
    }
    return value as NamedKeys;
  } catch (error) {
    throw new Error(`${variableName} is invalid: ${error instanceof Error ? error.message : 'unknown error'}`);
  }
}

export function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getSupabaseSecretKey(name = 'default'): string {
  const modern = parseNamedKeys(Deno.env.get('SUPABASE_SECRET_KEYS'), 'SUPABASE_SECRET_KEYS')[name];
  return modern || requireEnv('SUPABASE_SERVICE_ROLE_KEY');
}

export function getSupabasePublishableKey(name = 'default'): string {
  const modern = parseNamedKeys(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'), 'SUPABASE_PUBLISHABLE_KEYS')[name];
  return modern || requireEnv('SUPABASE_ANON_KEY');
}
