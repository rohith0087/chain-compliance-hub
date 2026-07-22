import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ALLOWED_ORIGINS = ['https://compliance.tracer2c.com', 'https://chain-compliance-hub.lovable.app'];
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  try {
    const host = new URL(origin).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') ||
      host.endsWith('.lovableproject.com') || host.endsWith('.lovable.app') || host.endsWith('.lovable.dev');
  } catch { return false; }
}
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

// Provider-agnostic single-shot completion using platform keys (no buyer scope).
async function aiComplete(system: string, user: string): Promise<string> {
  const openai = Deno.env.get('OPENAI_API_KEY');
  const anthropic = Deno.env.get('ANTHROPIC_API_KEY');
  if (openai) {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openai}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: 400, temperature: 0.3,
      }),
    });
    if (!r.ok) throw new Error(`openai ${r.status}: ${await r.text()}`);
    const d = await r.json();
    return d.choices?.[0]?.message?.content ?? '';
  }
  if (anthropic) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropic, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 400, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!r.ok) throw new Error(`anthropic ${r.status}: ${await r.text()}`);
    const d = await r.json();
    return (d.content ?? []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('');
  }
  throw new Error('No AI provider key configured (OPENAI_API_KEY / ANTHROPIC_API_KEY).');
}

Deno.serve(async (req) => {
  const headers = { ...cors(req), 'Content-Type': 'application/json' };
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) throw new Error('Invalid authentication');

    const { data: admin } = await supabase.from('platform_administrators')
      .select('id').eq('auth_user_id', user.id).eq('is_active', true).maybeSingle();
    if (!admin) return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 403, headers });

    const { supplier_id } = await req.json();
    if (!supplier_id) throw new Error('Missing supplier_id');

    const { data: supplier } = await supabase.from('suppliers')
      .select('company_name, industry, country').eq('id', supplier_id).maybeSingle();
    const { data: events } = await supabase.from('supplier_risk_events')
      .select('event_type, dimension, severity, status, remediation_status, evidence_status, entity_match_confidence, occurred_at, detected_at, risk_source_records(source_url, source_type, raw_payload)')
      .eq('supplier_id', supplier_id).order('detected_at', { ascending: false });

    if (!supplier) throw new Error('Supplier not found');

    const evs = events ?? [];
    if (evs.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        summary: `No external risk signals have been collected for ${supplier.company_name} yet. The supplier is monitored across sanctions, product-safety, regulatory, geopolitical, operational, financial, legal and cybersecurity dimensions; a clean record means nothing adverse has surfaced from the connected feeds to date.`,
      }), { headers });
    }

    const system =
      'You are a supply-chain risk analyst writing for a compliance platform administrator. ' +
      'Given a supplier and the external risk signals collected about it, write a concise 3–5 sentence ' +
      'plain-text summary of the supplier\'s risk posture. Reference the signal categories (dimensions) and ' +
      'their severity, note the most material signals, whether they are open or remediated, and call out if ' +
      'the evidence base is thin. When a signal has a named source (e.g. a news outlet or a government feed), ' +
      'attribute it (e.g. "per Packaging Dive" or "per an openFDA enforcement record"). Only reference sources ' +
      'present in the data. Be factual and specific; do not invent data; no markdown, no headers, no bullet points.';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const srcOf = (e: any) => {
      const r = Array.isArray(e.risk_source_records) ? e.risk_source_records[0] : e.risk_source_records;
      if (!r) return null;
      const p = r.raw_payload ?? {};
      return { type: r.source_type, title: p.title ?? p.Title ?? p.name ?? p.recall_number ?? p.recalling_firm ?? null, url: r.source_url };
    };

    const user = JSON.stringify({
      supplier: { name: supplier.company_name, industry: supplier.industry, country: supplier.country },
      signal_count: evs.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signals: evs.slice(0, 40).map((e: any) => ({
        type: e.event_type, dimension: e.dimension, severity: e.severity,
        status: e.status, remediation: e.remediation_status, evidence: e.evidence_status,
        entity_match: e.entity_match_confidence, occurred: e.occurred_at, detected: e.detected_at,
        source: srcOf(e),
      })),
    });

    const summary = await aiComplete(system, user);
    return new Response(JSON.stringify({ success: true, summary: summary.trim() }), { headers });
  } catch (error) {
    console.error('admin-supplier-risk-summary error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 400, headers },
    );
  }
});
