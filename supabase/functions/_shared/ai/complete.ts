import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

// Bring-your-own-AI provider abstraction. One entry point, three providers.
// OpenAI and xAI share the OpenAI chat-completions shape; Anthropic uses the
// Messages API (system is a top-level field, max_tokens is required, and
// temperature is rejected on current models). The whole edge codebase uses raw
// fetch, so this does too.

export type AiProvider = 'openai' | 'anthropic' | 'xai';

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey: string;
  ownKey: boolean;
}

export interface AiCompleteInput {
  system: string;
  user: string;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
}

type SupabaseAdmin = ReturnType<typeof createClient>;

const DEFAULTS: Record<AiProvider, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5',
  xai: 'grok-3',
};

function platformKey(provider: AiProvider): string | null {
  if (provider === 'openai') return Deno.env.get('OPENAI_API_KEY') ?? null;
  if (provider === 'anthropic') return Deno.env.get('ANTHROPIC_API_KEY') ?? null;
  if (provider === 'xai') return Deno.env.get('XAI_API_KEY') ?? null;
  return null;
}

/**
 * Resolves the AI config for a buyer: their chosen provider/model, and the key
 * to use — their own (from Vault) or our platform key. Falls back to OpenAI on
 * our key when nothing is configured. Returns null if no usable key exists.
 */
export async function resolveAiConfig(admin: SupabaseAdmin, buyerId: string): Promise<AiConfig | null> {
  const { data: settings } = await admin.from('organization_ai_settings')
    .select('provider, model, use_own_key, has_own_key').eq('buyer_id', buyerId).maybeSingle();

  const provider = (settings?.provider ?? 'openai') as AiProvider;
  const model = settings?.model || DEFAULTS[provider];

  if (settings?.use_own_key && settings?.has_own_key) {
    const { data: key } = await admin.rpc('get_org_ai_key_v1', { p_buyer_id: buyerId });
    if (typeof key === 'string' && key.length > 0) {
      return { provider, model, apiKey: key, ownKey: true };
    }
  }

  const key = platformKey(provider);
  if (key) return { provider, model, apiKey: key, ownKey: false };
  return null;
}

/** Provider-agnostic single-shot completion. Returns the assistant text. */
export async function aiComplete(config: AiConfig, input: AiCompleteInput): Promise<string> {
  const maxTokens = input.maxTokens ?? 800;
  if (config.provider === 'anthropic') {
    // Messages API: system top-level, max_tokens required, no temperature on
    // current models. JSON is steered via the prompt (no response_format).
    const system = input.jsonMode
      ? `${input.system}\n\nRespond with ONLY valid JSON, no prose, no markdown fences.`
      : input.system;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: input.user }],
      }),
    });
    if (!response.ok) throw new Error(`Anthropic ${response.status}: ${await response.text()}`);
    const data = await response.json();
    const text = (data.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text).join('');
    return jsonModeClean(text, input.jsonMode);
  }

  // OpenAI + xAI (OpenAI-compatible)
  const baseUrl = config.provider === 'xai' ? 'https://api.x.ai/v1' : 'https://api.openai.com/v1';
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: 'system', content: input.system },
      { role: 'user', content: input.user },
    ],
    max_tokens: maxTokens,
    temperature: input.temperature ?? 0.2,
  };
  if (input.jsonMode) body.response_format = { type: 'json_object' };
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${config.provider} ${response.status}: ${await response.text()}`);
  const data = await response.json();
  return jsonModeClean(data.choices?.[0]?.message?.content ?? '', input.jsonMode);
}

// Some providers/models wrap JSON in ```json fences even when asked not to;
// strip them so callers can JSON.parse reliably.
function jsonModeClean(text: string, jsonMode?: boolean): string {
  if (!jsonMode) return text;
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return (fenced ? fenced[1] : trimmed).trim();
}
