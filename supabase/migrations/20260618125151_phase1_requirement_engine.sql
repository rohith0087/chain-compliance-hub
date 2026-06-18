-- Phase 1 requirement engine. Development-only until the Phase 0 exit gate passes.

create table public.requirement_frameworks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9-]{1,63}$'),
  name text not null,
  description text,
  framework_type text not null check (framework_type in ('regulatory', 'internal', 'organization')),
  owner_buyer_id uuid references public.buyers(id) on delete cascade,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (framework_type = 'organization' and owner_buyer_id is not null)
    or (framework_type <> 'organization' and owner_buyer_id is null)
  )
);

create table public.requirement_framework_versions (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.requirement_frameworks(id) on delete cascade,
  version text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'superseded', 'retired')),
  effective_from date not null,
  effective_to date,
  source_urls jsonb not null default '[]'::jsonb check (jsonb_typeof(source_urls) = 'array'),
  content_hash text not null,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (framework_id, version),
  check (effective_to is null or effective_to >= effective_from),
  check (
    status = 'draft'
    or (
      reviewed_by is not null
      and reviewed_at is not null
      and published_at is not null
      and jsonb_array_length(source_urls) > 0
    )
  )
);

create table public.requirement_jurisdictions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  subdivision_code text,
  created_at timestamptz not null default now()
);

create table public.requirements (
  id uuid primary key default gen_random_uuid(),
  framework_id uuid not null references public.requirement_frameworks(id) on delete cascade,
  stable_key text not null,
  subject_types text[] not null check (
    cardinality(subject_types) > 0
    and subject_types <@ array['supplier', 'facility', 'product']::text[]
  ),
  created_at timestamptz not null default now(),
  unique (framework_id, stable_key)
);

create table public.requirement_versions (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  framework_version_id uuid not null references public.requirement_framework_versions(id) on delete cascade,
  jurisdiction_id uuid references public.requirement_jurisdictions(id),
  title text not null,
  description text not null,
  citation text,
  source_url text,
  applicability_rule jsonb not null check (jsonb_typeof(applicability_rule) = 'object'),
  required_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(required_evidence) = 'array'),
  explanation_template text not null,
  effective_from date not null,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (requirement_id, framework_version_id),
  check (effective_to is null or effective_to >= effective_from)
);

create table public.company_requirement_configurations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  configuration jsonb not null default '{}'::jsonb check (jsonb_typeof(configuration) = 'object'),
  display_order integer not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_id, requirement_id)
);

create table public.legacy_requirement_mappings (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  source_type text not null check (source_type in ('default_document_requirement', 'onboarding_document_requirement')),
  source_id uuid not null,
  requirement_key text not null,
  evidence_definition jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence_definition) = 'object'),
  created_at timestamptz not null default now(),
  unique (buyer_id, source_type, source_id)
);

create table public.requirement_evaluations (
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

create table public.requirement_evaluation_results (
  id uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.requirement_evaluations(id) on delete cascade,
  requirement_version_id uuid references public.requirement_versions(id),
  legacy_mapping_id uuid references public.legacy_requirement_mappings(id),
  framework_code text not null,
  framework_version text not null,
  requirement_key text not null,
  title text not null,
  outcome text not null check (outcome in ('applies', 'does_not_apply', 'indeterminate')),
  explanation text not null,
  matched_facts jsonb not null default '{}'::jsonb check (jsonb_typeof(matched_facts) = 'object'),
  missing_inputs jsonb not null default '[]'::jsonb check (jsonb_typeof(missing_inputs) = 'array'),
  citation text,
  source_url text,
  required_evidence jsonb not null default '[]'::jsonb check (jsonb_typeof(required_evidence) = 'array'),
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  unique (evaluation_id, framework_code, requirement_key, framework_version)
);

create index requirement_framework_versions_effective_idx
  on public.requirement_framework_versions(status, effective_from, effective_to);
create index requirement_versions_effective_idx
  on public.requirement_versions(effective_from, effective_to);
create index requirement_evaluations_subject_idx
  on public.requirement_evaluations(buyer_id, subject_type, subject_id, created_at desc);
create index requirement_evaluation_results_evaluation_idx
  on public.requirement_evaluation_results(evaluation_id);

alter table public.requirement_frameworks enable row level security;
alter table public.requirement_framework_versions enable row level security;
alter table public.requirement_jurisdictions enable row level security;
alter table public.requirements enable row level security;
alter table public.requirement_versions enable row level security;
alter table public.company_requirement_configurations enable row level security;
alter table public.legacy_requirement_mappings enable row level security;
alter table public.requirement_evaluations enable row level security;
alter table public.requirement_evaluation_results enable row level security;

create or replace function private.is_platform_administrator(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_administrators pa
    where pa.auth_user_id = _user_id and pa.is_active = true
  );
$$;

revoke all on function private.is_platform_administrator(uuid) from public;
grant execute on function private.is_platform_administrator(uuid) to authenticated, service_role;

create policy "Members can read accessible requirement frameworks"
on public.requirement_frameworks for select to authenticated
using (
  owner_buyer_id is null
  or private.has_organization_access(auth.uid(), owner_buyer_id, 'buyer')
  or private.is_platform_administrator(auth.uid())
);

create policy "Members can read published framework versions"
on public.requirement_framework_versions for select to authenticated
using (
  status in ('published', 'superseded', 'retired')
  or private.is_platform_administrator(auth.uid())
  or exists (
    select 1 from public.requirement_frameworks rf
    where rf.id = framework_id
      and rf.owner_buyer_id is not null
      and private.has_organization_access(auth.uid(), rf.owner_buyer_id, 'buyer')
  )
);

create policy "Authenticated users can read jurisdictions"
on public.requirement_jurisdictions for select to authenticated using (true);

create policy "Members can read accessible requirements"
on public.requirements for select to authenticated
using (
  exists (
    select 1 from public.requirement_frameworks rf
    where rf.id = framework_id
      and (
        rf.owner_buyer_id is null
        or private.has_organization_access(auth.uid(), rf.owner_buyer_id, 'buyer')
        or private.is_platform_administrator(auth.uid())
      )
  )
);

create policy "Members can read published requirement versions"
on public.requirement_versions for select to authenticated
using (
  exists (
    select 1
    from public.requirement_framework_versions rfv
    join public.requirement_frameworks rf on rf.id = rfv.framework_id
    where rfv.id = framework_version_id
      and (
        rfv.status in ('published', 'superseded', 'retired')
        or private.is_platform_administrator(auth.uid())
        or (
          rf.owner_buyer_id is not null
          and private.has_organization_access(auth.uid(), rf.owner_buyer_id, 'buyer')
        )
      )
  )
);

create policy "Buyer members can read requirement configurations"
on public.company_requirement_configurations for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create policy "Buyer members can read legacy mappings"
on public.legacy_requirement_mappings for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create policy "Buyer members can read requirement evaluations"
on public.requirement_evaluations for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create policy "Buyer members can read requirement evaluation results"
on public.requirement_evaluation_results for select to authenticated
using (
  exists (
    select 1 from public.requirement_evaluations re
    where re.id = evaluation_id
      and private.has_organization_access(auth.uid(), re.buyer_id, 'buyer')
  )
);

revoke all on table
  public.requirement_frameworks,
  public.requirement_framework_versions,
  public.requirement_jurisdictions,
  public.requirements,
  public.requirement_versions,
  public.company_requirement_configurations,
  public.legacy_requirement_mappings,
  public.requirement_evaluations,
  public.requirement_evaluation_results
from public, anon, authenticated;

grant select on table
  public.requirement_frameworks,
  public.requirement_framework_versions,
  public.requirement_jurisdictions,
  public.requirements,
  public.requirement_versions,
  public.company_requirement_configurations,
  public.legacy_requirement_mappings,
  public.requirement_evaluations,
  public.requirement_evaluation_results
to authenticated;

grant all on table
  public.requirement_frameworks,
  public.requirement_framework_versions,
  public.requirement_jurisdictions,
  public.requirements,
  public.requirement_versions,
  public.company_requirement_configurations,
  public.legacy_requirement_mappings,
  public.requirement_evaluations,
  public.requirement_evaluation_results
to service_role;

create or replace function private.protect_requirement_evaluation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Requirement evaluations and results are immutable';
end;
$$;

create trigger protect_requirement_evaluations
before update or delete on public.requirement_evaluations
for each row execute function private.protect_requirement_evaluation();

create trigger protect_requirement_evaluation_results
before update or delete on public.requirement_evaluation_results
for each row execute function private.protect_requirement_evaluation();

create or replace function private.protect_published_framework_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'Published framework versions cannot be deleted';
  end if;

  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if new.framework_id is distinct from old.framework_id
      or new.version is distinct from old.version
      or new.effective_from is distinct from old.effective_from
      or new.effective_to is distinct from old.effective_to
      or new.source_urls is distinct from old.source_urls
      or new.content_hash is distinct from old.content_hash
      or new.reviewed_by is distinct from old.reviewed_by
      or new.reviewed_at is distinct from old.reviewed_at
      or new.published_at is distinct from old.published_at
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'Published framework version content is immutable';
    end if;

    if not (
      new.status = old.status
      or (old.status = 'published' and new.status in ('superseded', 'retired'))
      or (old.status = 'superseded' and new.status = 'retired')
    ) then
      raise exception 'Invalid published framework version status transition';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger protect_published_framework_versions
before update or delete on public.requirement_framework_versions
for each row execute function private.protect_published_framework_version();

create or replace function private.validate_framework_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status in ('published', 'superseded', 'retired') then
    if new.reviewed_by is null or not private.is_platform_administrator(new.reviewed_by) then
      raise exception 'A current platform administrator must review published framework versions';
    end if;
    if new.reviewed_at is null or new.published_at is null then
      raise exception 'Review and publication timestamps are required';
    end if;
    if jsonb_typeof(new.source_urls) <> 'array'
      or jsonb_array_length(new.source_urls) = 0
      or exists (
        select 1 from jsonb_array_elements(new.source_urls) as source(value)
        where jsonb_typeof(source.value) <> 'string'
          or source.value #>> '{}' !~ '^https://'
      )
    then
      raise exception 'At least one HTTPS source URL is required for publication';
    end if;
    if not exists (
      select 1 from public.requirement_versions rv
      where rv.framework_version_id = new.id
    ) then
      raise exception 'At least one requirement is required for publication';
    end if;
    if exists (
      select 1 from public.requirement_versions rv
      where rv.framework_version_id = new.id
        and (
          rv.citation is null
          or btrim(rv.citation) = ''
          or rv.source_url is null
          or rv.source_url !~ '^https://'
        )
    ) then
      raise exception 'Every published requirement requires a citation and HTTPS source URL';
    end if;
  end if;
  return new;
end;
$$;

create trigger validate_framework_publication
before insert or update on public.requirement_framework_versions
for each row execute function private.validate_framework_publication();

create or replace function private.protect_published_requirement_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT' then
    select status into v_status
    from public.requirement_framework_versions
    where id = new.framework_version_id;

    if v_status <> 'draft' then
      raise exception 'Requirements cannot be added to a published framework version';
    end if;
    return new;
  end if;

  select status into v_status
  from public.requirement_framework_versions
  where id = old.framework_version_id;

  if v_status <> 'draft' then
    raise exception 'Published requirement versions are immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger protect_published_requirement_versions
before insert or update or delete on public.requirement_versions
for each row execute function private.protect_published_requirement_version();

create or replace function public.publish_requirement_framework_version_v1(
  p_framework_version_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;
  if not private.is_platform_administrator(p_actor_id) then
    raise exception 'An active platform administrator must publish requirement versions';
  end if;

  update public.requirement_framework_versions
  set status = 'published',
      reviewed_by = p_actor_id,
      reviewed_at = now(),
      published_at = now(),
      updated_at = now()
  where id = p_framework_version_id
    and status = 'draft';

  if not found then
    raise exception 'Draft framework version not found';
  end if;
end;
$$;

revoke all on function public.publish_requirement_framework_version_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.publish_requirement_framework_version_v1(uuid, uuid) to service_role;

create or replace function public.record_requirement_evaluation_v1(
  p_evaluation jsonb,
  p_results jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;

  insert into public.requirement_evaluations (
    buyer_id, subject_type, subject_id, effective_at, input_snapshot,
    request_hash, evaluator_version, actor_id, idempotency_key, correlation_id
  ) values (
    (p_evaluation->>'buyer_id')::uuid,
    p_evaluation->>'subject_type',
    (p_evaluation->>'subject_id')::uuid,
    (p_evaluation->>'effective_at')::date,
    p_evaluation->'input_snapshot',
    p_evaluation->>'request_hash',
    p_evaluation->>'evaluator_version',
    (p_evaluation->>'actor_id')::uuid,
    p_evaluation->>'idempotency_key',
    p_evaluation->>'correlation_id'
  )
  returning id into v_id;

  insert into public.requirement_evaluation_results (
    evaluation_id, requirement_version_id, legacy_mapping_id,
    framework_code, framework_version, requirement_key, title, outcome,
    explanation, matched_facts, missing_inputs, citation, source_url,
    required_evidence, effective_from, effective_to
  )
  select
    v_id,
    nullif(item->>'requirement_version_id', '')::uuid,
    nullif(item->>'legacy_mapping_id', '')::uuid,
    item->>'framework_code',
    item->>'framework_version',
    item->>'requirement_key',
    item->>'title',
    item->>'outcome',
    item->>'explanation',
    coalesce(item->'matched_facts', '{}'::jsonb),
    coalesce(item->'missing_inputs', '[]'::jsonb),
    item->>'citation',
    item->>'source_url',
    coalesce(item->'required_evidence', '[]'::jsonb),
    nullif(item->>'effective_from', '')::date,
    nullif(item->>'effective_to', '')::date
  from jsonb_array_elements(p_results) as item;

  return v_id;
end;
$$;

revoke all on function public.record_requirement_evaluation_v1(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.record_requirement_evaluation_v1(jsonb, jsonb) to service_role;

insert into public.requirement_jurisdictions (code, name, country_code)
values ('US', 'United States', 'US')
on conflict (code) do nothing;

insert into public.requirement_frameworks (code, name, description, framework_type)
values
  ('TR2C-LEGACY', 'TraceR2C legacy requirements', 'Compatibility catalog for existing buyer document requirements.', 'internal'),
  ('US-CPSC', 'United States Consumer Product Safety Commission', 'Draft CPSC applicability catalog. Human review is required before publication.', 'regulatory')
on conflict (code) do nothing;

with framework as (
  select id from public.requirement_frameworks where code = 'US-CPSC'
)
insert into public.requirement_framework_versions (
  framework_id, version, status, effective_from, effective_to, source_urls, content_hash
)
select id, version, 'draft', effective_from, effective_to, source_urls, content_hash
from framework
cross join (values
  (
    'CPSC-2025.1', date '2008-11-12', date '2026-07-07',
    '["https://www.cpsc.gov/Business--Manufacturing/Business-Education/Childrens-Products","https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Childrens-Product-Certificate","https://www.cpsc.gov/Business--Manufacturing/Business-Education/tracking-label"]'::jsonb,
    'cpsc-2025.1-draft'
  ),
  (
    'CPSC-2026.1', date '2026-07-08', date '2027-01-07',
    '["https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Certificates"]'::jsonb,
    'cpsc-2026.1-draft'
  ),
  (
    'CPSC-2027.1', date '2027-01-08', null::date,
    '["https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Certificates"]'::jsonb,
    'cpsc-2027.1-draft'
  )
) as versions(version, effective_from, effective_to, source_urls, content_hash)
on conflict (framework_id, version) do nothing;

with framework as (
  select id from public.requirement_frameworks where code = 'US-CPSC'
)
insert into public.requirements (framework_id, stable_key, subject_types)
select id, stable_key, subject_types
from framework
cross join (values
  ('CHILDRENS-PRODUCT-CLASSIFICATION', array['product']::text[]),
  ('CHILDRENS-PRODUCT-CERTIFICATE', array['product']::text[]),
  ('GENERAL-CERTIFICATE-OF-CONFORMITY', array['product']::text[]),
  ('CHILDRENS-PRODUCT-TRACKING-LABEL', array['product']::text[]),
  ('CERTIFICATE-EFILING', array['supplier', 'facility', 'product']::text[])
) as requirements(stable_key, subject_types)
on conflict (framework_id, stable_key) do nothing;

with source as (
  select
    r.id as requirement_id,
    r.stable_key,
    rfv.id as framework_version_id,
    rfv.version,
    rfv.effective_from,
    rfv.effective_to,
    j.id as jurisdiction_id
  from public.requirements r
  join public.requirement_frameworks rf on rf.id = r.framework_id and rf.code = 'US-CPSC'
  join public.requirement_framework_versions rfv on rfv.framework_id = rf.id
  join public.requirement_jurisdictions j on j.code = 'US'
)
insert into public.requirement_versions (
  requirement_id, framework_version_id, jurisdiction_id, title, description,
  citation, source_url, applicability_rule, required_evidence,
  explanation_template, effective_from, effective_to
)
select
  requirement_id,
  framework_version_id,
  jurisdiction_id,
  case stable_key
    when 'CHILDRENS-PRODUCT-CLASSIFICATION' then 'Children''s product classification'
    when 'CHILDRENS-PRODUCT-CERTIFICATE' then 'Children''s Product Certificate (CPC)'
    when 'GENERAL-CERTIFICATE-OF-CONFORMITY' then 'General Certificate of Conformity (GCC)'
    when 'CHILDRENS-PRODUCT-TRACKING-LABEL' then 'Children''s product tracking label'
    else 'CPSC certificate eFiling'
  end,
  case stable_key
    when 'CHILDRENS-PRODUCT-CLASSIFICATION' then 'Classify whether the consumer product is designed or intended primarily for children 12 years of age or younger.'
    when 'CHILDRENS-PRODUCT-CERTIFICATE' then 'Children''s products subject to a CPSC-enforced safety rule require an applicable CPC.'
    when 'GENERAL-CERTIFICATE-OF-CONFORMITY' then 'Covered general-use products require an applicable GCC.'
    when 'CHILDRENS-PRODUCT-TRACKING-LABEL' then 'Children''s products require permanent distinguishing tracking information where practicable.'
    else 'Covered imported products require electronic certificate data filing from the applicable effective date.'
  end,
  case stable_key
    when 'CHILDRENS-PRODUCT-CLASSIFICATION' then '16 CFR part 1200'
    when 'CHILDRENS-PRODUCT-CERTIFICATE' then '15 U.S.C. 2063; 16 CFR part 1110'
    when 'GENERAL-CERTIFICATE-OF-CONFORMITY' then '15 U.S.C. 2063; 16 CFR part 1110'
    when 'CHILDRENS-PRODUCT-TRACKING-LABEL' then '15 U.S.C. 2063(a)(5)'
    else '16 CFR part 1110'
  end,
  case stable_key
    when 'CHILDRENS-PRODUCT-CLASSIFICATION' then 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/Childrens-Products'
    when 'CHILDRENS-PRODUCT-CERTIFICATE' then 'https://www.cpsc.gov/Business--Manufacturing/Testing-Certification/Childrens-Product-Certificate'
    when 'GENERAL-CERTIFICATE-OF-CONFORMITY' then 'https://www.cpsc.gov/node/23947'
    when 'CHILDRENS-PRODUCT-TRACKING-LABEL' then 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/tracking-label'
    else 'https://www.cpsc.gov/Business--Manufacturing/Business-Education/Business-Guidance/Certificates'
  end,
  case
    when stable_key = 'CHILDRENS-PRODUCT-CLASSIFICATION' then
      '{"all":[{"fact":"destination_country","operator":"eq","value":"US"},{"fact":"is_children_product","operator":"present"}]}'::jsonb
    when stable_key = 'CHILDRENS-PRODUCT-CERTIFICATE' then
      '{"all":[{"fact":"destination_country","operator":"eq","value":"US"},{"fact":"consumer_product_under_cpsc","operator":"eq","value":true},{"fact":"is_children_product","operator":"eq","value":true},{"fact":"subject_to_cpsc_rule","operator":"eq","value":true}]}'::jsonb
    when stable_key = 'GENERAL-CERTIFICATE-OF-CONFORMITY' then
      '{"all":[{"fact":"destination_country","operator":"eq","value":"US"},{"fact":"consumer_product_under_cpsc","operator":"eq","value":true},{"fact":"is_children_product","operator":"eq","value":false},{"fact":"subject_to_cpsc_rule","operator":"eq","value":true}]}'::jsonb
    when stable_key = 'CHILDRENS-PRODUCT-TRACKING-LABEL' then
      '{"all":[{"fact":"destination_country","operator":"eq","value":"US"},{"fact":"is_children_product","operator":"eq","value":true}]}'::jsonb
    when stable_key = 'CERTIFICATE-EFILING' and version = 'CPSC-2026.1' then
      '{"all":[{"fact":"destination_country","operator":"eq","value":"US"},{"fact":"domestic_import_status","operator":"eq","value":"imported"},{"fact":"import_entry_mode","operator":"eq","value":"general"},{"fact":"subject_to_cpsc_rule","operator":"eq","value":true}]}'::jsonb
    when stable_key = 'CERTIFICATE-EFILING' and version = 'CPSC-2027.1' then
      '{"all":[{"fact":"destination_country","operator":"eq","value":"US"},{"fact":"domestic_import_status","operator":"eq","value":"imported"},{"fact":"import_entry_mode","operator":"in","value":["general","foreign_trade_zone"]},{"fact":"subject_to_cpsc_rule","operator":"eq","value":true}]}'::jsonb
    else '{"all":[{"fact":"destination_country","operator":"eq","value":"US"},{"fact":"domestic_import_status","operator":"eq","value":"imported"},{"fact":"subject_to_cpsc_rule","operator":"eq","value":true}]}'::jsonb
  end,
  case stable_key
    when 'CHILDRENS-PRODUCT-CERTIFICATE' then '[{"type":"document","document_type":"cpc","name":"Children''s Product Certificate"}]'::jsonb
    when 'GENERAL-CERTIFICATE-OF-CONFORMITY' then '[{"type":"document","document_type":"gcc","name":"General Certificate of Conformity"}]'::jsonb
    when 'CHILDRENS-PRODUCT-TRACKING-LABEL' then '[{"type":"label","document_type":"tracking_label","name":"Product and packaging tracking information"}]'::jsonb
    when 'CERTIFICATE-EFILING' then '[{"type":"data","document_type":"cpsc_efiling_data","name":"Electronic certificate data"}]'::jsonb
    else '[]'::jsonb
  end,
  'Outcome determined from the recorded facts and the cited CPSC rule version.',
  effective_from,
  effective_to
from source
where stable_key <> 'CERTIFICATE-EFILING' or version in ('CPSC-2026.1', 'CPSC-2027.1')
on conflict (requirement_id, framework_version_id) do nothing;

comment on table public.requirement_framework_versions is
  'Versioned requirement catalogs. Regulatory seed content remains draft until human review and publication.';
comment on table public.requirement_evaluations is
  'Immutable deterministic evaluation input snapshots. No AI-generated input is authoritative.';
