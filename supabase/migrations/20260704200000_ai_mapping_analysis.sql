-- Phase 5A (plasma_clone/update.md + final_output.md §11.6, §13): AI evidence
-- analysis layered onto the deterministic matcher. The machine already decides
-- eligibility; the AI adds an explainable second opinion — a confidence, a
-- verdict, plain-language reasoning, and named concerns — to help the human
-- reviewer. AI never changes status; it only annotates the proposal.
alter table public.requirement_evidence_mappings
  add column if not exists ai_confidence numeric,
  add column if not exists ai_verdict text
    check (ai_verdict is null or ai_verdict in ('satisfies','partial','insufficient')),
  add column if not exists ai_reasoning text,
  add column if not exists ai_concerns jsonb not null default '[]'::jsonb,
  add column if not exists ai_model text,
  add column if not exists ai_analyzed_at timestamptz;
