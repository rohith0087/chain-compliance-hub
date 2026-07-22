/**
 * Thin Composio REST client.
 *
 * We deliberately do NOT use @composio/core in edge functions:
 *   - it is ESM but depends on a CommonJS @composio/client;
 *   - it pulls in openai, pusher-js (websockets) and zod tooling, which is a
 *     lot of weight for a short-lived Deno isolate;
 *   - the whole edge codebase already talks to LLM/provider APIs over raw
 *     fetch (see _shared/ai/complete.ts, which says exactly this).
 *
 * The REST surface is small and stable: base + `x-api-key`. Verified live —
 * /tools, /toolkits, /connected_accounts and /auth_configs all respond, with
 * structured errors carrying a request_id.
 */

export const COMPOSIO_BASE = 'https://backend.composio.dev/api/v3.1';

export class ComposioError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly slug?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ComposioError';
  }
}

export function composioApiKey(): string | null {
  return Deno.env.get('COMPOSIO_API_KEY') ?? null;
}

/**
 * Single entry point for Composio HTTP. Never logs the key, and surfaces
 * Composio's request_id so a failure can be traced with their support.
 */
export async function composioFetch<T = unknown>(
  path: string,
  init: RequestInit & { query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const key = composioApiKey();
  if (!key) throw new ComposioError('COMPOSIO_API_KEY is not configured', 500);

  const url = new URL(`${COMPOSIO_BASE}${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    ...init,
    headers: {
      'x-api-key': key,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }

  if (!res.ok) {
    const err = (body as { error?: { message?: string; slug?: string; request_id?: string } })?.error;
    throw new ComposioError(
      err?.message ?? `Composio ${res.status}: ${text.slice(0, 200)}`,
      res.status,
      err?.slug,
      err?.request_id,
    );
  }
  return body as T;
}

/* ------------------------------------------------------------------ reads */

export interface Toolkit {
  slug: string;
  name: string;
  meta?: Record<string, unknown>;
}

export async function listToolkits(limit = 20): Promise<Toolkit[]> {
  const r = await composioFetch<{ items?: Toolkit[] }>('/toolkits', { query: { limit } });
  return r.items ?? [];
}

export interface ToolSummary {
  slug: string;
  name?: string;
  description?: string;
  toolkit?: { slug?: string };
  input_parameters?: Record<string, unknown>;
}

export async function listTools(
  opts: { toolkitSlug?: string; limit?: number } = {},
): Promise<ToolSummary[]> {
  const r = await composioFetch<{ items?: ToolSummary[] }>('/tools', {
    query: { toolkit_slug: opts.toolkitSlug, limit: opts.limit ?? 20 },
  });
  return r.items ?? [];
}
