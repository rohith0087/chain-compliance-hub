-- Canonical Evidence and Intelligent Request Reuse
-- Additive migration: legacy uploads, requests, evidence claims, and grants remain
-- available while canonical_evidence_v1 is rolled out organization by organization.

-- ---------------------------------------------------------------------------
-- 1. Document type registry and buyer review policy
-- ---------------------------------------------------------------------------

create table public.document_type_definitions (
  code text primary key,
  name text not null,
  category text not null,
  aliases text[] not null default '{}'::text[],
  required_fields text[] not null default '{}'::text[],
  validation_rules jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_rules) = 'array'),
  active_schema_version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.document_type_definitions
  (code, name, category, aliases, required_fields, validation_rules)
values
  ('sds', 'Safety Data Sheet (SDS)', 'health_safety', array['sds','safety data sheet','material safety data sheet','msds'],
   array['product_name','supplier_name','revision_date','hazard_classification'],
   '[{"rule":"required_fields"},{"rule":"sds_sections"},{"rule":"effective_date"}]'),
  ('iso_certificate', 'ISO Certificate', 'quality', array['iso certificate','iso 9001 certification','iso 14001 certification'],
   array['issuer','certificate_number','standards','issue_date','expiry_date'],
   '[{"rule":"required_fields"},{"rule":"date_order"},{"rule":"not_expired"}]'),
  ('insurance_certificate', 'Insurance Certificate', 'insurance', array['insurance certificate','certificate of insurance','coi'],
   array['issuer','policy_number','issue_date','expiry_date','coverage'],
   '[{"rule":"required_fields"},{"rule":"date_order"},{"rule":"not_expired"}]'),
  ('coa', 'Certificate of Analysis (COA)', 'quality', array['coa','certificate of analysis','analysis certificate'],
   array['issuer','lot_number','product_name','issue_date','test_results'],
   '[{"rule":"required_fields"},{"rule":"lot_scope"}]'),
  ('business_license', 'Business License', 'legal', array['business license','business licence'],
   array['issuer','license_number','issue_date','expiry_date','legal_entity'],
   '[{"rule":"required_fields"},{"rule":"date_order"},{"rule":"not_expired"}]'),
  ('test_report', 'Test Report', 'quality', array['test report','laboratory test report','lab report'],
   array['issuer','report_number','issue_date','tested_product','standards'],
   '[{"rule":"required_fields"},{"rule":"product_scope"}]'),
  ('generic_evidence', 'Other Evidence', 'other', array['other','generic','pdf','document'],
   array[]::text[], '[{"rule":"manual_review"}]')
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  aliases = excluded.aliases,
  required_fields = excluded.required_fields,
  validation_rules = excluded.validation_rules,
  updated_at = now();

create table public.evidence_review_policies (
  buyer_id uuid primary key references public.buyers(id) on delete cascade,
  require_four_eyes boolean not null default false,
  default_minimum_validity_days integer not null default 90 check (default_minimum_validity_days >= 0),
  document_type_overrides jsonb not null default '{}'::jsonb check (jsonb_typeof(document_type_overrides) = 'object'),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Canonical reviews use the existing compliance task queue. These references
-- make an evidence approval task authoritative instead of encoding its target
-- only in free text.
alter table public.compliance_tasks
  add column if not exists request_id uuid references public.document_requests(id) on delete set null,
  add column if not exists evidence_version_id uuid,
  add column if not exists legacy_document_assignment_id uuid unique references public.document_assignments(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Immutable assets, canonical records, and versioned structured evidence
-- ---------------------------------------------------------------------------

create table public.document_assets (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  storage_bucket text not null default 'compliance-documents',
  storage_path text not null,
  original_file_name text not null,
  content_sha256 text,
  mime_type text,
  file_size bigint,
  malware_scan_status text not null default 'pending'
    check (malware_scan_status in ('pending','clean','infected','failed','not_available')),
  uploaded_by uuid references public.profiles(id),
  legacy_document_upload_id uuid unique references public.document_uploads(id) on delete set null,
  legacy_supplier_library_id uuid unique references public.supplier_document_library(id) on delete set null,
  created_at timestamptz not null default now(),
  check (content_sha256 is null or content_sha256 ~ '^[0-9a-f]{64}$')
);

create unique index document_assets_supplier_hash_unique
  on public.document_assets(supplier_id, content_sha256)
  where content_sha256 is not null;
create index document_assets_supplier_idx on public.document_assets(supplier_id, created_at desc);

create table public.document_asset_sources (
  id uuid primary key default gen_random_uuid(),
  document_asset_id uuid not null references public.document_assets(id) on delete cascade,
  source_type text not null check (source_type in ('document_upload','supplier_library')),
  source_id uuid not null,
  storage_path text not null,
  linked_by uuid references public.profiles(id),
  linked_at timestamptz not null default now(),
  unique (source_type, source_id)
);
create index document_asset_sources_asset_idx on public.document_asset_sources(document_asset_id);

create table public.evidence_records (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  canonical_document_type text not null references public.document_type_definitions(code),
  display_name text not null,
  logical_identity_key text,
  status text not null default 'active' check (status in ('active','superseded','archived')),
  legacy_document_upload_id uuid unique references public.document_uploads(id) on delete set null,
  legacy_supplier_library_id uuid unique references public.supplier_document_library(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index evidence_records_supplier_identity_unique
  on public.evidence_records(supplier_id, logical_identity_key)
  where logical_identity_key is not null and status = 'active';

create table public.evidence_versions (
  id uuid primary key default gen_random_uuid(),
  evidence_record_id uuid not null references public.evidence_records(id) on delete cascade,
  document_asset_id uuid not null references public.document_assets(id),
  version_number integer not null check (version_number > 0),
  schema_version integer not null default 1 check (schema_version > 0),
  lifecycle_status text not null default 'current'
    check (lifecycle_status in ('processing','current','superseded','rejected','archived')),
  issue_date date,
  expiry_date date,
  jurisdiction text,
  standards text[] not null default '{}'::text[],
  covered_product_ids uuid[] not null default '{}'::uuid[],
  covered_facility_ids uuid[] not null default '{}'::uuid[],
  extraction_model_version text,
  validation_completeness numeric(5,4) check (validation_completeness is null or validation_completeness between 0 and 1),
  legacy_evidence_claim_id uuid unique references public.evidence_claims(id) on delete set null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (expiry_date is null or issue_date is null or expiry_date >= issue_date),
  unique (evidence_record_id, version_number)
);

alter table public.compliance_tasks
  add constraint compliance_tasks_evidence_version_id_fkey
  foreign key (evidence_version_id) references public.evidence_versions(id) on delete set null;
create index compliance_tasks_evidence_review_idx
  on public.compliance_tasks(buyer_id,status,evidence_version_id)
  where evidence_version_id is not null;

create unique index evidence_versions_one_current
  on public.evidence_versions(evidence_record_id)
  where lifecycle_status = 'current';
create index evidence_versions_asset_idx on public.evidence_versions(document_asset_id);

create table public.evidence_field_observations (
  id uuid primary key default gen_random_uuid(),
  evidence_version_id uuid not null references public.evidence_versions(id) on delete cascade,
  field_name text not null,
  raw_value jsonb,
  normalized_value jsonb,
  source_page integer check (source_page is null or source_page > 0),
  source_quote text,
  source_bbox jsonb check (source_bbox is null or jsonb_typeof(source_bbox) = 'object'),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  extraction_model_version text,
  observation_type text not null default 'extracted'
    check (observation_type in ('extracted','corrected','declared')),
  supersedes_observation_id uuid references public.evidence_field_observations(id),
  observed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index evidence_field_observations_version_idx
  on public.evidence_field_observations(evidence_version_id, field_name, created_at desc);

create table public.evidence_validation_runs (
  id uuid primary key default gen_random_uuid(),
  evidence_version_id uuid not null references public.evidence_versions(id) on delete cascade,
  validator_version text not null,
  status text not null check (status in ('passed','failed','needs_review')),
  completeness numeric(5,4) not null default 0 check (completeness between 0 and 1),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.evidence_validation_results (
  id uuid primary key default gen_random_uuid(),
  validation_run_id uuid not null references public.evidence_validation_runs(id) on delete cascade,
  rule_code text not null,
  outcome text not null check (outcome in ('passed','failed','needs_review','not_applicable')),
  severity text not null default 'error' check (severity in ('info','warning','error','critical')),
  field_name text,
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.evidence_attestations (
  id uuid primary key default gen_random_uuid(),
  evidence_version_id uuid not null references public.evidence_versions(id) on delete cascade,
  organization_id uuid not null references public.organizations(id),
  organization_type text not null check (organization_type in ('buyer','supplier')),
  attestation_type text not null
    check (attestation_type in ('supplier_verification','buyer_verification','buyer_acceptance','system_validation','rejection')),
  outcome text not null check (outcome in ('accepted','rejected','needs_review')),
  purpose text not null default 'compliance_decision',
  actor_id uuid references public.profiles(id),
  notes text,
  policy_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index evidence_attestations_version_idx
  on public.evidence_attestations(evidence_version_id, organization_id, attestation_type, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Request fulfillment, requirement links, and immutable resolution history
-- ---------------------------------------------------------------------------

alter table public.document_requests
  add column if not exists fulfillment_status text not null default 'open'
    check (fulfillment_status in (
      'open','match_available','awaiting_supplier_consent','existing_evidence_submitted',
      'new_version_required','clarification_requested','fulfilled_existing',
      'fulfilled_new_upload','superseded','cancelled_duplicate'
    )),
  add column if not exists request_reason_code text,
  add column if not exists request_reason_notes text,
  add column if not exists minimum_remaining_validity_days integer not null default 90
    check (minimum_remaining_validity_days >= 0),
  add column if not exists supersedes_request_id uuid references public.document_requests(id),
  add column if not exists evidence_subject_type text check (evidence_subject_type is null or evidence_subject_type in ('supplier','facility','product')),
  add column if not exists evidence_subject_id uuid,
  add column if not exists evidence_jurisdiction text,
  add column if not exists required_standards_snapshot text[] not null default '{}'::text[],
  add column if not exists reuse_preference text
    check (reuse_preference is null or reuse_preference in ('use_existing','ask_supplier','request_new','cancel_duplicate','create'));

alter table public.compliance_domain_events drop constraint if exists compliance_domain_events_event_type_check;
alter table public.compliance_domain_events add constraint compliance_domain_events_event_type_check check (event_type in (
  'decision_recorded','decision_changed','task_created','task_completed','finding_raised','finding_resolved',
  'corrective_action_due','exception_granted','approval_requested','approval_decided',
  'document_request_created','evidence_changed','evidence_access_changed','reevaluation_requested'
));

alter table public.document_uploads
  add column if not exists canonical_document_asset_id uuid references public.document_assets(id),
  add column if not exists canonical_evidence_version_id uuid references public.evidence_versions(id);

alter table public.supplier_document_library
  add column if not exists canonical_document_asset_id uuid references public.document_assets(id),
  add column if not exists canonical_evidence_record_id uuid references public.evidence_records(id),
  add column if not exists canonical_evidence_version_id uuid references public.evidence_versions(id);

alter table public.evidence_claims
  add column if not exists canonical_evidence_version_id uuid references public.evidence_versions(id);

create table public.request_evidence_links (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.document_requests(id) on delete cascade,
  evidence_version_id uuid not null references public.evidence_versions(id),
  relation text not null check (relation in ('candidate','offered','submitted','accepted','rejected','withdrawn')),
  qualification text not null default 'potential' check (qualification in ('eligible','potential','ineligible')),
  qualification_reasons text[] not null default '{}'::text[],
  sharing_grant_id uuid references public.evidence_sharing_grants(id),
  selected_by uuid references public.profiles(id),
  selected_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index request_evidence_one_active_acceptance
  on public.request_evidence_links(request_id)
  where relation = 'accepted';
create index request_evidence_links_version_idx on public.request_evidence_links(evidence_version_id);

create table public.requirement_evidence_links (
  id uuid primary key default gen_random_uuid(),
  requirement_version_id uuid references public.requirement_versions(id),
  legacy_mapping_id uuid references public.legacy_requirement_mappings(id),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  subject_type text not null check (subject_type in ('supplier','facility','product')),
  subject_id uuid not null,
  evidence_version_id uuid not null references public.evidence_versions(id),
  decision_result_id uuid references public.compliance_decision_results(id),
  match_outcome text not null check (match_outcome in ('eligible','potential','ineligible')),
  match_score numeric(5,4) not null default 0 check (match_score between 0 and 1),
  match_reasons text[] not null default '{}'::text[],
  scope_result jsonb not null default '{}'::jsonb,
  validation_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.evidence_resolution_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.document_requests(id) on delete cascade,
  buyer_id uuid references public.buyers(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete cascade,
  evidence_version_id uuid references public.evidence_versions(id),
  event_type text not null,
  actor_id uuid references public.profiles(id),
  correlation_id text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index evidence_resolution_events_request_idx
  on public.evidence_resolution_events(request_id, occurred_at desc);

create table public.canonical_migration_exceptions (
  id uuid primary key default gen_random_uuid(),
  source_table text not null,
  source_id uuid not null,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_table, source_id)
);

create table public.canonical_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  result jsonb,
  created_at timestamptz not null default now(),
  unique (actor_id,operation,idempotency_key)
);

create table public.compliance_reevaluation_queue (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  subject_type text not null check (subject_type in ('supplier','facility','product')),
  subject_id uuid not null,
  evidence_version_id uuid references public.evidence_versions(id),
  reason text not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','dead_letter')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  last_error text,
  scheduled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index compliance_reevaluation_one_pending
  on public.compliance_reevaluation_queue(buyer_id,subject_type,subject_id,evidence_version_id,reason)
  where status='pending';

create table public.canonical_asset_hash_jobs (
  id uuid primary key default gen_random_uuid(),
  document_asset_id uuid not null unique references public.document_assets(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed','dead_letter')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  scheduled_at timestamptz not null default now(),
  last_error text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4. Visibility helpers and RLS
-- ---------------------------------------------------------------------------

alter table public.evidence_sharing_grants
  add column if not exists evidence_version_id uuid references public.evidence_versions(id),
  add column if not exists scope_snapshot jsonb not null default '{}'::jsonb;

create or replace function private.normalize_document_type_code(p_value text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select d.code
      from public.document_type_definitions d
      where d.is_active
        and (
          lower(trim(p_value)) = d.code
          or lower(trim(p_value)) = lower(d.name)
          or lower(trim(p_value)) = any(d.aliases)
        )
      order by case when lower(trim(p_value)) = d.code then 0 else 1 end
      limit 1
    ),
    'generic_evidence'
  );
$$;

create or replace function private.can_read_evidence_version(p_user_id uuid, p_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.evidence_versions ev
    join public.evidence_records er on er.id = ev.evidence_record_id
    where ev.id = p_version_id
      and (
        private.has_organization_access(p_user_id, er.supplier_id, 'supplier')
        or exists (
          select 1
          from public.request_evidence_links rel
          join public.document_requests dr on dr.id = rel.request_id
          where rel.evidence_version_id = ev.id
            and rel.relation in ('submitted','accepted')
            and private.has_organization_access(p_user_id, dr.buyer_id, 'buyer')
        )
        or exists (
          select 1
          from public.evidence_sharing_grants g
          where g.evidence_version_id = ev.id
            and g.status = 'active'
            and (g.expires_at is null or g.expires_at > now())
            and private.has_organization_access(p_user_id, g.granted_to_organization_id, 'buyer')
        )
      )
  );
$$;

alter table public.document_type_definitions enable row level security;
alter table public.evidence_review_policies enable row level security;
alter table public.document_assets enable row level security;
alter table public.document_asset_sources enable row level security;
alter table public.evidence_records enable row level security;
alter table public.evidence_versions enable row level security;
alter table public.evidence_field_observations enable row level security;
alter table public.evidence_validation_runs enable row level security;
alter table public.evidence_validation_results enable row level security;
alter table public.evidence_attestations enable row level security;
alter table public.request_evidence_links enable row level security;
alter table public.requirement_evidence_links enable row level security;
alter table public.evidence_resolution_events enable row level security;
alter table public.canonical_migration_exceptions enable row level security;
alter table public.compliance_reevaluation_queue enable row level security;
alter table public.canonical_idempotency_keys enable row level security;
alter table public.canonical_asset_hash_jobs enable row level security;

create policy "Authenticated users can read document type definitions"
on public.document_type_definitions for select to authenticated using (true);

create policy "Buyer members can read evidence review policy"
on public.evidence_review_policies for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create policy "Supplier members can read canonical assets"
on public.document_assets for select to authenticated
using (
  private.has_organization_access(auth.uid(), supplier_id, 'supplier')
  or exists (
    select 1 from public.evidence_versions ev
    where ev.document_asset_id = id
      and private.can_read_evidence_version(auth.uid(), ev.id)
  )
);

create policy "Authorized members can read canonical asset sources"
on public.document_asset_sources for select to authenticated
using (exists (
  select 1 from public.document_assets da
  where da.id = document_asset_id
    and (
      private.has_organization_access(auth.uid(), da.supplier_id, 'supplier')
      or exists (
        select 1 from public.evidence_versions ev
        where ev.document_asset_id = da.id
          and private.can_read_evidence_version(auth.uid(), ev.id)
      )
    )
));

create policy "Supplier members can read canonical records"
on public.evidence_records for select to authenticated
using (
  private.has_organization_access(auth.uid(), supplier_id, 'supplier')
  or exists (
    select 1 from public.evidence_versions ev
    where ev.evidence_record_id = id
      and private.can_read_evidence_version(auth.uid(), ev.id)
  )
);

create policy "Authorized members can read evidence versions"
on public.evidence_versions for select to authenticated
using (private.can_read_evidence_version(auth.uid(), id));

create policy "Authorized members can read canonical evidence objects"
on storage.objects for select to authenticated
using (
  exists (
    select 1 from public.document_assets da
    join public.evidence_versions ev on ev.document_asset_id=da.id
    where da.storage_bucket=storage.objects.bucket_id
      and da.storage_path=storage.objects.name
      and private.can_read_evidence_version(auth.uid(),ev.id)
  )
);

create policy "Authorized members can read field observations"
on public.evidence_field_observations for select to authenticated
using (private.can_read_evidence_version(auth.uid(), evidence_version_id));

create policy "Authorized members can read validation runs"
on public.evidence_validation_runs for select to authenticated
using (private.can_read_evidence_version(auth.uid(), evidence_version_id));

create policy "Authorized members can read validation results"
on public.evidence_validation_results for select to authenticated
using (exists (
  select 1 from public.evidence_validation_runs vr
  where vr.id = validation_run_id
    and private.can_read_evidence_version(auth.uid(), vr.evidence_version_id)
));

create policy "Authorized members can read attestations"
on public.evidence_attestations for select to authenticated
using (private.can_read_evidence_version(auth.uid(), evidence_version_id));

create policy "Request participants can read evidence links"
on public.request_evidence_links for select to authenticated
using (exists (
  select 1 from public.document_requests dr
  where dr.id = request_id
    and (
      private.has_organization_access(auth.uid(), dr.buyer_id, 'buyer')
      or private.has_organization_access(auth.uid(), dr.supplier_id, 'supplier')
    )
));

create policy "Buyer members can read requirement evidence links"
on public.requirement_evidence_links for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create policy "Request participants can read resolution events"
on public.evidence_resolution_events for select to authenticated
using (
  (buyer_id is not null and private.has_organization_access(auth.uid(), buyer_id, 'buyer'))
  or (supplier_id is not null and private.has_organization_access(auth.uid(), supplier_id, 'supplier'))
);

revoke all on table
  public.document_type_definitions, public.evidence_review_policies,
  public.document_assets, public.document_asset_sources, public.evidence_records, public.evidence_versions,
  public.evidence_field_observations, public.evidence_validation_runs,
  public.evidence_validation_results, public.evidence_attestations,
  public.request_evidence_links, public.requirement_evidence_links,
  public.evidence_resolution_events, public.canonical_migration_exceptions
  , public.compliance_reevaluation_queue, public.canonical_idempotency_keys, public.canonical_asset_hash_jobs
from public, anon, authenticated;

grant select on table
  public.document_type_definitions, public.evidence_review_policies,
  public.document_assets, public.document_asset_sources, public.evidence_records, public.evidence_versions,
  public.evidence_field_observations, public.evidence_validation_runs,
  public.evidence_validation_results, public.evidence_attestations,
  public.request_evidence_links, public.requirement_evidence_links,
  public.evidence_resolution_events
to authenticated;

grant all on table
  public.document_type_definitions, public.evidence_review_policies,
  public.document_assets, public.document_asset_sources, public.evidence_records, public.evidence_versions,
  public.evidence_field_observations, public.evidence_validation_runs,
  public.evidence_validation_results, public.evidence_attestations,
  public.request_evidence_links, public.requirement_evidence_links,
  public.evidence_resolution_events, public.canonical_migration_exceptions
  , public.compliance_reevaluation_queue, public.canonical_idempotency_keys, public.canonical_asset_hash_jobs
to service_role;

create or replace function private.reject_immutable_evidence_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% is immutable', tg_table_name;
end;
$$;

create or replace function private.protect_document_asset_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('app.canonical_asset_merge',true)='on' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise exception 'document_assets are immutable'; end if;
  if old.supplier_id is distinct from new.supplier_id
    or old.storage_bucket is distinct from new.storage_bucket
    or old.storage_path is distinct from new.storage_path
    or old.original_file_name is distinct from new.original_file_name
    or old.mime_type is distinct from new.mime_type
    or old.file_size is distinct from new.file_size
    or old.uploaded_by is distinct from new.uploaded_by
    or old.legacy_document_upload_id is distinct from new.legacy_document_upload_id
    or old.legacy_supplier_library_id is distinct from new.legacy_supplier_library_id
    or old.created_at is distinct from new.created_at
    or (old.content_sha256 is not null and old.content_sha256 is distinct from new.content_sha256)
  then raise exception 'Immutable document asset identity cannot be changed'; end if;
  return new;
end;
$$;

create trigger protect_document_asset_identity
before update or delete on public.document_assets
for each row execute function private.protect_document_asset_identity();

create or replace function private.protect_canonical_storage_object()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.document_assets da
    where da.storage_bucket=old.bucket_id and da.storage_path=old.name
  ) then raise exception 'Canonical evidence storage objects are retained and cannot be moved or deleted'; end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
create trigger protect_canonical_storage_object
before delete or update of bucket_id,name on storage.objects
for each row execute function private.protect_canonical_storage_object();

create or replace function private.protect_evidence_version_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('app.canonical_asset_merge',true)='on' then
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then raise exception 'evidence_versions are immutable'; end if;
  if old.evidence_record_id is distinct from new.evidence_record_id
    or old.document_asset_id is distinct from new.document_asset_id
    or old.version_number is distinct from new.version_number
    or old.schema_version is distinct from new.schema_version
    or old.created_by is distinct from new.created_by
    or old.created_at is distinct from new.created_at
    or (old.issue_date is not null and old.issue_date is distinct from new.issue_date)
    or (old.expiry_date is not null and old.expiry_date is distinct from new.expiry_date)
    or (old.jurisdiction is not null and old.jurisdiction is distinct from new.jurisdiction)
    or (cardinality(old.standards)>0 and old.standards is distinct from new.standards)
    or (cardinality(old.covered_product_ids)>0 and old.covered_product_ids is distinct from new.covered_product_ids)
    or (cardinality(old.covered_facility_ids)>0 and old.covered_facility_ids is distinct from new.covered_facility_ids)
    or (old.extraction_model_version is not null and old.extraction_model_version is distinct from new.extraction_model_version)
  then raise exception 'Immutable evidence version identity cannot be changed'; end if;
  return new;
end;
$$;

create trigger protect_evidence_version_identity
before update or delete on public.evidence_versions
for each row execute function private.protect_evidence_version_identity();

create trigger protect_evidence_field_observations
before update or delete on public.evidence_field_observations
for each row execute function private.reject_immutable_evidence_mutation();
create trigger protect_evidence_validation_results
before update or delete on public.evidence_validation_results
for each row execute function private.reject_immutable_evidence_mutation();
create trigger protect_evidence_attestations
before update or delete on public.evidence_attestations
for each row execute function private.reject_immutable_evidence_mutation();
create trigger protect_evidence_resolution_events
before update or delete on public.evidence_resolution_events
for each row execute function private.reject_immutable_evidence_mutation();

-- ---------------------------------------------------------------------------
-- 5. Canonical sharing and strict eligibility
-- ---------------------------------------------------------------------------

alter table public.evidence_sharing_grants drop constraint if exists evidence_sharing_grants_check;
alter table public.evidence_sharing_grants add constraint evidence_sharing_grants_selector_check check (
  ((claim_id is not null)::integer + (document_type is not null)::integer + (evidence_version_id is not null)::integer) = 1
);
create unique index evidence_sharing_grants_canonical_active_unique
  on public.evidence_sharing_grants(owner_organization_id,granted_to_organization_id,evidence_version_id,purpose)
  where status='active' and evidence_version_id is not null;

create or replace function private.validate_evidence_sharing_grant()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner_type text;
  v_grantee_type text;
begin
  select organization_type into v_owner_type from public.organizations where id = new.owner_organization_id;
  select organization_type into v_grantee_type from public.organizations where id = new.granted_to_organization_id;
  if v_owner_type is distinct from 'supplier' then raise exception 'Grant owner must be a supplier'; end if;
  if v_grantee_type is distinct from 'buyer' then raise exception 'Grant recipient must be a buyer'; end if;
  if tg_op='UPDATE' and new.status<>'active' then return new; end if;
  if not exists (
    select 1 from public.buyer_supplier_connections
    where buyer_id = new.granted_to_organization_id
      and supplier_id = new.owner_organization_id and status = 'approved'
  ) then raise exception 'An approved buyer-supplier connection is required'; end if;
  if new.claim_id is not null and not exists (
    select 1 from public.evidence_claims
    where id = new.claim_id and supplier_id = new.owner_organization_id and status = 'verified'
  ) then raise exception 'Only verified supplier evidence can be shared'; end if;
  if new.evidence_version_id is not null and not exists (
    select 1
    from public.evidence_versions ev
    join public.evidence_records er on er.id = ev.evidence_record_id
    join public.document_assets da on da.id = ev.document_asset_id
    where ev.id = new.evidence_version_id
      and er.supplier_id = new.owner_organization_id
      and ev.lifecycle_status = 'current'
      and da.malware_scan_status not in ('infected','failed','pending')
      and coalesce((
        select ea.outcome='accepted' and ea.attestation_type in ('supplier_verification','buyer_verification')
        from public.evidence_attestations ea where ea.evidence_version_id=ev.id
          and (
            (ea.organization_id=new.owner_organization_id and ea.attestation_type in ('supplier_verification','rejection'))
            or (ea.organization_id=new.granted_to_organization_id and ea.attestation_type in ('buyer_verification','rejection'))
          )
        order by ea.created_at desc,ea.id desc limit 1
      ),false)
  ) then raise exception 'Only current verified canonical evidence can be shared'; end if;
  return new;
end;
$$;

drop trigger if exists validate_evidence_sharing_grant_before_insert on public.evidence_sharing_grants;
create trigger validate_evidence_sharing_grant_before_write
before insert or update of owner_organization_id,granted_to_organization_id,claim_id,document_type,evidence_version_id,purpose,status,expires_at
on public.evidence_sharing_grants
for each row execute function private.validate_evidence_sharing_grant();

create or replace function public.evaluate_evidence_eligibility_v1(
  p_buyer_id uuid,
  p_supplier_id uuid,
  p_document_type text,
  p_subject_type text default 'supplier',
  p_subject_id uuid default null,
  p_jurisdiction text default null,
  p_required_standards text[] default '{}'::text[],
  p_minimum_validity_days integer default null
)
returns table (
  evidence_version_id uuid,
  qualification text,
  visibility text,
  reasons text[],
  expires_on date,
  score numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_type text := private.normalize_document_type_code(p_document_type);
  v_min_days integer;
begin
  if not private.has_organization_access(v_actor, p_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if not exists (
    select 1 from public.buyer_supplier_connections
    where buyer_id = p_buyer_id and supplier_id = p_supplier_id and status = 'approved'
  ) then raise exception 'An approved supplier connection is required'; end if;

  select coalesce(
    p_minimum_validity_days,
    nullif(erp.document_type_overrides->v_type->>'minimum_validity_days','')::integer,
    erp.default_minimum_validity_days,
    90
  )
  into v_min_days
  from (select 1) seed
  left join public.evidence_review_policies erp on erp.buyer_id = p_buyer_id;

  return query
  with candidates as (
    select
      ev.id,
      ev.expiry_date,
      ev.issue_date,
      ev.jurisdiction,
      ev.standards,
      ev.covered_product_ids,
      ev.covered_facility_ids,
      ev.validation_completeness,
      da.malware_scan_status,
      coalesce((
        select ea.outcome='accepted' and ea.attestation_type in ('supplier_verification','buyer_verification')
        from public.evidence_attestations ea
        where ea.evidence_version_id=ev.id
          and (
            (ea.organization_id=er.supplier_id and ea.attestation_type in ('supplier_verification','rejection'))
            or (ea.organization_id=p_buyer_id and ea.attestation_type in ('buyer_verification','rejection'))
          )
        order by ea.created_at desc,ea.id desc limit 1
      ),false) as verified,
      coalesce((
        select vr.status='failed' from public.evidence_validation_runs vr
        where vr.evidence_version_id=ev.id order by vr.created_at desc,vr.id desc limit 1
      ),false) as failed_validation,
      coalesce((
        select vr.status='passed' from public.evidence_validation_runs vr
        where vr.evidence_version_id=ev.id order by vr.created_at desc,vr.id desc limit 1
      ),false) as validation_passed,
      exists (
        select 1 from public.evidence_sharing_grants g
        where g.evidence_version_id = ev.id
          and g.granted_to_organization_id = p_buyer_id
          and g.status = 'active' and (g.expires_at is null or g.expires_at > now())
      ) or exists (
        select 1 from public.request_evidence_links rel
        join public.document_requests dr on dr.id = rel.request_id
        where rel.evidence_version_id = ev.id and dr.buyer_id = p_buyer_id
          and rel.relation in ('submitted','accepted')
      ) as has_access
    from public.evidence_versions ev
    join public.evidence_records er on er.id = ev.evidence_record_id
    join public.document_assets da on da.id = ev.document_asset_id
    where er.supplier_id = p_supplier_id
      and er.canonical_document_type = v_type
      and er.status = 'active'
      and ev.lifecycle_status = 'current'
  ), assessed as (
    select c.*,
      array_remove(array[
        case when not c.verified then 'verification_required' end,
        case when c.failed_validation then 'validation_failed' end,
        case when not c.validation_passed then 'validation_required' end,
        case when c.malware_scan_status in ('infected','failed') then 'malware_scan_failed' end,
        case when c.malware_scan_status='pending' then 'malware_scan_pending' end,
        case when c.expiry_date is not null and c.expiry_date < current_date then 'expired' end,
        case when c.expiry_date is not null and c.expiry_date < current_date + v_min_days then 'insufficient_remaining_validity' end,
        case when p_jurisdiction is not null and (c.jurisdiction is null or lower(c.jurisdiction) <> lower(p_jurisdiction)) then 'jurisdiction_mismatch' end,
        case when cardinality(p_required_standards) > 0 and not p_required_standards <@ c.standards then 'standards_mismatch' end,
        case when p_subject_type = 'product' and (p_subject_id is null or not p_subject_id = any(c.covered_product_ids)) then 'product_scope_mismatch' end,
        case when p_subject_type = 'facility' and (p_subject_id is null or not p_subject_id = any(c.covered_facility_ids)) then 'facility_scope_mismatch' end,
        case when not c.has_access then 'supplier_consent_required' end
      ], null)::text[] as reason_list
    from candidates c
  )
  select
    case when a.has_access then a.id else null end,
    case
      when not a.has_access then 'potential'
      when a.reason_list && array['expired','validation_failed','malware_scan_failed','insufficient_remaining_validity','jurisdiction_mismatch','standards_mismatch','product_scope_mismatch','facility_scope_mismatch']::text[] then 'ineligible'
      when cardinality(a.reason_list) = 0 then 'eligible'
      else 'potential'
    end,
    case when a.has_access then 'full' else 'availability_only' end,
    case when a.has_access then a.reason_list else array['supplier_consent_required']::text[] end,
    case when a.has_access then a.expiry_date else null end,
    case when a.has_access then (
      (case when a.verified then 0.35 else 0 end)
      + (case when a.has_access then 0.15 else 0 end)
      + (case when p_jurisdiction is null or lower(a.jurisdiction) = lower(p_jurisdiction) then 0.15 else 0 end)
      + (case when cardinality(p_required_standards) = 0 or p_required_standards <@ a.standards then 0.15 else 0 end)
      + coalesce(a.validation_completeness, 0) * 0.20
    )::numeric else null end
  from assessed a
  order by
    case when cardinality(a.reason_list) = 0 then 0 else 1 end,
    a.issue_date desc nulls last,
    a.expiry_date desc nulls last,
    a.validation_completeness desc nulls last,
    a.id
  limit 1;
end;
$$;

create or replace function public.grant_canonical_evidence_access_v1(
  p_supplier_id uuid,
  p_buyer_id uuid,
  p_evidence_version_id uuid,
  p_purpose text default 'compliance_decision'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_grant uuid;
  v_expiry date;
begin
  if not private.has_organization_access(v_actor,p_supplier_id,'supplier') then raise exception 'Supplier access required'; end if;
  select ev.expiry_date into v_expiry
  from public.evidence_versions ev join public.evidence_records er on er.id=ev.evidence_record_id
  where ev.id=p_evidence_version_id and er.supplier_id=p_supplier_id and ev.lifecycle_status='current';
  if not found then raise exception 'Current supplier evidence not found'; end if;
  select id into v_grant from public.evidence_sharing_grants
  where owner_organization_id=p_supplier_id and granted_to_organization_id=p_buyer_id
    and evidence_version_id=p_evidence_version_id and purpose=p_purpose and status='active'
    and (expires_at is null or expires_at>now());
  if v_grant is not null then return v_grant; end if;
  insert into public.evidence_sharing_grants (
    owner_organization_id,granted_to_organization_id,evidence_version_id,purpose,status,expires_at,granted_by,scope_snapshot
  ) values (
    p_supplier_id,p_buyer_id,p_evidence_version_id,p_purpose,'active',
    case when v_expiry is null then null else (v_expiry+1)::timestamptz end,v_actor,
    jsonb_build_object('reuse_policy','until_expiry_or_revocation')
  ) returning id into v_grant;
  insert into public.evidence_sharing_audit_log (grant_id,event_type,actor_id,organization_id,metadata)
  values (v_grant,'granted',v_actor,p_supplier_id,jsonb_build_object('buyer_id',p_buyer_id,'evidence_version_id',p_evidence_version_id));
  return v_grant;
end;
$$;

create or replace function public.attest_supplier_evidence_v1(
  p_evidence_version_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_supplier_id uuid;
  v_validation_status text;
  v_malware_status text;
  v_attestation_id uuid;
begin
  select er.supplier_id,da.malware_scan_status into v_supplier_id,v_malware_status
  from public.evidence_versions ev
  join public.evidence_records er on er.id=ev.evidence_record_id
  join public.document_assets da on da.id=ev.document_asset_id
  where ev.id=p_evidence_version_id and ev.lifecycle_status='current';
  if v_supplier_id is null then raise exception 'Current supplier evidence not found'; end if;
  if not private.has_organization_access(v_actor,v_supplier_id,'supplier') then raise exception 'Supplier access required'; end if;
  if v_malware_status in ('infected','failed','pending') then raise exception 'Evidence cannot be verified until malware scanning is clear'; end if;
  select status into v_validation_status
  from public.evidence_validation_runs
  where evidence_version_id=p_evidence_version_id
  order by created_at desc,id desc limit 1;
  if coalesce(v_validation_status,'needs_review') <> 'passed' then
    raise exception 'Evidence validation must pass before supplier verification';
  end if;
  if exists (
    select 1 from public.evidence_attestations
    where evidence_version_id=p_evidence_version_id
      and organization_id=v_supplier_id and attestation_type='supplier_verification'
      and outcome='accepted'
  ) then raise exception 'This evidence version is already supplier verified'; end if;

  insert into public.evidence_attestations (
    evidence_version_id,organization_id,organization_type,attestation_type,outcome,actor_id,notes,policy_snapshot
  ) values (
    p_evidence_version_id,v_supplier_id,'supplier','supplier_verification','accepted',v_actor,p_notes,
    jsonb_build_object('validation_status',v_validation_status,'authority','supplier')
  ) returning id into v_attestation_id;
  insert into public.evidence_resolution_events (
    supplier_id,evidence_version_id,event_type,actor_id,metadata
  ) values (
    v_supplier_id,p_evidence_version_id,'supplier_evidence_verified',v_actor,
    jsonb_build_object('attestation_id',v_attestation_id)
  );
  return v_attestation_id;
end;
$$;

create or replace function public.set_evidence_review_policy_v1(
  p_buyer_id uuid,
  p_require_four_eyes boolean,
  p_default_minimum_validity_days integer default 90,
  p_document_type_overrides jsonb default '{}'::jsonb
)
returns public.evidence_review_policies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result public.evidence_review_policies%rowtype;
begin
  if not (
    exists (select 1 from public.buyers where id=p_buyer_id and profile_id=v_actor)
    or public.has_company_role(v_actor,p_buyer_id,'buyer','company_admin'::public.user_role)
  ) then raise exception 'Buyer administrator access required'; end if;
  if p_default_minimum_validity_days < 0 or p_default_minimum_validity_days > 3650 then
    raise exception 'Default minimum validity must be between 0 and 3650 days';
  end if;
  if jsonb_typeof(p_document_type_overrides)<>'object' then raise exception 'Document type overrides must be an object'; end if;
  insert into public.evidence_review_policies (
    buyer_id,require_four_eyes,default_minimum_validity_days,document_type_overrides,created_by,updated_at
  ) values (
    p_buyer_id,p_require_four_eyes,p_default_minimum_validity_days,p_document_type_overrides,v_actor,now()
  ) on conflict (buyer_id) do update set
    require_four_eyes=excluded.require_four_eyes,
    default_minimum_validity_days=excluded.default_minimum_validity_days,
    document_type_overrides=excluded.document_type_overrides,
    updated_at=now()
  returning * into v_result;
  insert into public.evidence_resolution_events (buyer_id,event_type,actor_id,metadata)
  values (p_buyer_id,'evidence_review_policy_updated',v_actor,jsonb_build_object(
    'require_four_eyes',p_require_four_eyes,'default_minimum_validity_days',p_default_minimum_validity_days
  ));
  return v_result;
end;
$$;

create or replace function private.queue_canonical_evidence_reevaluation(p_evidence_version_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected record;
  v_queue_id uuid;
begin
  for affected in
    select distinct rel.buyer_id,rel.subject_type,rel.subject_id
    from public.requirement_evidence_links rel
    where rel.evidence_version_id=p_evidence_version_id
    union
    select distinct dr.buyer_id,'supplier'::text,dr.supplier_id
    from public.request_evidence_links link join public.document_requests dr on dr.id=link.request_id
    where link.evidence_version_id=p_evidence_version_id and link.relation in ('submitted','accepted')
  loop
    if coalesce(
      (select off.enabled from public.organization_feature_flags off
       where off.organization_id=affected.buyer_id and off.organization_type='buyer'
         and off.feature_key='canonical_evidence_v1' and (off.expires_at is null or off.expires_at>now())),
      (select ff.default_enabled from public.feature_flags ff where ff.key='canonical_evidence_v1'),false
    ) then
      insert into public.compliance_reevaluation_queue (buyer_id,subject_type,subject_id,evidence_version_id,reason)
      values (affected.buyer_id,affected.subject_type,affected.subject_id,p_evidence_version_id,p_reason)
      on conflict (buyer_id,subject_type,subject_id,evidence_version_id,reason) where status='pending' do nothing
      returning id into v_queue_id;
      if v_queue_id is not null then
        insert into public.compliance_domain_events (buyer_id,subject_type,subject_id,event_type,payload)
        values (affected.buyer_id,affected.subject_type,affected.subject_id,'reevaluation_requested',
          jsonb_build_object('queue_id',v_queue_id,'evidence_version_id',p_evidence_version_id,'reason',p_reason));
      end if;
    end if;
  end loop;
end;
$$;

create or replace function private.queue_reevaluation_from_attestation()
returns trigger language plpgsql set search_path='' as $$ begin
  perform private.queue_canonical_evidence_reevaluation(new.evidence_version_id,'attestation_changed'); return new;
end; $$;
create trigger queue_reevaluation_after_attestation
after insert on public.evidence_attestations for each row execute function private.queue_reevaluation_from_attestation();

create or replace function private.queue_reevaluation_from_observation()
returns trigger language plpgsql set search_path='' as $$ begin
  if new.observation_type='corrected' then perform private.queue_canonical_evidence_reevaluation(new.evidence_version_id,'evidence_corrected'); end if; return new;
end; $$;
create trigger queue_reevaluation_after_correction
after insert on public.evidence_field_observations for each row execute function private.queue_reevaluation_from_observation();

create or replace function private.queue_reevaluation_from_version()
returns trigger language plpgsql set search_path='' as $$ begin
  if old.lifecycle_status is distinct from new.lifecycle_status or old.expiry_date is distinct from new.expiry_date then
    perform private.queue_canonical_evidence_reevaluation(new.id,'evidence_version_changed');
  end if; return new;
end; $$;
create trigger queue_reevaluation_after_version_change
after update of lifecycle_status,expiry_date on public.evidence_versions for each row execute function private.queue_reevaluation_from_version();

create or replace function private.queue_reevaluation_from_grant()
returns trigger language plpgsql set search_path='' as $$ begin
  if coalesce(new.evidence_version_id,old.evidence_version_id) is not null then
    perform private.queue_canonical_evidence_reevaluation(coalesce(new.evidence_version_id,old.evidence_version_id),'evidence_access_changed');
  end if; return new;
end; $$;
create trigger queue_reevaluation_after_grant_change
after insert or update of status,expires_at on public.evidence_sharing_grants for each row execute function private.queue_reevaluation_from_grant();

create or replace function public.claim_compliance_reevaluations_v1(p_batch_size integer default 20)
returns setof public.compliance_reevaluation_queue
language plpgsql
security invoker
set search_path=''
as $$
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  return query
  update public.compliance_reevaluation_queue q set status='processing',attempts=q.attempts+1
  where q.id in (
    select id from public.compliance_reevaluation_queue
    where status='pending' and scheduled_at<=now() order by created_at for update skip locked limit greatest(1,least(p_batch_size,100))
  ) returning q.*;
end;
$$;

create or replace function public.claim_canonical_asset_hash_jobs_v1(p_batch_size integer default 20)
returns table (id uuid,document_asset_id uuid,storage_bucket text,storage_path text,attempts integer,max_attempts integer)
language plpgsql security invoker set search_path='' as $$
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  return query
  update public.canonical_asset_hash_jobs job set status='processing',attempts=job.attempts+1
  from public.document_assets asset
  where job.document_asset_id=asset.id and job.id in (
    select queued.id from public.canonical_asset_hash_jobs queued
    where queued.status='pending' and queued.scheduled_at<=now()
    order by queued.created_at for update skip locked limit greatest(1,least(p_batch_size,100))
  )
  returning job.id,job.document_asset_id,asset.storage_bucket,asset.storage_path,job.attempts,job.max_attempts;
end;
$$;

create or replace function public.hydrate_canonical_asset_hash_v1(p_document_asset_id uuid,p_content_sha256 text)
returns uuid
language plpgsql security invoker set search_path='' as $$
declare
  v_asset public.document_assets%rowtype;
  v_existing uuid;
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if p_content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'A lowercase SHA-256 digest is required'; end if;
  select * into v_asset from public.document_assets where id=p_document_asset_id for update;
  if v_asset.id is null then raise exception 'Canonical asset not found'; end if;
  if v_asset.content_sha256=p_content_sha256 then return v_asset.id; end if;
  select id into v_existing from public.document_assets
  where supplier_id=v_asset.supplier_id and content_sha256=p_content_sha256 and id<>v_asset.id
  order by created_at,id limit 1 for update;
  if v_existing is null then
    update public.document_assets set content_sha256=p_content_sha256 where id=v_asset.id;
    return v_asset.id;
  end if;

  perform set_config('app.canonical_asset_merge','on',true);
  update public.document_asset_sources set document_asset_id=v_existing where document_asset_id=v_asset.id;
  update public.evidence_versions set document_asset_id=v_existing where document_asset_id=v_asset.id;
  update public.document_uploads set canonical_document_asset_id=v_existing where canonical_document_asset_id=v_asset.id;
  update public.supplier_document_library set canonical_document_asset_id=v_existing where canonical_document_asset_id=v_asset.id;
  delete from public.document_assets where id=v_asset.id;
  perform set_config('app.canonical_asset_merge','off',true);
  insert into public.evidence_resolution_events (supplier_id,event_type,metadata)
  values (v_asset.supplier_id,'canonical_assets_merged',jsonb_build_object('retained_asset_id',v_existing,'merged_asset_id',v_asset.id,'content_sha256',p_content_sha256));
  return v_existing;
end;
$$;

revoke all on function public.evaluate_evidence_eligibility_v1(uuid,uuid,text,text,uuid,text,text[],integer) from public, anon;
revoke all on function public.grant_canonical_evidence_access_v1(uuid,uuid,uuid,text) from public,anon;
revoke all on function public.attest_supplier_evidence_v1(uuid,text) from public,anon;
revoke all on function public.set_evidence_review_policy_v1(uuid,boolean,integer,jsonb) from public,anon;
revoke all on function public.claim_compliance_reevaluations_v1(integer) from public,anon,authenticated;
revoke all on function public.claim_canonical_asset_hash_jobs_v1(integer) from public,anon,authenticated;
revoke all on function public.hydrate_canonical_asset_hash_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.evaluate_evidence_eligibility_v1(uuid,uuid,text,text,uuid,text,text[],integer) to authenticated, service_role;
grant execute on function public.grant_canonical_evidence_access_v1(uuid,uuid,uuid,text) to authenticated,service_role;
grant execute on function public.attest_supplier_evidence_v1(uuid,text) to authenticated,service_role;
grant execute on function public.set_evidence_review_policy_v1(uuid,boolean,integer,jsonb) to authenticated,service_role;
grant execute on function public.claim_compliance_reevaluations_v1(integer) to service_role;
grant execute on function public.claim_canonical_asset_hash_jobs_v1(integer) to service_role;
grant execute on function public.hydrate_canonical_asset_hash_v1(uuid,text) to service_role;

-- ---------------------------------------------------------------------------
-- 6. Transactional request preflight, creation, supplier resolution, review
-- ---------------------------------------------------------------------------

create or replace function public.finalize_canonical_upload_v1(
  p_source_type text,
  p_source_id uuid,
  p_content_sha256 text,
  p_document_type text,
  p_display_name text,
  p_logical_identity_key text default null,
  p_fields jsonb default '[]'::jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_supplier uuid;
  v_storage_path text;
  v_file_name text;
  v_mime_type text;
  v_file_size bigint;
  v_uploaded_by uuid;
  v_request_id uuid;
  v_buyer uuid;
  v_asset uuid;
  v_source_asset uuid;
  v_record uuid;
  v_version uuid;
  v_version_number integer;
  v_type text := private.normalize_document_type_code(p_document_type);
  v_item jsonb;
  v_validation_run uuid;
  v_missing_fields text[];
  v_required_fields text[];
begin
  if p_source_type not in ('document_upload','supplier_library') then raise exception 'Unsupported source type'; end if;
  if p_content_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'A lowercase SHA-256 digest is required'; end if;
  if jsonb_typeof(p_fields) <> 'array' then raise exception 'Fields must be an array'; end if;

  if p_source_type = 'document_upload' then
    select dr.supplier_id,du.file_path,du.file_name,du.mime_type,du.file_size,du.uploader_id,dr.id,dr.buyer_id
    into v_supplier,v_storage_path,v_file_name,v_mime_type,v_file_size,v_uploaded_by,v_request_id,v_buyer
    from public.document_uploads du join public.document_requests dr on dr.id=du.request_id
    where du.id=p_source_id;
  else
    select supplier_id,file_path,document_name,mime_type,file_size,uploaded_by
    into v_supplier,v_storage_path,v_file_name,v_mime_type,v_file_size,v_uploaded_by
    from public.supplier_document_library where id=p_source_id;
  end if;
  if v_supplier is null then raise exception 'Upload source not found'; end if;
  if not private.has_organization_access(v_actor,v_supplier,'supplier') and coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Supplier access required';
  end if;

  select das.document_asset_id into v_source_asset
  from public.document_asset_sources das where das.source_type=p_source_type and das.source_id=p_source_id;
  if v_source_asset is not null then
    select ev.id,ev.evidence_record_id into v_version,v_record
    from public.evidence_versions ev where ev.document_asset_id=v_source_asset
    order by ev.created_at desc limit 1;
    if v_version is not null and exists (select 1 from public.document_assets where id=v_source_asset and content_sha256=p_content_sha256) then
      return jsonb_build_object('document_asset_id',v_source_asset,'evidence_record_id',v_record,'evidence_version_id',v_version,'deduplicated',true,'idempotent',true);
    end if;
  end if;

  select id into v_asset from public.document_assets
  where supplier_id=v_supplier and content_sha256=p_content_sha256;
  if v_asset is null and v_source_asset is not null then
    update public.document_assets set content_sha256=p_content_sha256 where id=v_source_asset and content_sha256 is null;
    if found then v_asset := v_source_asset; end if;
  end if;
  if v_asset is null then
    insert into public.document_assets (
      supplier_id,storage_path,original_file_name,content_sha256,mime_type,file_size,
      malware_scan_status,uploaded_by,legacy_document_upload_id,legacy_supplier_library_id
    ) values (
      v_supplier,v_storage_path,v_file_name,p_content_sha256,v_mime_type,v_file_size,
      coalesce(p_metadata->>'malware_scan_status','not_available'),v_uploaded_by,
      case when p_source_type='document_upload' then p_source_id end,
      case when p_source_type='supplier_library' then p_source_id end
    )
    on conflict (supplier_id,content_sha256) where content_sha256 is not null
    do update set content_sha256=excluded.content_sha256
    returning id into v_asset;
  end if;
  insert into public.document_asset_sources (document_asset_id,source_type,source_id,storage_path,linked_by)
  values (v_asset,p_source_type,p_source_id,v_storage_path,v_actor)
  on conflict (source_type,source_id) do update set document_asset_id=excluded.document_asset_id,storage_path=excluded.storage_path;

  select ev.id,ev.evidence_record_id into v_version,v_record
  from public.evidence_versions ev where ev.document_asset_id=v_asset order by ev.created_at desc limit 1;
  if v_version is null then
    if p_logical_identity_key is not null then
      select id into v_record from public.evidence_records
      where supplier_id=v_supplier and logical_identity_key=p_logical_identity_key and status='active';
    end if;
    if v_record is null then
      insert into public.evidence_records (
        supplier_id,canonical_document_type,display_name,logical_identity_key,
        legacy_document_upload_id,legacy_supplier_library_id,created_by
      ) values (
        v_supplier,v_type,coalesce(nullif(p_display_name,''),v_file_name),p_logical_identity_key,
        case when p_source_type='document_upload' then p_source_id end,
        case when p_source_type='supplier_library' then p_source_id end,v_actor
      ) returning id into v_record;
    end if;
    select coalesce(max(version_number),0)+1 into v_version_number from public.evidence_versions where evidence_record_id=v_record;
    update public.evidence_versions set lifecycle_status='superseded'
    where evidence_record_id=v_record and lifecycle_status='current';
    insert into public.evidence_versions (
      evidence_record_id,document_asset_id,version_number,schema_version,lifecycle_status,
      issue_date,expiry_date,jurisdiction,standards,covered_product_ids,covered_facility_ids,
      extraction_model_version,created_by
    ) values (
      v_record,v_asset,v_version_number,coalesce(nullif(p_metadata->>'schema_version','')::integer,1),'current',
      nullif(p_metadata->>'issue_date','')::date,nullif(p_metadata->>'expiry_date','')::date,
      nullif(p_metadata->>'jurisdiction',''),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_metadata->'standards','[]'::jsonb))),'{}'::text[]),
      coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_metadata->'covered_product_ids','[]'::jsonb))),'{}'::uuid[]),
      coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_metadata->'covered_facility_ids','[]'::jsonb))),'{}'::uuid[]),
      p_metadata->>'extraction_model_version',v_actor
    ) returning id into v_version;
  end if;

  for v_item in select * from jsonb_array_elements(p_fields) loop
    if coalesce(v_item->>'field_name','') <> '' and not exists (
      select 1 from public.evidence_field_observations
      where evidence_version_id=v_version and field_name=v_item->>'field_name'
        and normalized_value is not distinct from coalesce(v_item->'normalized_value',v_item->'value')
    ) then
      insert into public.evidence_field_observations (
        evidence_version_id,field_name,raw_value,normalized_value,source_page,source_quote,source_bbox,
        confidence,extraction_model_version,observation_type,observed_by
      ) values (
        v_version,v_item->>'field_name',v_item->'value',coalesce(v_item->'normalized_value',v_item->'value'),
        nullif(v_item->>'source_page','')::integer,v_item->>'source_quote',v_item->'source_bbox',
        nullif(v_item->>'confidence','')::numeric,p_metadata->>'extraction_model_version','extracted',v_actor
      );
    end if;
  end loop;

  select required_fields into v_required_fields from public.document_type_definitions where code=v_type;
  select coalesce(array_agg(required_field),'{}'::text[]) into v_missing_fields
  from unnest(coalesce(v_required_fields,'{}'::text[])) required_field
  where not exists (
    select 1 from public.evidence_field_observations o
    where o.evidence_version_id=v_version and o.field_name=required_field
      and coalesce(o.normalized_value,o.raw_value) is not null
  );
  insert into public.evidence_validation_runs (evidence_version_id,validator_version,status,completeness,completed_at)
  values (
    v_version,'canonical-validation-v1',
    case when cardinality(v_missing_fields)=0 then 'passed' else 'needs_review' end,
    case when cardinality(v_required_fields)=0 then 1
      else (cardinality(v_required_fields)-cardinality(v_missing_fields))::numeric/cardinality(v_required_fields) end,
    now()
  ) returning id into v_validation_run;
  if cardinality(v_missing_fields)>0 then
    insert into public.evidence_validation_results (validation_run_id,rule_code,outcome,severity,message,details)
    values (v_validation_run,'required_fields','needs_review','error','Required evidence fields are missing',jsonb_build_object('missing_fields',v_missing_fields));
  end if;
  update public.evidence_versions ev set validation_completeness=vr.completeness
  from public.evidence_validation_runs vr where ev.id=v_version and vr.id=v_validation_run;

  if p_source_type='document_upload' then
    update public.document_uploads set canonical_document_asset_id=v_asset,canonical_evidence_version_id=v_version where id=p_source_id;
    if not exists (select 1 from public.request_evidence_links where request_id=v_request_id and evidence_version_id=v_version and relation in ('submitted','accepted')) then
      insert into public.request_evidence_links (request_id,evidence_version_id,relation,qualification,qualification_reasons,selected_by)
      values (v_request_id,v_version,'submitted','potential',array['verification_required']::text[],v_actor);
    end if;
  else
    update public.supplier_document_library set canonical_document_asset_id=v_asset,canonical_evidence_record_id=v_record,canonical_evidence_version_id=v_version where id=p_source_id;
  end if;
  insert into public.evidence_resolution_events (supplier_id,evidence_version_id,event_type,actor_id,metadata)
  values (v_supplier,v_version,'canonical_upload_finalized',v_actor,jsonb_build_object('source_type',p_source_type,'source_id',p_source_id,'deduplicated',exists(
    select 1 from public.document_asset_sources where document_asset_id=v_asset and not (source_type=p_source_type and source_id=p_source_id)
  )));
  return jsonb_build_object('document_asset_id',v_asset,'evidence_record_id',v_record,'evidence_version_id',v_version,'validation_run_id',v_validation_run);
end;
$$;

create or replace function public.record_canonical_extraction_v1(p_claim_id uuid, p_fields jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claim public.evidence_claims%rowtype;
  v_version uuid;
  v_item jsonb;
  v_run uuid;
  v_type text;
  v_required text[];
  v_missing text[];
  v_low_confidence text[];
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if jsonb_typeof(p_fields) <> 'array' then raise exception 'Fields must be an array'; end if;
  select * into v_claim from public.evidence_claims where id=p_claim_id;
  if v_claim.id is null then raise exception 'Evidence claim not found'; end if;
  v_version := v_claim.canonical_evidence_version_id;
  if v_version is null then
    select canonical_evidence_version_id into v_version from public.document_uploads where id=v_claim.document_upload_id;
    update public.evidence_claims set canonical_evidence_version_id=v_version where id=p_claim_id;
  end if;
  if v_version is null then raise exception 'Canonical upload must be finalized before recording extraction'; end if;

  update public.evidence_versions set issue_date=v_claim.issue_date,expiry_date=v_claim.expiry_date,
    standards=v_claim.standards,extraction_model_version=v_claim.extraction_model_version
  where id=v_version;
  for v_item in select * from jsonb_array_elements(p_fields) loop
    if coalesce(v_item->>'field_name','') <> '' then
      insert into public.evidence_field_observations (
        evidence_version_id,field_name,raw_value,normalized_value,source_page,source_quote,
        confidence,extraction_model_version,observation_type
      ) values (
        v_version,v_item->>'field_name',v_item->'value',coalesce(v_item->'normalized_value',v_item->'value'),
        nullif(v_item->>'source_page','')::integer,v_item->>'source_quote',nullif(v_item->>'confidence','')::numeric,
        v_claim.extraction_model_version,'extracted'
      );
    end if;
  end loop;

  select er.canonical_document_type into v_type
  from public.evidence_versions ev join public.evidence_records er on er.id=ev.evidence_record_id where ev.id=v_version;
  select required_fields into v_required from public.document_type_definitions where code=v_type;
  select coalesce(array_agg(missing_field),'{}'::text[]) into v_missing
  from unnest(coalesce(v_required,'{}'::text[])) missing_field
  where not exists (select 1 from public.evidence_field_observations o where o.evidence_version_id=v_version and o.field_name=missing_field and coalesce(o.normalized_value,o.raw_value) is not null);
  insert into public.evidence_validation_runs (evidence_version_id,validator_version,status,completeness,completed_at)
  values (v_version,'canonical-validation-v1',case when cardinality(v_missing)=0 then 'passed' else 'needs_review' end,
    case when cardinality(v_required)=0 then 1 else (cardinality(v_required)-cardinality(v_missing))::numeric/cardinality(v_required) end,now())
  returning id into v_run;
  if cardinality(v_missing)>0 then
    insert into public.evidence_validation_results (validation_run_id,rule_code,outcome,severity,message,details)
    values (v_run,'required_fields','needs_review','error','Required evidence fields are missing',jsonb_build_object('missing_fields',v_missing));
  end if;
  update public.evidence_versions set validation_completeness=(select completeness from public.evidence_validation_runs where id=v_run) where id=v_version;
  insert into public.evidence_resolution_events (supplier_id,evidence_version_id,event_type,metadata)
  values (v_claim.supplier_id,v_version,'canonical_extraction_recorded',jsonb_build_object('claim_id',p_claim_id,'validation_run_id',v_run));
  return v_version;
end;
$$;

create or replace function public.preflight_document_requests_v1(p_buyer_id uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_result jsonb;
begin
  if not private.has_organization_access(v_actor, p_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'p_items must be an array'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'client_key', item->>'client_key',
      'supplier_id', item->>'supplier_id',
      'document_type', item->>'document_type',
      'match', coalesce((
        select to_jsonb(m)
        from public.evaluate_evidence_eligibility_v1(
          p_buyer_id,
          (item->>'supplier_id')::uuid,
          item->>'document_type',
          coalesce(item->>'subject_type','supplier'),
          nullif(item->>'subject_id','')::uuid,
          nullif(item->>'jurisdiction',''),
          coalesce(array(select jsonb_array_elements_text(coalesce(item->'required_standards','[]'::jsonb))), '{}'::text[]),
          nullif(item->>'minimum_validity_days','')::integer
        ) m
      ), jsonb_build_object('qualification','ineligible','visibility','none','reasons',array['no_match']::text[]))
    )
  ), '[]'::jsonb) into v_result
  from jsonb_array_elements(p_items) item;

  return v_result;
end;
$$;

create or replace function public.create_document_request_v2(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_buyer uuid := (p_input->>'buyer_id')::uuid;
  v_supplier uuid := (p_input->>'supplier_id')::uuid;
  v_choice text := coalesce(p_input->>'reuse_preference','create');
  v_reason text := p_input->>'request_reason_code';
  v_request uuid;
  v_match record;
  v_supplier_profile uuid;
  v_idempotency_key text := p_input->>'idempotency_key';
  v_request_hash text := encode(extensions.digest(p_input::text,'sha256'),'hex');
  v_type text := private.normalize_document_type_code(p_input->>'document_type');
  v_min_validity integer;
  v_existing_idempotency public.canonical_idempotency_keys%rowtype;
  v_result jsonb;
begin
  if not private.has_organization_access(v_actor, v_buyer, 'buyer') then raise exception 'Buyer access required'; end if;
  select coalesce(
    nullif(p_input->>'minimum_validity_days','')::integer,
    nullif(erp.document_type_overrides->v_type->>'minimum_validity_days','')::integer,
    erp.default_minimum_validity_days,
    90
  ) into v_min_validity
  from (select 1) seed left join public.evidence_review_policies erp on erp.buyer_id=v_buyer;
  if coalesce(v_idempotency_key,'')='' then raise exception 'An idempotency key is required'; end if;
  insert into public.canonical_idempotency_keys(actor_id,operation,idempotency_key,request_hash)
  values(v_actor,'create_document_request_v2',v_idempotency_key,v_request_hash)
  on conflict(actor_id,operation,idempotency_key) do nothing;
  if not found then
    select * into v_existing_idempotency from public.canonical_idempotency_keys
    where actor_id=v_actor and operation='create_document_request_v2' and idempotency_key=v_idempotency_key;
    if v_existing_idempotency.request_hash<>v_request_hash then raise exception 'Idempotency key was used for a different request'; end if;
    if v_existing_idempotency.result is not null then return v_existing_idempotency.result; end if;
  end if;
  if v_choice not in ('use_existing','ask_supplier','request_new','cancel_duplicate','create') then raise exception 'Invalid reuse preference'; end if;

  select * into v_match from public.evaluate_evidence_eligibility_v1(
    v_buyer, v_supplier, p_input->>'document_type', coalesce(p_input->>'subject_type','supplier'),
    nullif(p_input->>'subject_id','')::uuid, nullif(p_input->>'jurisdiction',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'required_standards','[]'::jsonb))), '{}'::text[]),
    v_min_validity
  );

  if v_choice = 'cancel_duplicate' then
    insert into public.evidence_resolution_events (buyer_id, supplier_id, evidence_version_id, event_type, actor_id, correlation_id, metadata)
    values (v_buyer, v_supplier, v_match.evidence_version_id, 'duplicate_request_cancelled', v_actor,
      p_input->>'idempotency_key', jsonb_build_object('document_type',p_input->>'document_type','reasons',v_match.reasons));
    v_result:=jsonb_build_object('request_id',null,'fulfillment_status','cancelled_duplicate');
    update public.canonical_idempotency_keys set result=v_result where actor_id=v_actor and operation='create_document_request_v2' and idempotency_key=v_idempotency_key;
    return v_result;
  end if;

  if v_choice = 'use_existing' and (v_match.qualification <> 'eligible' or v_match.evidence_version_id is null) then
    raise exception 'Existing evidence is not eligible or not authorized for reuse';
  end if;
  if v_choice = 'request_new' and v_match.qualification in ('eligible','potential') and coalesce(v_reason,'') = '' then
    raise exception 'A structured reason is required when requesting a new version despite a match';
  end if;

  insert into public.document_requests (
    supplier_id, requester_id, title, description, document_type, category, priority,
    due_date, notes, buyer_id, branch_id, supplier_branch_id,
    template_sections,template_type,custom_template_id,
    sample_file_path,sample_file_name,sample_file_size,sample_mime_type,sample_uploaded_by,sample_uploaded_at,
    evidence_subject_type,evidence_subject_id,evidence_jurisdiction,required_standards_snapshot,
    fulfillment_status, request_reason_code, request_reason_notes,
    minimum_remaining_validity_days, reuse_preference
  ) values (
    v_supplier, v_actor, p_input->>'title', p_input->>'description', p_input->>'document_type',
    p_input->>'category', coalesce((p_input->>'priority')::public.request_priority, 'medium'::public.request_priority),
    nullif(p_input->>'due_date','')::date, p_input->>'notes', v_buyer,
    nullif(p_input->>'branch_id','')::uuid, nullif(p_input->>'supplier_branch_id','')::uuid,
    p_input->'template_sections',coalesce(p_input->>'template_type','standard'),nullif(p_input->>'custom_template_id','')::uuid,
    p_input->>'sample_file_path',p_input->>'sample_file_name',nullif(p_input->>'sample_file_size','')::integer,
    p_input->>'sample_mime_type',nullif(p_input->>'sample_uploaded_by','')::uuid,nullif(p_input->>'sample_uploaded_at','')::timestamptz,
    coalesce(p_input->>'subject_type','supplier'),coalesce(nullif(p_input->>'subject_id','')::uuid,v_supplier),
    nullif(p_input->>'jurisdiction',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_input->'required_standards','[]'::jsonb))),'{}'::text[]),
    case v_choice when 'use_existing' then 'fulfilled_existing' when 'ask_supplier' then 'awaiting_supplier_consent'
      when 'request_new' then 'new_version_required' else 'open' end,
    v_reason, p_input->>'request_reason_notes', v_min_validity, v_choice
  ) returning id into v_request;

  if v_choice = 'use_existing' then
    insert into public.request_evidence_links (request_id,evidence_version_id,relation,qualification,qualification_reasons,selected_by,decided_by,decided_at)
    values (v_request,v_match.evidence_version_id,'accepted','eligible',v_match.reasons,v_actor,v_actor,now());
    update public.document_requests set status = 'approved' where id = v_request;
    insert into public.evidence_attestations (evidence_version_id,organization_id,organization_type,attestation_type,outcome,actor_id,notes,policy_snapshot)
    values (v_match.evidence_version_id,v_buyer,'buyer','buyer_acceptance','accepted',v_actor,'Reused for matching request',jsonb_build_object('request_id',v_request));
  elsif v_match.qualification in ('eligible','potential') then
    update public.document_requests
    set fulfillment_status = case when v_choice='create' then 'match_available' else fulfillment_status end
    where id = v_request;
  end if;

  insert into public.evidence_resolution_events (request_id,buyer_id,supplier_id,evidence_version_id,event_type,actor_id,correlation_id,metadata)
  values (v_request,v_buyer,v_supplier,v_match.evidence_version_id,'request_created_v2',v_actor,p_input->>'idempotency_key',
    jsonb_build_object('reuse_preference',v_choice,'qualification',v_match.qualification,'visibility',v_match.visibility));
  insert into public.compliance_domain_events (buyer_id,subject_type,subject_id,event_type,payload)
  values (v_buyer,'supplier',v_supplier,'document_request_created',jsonb_build_object('request_id',v_request,'reuse_preference',v_choice));

  select profile_id into v_supplier_profile from public.suppliers where id=v_supplier;
  if v_supplier_profile is not null then
    perform public.create_notification_v1(
      v_supplier_profile,
      case when v_choice='use_existing' then 'evidence_reused' else 'request_created' end,
      case when v_choice='use_existing' then 'Existing evidence reused' else 'New document request' end,
      case when v_choice='use_existing'
        then concat('Your existing ',p_input->>'document_type',' evidence was reused for a matching request.')
        else concat('A buyer requested ',p_input->>'title','.') end,
      v_request
    );
  end if;

  v_result:=jsonb_build_object('request_id',v_request,'fulfillment_status',(
    select fulfillment_status from public.document_requests where id=v_request
  ),'qualification',v_match.qualification);
  update public.canonical_idempotency_keys set result=v_result where actor_id=v_actor and operation='create_document_request_v2' and idempotency_key=v_idempotency_key;
  return v_result;
end;
$$;

create or replace function public.create_document_requests_v2(p_inputs jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_inputs) <> 'array' or jsonb_array_length(p_inputs)=0 then
    raise exception 'p_inputs must be a non-empty array';
  end if;
  for v_item in select * from jsonb_array_elements(p_inputs) loop
    v_results := v_results || jsonb_build_array(public.create_document_request_v2(v_item));
  end loop;
  return v_results;
end;
$$;

create or replace function public.resolve_document_request_v1(
  p_request_id uuid,
  p_action text,
  p_evidence_version_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.document_requests%rowtype;
  v_grant uuid;
begin
  select * into v_request from public.document_requests where id = p_request_id for update;
  if v_request.id is null then raise exception 'Request not found'; end if;
  if not private.has_organization_access(v_actor, v_request.supplier_id, 'supplier') then raise exception 'Supplier access required'; end if;

  if p_action = 'submit_existing' then
    if p_evidence_version_id is null then raise exception 'Evidence version is required'; end if;
    if not exists (
      select 1 from public.evidence_versions ev
      join public.evidence_records er on er.id=ev.evidence_record_id
      join public.document_assets da on da.id=ev.document_asset_id
      where ev.id=p_evidence_version_id and er.supplier_id=v_request.supplier_id and ev.lifecycle_status='current'
        and da.malware_scan_status not in ('infected','failed','pending')
        and er.canonical_document_type=private.normalize_document_type_code(v_request.document_type)
        and (ev.expiry_date is null or ev.expiry_date >= current_date + coalesce(v_request.minimum_remaining_validity_days,90))
        and (v_request.evidence_jurisdiction is null or (ev.jurisdiction is not null and lower(ev.jurisdiction)=lower(v_request.evidence_jurisdiction)))
        and (cardinality(v_request.required_standards_snapshot)=0 or v_request.required_standards_snapshot <@ ev.standards)
        and (coalesce(v_request.evidence_subject_type,'supplier')<>'product' or v_request.evidence_subject_id=any(ev.covered_product_ids))
        and (coalesce(v_request.evidence_subject_type,'supplier')<>'facility' or v_request.evidence_subject_id=any(ev.covered_facility_ids))
        and coalesce((select vr.status='passed' from public.evidence_validation_runs vr where vr.evidence_version_id=ev.id order by vr.created_at desc,vr.id desc limit 1),false)
        and coalesce((select ea.outcome='accepted' and ea.attestation_type in ('supplier_verification','buyer_verification')
          from public.evidence_attestations ea where ea.evidence_version_id=ev.id
            and (
              (ea.organization_id=v_request.supplier_id and ea.attestation_type in ('supplier_verification','rejection'))
              or (ea.organization_id=v_request.buyer_id and ea.attestation_type in ('buyer_verification','rejection'))
            )
          order by ea.created_at desc,ea.id desc limit 1),false)
    ) then raise exception 'Evidence is not current, verified, valid, or supplier-owned'; end if;

    select id into v_grant from public.evidence_sharing_grants
    where owner_organization_id=v_request.supplier_id and granted_to_organization_id=v_request.buyer_id
      and evidence_version_id=p_evidence_version_id and purpose='compliance_decision' and status='active'
      and (expires_at is null or expires_at>now());
    if v_grant is null then
      insert into public.evidence_sharing_grants (
      owner_organization_id,granted_to_organization_id,evidence_version_id,purpose,status,expires_at,granted_by,scope_snapshot
      ) select v_request.supplier_id,v_request.buyer_id,p_evidence_version_id,'compliance_decision','active',
        (ev.expiry_date + 1)::timestamptz,v_actor,jsonb_build_object('request_id',p_request_id)
      from public.evidence_versions ev where ev.id=p_evidence_version_id
      returning id into v_grant;
      insert into public.evidence_sharing_audit_log (grant_id,event_type,actor_id,organization_id,metadata)
      values (v_grant,'granted',v_actor,v_request.supplier_id,jsonb_build_object('request_id',p_request_id,'reuse_until','expiry_or_revocation'));
    end if;
    if not exists (select 1 from public.request_evidence_links where request_id=p_request_id and evidence_version_id=p_evidence_version_id and relation in ('submitted','accepted')) then
      insert into public.request_evidence_links (request_id,evidence_version_id,relation,qualification,sharing_grant_id,selected_by)
      values (p_request_id,p_evidence_version_id,'submitted','eligible',v_grant,v_actor);
    end if;
    update public.document_requests set status='submitted',fulfillment_status='existing_evidence_submitted',updated_at=now() where id=p_request_id;
  elsif p_action = 'upload_new_version' then
    update public.document_requests set fulfillment_status='new_version_required',updated_at=now() where id=p_request_id;
  elsif p_action = 'ask_clarification' then
    update public.document_requests set fulfillment_status='clarification_requested',updated_at=now() where id=p_request_id;
  elsif p_action = 'decline_sharing' then
    update public.document_requests set fulfillment_status='new_version_required',updated_at=now() where id=p_request_id;
  elsif p_action = 'cancel_duplicate' then
    update public.document_requests set status='withdrawn',fulfillment_status='cancelled_duplicate',updated_at=now() where id=p_request_id;
  else raise exception 'Unsupported request resolution action';
  end if;

  insert into public.evidence_resolution_events (request_id,buyer_id,supplier_id,evidence_version_id,event_type,actor_id,metadata)
  values (p_request_id,v_request.buyer_id,v_request.supplier_id,p_evidence_version_id,p_action,v_actor,jsonb_build_object('reason',p_reason,'grant_id',v_grant));
  return jsonb_build_object('request_id',p_request_id,'action',p_action,'grant_id',v_grant);
end;
$$;

create or replace function public.review_evidence_v2(
  p_request_id uuid,
  p_evidence_version_id uuid,
  p_corrections jsonb default '[]'::jsonb,
  p_approve boolean default true,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_request public.document_requests%rowtype;
  v_four_eyes boolean := false;
  v_item jsonb;
  v_previous uuid;
  v_task uuid;
  v_type text;
  v_required text[];
  v_missing text[];
  v_low_confidence text[];
  v_validation_status text;
  v_validation_run uuid;
begin
  select * into v_request from public.document_requests where id=p_request_id for update;
  if v_request.id is null then raise exception 'Request not found'; end if;
  if not private.has_organization_access(v_actor,v_request.buyer_id,'buyer') then raise exception 'Buyer access required'; end if;
  if not (
    exists (select 1 from public.buyers where id=v_request.buyer_id and profile_id=v_actor)
    or exists (select 1 from public.company_users where profile_id=v_actor and company_id=v_request.buyer_id
      and company_type='buyer' and status='active' and role::text in ('company_admin','branch_manager','document_manager','approver'))
  ) then raise exception 'Evidence reviewer role required'; end if;
  if not exists (select 1 from public.request_evidence_links where request_id=p_request_id and evidence_version_id=p_evidence_version_id and relation in ('submitted','offered','candidate')) then
    raise exception 'Evidence is not linked to this request';
  end if;
  if jsonb_typeof(p_corrections) <> 'array' then raise exception 'Corrections must be an array'; end if;
  select er.canonical_document_type into v_type from public.evidence_versions ev join public.evidence_records er on er.id=ev.evidence_record_id where ev.id=p_evidence_version_id;
  select required_fields into v_required from public.document_type_definitions where code=v_type;

  for v_item in select * from jsonb_array_elements(p_corrections) loop
    select id into v_previous from public.evidence_field_observations
    where evidence_version_id=p_evidence_version_id and field_name=v_item->>'field_name'
    order by created_at desc limit 1;
    insert into public.evidence_field_observations (
      evidence_version_id,field_name,raw_value,normalized_value,source_page,source_quote,source_bbox,
      confidence,observation_type,supersedes_observation_id,observed_by
    ) values (
      p_evidence_version_id,v_item->>'field_name',v_item->'value',coalesce(v_item->'normalized_value',v_item->'value'),
      nullif(v_item->>'source_page','')::integer,v_item->>'source_quote',v_item->'source_bbox',1,'corrected',v_previous,v_actor
    );
  end loop;

  if jsonb_array_length(p_corrections)>0 then
    select coalesce(array_agg(missing_field),'{}'::text[]) into v_missing
    from unnest(coalesce(v_required,'{}'::text[])) missing_field
    where not exists (select 1 from public.evidence_field_observations o where o.evidence_version_id=p_evidence_version_id and o.field_name=missing_field and coalesce(o.normalized_value,o.raw_value) is not null);
    insert into public.evidence_validation_runs(evidence_version_id,validator_version,status,completeness,completed_at)
    values(p_evidence_version_id,'canonical-validation-v1',case when cardinality(v_missing)=0 then 'passed' else 'needs_review' end,
      case when cardinality(v_required)=0 then 1 else (cardinality(v_required)-cardinality(v_missing))::numeric/cardinality(v_required) end,now())
    returning id,status into v_validation_run,v_validation_status;
    if cardinality(v_missing)>0 then
      insert into public.evidence_validation_results(validation_run_id,rule_code,outcome,severity,message,details)
      values(v_validation_run,'required_fields','needs_review','error','Required evidence fields are missing',jsonb_build_object('missing_fields',v_missing));
    end if;
  else
    select status into v_validation_status from public.evidence_validation_runs where evidence_version_id=p_evidence_version_id order by created_at desc,id desc limit 1;
  end if;
  select coalesce(array_agg(required_field),'{}'::text[]) into v_low_confidence
  from unnest(coalesce(v_required,'{}'::text[])) required_field
  join lateral (
    select confidence,observation_type from public.evidence_field_observations
    where evidence_version_id=p_evidence_version_id and field_name=required_field
    order by created_at desc,id desc limit 1
  ) latest on true
  where latest.observation_type='extracted' and coalesce(latest.confidence,0)<0.70;
  if cardinality(v_low_confidence)>0 then
    raise exception 'Low-confidence critical fields require correction before verification: %',array_to_string(v_low_confidence,', ');
  end if;
  if coalesce(v_validation_status,'needs_review')<>'passed' then
    raise exception 'Evidence validation must pass before verification';
  end if;

  select coalesce((select require_four_eyes from public.evidence_review_policies where buyer_id=v_request.buyer_id),false) into v_four_eyes;
  insert into public.evidence_attestations (evidence_version_id,organization_id,organization_type,attestation_type,outcome,actor_id,notes,policy_snapshot)
  values (p_evidence_version_id,v_request.buyer_id,'buyer','buyer_verification','accepted',v_actor,p_notes,
    jsonb_build_object('request_id',p_request_id,'four_eyes',v_four_eyes));

  if p_approve and not v_four_eyes then
    insert into public.evidence_attestations (evidence_version_id,organization_id,organization_type,attestation_type,outcome,actor_id,notes,policy_snapshot)
    values (p_evidence_version_id,v_request.buyer_id,'buyer','buyer_acceptance','accepted',v_actor,p_notes,jsonb_build_object('request_id',p_request_id));
    update public.request_evidence_links set relation='accepted',qualification='eligible',qualification_reasons='{}'::text[],decided_by=v_actor,decided_at=now()
    where request_id=p_request_id and evidence_version_id=p_evidence_version_id;
    update public.document_requests set status='approved',fulfillment_status=case when exists (
      select 1 from public.document_uploads where request_id=p_request_id
    ) then 'fulfilled_new_upload' else 'fulfilled_existing' end,updated_at=now() where id=p_request_id;
  elsif p_approve and v_four_eyes then
    insert into public.compliance_tasks (buyer_id,supplier_id,subject_type,subject_id,request_id,evidence_version_id,task_type,title,description,due_date,status,created_by)
    values (v_request.buyer_id,v_request.supplier_id,'supplier',v_request.supplier_id,p_request_id,p_evidence_version_id,'approval',
      'Approve verified evidence',concat('Final approval required for request ',p_request_id),v_request.due_date::date,'open',v_actor)
    returning id into v_task;
  end if;

  insert into public.evidence_resolution_events (request_id,buyer_id,supplier_id,evidence_version_id,event_type,actor_id,metadata)
  values (p_request_id,v_request.buyer_id,v_request.supplier_id,p_evidence_version_id,'evidence_reviewed',v_actor,
    jsonb_build_object('approved',p_approve and not v_four_eyes,'four_eyes',v_four_eyes,'task_id',v_task,'corrections',jsonb_array_length(p_corrections)));
  return jsonb_build_object('verified',true,'approved',p_approve and not v_four_eyes,'four_eyes_required',v_four_eyes,'approval_task_id',v_task);
end;
$$;

create or replace function public.approve_verified_evidence_v1(
  p_task_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_task public.compliance_tasks%rowtype;
  v_request public.document_requests%rowtype;
  v_verifier uuid;
begin
  select * into v_task from public.compliance_tasks where id=p_task_id for update;
  if v_task.id is null or v_task.task_type<>'approval' or v_task.request_id is null or v_task.evidence_version_id is null then
    raise exception 'Evidence approval task not found';
  end if;
  if v_task.status not in ('open','in_progress') then raise exception 'Evidence approval task is not open'; end if;
  if not private.has_organization_access(v_actor,v_task.buyer_id,'buyer') then raise exception 'Buyer access required'; end if;
  if not (
    exists (select 1 from public.buyers where id=v_task.buyer_id and profile_id=v_actor)
    or exists (select 1 from public.company_users where profile_id=v_actor and company_id=v_task.buyer_id
      and company_type='buyer' and status='active' and role::text in ('company_admin','approver'))
  ) then raise exception 'Evidence approver role required'; end if;
  if v_task.assignee_id is not null and v_task.assignee_id<>v_actor then raise exception 'This approval is assigned to another reviewer'; end if;
  select * into v_request from public.document_requests where id=v_task.request_id for update;
  select actor_id into v_verifier
  from public.evidence_attestations
  where evidence_version_id=v_task.evidence_version_id and organization_id=v_task.buyer_id
    and attestation_type='buyer_verification' and outcome='accepted'
    and policy_snapshot->>'request_id'=v_task.request_id::text
  order by created_at desc,id desc limit 1;
  if v_verifier is null then raise exception 'Buyer verification is required before approval'; end if;
  if v_verifier=v_actor then raise exception 'Four-eyes policy requires a different final approver'; end if;
  if exists (
    select 1 from public.evidence_attestations
    where evidence_version_id=v_task.evidence_version_id and organization_id=v_task.buyer_id
      and attestation_type='buyer_acceptance' and outcome='accepted'
      and policy_snapshot->>'request_id'=v_task.request_id::text
  ) then raise exception 'This submission is already approved'; end if;

  insert into public.evidence_attestations (
    evidence_version_id,organization_id,organization_type,attestation_type,outcome,actor_id,notes,policy_snapshot
  ) values (
    v_task.evidence_version_id,v_task.buyer_id,'buyer','buyer_acceptance','accepted',v_actor,p_notes,
    jsonb_build_object('request_id',v_task.request_id,'four_eyes',true,'verification_actor_id',v_verifier,'task_id',p_task_id)
  );
  update public.request_evidence_links
  set relation='accepted',qualification='eligible',qualification_reasons='{}'::text[],decided_by=v_actor,decided_at=now()
  where request_id=v_task.request_id and evidence_version_id=v_task.evidence_version_id;
  update public.document_requests
  set status='approved',fulfillment_status=case when exists (
    select 1 from public.document_uploads where request_id=v_task.request_id
  ) then 'fulfilled_new_upload' else 'fulfilled_existing' end,updated_at=now()
  where id=v_task.request_id;
  update public.compliance_tasks
  set status='done',completed_by=v_actor,completed_at=now(),updated_at=now()
  where id=p_task_id;
  insert into public.evidence_resolution_events (
    request_id,buyer_id,supplier_id,evidence_version_id,event_type,actor_id,metadata
  ) values (
    v_task.request_id,v_task.buyer_id,v_task.supplier_id,v_task.evidence_version_id,'evidence_approved',v_actor,
    jsonb_build_object('task_id',p_task_id,'verification_actor_id',v_verifier,'four_eyes',true)
  );
  insert into public.compliance_domain_events (buyer_id,subject_type,subject_id,event_type,payload)
  values (v_task.buyer_id,v_task.subject_type,v_task.subject_id,'task_completed',jsonb_build_object('task_id',p_task_id,'evidence_version_id',v_task.evidence_version_id));
  return jsonb_build_object('approved',true,'request_id',v_task.request_id,'evidence_version_id',v_task.evidence_version_id);
end;
$$;

revoke all on function public.preflight_document_requests_v1(uuid,jsonb) from public,anon;
revoke all on function public.finalize_canonical_upload_v1(text,uuid,text,text,text,text,jsonb,jsonb) from public,anon;
revoke all on function public.record_canonical_extraction_v1(uuid,jsonb) from public,anon,authenticated;
revoke all on function public.create_document_request_v2(jsonb) from public,anon;
revoke all on function public.create_document_requests_v2(jsonb) from public,anon;
revoke all on function public.resolve_document_request_v1(uuid,text,uuid,text) from public,anon;
revoke all on function public.review_evidence_v2(uuid,uuid,jsonb,boolean,text) from public,anon;
revoke all on function public.approve_verified_evidence_v1(uuid,text) from public,anon;
grant execute on function public.preflight_document_requests_v1(uuid,jsonb) to authenticated,service_role;
grant execute on function public.finalize_canonical_upload_v1(text,uuid,text,text,text,text,jsonb,jsonb) to authenticated,service_role;
grant execute on function public.record_canonical_extraction_v1(uuid,jsonb) to service_role;
grant execute on function public.create_document_request_v2(jsonb) to authenticated,service_role;
grant execute on function public.create_document_requests_v2(jsonb) to authenticated,service_role;
grant execute on function public.resolve_document_request_v1(uuid,text,uuid,text) to authenticated,service_role;
grant execute on function public.review_evidence_v2(uuid,uuid,jsonb,boolean,text) to authenticated,service_role;
grant execute on function public.approve_verified_evidence_v1(uuid,text) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- 7. Additive backfill. Assets are linked without moving files; hash hydration
-- is performed asynchronously by the canonical upload processor.
-- ---------------------------------------------------------------------------

insert into public.document_assets (
  supplier_id,storage_path,original_file_name,mime_type,file_size,uploaded_by,
  legacy_document_upload_id,created_at,malware_scan_status
)
select dr.supplier_id,du.file_path,du.file_name,du.mime_type,du.file_size,du.uploader_id,du.id,du.created_at,'not_available'
from public.document_uploads du
join public.document_requests dr on dr.id=du.request_id
where dr.supplier_id is not null
on conflict (legacy_document_upload_id) do nothing;

insert into public.document_asset_sources (document_asset_id,source_type,source_id,storage_path,linked_by,linked_at)
select da.id,'document_upload',du.id,du.file_path,du.uploader_id,du.created_at
from public.document_assets da join public.document_uploads du on du.id=da.legacy_document_upload_id
on conflict (source_type,source_id) do nothing;

insert into public.canonical_migration_exceptions (source_table,source_id,reason)
select 'document_uploads',du.id,'missing_supplier_or_request'
from public.document_uploads du left join public.document_requests dr on dr.id=du.request_id
where dr.id is null or dr.supplier_id is null
on conflict (source_table,source_id) do nothing;

insert into public.document_assets (
  supplier_id,storage_path,original_file_name,mime_type,file_size,uploaded_by,
  legacy_supplier_library_id,created_at,malware_scan_status
)
select supplier_id,file_path,document_name,mime_type,file_size,uploaded_by,id,created_at,'not_available'
from public.supplier_document_library
on conflict (legacy_supplier_library_id) do nothing;

insert into public.document_asset_sources (document_asset_id,source_type,source_id,storage_path,linked_by,linked_at)
select da.id,'supplier_library',sdl.id,sdl.file_path,sdl.uploaded_by,sdl.created_at
from public.document_assets da join public.supplier_document_library sdl on sdl.id=da.legacy_supplier_library_id
on conflict (source_type,source_id) do nothing;

insert into public.evidence_records (
  supplier_id,canonical_document_type,display_name,legacy_document_upload_id,created_by,created_at
)
select da.supplier_id,private.normalize_document_type_code(dr.document_type),coalesce(du.document_name,du.file_name,dr.title),du.id,du.uploader_id,du.created_at
from public.document_assets da
join public.document_uploads du on du.id=da.legacy_document_upload_id
join public.document_requests dr on dr.id=du.request_id
where not exists (select 1 from public.evidence_versions ev where ev.document_asset_id=da.id);

insert into public.evidence_versions (
  evidence_record_id,document_asset_id,version_number,lifecycle_status,issue_date,expiry_date,
  standards,extraction_model_version,legacy_evidence_claim_id,created_by,created_at
)
select er.id,da.id,1,
  case when ec.status='rejected' then 'rejected' else 'current' end,
  ec.issue_date,coalesce(ec.expiry_date,du.expiration_date),coalesce(ec.standards,'{}'::text[]),
  ec.extraction_model_version,ec.id,du.uploader_id,du.created_at
from public.document_assets da
join public.document_uploads du on du.id=da.legacy_document_upload_id
join public.document_requests dr on dr.id=du.request_id
join lateral (
  select r.id from public.evidence_records r
  where r.legacy_document_upload_id=du.id
  order by r.id limit 1
) er on true
left join lateral (
  select claim.* from public.evidence_claims claim
  where claim.document_upload_id=du.id order by claim.created_at desc,claim.id limit 1
) ec on true
where not exists (select 1 from public.evidence_versions x where x.document_asset_id=da.id);

insert into public.evidence_records (
  supplier_id,canonical_document_type,display_name,legacy_supplier_library_id,created_by,created_at
)
select da.supplier_id,private.normalize_document_type_code(sdl.document_type),sdl.document_name,sdl.id,sdl.uploaded_by,sdl.created_at
from public.document_assets da
join public.supplier_document_library sdl on sdl.id=da.legacy_supplier_library_id
where not exists (select 1 from public.evidence_versions ev where ev.document_asset_id=da.id);

insert into public.evidence_versions (
  evidence_record_id,document_asset_id,version_number,lifecycle_status,expiry_date,created_by,created_at
)
select er.id,da.id,greatest(sdl.version,1),case when sdl.is_current_version then 'current' else 'superseded' end,
  sdl.expiration_date,sdl.uploaded_by,sdl.created_at
from public.document_assets da
join public.supplier_document_library sdl on sdl.id=da.legacy_supplier_library_id
join lateral (
  select r.id from public.evidence_records r
  where r.legacy_supplier_library_id=sdl.id
  order by r.id limit 1
) er on true
where not exists (select 1 from public.evidence_versions x where x.document_asset_id=da.id);

update public.document_uploads du set
  canonical_document_asset_id=da.id,
  canonical_evidence_version_id=ev.id
from public.document_assets da
left join public.evidence_versions ev on ev.document_asset_id=da.id
where da.legacy_document_upload_id=du.id;

update public.supplier_document_library sdl set
  canonical_document_asset_id=da.id,
  canonical_evidence_version_id=ev.id,
  canonical_evidence_record_id=ev.evidence_record_id
from public.document_assets da
left join public.evidence_versions ev on ev.document_asset_id=da.id
where da.legacy_supplier_library_id=sdl.id;

update public.evidence_claims ec set canonical_evidence_version_id=du.canonical_evidence_version_id
from public.document_uploads du
where du.id=ec.document_upload_id and du.canonical_evidence_version_id is not null;

insert into public.request_evidence_links (
  request_id,evidence_version_id,relation,qualification,qualification_reasons,selected_by,selected_at,decided_by,decided_at
)
select dr.id,du.canonical_evidence_version_id,
  case when dr.status='approved' and ec.status='verified' then 'accepted' else 'submitted' end,
  case when ec.status='verified' then 'eligible' else 'potential' end,
  case when ec.status='verified' then '{}'::text[] else array['verification_required']::text[] end,
  du.uploader_id,du.created_at,
  case when dr.status='approved' and ec.status='verified' then coalesce(ec.verified_by,dr.requester_id) end,
  case when dr.status='approved' and ec.status='verified' then coalesce(ec.verified_at,du.updated_at) end
from public.document_uploads du
join public.document_requests dr on dr.id=du.request_id
left join lateral (
  select claim.* from public.evidence_claims claim where claim.document_upload_id=du.id
  order by claim.created_at desc,claim.id limit 1
) ec on true
where du.canonical_evidence_version_id is not null
  and du.id=(select latest.id from public.document_uploads latest where latest.request_id=dr.id order by latest.created_at desc,latest.id desc limit 1)
  and not exists (select 1 from public.request_evidence_links link where link.request_id=dr.id and link.evidence_version_id=du.canonical_evidence_version_id);

insert into public.evidence_field_observations (
  evidence_version_id,field_name,raw_value,normalized_value,source_page,source_quote,confidence,
  extraction_model_version,observation_type,created_at
)
select ec.canonical_evidence_version_id,v.field_name,to_jsonb(v.field_value),to_jsonb(v.field_value),
  ec.source_page,ec.source_text,ec.confidence,ec.extraction_model_version,'extracted',ec.created_at
from public.evidence_claims ec
cross join lateral (values
  ('issuer',ec.issuer),('certificate_number',ec.certificate_number),
  ('issue_date',ec.issue_date::text),('expiry_date',ec.expiry_date::text)
) v(field_name,field_value)
where ec.canonical_evidence_version_id is not null and v.field_value is not null
  and not exists (
    select 1 from public.evidence_field_observations o
    where o.evidence_version_id=ec.canonical_evidence_version_id and o.field_name=v.field_name
  );

insert into public.evidence_validation_runs(evidence_version_id,validator_version,status,completeness,completed_at,created_at)
select ev.id,'canonical-validation-v1',
  case when missing.missing_count=0 then 'passed' else 'needs_review' end,
  case when cardinality(d.required_fields)=0 then 1
    else (cardinality(d.required_fields)-missing.missing_count)::numeric/cardinality(d.required_fields) end,
  now(),now()
from public.evidence_versions ev
join public.evidence_records er on er.id=ev.evidence_record_id
join public.document_type_definitions d on d.code=er.canonical_document_type
cross join lateral (
  select count(*)::integer missing_count
  from unnest(d.required_fields) required_field
  where not exists (select 1 from public.evidence_field_observations o where o.evidence_version_id=ev.id and o.field_name=required_field and coalesce(o.normalized_value,o.raw_value) is not null)
) missing
where not exists(select 1 from public.evidence_validation_runs vr where vr.evidence_version_id=ev.id);

insert into public.evidence_validation_results(validation_run_id,rule_code,outcome,severity,message,details)
select vr.id,'required_fields','needs_review','error','Required evidence fields are missing',
  jsonb_build_object('missing_fields',to_jsonb(array(
    select required_field from unnest(d.required_fields) required_field
    where not exists(select 1 from public.evidence_field_observations o where o.evidence_version_id=vr.evidence_version_id and o.field_name=required_field and coalesce(o.normalized_value,o.raw_value) is not null)
  )))
from public.evidence_validation_runs vr
join public.evidence_versions ev on ev.id=vr.evidence_version_id
join public.evidence_records er on er.id=ev.evidence_record_id
join public.document_type_definitions d on d.code=er.canonical_document_type
where vr.validator_version='canonical-validation-v1' and vr.status='needs_review'
  and not exists(select 1 from public.evidence_validation_results result where result.validation_run_id=vr.id and result.rule_code='required_fields');

update public.evidence_versions ev set validation_completeness=(
  select vr.completeness from public.evidence_validation_runs vr
  where vr.evidence_version_id=ev.id order by vr.created_at desc,vr.id desc limit 1
)
where exists(select 1 from public.evidence_validation_runs vr where vr.evidence_version_id=ev.id);

insert into public.evidence_attestations (
  evidence_version_id,organization_id,organization_type,attestation_type,outcome,actor_id,notes,created_at
)
select ec.canonical_evidence_version_id,ec.buyer_id,'buyer',
  case when ec.status='rejected' then 'rejection' else 'buyer_verification' end,
  case when ec.status='rejected' then 'rejected' else 'accepted' end,
  coalesce(ec.verified_by,du.uploader_id),ec.rejected_reason,coalesce(ec.verified_at,ec.updated_at)
from public.evidence_claims ec
join public.document_uploads du on du.id=ec.document_upload_id
where ec.canonical_evidence_version_id is not null and ec.status in ('verified','rejected')
  and not exists (
    select 1 from public.evidence_attestations ea
    where ea.evidence_version_id=ec.canonical_evidence_version_id
      and ea.organization_id=ec.buyer_id
      and ea.attestation_type=case when ec.status='rejected' then 'rejection' else 'buyer_verification' end
  );

insert into public.evidence_attestations (
  evidence_version_id,organization_id,organization_type,attestation_type,outcome,actor_id,notes,policy_snapshot,created_at
)
select link.evidence_version_id,dr.buyer_id,'buyer','buyer_acceptance','accepted',coalesce(link.decided_by,dr.requester_id),
  'Backfilled from an approved legacy document request',jsonb_build_object('request_id',dr.id,'legacy_backfill',true),coalesce(link.decided_at,dr.updated_at)
from public.request_evidence_links link join public.document_requests dr on dr.id=link.request_id
where link.relation='accepted'
  and not exists (select 1 from public.evidence_attestations ea where ea.evidence_version_id=link.evidence_version_id and ea.organization_id=dr.buyer_id and ea.attestation_type='buyer_acceptance');

-- Preserve legacy assignments in the shared compliance task queue. Legacy rows
-- remain readable as compatibility sources, but canonical review creates only
-- compliance_tasks from this point forward.
insert into public.compliance_tasks (
  buyer_id,supplier_id,subject_type,subject_id,request_id,evidence_version_id,
  legacy_document_assignment_id,task_type,title,description,assignee_id,due_date,
  status,created_by,created_at,completed_by,completed_at,updated_at
)
select
  dr.buyer_id,dr.supplier_id,'supplier',dr.supplier_id,dr.id,du.canonical_evidence_version_id,
  assignment.id,
  case when assignment.assignment_type in ('approve','final_sign_off') then 'approval' else 'review' end,
  concat('Review ',coalesce(du.document_name,du.file_name,dr.title)),assignment.notes,assignment.assigned_to,
  assignment.due_date::date,
  case assignment.status when 'completed' then 'done' when 'declined' then 'cancelled' when 'in_progress' then 'in_progress' else 'open' end,
  assignment.assigned_by,assignment.created_at,
  case when assignment.status='completed' then assignment.assigned_to end,
  case when assignment.status='completed' then coalesce(assignment.completed_at,assignment.updated_at) end,
  assignment.updated_at
from public.document_assignments assignment
join public.document_uploads du on du.id=assignment.document_upload_id
join public.document_requests dr on dr.id=du.request_id
join public.profiles creator on creator.id=assignment.assigned_by
join public.profiles assignee on assignee.id=assignment.assigned_to
where dr.buyer_id is not null and dr.supplier_id is not null
  and not exists (
  select 1 from public.compliance_tasks task where task.legacy_document_assignment_id=assignment.id
);

insert into public.canonical_asset_hash_jobs(document_asset_id)
select id from public.document_assets where content_sha256 is null
on conflict(document_asset_id) do nothing;

insert into public.feature_flags (key,description,default_enabled,lifecycle)
values ('canonical_evidence_v1','Canonical supplier-owned evidence, request reuse, and unified review',false,'development')
on conflict (key) do update set description=excluded.description,lifecycle=excluded.lifecycle;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='process-compliance-reevaluations';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end;
$$;

select cron.schedule(
  'process-compliance-reevaluations','*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-compliance-reevaluations-v1',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-System-Secret',(select decrypted_secret from vault.decrypted_secrets where name='system_cron_invocation')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='process-canonical-asset-hashes';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end;
$$;

select cron.schedule(
  'process-canonical-asset-hashes','*/3 * * * *',
  $$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-canonical-asset-hash-jobs-v1',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-System-Secret',(select decrypted_secret from vault.decrypted_secrets where name='system_cron_invocation')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);

comment on table public.document_assets is 'Immutable supplier-scoped physical file identity. Storage objects are never moved during canonical backfill.';
comment on table public.evidence_records is 'Supplier-owned logical evidence identity reused across requests and buyers.';
comment on table public.evidence_versions is 'Immutable canonical evidence versions; organizational trust is stored separately as attestations.';
