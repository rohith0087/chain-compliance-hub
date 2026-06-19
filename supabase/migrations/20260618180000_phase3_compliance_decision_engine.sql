-- Phase 3 compliance decision and workflow engines. Additive only.

-- =============================================================================
-- Extend Phase 2's evidence_claims so coverage matching against a
-- requirement's required_evidence[].document_type is a plain comparison.
-- =============================================================================

alter table public.evidence_claims add column if not exists document_type text;

create or replace function public.record_evidence_claim_v1(
  p_job_id uuid,
  p_claim jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_buyer_id uuid;
  v_supplier_id uuid;
  v_document_upload_id uuid;
  v_document_type text;
  v_certificate_number text;
  v_issuer text;
  v_expiry_date date;
  v_standards text[];
  v_dup_id uuid;
  v_other record;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;

  select j.buyer_id, j.supplier_id, j.document_upload_id
  into v_buyer_id, v_supplier_id, v_document_upload_id
  from public.evidence_extraction_jobs j
  where j.id = p_job_id;

  if v_buyer_id is null then
    raise exception 'Extraction job not found';
  end if;

  select dr.document_type into v_document_type
  from public.document_uploads du
  join public.document_requests dr on dr.id = du.request_id
  where du.id = v_document_upload_id;

  v_certificate_number := btrim(p_claim->>'certificate_number');
  v_issuer := btrim(p_claim->>'issuer');
  v_expiry_date := nullif(p_claim->>'expiry_date', '')::date;
  v_standards := coalesce(
    (select array_agg(value) from jsonb_array_elements_text(coalesce(p_claim->'standards', '[]'::jsonb))),
    '{}'::text[]
  );

  if v_certificate_number is not null and v_certificate_number <> '' then
    select id into v_dup_id
    from public.evidence_claims
    where supplier_id = v_supplier_id
      and status not in ('rejected', 'superseded')
      and btrim(certificate_number) = v_certificate_number
      and btrim(issuer) is not distinct from v_issuer
    limit 1;
  end if;

  insert into public.evidence_claims (
    document_upload_id, extraction_job_id, buyer_id, supplier_id, document_type,
    issuer, certificate_number, issue_date, expiry_date, standards,
    covered_products, covered_facilities, source_page, source_text,
    confidence, extraction_model_version, is_duplicate_of
  ) values (
    v_document_upload_id, p_job_id, v_buyer_id, v_supplier_id, v_document_type,
    v_issuer, v_certificate_number,
    nullif(p_claim->>'issue_date', '')::date, v_expiry_date, v_standards,
    coalesce(p_claim->'covered_products', '[]'::jsonb),
    coalesce(p_claim->'covered_facilities', '[]'::jsonb),
    nullif(p_claim->>'source_page', '')::integer, p_claim->>'source_text',
    nullif(p_claim->>'confidence', '')::numeric, p_claim->>'extraction_model_version',
    v_dup_id
  )
  returning id into v_id;

  if v_certificate_number is not null and v_certificate_number <> '' then
    for v_other in
      select id, issuer, expiry_date, standards
      from public.evidence_claims
      where supplier_id = v_supplier_id
        and status = 'verified'
        and id <> v_id
        and btrim(certificate_number) = v_certificate_number
    loop
      if v_other.issuer is distinct from v_issuer then
        insert into public.evidence_conflicts (claim_id, conflicting_claim_id, conflict_type)
        values (v_id, v_other.id, 'issuer_mismatch')
        on conflict do nothing;
      end if;
      if v_other.expiry_date is distinct from v_expiry_date then
        insert into public.evidence_conflicts (claim_id, conflicting_claim_id, conflict_type)
        values (v_id, v_other.id, 'expiry_mismatch')
        on conflict do nothing;
      end if;
      if v_other.standards is distinct from v_standards then
        insert into public.evidence_conflicts (claim_id, conflicting_claim_id, conflict_type)
        values (v_id, v_other.id, 'standards_mismatch')
        on conflict do nothing;
      end if;
    end loop;
  end if;

  return v_id;
end;
$$;

-- =============================================================================
-- Decision engine: immutable evaluation header + per-requirement results.
-- =============================================================================

create table public.compliance_evaluations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  subject_type text not null check (subject_type in ('supplier', 'facility', 'product')),
  subject_id uuid not null,
  effective_at date not null,
  input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
  request_hash text not null,
  evaluator_version text not null,
  actor_id uuid not null references public.profiles(id),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  correlation_id text not null check (char_length(correlation_id) between 1 and 128),
  created_at timestamptz not null default now(),
  unique (buyer_id, actor_id, idempotency_key)
);

create index compliance_evaluations_subject_idx
  on public.compliance_evaluations(buyer_id, subject_type, subject_id, created_at desc);

create table public.compliance_decision_results (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.compliance_evaluations(id) on delete cascade,
  requirement_version_id uuid references public.requirement_versions(id),
  legacy_mapping_id uuid references public.legacy_requirement_mappings(id),
  framework_code text not null,
  framework_version text not null,
  requirement_key text not null,
  title text not null,
  applicability_outcome text not null check (applicability_outcome in ('applies', 'does_not_apply', 'indeterminate')),
  outcome text not null check (outcome in (
    'missing', 'requested', 'submitted', 'under_review', 'compliant',
    'conditional', 'noncompliant', 'expired', 'not_applicable'
  )),
  explanation text not null,
  evidence_claim_ids uuid[] not null default '{}'::uuid[],
  decision_version text not null,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (evaluation_id, framework_code, requirement_key, framework_version)
);

create index compliance_decision_results_evaluation_idx on public.compliance_decision_results(evaluation_id);
create index compliance_decision_results_lookup_idx
  on public.compliance_decision_results(requirement_key, framework_code, created_at desc);

alter table public.compliance_evaluations enable row level security;
alter table public.compliance_decision_results enable row level security;

create policy "Buyer members can read compliance evaluations"
on public.compliance_evaluations for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create policy "Buyer members can read compliance decision results"
on public.compliance_decision_results for select to authenticated
using (
  exists (
    select 1 from public.compliance_evaluations ce
    where ce.id = evaluation_id
      and private.has_organization_access(auth.uid(), ce.buyer_id, 'buyer')
  )
);

revoke all on table public.compliance_evaluations, public.compliance_decision_results from public, anon, authenticated;
grant select on table public.compliance_evaluations, public.compliance_decision_results to authenticated;
grant all on table public.compliance_evaluations, public.compliance_decision_results to service_role;

create or replace function private.protect_compliance_decision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Compliance evaluations and decision results are immutable';
end;
$$;

create trigger protect_compliance_evaluations
before update or delete on public.compliance_evaluations
for each row execute function private.protect_compliance_decision();

create trigger protect_compliance_decision_results
before update or delete on public.compliance_decision_results
for each row execute function private.protect_compliance_decision();

-- =============================================================================
-- Overrides and approvals: how a human affects "current" status without
-- mutating the immutable computed snapshot above.
-- =============================================================================

create table public.compliance_approvals (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  approval_type text not null check (approval_type in ('exception', 'conditional_decision')),
  requested_by uuid not null references public.profiles(id),
  requested_at timestamptz not null default now(),
  approver_id uuid references public.profiles(id),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  check (status = 'pending' or (approver_id is not null and decided_at is not null))
);

create table public.compliance_decision_overrides (
  id uuid primary key default gen_random_uuid(),
  decision_result_id uuid not null references public.compliance_decision_results(id) on delete cascade,
  override_outcome text not null check (override_outcome in ('conditional', 'compliant', 'noncompliant')),
  reason text not null,
  requested_by uuid not null references public.profiles(id),
  approval_id uuid not null references public.compliance_approvals(id),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create index compliance_decision_overrides_active_idx
  on public.compliance_decision_overrides(decision_result_id) where is_active;

create table public.compliance_exceptions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  subject_type text not null check (subject_type in ('supplier', 'facility', 'product')),
  subject_id uuid not null,
  requirement_version_id uuid references public.requirement_versions(id),
  decision_result_id uuid references public.compliance_decision_results(id),
  reason text not null,
  requested_by uuid not null references public.profiles(id),
  approval_id uuid not null references public.compliance_approvals(id),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.compliance_approvals
  add column exception_id uuid references public.compliance_exceptions(id),
  add column override_id uuid references public.compliance_decision_overrides(id);

alter table public.compliance_approvals
  add constraint compliance_approvals_reference_matches_type check (
    (approval_type = 'exception' and exception_id is not null and override_id is null)
    or (approval_type = 'conditional_decision' and override_id is not null and exception_id is null)
  );

alter table public.compliance_approvals enable row level security;
alter table public.compliance_decision_overrides enable row level security;
alter table public.compliance_exceptions enable row level security;

create policy "Buyer members can read compliance approvals"
on public.compliance_approvals for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create policy "Buyer members can read decision overrides"
on public.compliance_decision_overrides for select to authenticated
using (
  exists (
    select 1 from public.compliance_decision_results dr
    join public.compliance_evaluations ce on ce.id = dr.evaluation_id
    where dr.id = decision_result_id
      and private.has_organization_access(auth.uid(), ce.buyer_id, 'buyer')
  )
);

create policy "Buyer members can read compliance exceptions"
on public.compliance_exceptions for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

revoke all on table public.compliance_approvals, public.compliance_decision_overrides, public.compliance_exceptions from public, anon, authenticated;
grant select on table public.compliance_approvals, public.compliance_decision_overrides, public.compliance_exceptions to authenticated;
grant all on table public.compliance_approvals, public.compliance_decision_overrides, public.compliance_exceptions to service_role;

-- =============================================================================
-- Workflow tables: tasks, findings, corrective actions, escalations.
-- =============================================================================

create table public.compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  subject_type text not null check (subject_type in ('supplier', 'facility', 'product')),
  subject_id uuid not null,
  decision_result_id uuid references public.compliance_decision_results(id),
  task_type text not null check (task_type in ('review', 'corrective_action', 'escalation', 'approval', 'other')),
  title text not null,
  description text,
  assignee_id uuid references public.profiles(id),
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'done', 'cancelled')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  completed_by uuid references public.profiles(id),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'done' or (completed_by is not null and completed_at is not null))
);

create index compliance_tasks_buyer_idx on public.compliance_tasks(buyer_id, status);

create table public.compliance_findings (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid references public.suppliers(id),
  subject_type text not null check (subject_type in ('supplier', 'facility', 'product')),
  subject_id uuid not null,
  decision_result_id uuid references public.compliance_decision_results(id),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null,
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  raised_by uuid not null references public.profiles(id),
  raised_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  check (status <> 'resolved' or (resolved_by is not null and resolved_at is not null))
);

create index compliance_findings_buyer_idx on public.compliance_findings(buyer_id, status);

create table public.compliance_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null references public.compliance_findings(id) on delete cascade,
  task_id uuid references public.compliance_tasks(id),
  description text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'in_progress', 'completed', 'verified')),
  assigned_to uuid references public.profiles(id),
  completed_at timestamptz,
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  check (status <> 'verified' or (verified_by is not null and verified_at is not null))
);

create table public.compliance_escalations (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.compliance_tasks(id),
  finding_id uuid references public.compliance_findings(id),
  escalated_to uuid not null references public.profiles(id),
  escalated_by uuid not null references public.profiles(id),
  reason text not null,
  escalated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  check ((task_id is not null and finding_id is null) or (task_id is null and finding_id is not null))
);

alter table public.compliance_tasks enable row level security;
alter table public.compliance_findings enable row level security;
alter table public.compliance_corrective_actions enable row level security;
alter table public.compliance_escalations enable row level security;

create policy "Buyer and supplier members can read compliance tasks"
on public.compliance_tasks for select to authenticated
using (
  private.has_organization_access(auth.uid(), buyer_id, 'buyer')
  or (supplier_id is not null and private.has_organization_access(auth.uid(), supplier_id, 'supplier'))
);

create policy "Buyer and supplier members can read compliance findings"
on public.compliance_findings for select to authenticated
using (
  private.has_organization_access(auth.uid(), buyer_id, 'buyer')
  or (supplier_id is not null and private.has_organization_access(auth.uid(), supplier_id, 'supplier'))
);

create policy "Buyer and supplier members can read corrective actions"
on public.compliance_corrective_actions for select to authenticated
using (
  exists (
    select 1 from public.compliance_findings f
    where f.id = finding_id
      and (
        private.has_organization_access(auth.uid(), f.buyer_id, 'buyer')
        or (f.supplier_id is not null and private.has_organization_access(auth.uid(), f.supplier_id, 'supplier'))
      )
  )
);

create policy "Buyer and supplier members can read escalations"
on public.compliance_escalations for select to authenticated
using (
  exists (
    select 1 from public.compliance_tasks t
    where t.id = task_id
      and (
        private.has_organization_access(auth.uid(), t.buyer_id, 'buyer')
        or (t.supplier_id is not null and private.has_organization_access(auth.uid(), t.supplier_id, 'supplier'))
      )
  )
  or exists (
    select 1 from public.compliance_findings f
    where f.id = finding_id
      and (
        private.has_organization_access(auth.uid(), f.buyer_id, 'buyer')
        or (f.supplier_id is not null and private.has_organization_access(auth.uid(), f.supplier_id, 'supplier'))
      )
  )
);

revoke all on table
  public.compliance_tasks, public.compliance_findings,
  public.compliance_corrective_actions, public.compliance_escalations
from public, anon, authenticated;
grant select on table
  public.compliance_tasks, public.compliance_findings,
  public.compliance_corrective_actions, public.compliance_escalations
to authenticated;
grant all on table
  public.compliance_tasks, public.compliance_findings,
  public.compliance_corrective_actions, public.compliance_escalations
to service_role;

-- =============================================================================
-- Transactional outbox. Internal plumbing only - no buyer-facing read policy.
-- =============================================================================

create table public.compliance_domain_events (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  subject_type text check (subject_type in ('supplier', 'facility', 'product')),
  subject_id uuid,
  event_type text not null check (event_type in (
    'decision_recorded', 'decision_changed', 'task_created', 'task_completed',
    'finding_raised', 'finding_resolved', 'corrective_action_due',
    'exception_granted', 'approval_requested', 'approval_decided'
  )),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'published', 'failed', 'dead_letter')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index compliance_domain_events_claimable_idx
  on public.compliance_domain_events(status, created_at) where status = 'pending';

alter table public.compliance_domain_events enable row level security;
revoke all on table public.compliance_domain_events from public, anon, authenticated;
grant all on table public.compliance_domain_events to service_role;

-- =============================================================================
-- Convenience view: latest result per (buyer, subject, requirement), with any
-- active override applied. security_invoker so it respects the querying
-- user's RLS on the underlying tables rather than the view owner's.
-- =============================================================================

create view public.compliance_current_status with (security_invoker = true) as
with latest as (
  select dr.*, ce.buyer_id, ce.subject_type, ce.subject_id, ce.created_at as evaluated_at,
    row_number() over (
      partition by ce.buyer_id, ce.subject_type, ce.subject_id, dr.framework_code, dr.requirement_key
      order by ce.created_at desc
    ) as rn
  from public.compliance_decision_results dr
  join public.compliance_evaluations ce on ce.id = dr.evaluation_id
)
select
  l.id as decision_result_id, l.buyer_id, l.subject_type, l.subject_id,
  l.framework_code, l.framework_version, l.requirement_key, l.title,
  coalesce(ov.override_outcome, l.outcome) as outcome,
  (ov.id is not null) as is_overridden,
  l.applicability_outcome, l.explanation, l.evidence_claim_ids,
  l.decision_version, l.effective_from, l.effective_to, l.evaluated_at
from latest l
left join public.compliance_decision_overrides ov
  on ov.decision_result_id = l.id and ov.is_active
where l.rn = 1;

grant select on public.compliance_current_status to authenticated, service_role;

comment on table public.compliance_decision_results is
  'Immutable per-requirement compliance decision snapshots, pinned to a specific requirement version, evidence claim ids, and decision_version. The deterministic engine never writes conditional; see compliance_decision_overrides for human-approved corrections.';
comment on table public.compliance_domain_events is
  'Transactional outbox. Every state-changing compliance RPC inserts its event in the same call as the state change; process-compliance-events-v1 dispatches them on a pg_cron schedule.';

-- =============================================================================
-- RPCs
-- =============================================================================

create or replace function public.claim_compliance_events_v1(
  p_batch_size integer
)
returns setof public.compliance_domain_events
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;

  return query
  update public.compliance_domain_events
  set status = 'processing', processed_at = now()
  where id in (
    select id from public.compliance_domain_events
    where status = 'pending'
    order by created_at
    limit p_batch_size
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_compliance_events_v1(integer) from public, anon, authenticated;
grant execute on function public.claim_compliance_events_v1(integer) to service_role;

create or replace function public.record_compliance_decision_v1(
  p_evaluation jsonb,
  p_results jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_evaluation_id uuid;
  v_buyer_id uuid;
  v_subject_type text;
  v_subject_id uuid;
  item jsonb;
  v_result_id uuid;
  v_prev_outcome text;
  v_evidence_ids uuid[];
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;

  v_buyer_id := (p_evaluation->>'buyer_id')::uuid;
  v_subject_type := p_evaluation->>'subject_type';
  v_subject_id := (p_evaluation->>'subject_id')::uuid;

  insert into public.compliance_evaluations (
    buyer_id, subject_type, subject_id, effective_at, input_snapshot, request_hash,
    evaluator_version, actor_id, idempotency_key, correlation_id
  ) values (
    v_buyer_id, v_subject_type, v_subject_id,
    (p_evaluation->>'effective_at')::date, p_evaluation->'input_snapshot', p_evaluation->>'request_hash',
    p_evaluation->>'evaluator_version', (p_evaluation->>'actor_id')::uuid,
    p_evaluation->>'idempotency_key', p_evaluation->>'correlation_id'
  )
  returning id into v_evaluation_id;

  for item in select * from jsonb_array_elements(p_results)
  loop
    select array_agg(value::uuid) into v_evidence_ids
    from jsonb_array_elements_text(coalesce(item->'evidence_claim_ids', '[]'::jsonb));

    select dr.outcome into v_prev_outcome
    from public.compliance_decision_results dr
    join public.compliance_evaluations ce on ce.id = dr.evaluation_id
    where ce.buyer_id = v_buyer_id
      and ce.subject_type = v_subject_type
      and ce.subject_id = v_subject_id
      and dr.framework_code = item->>'framework_code'
      and dr.requirement_key = item->>'requirement_key'
      and dr.framework_version = item->>'framework_version'
      and ce.id <> v_evaluation_id
    order by ce.created_at desc
    limit 1;

    insert into public.compliance_decision_results (
      evaluation_id, requirement_version_id, legacy_mapping_id,
      framework_code, framework_version, requirement_key, title,
      applicability_outcome, outcome, explanation, evidence_claim_ids,
      decision_version, effective_from, effective_to
    ) values (
      v_evaluation_id,
      nullif(item->>'requirement_version_id', '')::uuid,
      nullif(item->>'legacy_mapping_id', '')::uuid,
      item->>'framework_code', item->>'framework_version', item->>'requirement_key', item->>'title',
      item->>'applicability_outcome', item->>'outcome', item->>'explanation',
      coalesce(v_evidence_ids, '{}'::uuid[]),
      item->>'decision_version',
      nullif(item->>'effective_from', '')::date, nullif(item->>'effective_to', '')::date
    )
    returning id into v_result_id;

    if v_prev_outcome is null then
      insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
      values (v_buyer_id, v_subject_type, v_subject_id, 'decision_recorded', jsonb_build_object(
        'decision_result_id', v_result_id, 'requirement_key', item->>'requirement_key', 'outcome', item->>'outcome'
      ));
    elsif v_prev_outcome <> item->>'outcome' then
      insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
      values (v_buyer_id, v_subject_type, v_subject_id, 'decision_changed', jsonb_build_object(
        'decision_result_id', v_result_id, 'requirement_key', item->>'requirement_key',
        'previous_outcome', v_prev_outcome, 'outcome', item->>'outcome'
      ));
    end if;
  end loop;

  return v_evaluation_id;
end;
$$;

revoke all on function public.record_compliance_decision_v1(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_compliance_decision_v1(jsonb, jsonb) to service_role;

create or replace function public.create_compliance_task_v1(
  p_buyer_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_task_type text,
  p_title text,
  p_description text,
  p_assignee_id uuid,
  p_due_date date,
  p_decision_result_id uuid,
  p_supplier_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
begin
  if not private.has_organization_access(v_actor_id, p_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if char_length(coalesce(p_title, '')) = 0 then
    raise exception 'A title is required';
  end if;

  insert into public.compliance_tasks (
    buyer_id, supplier_id, subject_type, subject_id, decision_result_id,
    task_type, title, description, assignee_id, due_date, created_by
  ) values (
    p_buyer_id, p_supplier_id, p_subject_type, p_subject_id, p_decision_result_id,
    p_task_type, p_title, p_description, p_assignee_id, p_due_date, v_actor_id
  )
  returning id into v_id;

  insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
  values (p_buyer_id, p_subject_type, p_subject_id, 'task_created', jsonb_build_object('task_id', v_id, 'assignee_id', p_assignee_id));

  return v_id;
end;
$$;

revoke all on function public.create_compliance_task_v1(uuid, text, uuid, text, text, text, uuid, date, uuid, uuid) from public, anon;
grant execute on function public.create_compliance_task_v1(uuid, text, uuid, text, text, text, uuid, date, uuid, uuid) to authenticated, service_role;

create or replace function public.complete_compliance_task_v1(
  p_task_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_subject_type text;
  v_subject_id uuid;
begin
  select buyer_id, subject_type, subject_id into v_buyer_id, v_subject_type, v_subject_id
  from public.compliance_tasks where id = p_task_id;
  if v_buyer_id is null then
    raise exception 'Task not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  update public.compliance_tasks
  set status = 'done', completed_by = v_actor_id, completed_at = now(), updated_at = now()
  where id = p_task_id;

  insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
  values (v_buyer_id, v_subject_type, v_subject_id, 'task_completed', jsonb_build_object('task_id', p_task_id));
end;
$$;

revoke all on function public.complete_compliance_task_v1(uuid) from public, anon;
grant execute on function public.complete_compliance_task_v1(uuid) to authenticated, service_role;

create or replace function public.raise_compliance_finding_v1(
  p_buyer_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_severity text,
  p_description text,
  p_decision_result_id uuid,
  p_supplier_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
begin
  if not private.has_organization_access(v_actor_id, p_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if char_length(coalesce(p_description, '')) = 0 then
    raise exception 'A description is required';
  end if;

  insert into public.compliance_findings (
    buyer_id, supplier_id, subject_type, subject_id, decision_result_id,
    severity, description, raised_by
  ) values (
    p_buyer_id, p_supplier_id, p_subject_type, p_subject_id, p_decision_result_id,
    p_severity, p_description, v_actor_id
  )
  returning id into v_id;

  insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
  values (p_buyer_id, p_subject_type, p_subject_id, 'finding_raised', jsonb_build_object('finding_id', v_id, 'severity', p_severity));

  return v_id;
end;
$$;

revoke all on function public.raise_compliance_finding_v1(uuid, text, uuid, text, text, uuid, uuid) from public, anon;
grant execute on function public.raise_compliance_finding_v1(uuid, text, uuid, text, text, uuid, uuid) to authenticated, service_role;

create or replace function public.resolve_compliance_finding_v1(
  p_finding_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_subject_type text;
  v_subject_id uuid;
begin
  select buyer_id, subject_type, subject_id into v_buyer_id, v_subject_type, v_subject_id
  from public.compliance_findings where id = p_finding_id;
  if v_buyer_id is null then
    raise exception 'Finding not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  update public.compliance_findings
  set status = 'resolved', resolved_by = v_actor_id, resolved_at = now()
  where id = p_finding_id;

  insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
  values (v_buyer_id, v_subject_type, v_subject_id, 'finding_resolved', jsonb_build_object('finding_id', p_finding_id));
end;
$$;

revoke all on function public.resolve_compliance_finding_v1(uuid) from public, anon;
grant execute on function public.resolve_compliance_finding_v1(uuid) to authenticated, service_role;

create or replace function public.create_corrective_action_v1(
  p_finding_id uuid,
  p_description text,
  p_due_date date,
  p_assigned_to uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_subject_type text;
  v_subject_id uuid;
  v_id uuid;
begin
  select buyer_id, subject_type, subject_id into v_buyer_id, v_subject_type, v_subject_id
  from public.compliance_findings where id = p_finding_id;
  if v_buyer_id is null then
    raise exception 'Finding not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if char_length(coalesce(p_description, '')) = 0 then
    raise exception 'A description is required';
  end if;

  insert into public.compliance_corrective_actions (finding_id, description, due_date, assigned_to)
  values (p_finding_id, p_description, p_due_date, p_assigned_to)
  returning id into v_id;

  if p_due_date is not null then
    insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
    values (v_buyer_id, v_subject_type, v_subject_id, 'corrective_action_due', jsonb_build_object(
      'corrective_action_id', v_id, 'due_date', p_due_date, 'assigned_to', p_assigned_to
    ));
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_corrective_action_v1(uuid, text, date, uuid) from public, anon;
grant execute on function public.create_corrective_action_v1(uuid, text, date, uuid) to authenticated, service_role;

create or replace function public.complete_corrective_action_v1(
  p_corrective_action_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
begin
  select f.buyer_id into v_buyer_id
  from public.compliance_corrective_actions ca
  join public.compliance_findings f on f.id = ca.finding_id
  where ca.id = p_corrective_action_id;
  if v_buyer_id is null then
    raise exception 'Corrective action not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  update public.compliance_corrective_actions
  set status = 'completed', completed_at = now()
  where id = p_corrective_action_id;
end;
$$;

revoke all on function public.complete_corrective_action_v1(uuid) from public, anon;
grant execute on function public.complete_corrective_action_v1(uuid) to authenticated, service_role;

create or replace function public.verify_corrective_action_v1(
  p_corrective_action_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_status text;
begin
  select f.buyer_id, ca.status into v_buyer_id, v_status
  from public.compliance_corrective_actions ca
  join public.compliance_findings f on f.id = ca.finding_id
  where ca.id = p_corrective_action_id;
  if v_buyer_id is null then
    raise exception 'Corrective action not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if v_status <> 'completed' then
    raise exception 'Corrective action must be completed before it can be verified';
  end if;

  update public.compliance_corrective_actions
  set status = 'verified', verified_by = v_actor_id, verified_at = now()
  where id = p_corrective_action_id;
end;
$$;

revoke all on function public.verify_corrective_action_v1(uuid) from public, anon;
grant execute on function public.verify_corrective_action_v1(uuid) to authenticated, service_role;

create or replace function public.request_compliance_exception_v1(
  p_buyer_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_requirement_version_id uuid,
  p_decision_result_id uuid,
  p_reason text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_approval_id uuid;
  v_exception_id uuid;
begin
  if not private.has_organization_access(v_actor_id, p_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if char_length(coalesce(p_reason, '')) = 0 then
    raise exception 'A reason is required';
  end if;

  insert into public.compliance_approvals (buyer_id, approval_type, requested_by)
  values (p_buyer_id, 'exception', v_actor_id)
  returning id into v_approval_id;

  insert into public.compliance_exceptions (
    buyer_id, subject_type, subject_id, requirement_version_id, decision_result_id,
    reason, requested_by, approval_id, expires_at
  ) values (
    p_buyer_id, p_subject_type, p_subject_id, p_requirement_version_id, p_decision_result_id,
    p_reason, v_actor_id, v_approval_id, p_expires_at
  )
  returning id into v_exception_id;

  update public.compliance_approvals set exception_id = v_exception_id where id = v_approval_id;

  insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
  values (p_buyer_id, p_subject_type, p_subject_id, 'approval_requested', jsonb_build_object(
    'approval_id', v_approval_id, 'approval_type', 'exception', 'exception_id', v_exception_id
  ));

  return v_exception_id;
end;
$$;

revoke all on function public.request_compliance_exception_v1(uuid, text, uuid, uuid, uuid, text, timestamptz) from public, anon;
grant execute on function public.request_compliance_exception_v1(uuid, text, uuid, uuid, uuid, text, timestamptz) to authenticated, service_role;

create or replace function public.request_compliance_decision_override_v1(
  p_decision_result_id uuid,
  p_override_outcome text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_subject_type text;
  v_subject_id uuid;
  v_approval_id uuid;
  v_override_id uuid;
begin
  select ce.buyer_id, ce.subject_type, ce.subject_id into v_buyer_id, v_subject_type, v_subject_id
  from public.compliance_decision_results dr
  join public.compliance_evaluations ce on ce.id = dr.evaluation_id
  where dr.id = p_decision_result_id;
  if v_buyer_id is null then
    raise exception 'Decision result not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if char_length(coalesce(p_reason, '')) = 0 then
    raise exception 'A reason is required';
  end if;

  insert into public.compliance_approvals (buyer_id, approval_type, requested_by)
  values (v_buyer_id, 'conditional_decision', v_actor_id)
  returning id into v_approval_id;

  insert into public.compliance_decision_overrides (decision_result_id, override_outcome, reason, requested_by, approval_id)
  values (p_decision_result_id, p_override_outcome, p_reason, v_actor_id, v_approval_id)
  returning id into v_override_id;

  update public.compliance_approvals set override_id = v_override_id where id = v_approval_id;

  insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
  values (v_buyer_id, v_subject_type, v_subject_id, 'approval_requested', jsonb_build_object(
    'approval_id', v_approval_id, 'approval_type', 'conditional_decision', 'override_id', v_override_id
  ));

  return v_override_id;
end;
$$;

revoke all on function public.request_compliance_decision_override_v1(uuid, text, text) from public, anon;
grant execute on function public.request_compliance_decision_override_v1(uuid, text, text) to authenticated, service_role;

create or replace function public.decide_compliance_approval_v1(
  p_approval_id uuid,
  p_decision text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_exception_id uuid;
  v_override_id uuid;
  v_subject_type text;
  v_subject_id uuid;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected';
  end if;

  select buyer_id, exception_id, override_id
  into v_buyer_id, v_exception_id, v_override_id
  from public.compliance_approvals where id = p_approval_id;

  if v_buyer_id is null then
    raise exception 'Approval not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  if v_exception_id is not null then
    select subject_type, subject_id into v_subject_type, v_subject_id
    from public.compliance_exceptions where id = v_exception_id;
  elsif v_override_id is not null then
    select ce.subject_type, ce.subject_id into v_subject_type, v_subject_id
    from public.compliance_decision_overrides ov
    join public.compliance_decision_results dr on dr.id = ov.decision_result_id
    join public.compliance_evaluations ce on ce.id = dr.evaluation_id
    where ov.id = v_override_id;
  end if;

  update public.compliance_approvals
  set status = p_decision, approver_id = v_actor_id, decided_at = now(), notes = p_notes
  where id = p_approval_id and status = 'pending';

  if not found then
    raise exception 'Approval is not pending';
  end if;

  if p_decision = 'approved' then
    if v_exception_id is not null then
      update public.compliance_exceptions set status = 'active' where id = v_exception_id;
      insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
      values (v_buyer_id, v_subject_type, v_subject_id, 'exception_granted', jsonb_build_object('exception_id', v_exception_id));
    elsif v_override_id is not null then
      update public.compliance_decision_overrides set is_active = true where id = v_override_id;
    end if;
  end if;

  insert into public.compliance_domain_events (buyer_id, subject_type, subject_id, event_type, payload)
  values (v_buyer_id, v_subject_type, v_subject_id, 'approval_decided', jsonb_build_object(
    'approval_id', p_approval_id, 'decision', p_decision
  ));
end;
$$;

revoke all on function public.decide_compliance_approval_v1(uuid, text, text) from public, anon;
grant execute on function public.decide_compliance_approval_v1(uuid, text, text) to authenticated, service_role;

create or replace function public.create_compliance_escalation_v1(
  p_task_id uuid,
  p_finding_id uuid,
  p_escalated_to uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_id uuid;
begin
  if (p_task_id is null) = (p_finding_id is null) then
    raise exception 'Exactly one of task or finding must be set';
  end if;
  if char_length(coalesce(p_reason, '')) = 0 then
    raise exception 'A reason is required';
  end if;

  if p_task_id is not null then
    select buyer_id into v_buyer_id from public.compliance_tasks where id = p_task_id;
  else
    select buyer_id into v_buyer_id from public.compliance_findings where id = p_finding_id;
  end if;
  if v_buyer_id is null then
    raise exception 'Task or finding not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  insert into public.compliance_escalations (task_id, finding_id, escalated_to, escalated_by, reason)
  values (p_task_id, p_finding_id, p_escalated_to, v_actor_id, p_reason)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_compliance_escalation_v1(uuid, uuid, uuid, text) from public, anon;
grant execute on function public.create_compliance_escalation_v1(uuid, uuid, uuid, text) to authenticated, service_role;

create or replace function public.resolve_compliance_escalation_v1(
  p_escalation_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_task_id uuid;
  v_finding_id uuid;
begin
  select task_id, finding_id into v_task_id, v_finding_id from public.compliance_escalations where id = p_escalation_id;
  if v_task_id is null and v_finding_id is null then
    raise exception 'Escalation not found';
  end if;

  if v_task_id is not null then
    select buyer_id into v_buyer_id from public.compliance_tasks where id = v_task_id;
  else
    select buyer_id into v_buyer_id from public.compliance_findings where id = v_finding_id;
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  update public.compliance_escalations
  set resolved_at = now(), resolved_by = v_actor_id
  where id = p_escalation_id;
end;
$$;

revoke all on function public.resolve_compliance_escalation_v1(uuid) from public, anon;
grant execute on function public.resolve_compliance_escalation_v1(uuid) to authenticated, service_role;

-- =============================================================================
-- Cron: dispatch outbox events every 5 minutes. No-op until any buyer has
-- compliance_decisions_v1 enabled and decisions/tasks/findings actually exist.
-- =============================================================================

select cron.schedule(
  'process-compliance-events',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-compliance-events-v1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
