// Real AI assistance for the "Create Document Request" flow. One function,
// three tasks — all steered to return strict JSON and validated here before we
// hand anything back to the UI:
//
//   recommend_documents -> which of the buyer's available documents to request
//                          for a given entity type (+ a one-line rationale)
//   suggest_config      -> a sensible priority and due-date window
//   draft_message       -> a short supplier-facing instruction message
//
// Provider/model/key come from the buyer's own AI settings via the shared
// resolveAiConfig helper (their key or our platform key). The client always has
// a static fallback, so a missing key or model error degrades gracefully rather
// than blocking request creation.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';
import { getCorsHeaders, handleCorsPreflightRequest } from '../_shared/corsHeaders.ts';
import { resolveAiConfig, aiComplete } from '../_shared/ai/complete.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

type Task = 'recommend_documents' | 'suggest_config' | 'draft_message';

interface AvailableDoc { id: string; title: string; category?: string | null }

interface RequestBody {
  buyerId?: string;
  task?: Task;
  context?: {
    entityType?: string;
    availableDocuments?: AvailableDoc[];
    selectedDocuments?: string[]; // titles
    supplierCount?: number;
    priority?: string;
    dueDate?: string | null;
  };
}

const clampInt = (n: unknown, lo: number, hi: number, dflt: number): number => {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(v)));
};

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

function safeParse(text: string): Record<string, unknown> {
  try { return JSON.parse(text); } catch { return {}; }
}

Deno.serve(async (req: Request) => {
  const preflight = handleCorsPreflightRequest(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { buyerId, task, context = {} } = body;

    if (!buyerId) return json({ error: 'buyerId is required' }, 400);
    if (!task) return json({ error: 'task is required' }, 400);

    // Auth: the caller must be a member of the buyer they name.
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: buyerIds } = await userClient.rpc('get_user_buyer_ids');
    if (!((buyerIds ?? []) as string[]).includes(buyerId)) return json({ error: 'Forbidden' }, 403);

    const config = await resolveAiConfig(admin, buyerId);
    if (!config) return json({ error: 'no_ai_key', message: 'No AI provider key configured.' }, 424);

    const entityType = (context.entityType || 'General Supplier').toString().slice(0, 80);

    // -- recommend_documents ------------------------------------------------
    if (task === 'recommend_documents') {
      const available = (context.availableDocuments ?? []).slice(0, 60);
      if (available.length === 0) return json({ recommendations: [], summary: '' });

      const catalog = available.map((d) => `${d.id} :: ${d.title}${d.category ? ` (${d.category})` : ''}`).join('\n');
      const raw = await aiComplete(config, {
        jsonMode: true,
        maxTokens: 500,
        system:
          'You help compliance buyers decide which documents to request from a supplier. ' +
          'Choose ONLY from the provided catalog. Return the most commonly-required documents ' +
          'for the given entity type — typically 3 to 6 items, never more than 8. ' +
          'Respond as JSON: {"recommendedIds": string[], "summary": string}. ' +
          'The summary is one short sentence naming the picks in plain language.',
        user:
          `Entity type: ${entityType}\n\nDocument catalog (id :: title):\n${catalog}\n\n` +
          'Return only ids that appear in the catalog.',
      });
      const parsed = safeParse(raw);
      const validIds = new Set(available.map((d) => d.id));
      const recommendedIds = Array.isArray(parsed.recommendedIds)
        ? (parsed.recommendedIds as unknown[]).map(String).filter((id) => validIds.has(id)).slice(0, 8)
        : [];
      const summary = typeof parsed.summary === 'string' ? parsed.summary.slice(0, 400) : '';
      const byId = new Map(available.map((d) => [d.id, d]));
      return json({
        recommendations: recommendedIds.map((id) => ({ id, title: byId.get(id)?.title ?? '' })),
        summary,
      });
    }

    // -- suggest_config -----------------------------------------------------
    if (task === 'suggest_config') {
      const docs = (context.selectedDocuments ?? []).slice(0, 40);
      const raw = await aiComplete(config, {
        jsonMode: true,
        maxTokens: 300,
        system:
          'You advise on how urgently a supplier document request should be handled. ' +
          'Return JSON: {"priority": "low"|"medium"|"high"|"urgent", "dueInDays": number, "rationale": string}. ' +
          'dueInDays is a whole number between 3 and 90. Keep rationale to one short sentence.',
        user:
          `Entity type: ${entityType}\nSupplier count: ${context.supplierCount ?? 1}\n` +
          `Requested documents: ${docs.length ? docs.join(', ') : '(none selected yet)'}`,
      });
      const parsed = safeParse(raw);
      const priority = PRIORITIES.includes(String(parsed.priority)) ? String(parsed.priority) : 'medium';
      const dueInDays = clampInt(parsed.dueInDays, 3, 90, 14);
      const rationale = typeof parsed.rationale === 'string' ? parsed.rationale.slice(0, 300) : '';
      return json({ priority, dueInDays, rationale });
    }

    // -- draft_message ------------------------------------------------------
    if (task === 'draft_message') {
      const docs = (context.selectedDocuments ?? []).slice(0, 40);
      const raw = await aiComplete(config, {
        jsonMode: true,
        maxTokens: 400,
        temperature: 0.4,
        system:
          'You draft a short, professional message a compliance buyer sends to a supplier ' +
          'along with a document request. 2-4 sentences, courteous, specific about what to upload ' +
          '(valid certificates, clear scopes, visible expiration dates). No greeting placeholders like ' +
          '"[Supplier Name]", no signature. Return JSON: {"message": string}.',
        user:
          `Entity type: ${entityType}\nPriority: ${context.priority ?? 'medium'}\n` +
          `Due date: ${context.dueDate || 'none'}\n` +
          `Requested documents: ${docs.length ? docs.join(', ') : 'compliance documents'}`,
      });
      const parsed = safeParse(raw);
      const message = typeof parsed.message === 'string' ? parsed.message.trim().slice(0, 1200) : '';
      return json({ message });
    }

    return json({ error: `Unknown task: ${task}` }, 400);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('request-ai-assist error:', message);
    return json({ error: 'ai_failed', message }, 502);
  }
});
