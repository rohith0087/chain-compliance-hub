-- Phase 5B (final_output.md §8.3, §11.3): AI reads a customer spec / standard
-- and drafts structured requirements. AI proposes; a human reviews each draft
-- (accept/dismiss). Drafts are staging only — promoting accepted drafts into a
-- live framework goes through the existing publish/review guardrail separately.
create table if not exists public.requirement_extraction_drafts (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  source_name text not null,
  requirement_statement text not null,
  suggested_document_type text,
  suggested_evidence_name text,
  responsible_party text,          -- 'supplier' | 'internal' | null
  rationale text,                  -- why the AI thinks this is a requirement
  source_quote text,               -- the clause text it was drawn from
  ai_confidence numeric,
  ai_model text,
  status text not null default 'proposed' check (status in ('proposed','accepted','dismissed')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz
);

create index if not exists requirement_extraction_drafts_buyer_idx
  on public.requirement_extraction_drafts (buyer_id, status, created_at desc);

alter table public.requirement_extraction_drafts enable row level security;

create policy requirement_extraction_drafts_buyer_all
  on public.requirement_extraction_drafts
  for all
  using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'))
  with check (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));
