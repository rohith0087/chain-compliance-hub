-- Phase 2 structured evidence engine. Additive only; existing document_uploads
-- and ai_knowledge_entries extraction paths are untouched (dual-write, not replace).

create table public.evidence_extraction_jobs (
  id uuid primary key default gen_random_uuid(),
  document_upload_id uuid not null references public.document_uploads(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  extraction_model_version text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed', 'dead_letter', 'skipped')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  idempotency_key text not null unique,
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index evidence_extraction_jobs_claimable_idx
  on public.evidence_extraction_jobs(status, scheduled_at)
  where status = 'pending';

create table public.evidence_claims (
  id uuid primary key default gen_random_uuid(),
  document_upload_id uuid not null references public.document_uploads(id) on delete cascade,
  extraction_job_id uuid references public.evidence_extraction_jobs(id) on delete set null,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  status text not null default 'extracted'
    check (status in ('extracted', 'verified', 'rejected', 'superseded')),
  issuer text,
  certificate_number text,
  issue_date date,
  expiry_date date,
  standards text[] not null default '{}'::text[],
  covered_products jsonb not null default '[]'::jsonb check (jsonb_typeof(covered_products) = 'array'),
  covered_facilities jsonb not null default '[]'::jsonb check (jsonb_typeof(covered_facilities) = 'array'),
  source_page integer,
  source_text text,
  confidence numeric(4,3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  extraction_model_version text not null,
  is_duplicate_of uuid references public.evidence_claims(id),
  verified_by uuid references public.profiles(id),
  verified_at timestamptz,
  rejected_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date),
  check (status <> 'verified' or (verified_by is not null and verified_at is not null)),
  check (status <> 'rejected' or rejected_reason is not null)
);

create index evidence_claims_document_upload_idx on public.evidence_claims(document_upload_id);
create index evidence_claims_buyer_idx on public.evidence_claims(buyer_id, status);
create index evidence_claims_supplier_cert_idx
  on public.evidence_claims(supplier_id, certificate_number)
  where certificate_number is not null;

create table public.evidence_claim_corrections (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.evidence_claims(id) on delete cascade,
  field_name text not null,
  old_value text,
  new_value text,
  corrected_by uuid not null references public.profiles(id),
  reason text,
  created_at timestamptz not null default now()
);

create index evidence_claim_corrections_claim_idx on public.evidence_claim_corrections(claim_id, created_at desc);

create table public.evidence_conflicts (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.evidence_claims(id) on delete cascade,
  conflicting_claim_id uuid not null references public.evidence_claims(id) on delete cascade,
  conflict_type text not null
    check (conflict_type in ('issuer_mismatch', 'expiry_mismatch', 'standards_mismatch', 'other')),
  resolved boolean not null default false,
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now(),
  unique (claim_id, conflicting_claim_id, conflict_type),
  check (claim_id <> conflicting_claim_id),
  check (not resolved or (resolved_by is not null and resolved_at is not null))
);

create index evidence_conflicts_claim_idx on public.evidence_conflicts(claim_id) where not resolved;

alter table public.evidence_extraction_jobs enable row level security;
alter table public.evidence_claims enable row level security;
alter table public.evidence_claim_corrections enable row level security;
alter table public.evidence_conflicts enable row level security;

create policy "Buyer and supplier members can read extraction jobs"
on public.evidence_extraction_jobs for select to authenticated
using (
  private.has_organization_access(auth.uid(), buyer_id, 'buyer')
  or private.has_organization_access(auth.uid(), supplier_id, 'supplier')
);

create policy "Buyer and supplier members can read evidence claims"
on public.evidence_claims for select to authenticated
using (
  private.has_organization_access(auth.uid(), buyer_id, 'buyer')
  or private.has_organization_access(auth.uid(), supplier_id, 'supplier')
);

create policy "Buyer and supplier members can read correction history"
on public.evidence_claim_corrections for select to authenticated
using (
  exists (
    select 1 from public.evidence_claims ec
    where ec.id = claim_id
      and (
        private.has_organization_access(auth.uid(), ec.buyer_id, 'buyer')
        or private.has_organization_access(auth.uid(), ec.supplier_id, 'supplier')
      )
  )
);

create policy "Buyer and supplier members can read conflicts"
on public.evidence_conflicts for select to authenticated
using (
  exists (
    select 1 from public.evidence_claims ec
    where ec.id = claim_id
      and (
        private.has_organization_access(auth.uid(), ec.buyer_id, 'buyer')
        or private.has_organization_access(auth.uid(), ec.supplier_id, 'supplier')
      )
  )
);

revoke all on table
  public.evidence_extraction_jobs,
  public.evidence_claims,
  public.evidence_claim_corrections,
  public.evidence_conflicts
from public, anon, authenticated;

grant select on table
  public.evidence_extraction_jobs,
  public.evidence_claims,
  public.evidence_claim_corrections,
  public.evidence_conflicts
to authenticated;

grant all on table
  public.evidence_extraction_jobs,
  public.evidence_claims,
  public.evidence_claim_corrections,
  public.evidence_conflicts
to service_role;

-- Corrections are an append-only audit trail.
create or replace function private.protect_evidence_claim_corrections()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Evidence claim corrections are immutable';
end;
$$;

create trigger protect_evidence_claim_corrections
before update or delete on public.evidence_claim_corrections
for each row execute function private.protect_evidence_claim_corrections();

-- Enqueue a pending extraction job whenever a new document version is uploaded.
-- Cheap and always runs; the processor checks the buyer's feature flag and
-- marks the job 'skipped' if the buyer hasn't opted in, so enabling the
-- feature for a buyer costs nothing until that buyer actually has it on.
create or replace function private.enqueue_evidence_extraction_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_supplier_id uuid;
  v_model_version text := 'evidence-extract-v1';
begin
  if new.request_id is null then
    return new;
  end if;

  select dr.buyer_id, dr.supplier_id into v_buyer_id, v_supplier_id
  from public.document_requests dr
  where dr.id = new.request_id;

  if v_buyer_id is null or v_supplier_id is null then
    return new;
  end if;

  insert into public.evidence_extraction_jobs (
    document_upload_id, buyer_id, supplier_id, extraction_model_version, idempotency_key
  ) values (
    new.id, v_buyer_id, v_supplier_id, v_model_version,
    new.id::text || ':' || v_model_version
  )
  on conflict (idempotency_key) do nothing;

  return new;
end;
$$;

create trigger enqueue_evidence_extraction_job
after insert on public.document_uploads
for each row execute function private.enqueue_evidence_extraction_job();

-- Atomically claims a batch of pending jobs. PostgREST can't express
-- FOR UPDATE SKIP LOCKED directly, so the extraction processor claims through
-- this function rather than a plain table update.
create or replace function public.claim_evidence_extraction_jobs_v1(
  p_batch_size integer
)
returns setof public.evidence_extraction_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;

  return query
  update public.evidence_extraction_jobs
  set status = 'processing', started_at = now(), updated_at = now()
  where id in (
    select id from public.evidence_extraction_jobs
    where status = 'pending' and scheduled_at <= now()
    order by scheduled_at
    limit p_batch_size
    for update skip locked
  )
  returning *;
end;
$$;

revoke all on function public.claim_evidence_extraction_jobs_v1(integer) from public, anon, authenticated;
grant execute on function public.claim_evidence_extraction_jobs_v1(integer) to service_role;

-- Inserts an extracted claim and runs duplicate/conflict detection. Service-role
-- only: called from the extraction processor after a validated model response.
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

  select buyer_id, supplier_id, document_upload_id
  into v_buyer_id, v_supplier_id, v_document_upload_id
  from public.evidence_extraction_jobs
  where id = p_job_id;

  if v_buyer_id is null then
    raise exception 'Extraction job not found';
  end if;

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
    document_upload_id, extraction_job_id, buyer_id, supplier_id,
    issuer, certificate_number, issue_date, expiry_date, standards,
    covered_products, covered_facilities, source_page, source_text,
    confidence, extraction_model_version, is_duplicate_of
  ) values (
    v_document_upload_id, p_job_id, v_buyer_id, v_supplier_id,
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

revoke all on function public.record_evidence_claim_v1(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_evidence_claim_v1(uuid, jsonb) to service_role;

create or replace function public.verify_evidence_claim_v1(
  p_claim_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_actor_id uuid := auth.uid();
begin
  select buyer_id into v_buyer_id from public.evidence_claims where id = p_claim_id;
  if v_buyer_id is null then
    raise exception 'Evidence claim not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if exists (
    select 1 from public.evidence_conflicts
    where claim_id = p_claim_id and not resolved
  ) then
    raise exception 'Cannot verify a claim with unresolved conflicts';
  end if;

  update public.evidence_claims
  set status = 'verified', verified_by = v_actor_id, verified_at = now(), updated_at = now()
  where id = p_claim_id;
end;
$$;

revoke all on function public.verify_evidence_claim_v1(uuid) from public, anon;
grant execute on function public.verify_evidence_claim_v1(uuid) to authenticated, service_role;

create or replace function public.reject_evidence_claim_v1(
  p_claim_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_actor_id uuid := auth.uid();
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A rejection reason is required';
  end if;

  select buyer_id into v_buyer_id from public.evidence_claims where id = p_claim_id;
  if v_buyer_id is null then
    raise exception 'Evidence claim not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  update public.evidence_claims
  set status = 'rejected', rejected_reason = p_reason, updated_at = now()
  where id = p_claim_id;
end;
$$;

revoke all on function public.reject_evidence_claim_v1(uuid, text) from public, anon;
grant execute on function public.reject_evidence_claim_v1(uuid, text) to authenticated, service_role;

create or replace function public.correct_evidence_claim_v1(
  p_claim_id uuid,
  p_field_name text,
  p_new_value text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_actor_id uuid := auth.uid();
  v_old_value text;
begin
  if p_field_name not in (
    'issuer', 'certificate_number', 'issue_date', 'expiry_date', 'source_page'
  ) then
    raise exception 'Field % cannot be corrected through this function', p_field_name;
  end if;

  select buyer_id into v_buyer_id from public.evidence_claims where id = p_claim_id;
  if v_buyer_id is null then
    raise exception 'Evidence claim not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  execute format('select %I::text from public.evidence_claims where id = $1', p_field_name)
    into v_old_value using p_claim_id;

  insert into public.evidence_claim_corrections (claim_id, field_name, old_value, new_value, corrected_by, reason)
  values (p_claim_id, p_field_name, v_old_value, p_new_value, v_actor_id, p_reason);

  execute format(
    'update public.evidence_claims set %I = $1, status = ''extracted'', verified_by = null, verified_at = null, updated_at = now() where id = $2',
    p_field_name
  ) using p_new_value, p_claim_id;
end;
$$;

revoke all on function public.correct_evidence_claim_v1(uuid, text, text, text) from public, anon;
grant execute on function public.correct_evidence_claim_v1(uuid, text, text, text) to authenticated, service_role;

create or replace function public.resolve_evidence_conflict_v1(
  p_conflict_id uuid,
  p_resolution_notes text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_buyer_id uuid;
  v_actor_id uuid := auth.uid();
begin
  select ec.buyer_id into v_buyer_id
  from public.evidence_conflicts conf
  join public.evidence_claims ec on ec.id = conf.claim_id
  where conf.id = p_conflict_id;

  if v_buyer_id is null then
    raise exception 'Evidence conflict not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  update public.evidence_conflicts
  set resolved = true, resolved_by = v_actor_id, resolved_at = now(), resolution_notes = p_resolution_notes
  where id = p_conflict_id;
end;
$$;

revoke all on function public.resolve_evidence_conflict_v1(uuid, text) from public, anon;
grant execute on function public.resolve_evidence_conflict_v1(uuid, text) to authenticated, service_role;

comment on table public.evidence_claims is
  'Structured evidence extracted from document_uploads. Never authoritative until status = verified by a human reviewer; corrections always reset status back to extracted.';
comment on table public.evidence_extraction_jobs is
  'Async, idempotent extraction job queue processed by process-evidence-extraction-jobs-v1 on a pg_cron schedule.';

-- Every 5 minutes; a no-op when there are no pending jobs (i.e. for every buyer
-- without structured_evidence_v1 enabled). Uses the service-role key from the
-- platform-managed setting rather than a key checked into this file.
select cron.schedule(
  'process-evidence-extraction-jobs',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-evidence-extraction-jobs-v1',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
