/**
 * Pure logic for the buyer AI summary: change-detection, prompt construction,
 * and the number guard. Deliberately free of Deno/Supabase imports so it can be
 * exercised directly in a test harness -- the fingerprint is the entire cost
 * control for this feature, so it needs to be provable rather than assumed.
 */

export interface SummaryFacts {
  awaitingReview: number;
  overdue: number;
  expiring0_30: number;
  expiring31_60: number;
  expiring61_90: number;
  complianceScore: number;
  priorScore: number | null;
  approvedTotal: number;
  requestTotal: number;
  approvedThisMonth: number;
  connectedSuppliers: number;
  pendingConnections: number;
  onboardingCount: number;
  topRisk: { name: string; score: number }[];
  /** Names only -- used for prose, never for arithmetic. */
  oldestOverdue: string | null;
}

export interface Bullet {
  text: string;
  tone: 'neutral' | 'warn' | 'danger';
}

export interface FollowUp {
  label: string;
  prompt: string;
}

/**
 * Stable JSON: keys sorted at every level, so two structurally equal fact sets
 * always serialize identically regardless of property insertion order.
 * `JSON.stringify` alone does not guarantee that.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** SHA-256 of the stable serialization. Web Crypto exists in Deno and Node 18+. */
export async function fingerprint(facts: SummaryFacts): Promise<string> {
  const bytes = new TextEncoder().encode(stableStringify(facts));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Numbers that may legitimately appear in prose without coming from the facts:
 * the expiry window boundaries we ourselves define, and 0/1 which show up in
 * ordinary phrasing ("1 supplier", "no. 1 priority").
 */
const ALLOWED_LITERALS = new Set([0, 1, 30, 60, 90]);

/** Every numeric value the model is permitted to state. */
export function allowedNumbers(facts: SummaryFacts): Set<number> {
  const nums = new Set<number>(ALLOWED_LITERALS);
  for (const [key, value] of Object.entries(facts)) {
    if (typeof value === 'number') nums.add(value);
    if (key === 'priorScore' && typeof value === 'number') {
      // The delta is derived, so it is a legitimate figure too.
      nums.add(Math.abs(facts.complianceScore - value));
    }
  }
  for (const r of facts.topRisk) nums.add(r.score);
  return nums;
}

/**
 * Drops any bullet citing a number that isn't in the fact set. The prompt asks
 * the model not to invent figures; this is what makes that a guarantee rather
 * than a request. Percent signs and separators are normalized first so "1,200"
 * and "47%" compare as 1200 and 47.
 */
export function enforceNumbers(bullets: Bullet[], facts: SummaryFacts): Bullet[] {
  const allowed = allowedNumbers(facts);
  return bullets.filter((b) => {
    const matches = String(b.text ?? '').match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
    return matches.every((raw) => {
      const n = Number(raw.replace(/,/g, ''));
      return Number.isFinite(n) && allowed.has(Math.round(n));
    });
  });
}

/** True when the buyer has nothing worth spending a completion on. */
export function isDormant(facts: SummaryFacts): boolean {
  return (
    facts.requestTotal === 0 &&
    facts.connectedSuppliers === 0 &&
    facts.pendingConnections === 0 &&
    facts.onboardingCount === 0
  );
}

export const SYSTEM_PROMPT = `You write the daily compliance briefing for a buyer in a supply-chain compliance product.

RULES — these are absolute:
- Use ONLY the numbers provided in the facts object. Never calculate new figures, never estimate, never round differently, never invent a number. A bullet containing an unlisted number will be discarded.
- Refer to suppliers only by the names given.
- Be descriptive, not advisory. Report what is true; do not give legal or regulatory advice.
- Each bullet is one short sentence, under 110 characters, written in plain language.
- Order bullets by what needs attention first. Lead with anything overdue or expiring.
- Do not greet, do not summarize your own output, do not use markdown.

Return STRICT JSON, no code fences:
{
  "bullets": [{ "text": string, "tone": "neutral" | "warn" | "danger" }],
  "followUps": [{ "label": string, "prompt": string }]
}

Provide 5 to 7 bullets, and exactly 3 followUps.
"tone": "danger" for overdue/expired, "warn" for approaching deadlines or rising risk, otherwise "neutral".
Each followUp "label" is a short question (under 48 chars) the user might click.
Each followUp "prompt" is the fuller question to send to an AI assistant that has access to this buyer's compliance data.`;

export function buildUserPrompt(facts: SummaryFacts): string {
  return `Facts for this buyer (the only numbers you may use):\n${JSON.stringify(facts, null, 2)}`;
}

/** Parses the model's JSON, tolerating stray code fences. */
export function parseAiOutput(raw: string): { bullets: Bullet[]; followUps: FollowUp[] } {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned) as { bullets?: unknown; followUps?: unknown };

  const bullets = Array.isArray(parsed.bullets)
    ? (parsed.bullets as Bullet[])
        .filter((b) => b && typeof b.text === 'string' && b.text.trim().length > 0)
        .map((b) => ({
          text: b.text.trim(),
          tone: b.tone === 'danger' || b.tone === 'warn' ? b.tone : ('neutral' as const),
        }))
    : [];

  const followUps = Array.isArray(parsed.followUps)
    ? (parsed.followUps as FollowUp[])
        .filter((f) => f && typeof f.label === 'string' && typeof f.prompt === 'string')
        .map((f) => ({ label: f.label.trim(), prompt: f.prompt.trim() }))
    : [];

  return { bullets, followUps };
}
