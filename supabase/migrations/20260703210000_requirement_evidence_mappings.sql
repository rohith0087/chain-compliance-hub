-- Phase 3 (plasma_clone/update.md): per-mapping human decisions.
-- One row = one (requirement, evidence version) pairing for a subject.
-- The compliance evaluator proposes rows for machine-eligible matches; only a
-- human decision moves them to approved/rejected. Rejected mappings exclude
-- that evidence for that requirement; with require_mapping_approval on, a
-- requirement cannot be compliant without an approved mapping.

create table if not exists public.requirement_evidence_mappings (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  subject_type text not null default 'supplier'
    check (subject_type in ('supplier','facility','product')),
  subject_id uuid not null,
  framework_code text not null,
  framework_version text not null,
  requirement_key text not null,
  requirement_title text,
  evidence_version_id uuid not null references public.evidence_versions(id) on delete cascade,
  -- denormalized for scalable list reads in the review queue
  evidence_display_name text,
  evidence_document_type text,
  status text not null default 'proposed' check (status in ('proposed','approved','rejected')),
  match_score numeric,
  match_reasons jsonb not null default '[]'::jsonb,
  proposed_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  decision_notes text,
  unique (buyer_id, subject_type, subject_id, framework_code, requirement_key, evidence_version_id)
);

create index if not exists requirement_evidence_mappings_queue_idx
  on public.requirement_evidence_mappings (buyer_id, status, proposed_at desc);

alter table public.requirement_evidence_mappings enable row level security;

-- Buyers read their own mappings; writes go through the evaluator (service
-- role) and the decision RPC (security definer) so status transitions and
-- reviewer attribution cannot be forged client-side.
create policy requirement_evidence_mappings_buyer_read
  on public.requirement_evidence_mappings
  for select
  using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

-- Strict mode: compliant requires an approved mapping.
alter table public.evidence_review_policies
  add column if not exists require_mapping_approval boolean not null default false;

-- Human decision RPC: records the reviewer and queues a recompute so the
-- chain resolver updates compliance_current_status without manual re-runs.
create or replace function public.decide_requirement_evidence_mapping_v1(
  p_mapping_id uuid,
  p_decision text,
  p_notes text default null
) returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_mapping public.requirement_evidence_mappings%rowtype;
begin
  if p_decision not in ('approved','rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select * into v_mapping from public.requirement_evidence_mappings where id = p_mapping_id;
  if v_mapping.id is null then
    raise exception 'Mapping not found';
  end if;
  if not private.has_organization_access(v_actor, v_mapping.buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  update public.requirement_evidence_mappings
    set status = p_decision,
        decided_by = v_actor,
        decided_at = now(),
        decision_notes = p_notes
    where id = p_mapping_id;

  insert into public.compliance_reevaluation_queue
    (buyer_id, subject_type, subject_id, evidence_version_id, reason, status, scheduled_at)
  values
    (v_mapping.buyer_id, v_mapping.subject_type, v_mapping.subject_id,
     v_mapping.evidence_version_id, 'mapping_' || p_decision, 'pending', now());

  return jsonb_build_object(
    'mapping_id', p_mapping_id,
    'status', p_decision,
    'decided_by', v_actor,
    'decided_at', now()
  );
end;
$function$;

grant execute on function public.decide_requirement_evidence_mapping_v1(uuid, text, text) to authenticated;

-- Pilot buyer runs in strict mode (blueprint §13.2: AI/machine proposes,
-- humans approve compliance).
insert into public.evidence_review_policies (buyer_id, require_mapping_approval)
values ('d52b3a3c-96ce-4529-b3a6-61ab8aa100fd', true)
on conflict (buyer_id) do update set require_mapping_approval = true;
