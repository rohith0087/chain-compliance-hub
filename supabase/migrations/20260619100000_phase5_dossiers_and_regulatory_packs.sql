-- Phase 5: Dossiers, Reporting, and Regulatory Packs
--
-- Turns Phase 1-4's authoritative chain (requirement applicability, verified
-- evidence, immutable decisions, supplier-controlled sharing) into a
-- defensible, exportable artifact: a per-subject "dossier" whose every
-- statement traces back to its requirement version, evidence claims, and
-- decision snapshot, with signed exports, versioning, retention controls,
-- a tamper-evident hash-chained audit log, and a versioned regulatory-pack
-- framework (first reference pack: CPSC eFiling, which stays unpublishable
-- until the underlying US-CPSC catalog is separately promoted out of draft).

-- ============================================================================
-- 1. Dossiers (stable identity) and versions (immutable signed snapshots)
-- ============================================================================

create table public.compliance_dossiers (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id),
  subject_type text not null check (subject_type in ('supplier', 'facility', 'product')),
  subject_id uuid not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  unique (buyer_id, subject_type, subject_id)
);

alter table public.compliance_dossiers enable row level security;

create policy "Buyer members can read their dossiers"
on public.compliance_dossiers for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create table public.dossier_versions (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.compliance_dossiers(id),
  version_number integer not null,
  effective_at date not null,
  content_snapshot jsonb not null,
  content_hash text not null,
  signature text not null,
  signing_key_id uuid not null,
  storage_path text,
  retain_until date,
  legal_hold boolean not null default false,
  status text not null default 'current' check (status in ('current', 'superseded', 'archived')),
  actor_id uuid not null,
  idempotency_key text,
  request_hash text,
  created_at timestamptz not null default now(),
  unique (dossier_id, version_number)
);

create index dossier_versions_dossier_idx on public.dossier_versions(dossier_id);
create unique index dossier_versions_idempotency_idx
  on public.dossier_versions(dossier_id, actor_id, idempotency_key)
  where idempotency_key is not null;

alter table public.dossier_versions enable row level security;

create policy "Buyer members can read their dossier versions"
on public.dossier_versions for select to authenticated
using (
  exists (
    select 1 from public.compliance_dossiers d
    where d.id = dossier_id and private.has_organization_access(auth.uid(), d.buyer_id, 'buyer')
  )
);

-- The signed content (snapshot/hash/signature/identity columns) must never
-- change once written; retention/legal-hold/status are legitimately mutable
-- operational metadata on the same row, so this table cannot use a blanket
-- "raise on any update" trigger like prior phases' pure computed-snapshot
-- tables -- it must check which columns actually changed.
create or replace function private.protect_dossier_version_content()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if old.dossier_id is distinct from new.dossier_id
    or old.version_number is distinct from new.version_number
    or old.effective_at is distinct from new.effective_at
    or old.content_snapshot is distinct from new.content_snapshot
    or old.content_hash is distinct from new.content_hash
    or old.signature is distinct from new.signature
    or old.signing_key_id is distinct from new.signing_key_id
  then
    raise exception 'Dossier version content is immutable; only status, retain_until, and legal_hold may change';
  end if;
  return new;
end;
$$;

create trigger protect_dossier_version_content_before_update
before update on public.dossier_versions
for each row execute function private.protect_dossier_version_content();

create or replace function private.protect_dossier_version_delete()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'Dossier versions cannot be deleted';
end;
$$;

create trigger protect_dossier_version_before_delete
before delete on public.dossier_versions
for each row execute function private.protect_dossier_version_delete();

-- ============================================================================
-- 2. Signing keys
-- ============================================================================

create table public.dossier_signing_keys (
  id uuid primary key default gen_random_uuid(),
  algorithm text not null default 'ECDSA_P256_SHA256',
  public_key_jwk jsonb not null,
  vault_secret_name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

alter table public.dossier_signing_keys enable row level security;

create policy "Authenticated users can read signing public keys"
on public.dossier_signing_keys for select to authenticated
using (true);

alter table public.dossier_versions
  add constraint dossier_versions_signing_key_id_fkey
  foreign key (signing_key_id) references public.dossier_signing_keys(id);

-- ============================================================================
-- 3. Tamper-evident, hash-chained audit log
-- ============================================================================

create table public.dossier_audit_log (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.compliance_dossiers(id),
  version_id uuid references public.dossier_versions(id),
  event_type text not null check (event_type in (
    'generated', 'signed', 'exported', 'viewed', 'verified',
    'archived', 'legal_hold_set', 'legal_hold_released'
  )),
  actor_id uuid,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  prev_hash text,
  row_hash text not null
);

create index dossier_audit_log_dossier_idx on public.dossier_audit_log(dossier_id, occurred_at);

alter table public.dossier_audit_log enable row level security;

-- Explicit-filter discipline: this is buyer-scoped via the dossier's
-- buyer_id, the same lesson learned from the evidence_sharing_audit_log
-- scoping bug -- any UI reading this must additionally filter by the
-- specific dossier_id being viewed, never trust RLS alone, since a user
-- can belong to multiple buyer orgs.
create policy "Buyer members can read their dossier audit log"
on public.dossier_audit_log for select to authenticated
using (
  exists (
    select 1 from public.compliance_dossiers d
    where d.id = dossier_id and private.has_organization_access(auth.uid(), d.buyer_id, 'buyer')
  )
);

-- One canonicalization, used by both the write-time trigger below and the
-- read-time verify_dossier_audit_chain_v1 RPC -- never duplicated, so the
-- chain can never silently drift out of sync with itself.
create or replace function private.compute_dossier_audit_row_hash(
  p_prev_hash text,
  p_event_type text,
  p_dossier_id uuid,
  p_version_id uuid,
  p_actor_id uuid,
  p_occurred_at timestamptz,
  p_metadata jsonb
)
returns text
language sql
immutable
set search_path to ''
as $$
  select encode(
    extensions.digest(
      coalesce(p_prev_hash, '') || '|' ||
      p_event_type || '|' ||
      p_dossier_id::text || '|' ||
      coalesce(p_version_id::text, '') || '|' ||
      coalesce(p_actor_id::text, '') || '|' ||
      p_occurred_at::text || '|' ||
      coalesce(p_metadata::text, '{}'),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.chain_dossier_audit_log_row()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_prev_hash text;
begin
  select row_hash into v_prev_hash
  from public.dossier_audit_log
  where dossier_id = new.dossier_id
  order by occurred_at desc, id desc
  limit 1;

  new.prev_hash := v_prev_hash;
  new.row_hash := private.compute_dossier_audit_row_hash(
    v_prev_hash, new.event_type, new.dossier_id, new.version_id,
    new.actor_id, new.occurred_at, new.metadata
  );
  return new;
end;
$$;

create trigger chain_dossier_audit_log_row_before_insert
before insert on public.dossier_audit_log
for each row execute function private.chain_dossier_audit_log_row();

create or replace function private.protect_dossier_audit_log()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'Dossier audit log entries are immutable';
end;
$$;

create trigger protect_dossier_audit_log_update
before update on public.dossier_audit_log
for each row execute function private.protect_dossier_audit_log();

create trigger protect_dossier_audit_log_delete
before delete on public.dossier_audit_log
for each row execute function private.protect_dossier_audit_log();

create or replace function public.verify_dossier_audit_chain_v1(p_dossier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_row record;
  v_prev_hash text := null;
  v_expected text;
begin
  select buyer_id into v_buyer_id from public.compliance_dossiers where id = p_dossier_id;
  if v_buyer_id is null then
    raise exception 'Dossier not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  for v_row in
    select * from public.dossier_audit_log
    where dossier_id = p_dossier_id
    order by occurred_at, id
  loop
    if v_row.prev_hash is distinct from v_prev_hash then
      return jsonb_build_object('valid', false, 'broken_at_row_id', v_row.id, 'reason', 'prev_hash mismatch');
    end if;

    v_expected := private.compute_dossier_audit_row_hash(
      v_row.prev_hash, v_row.event_type, v_row.dossier_id, v_row.version_id,
      v_row.actor_id, v_row.occurred_at, v_row.metadata
    );
    if v_expected is distinct from v_row.row_hash then
      return jsonb_build_object('valid', false, 'broken_at_row_id', v_row.id, 'reason', 'row_hash mismatch');
    end if;

    v_prev_hash := v_row.row_hash;
  end loop;

  return jsonb_build_object('valid', true, 'broken_at_row_id', null, 'reason', null);
end;
$function$;

grant execute on function public.verify_dossier_audit_chain_v1(uuid) to authenticated;

-- ============================================================================
-- 4. Regulatory packs
-- ============================================================================

create table public.regulatory_packs (
  pack_code text primary key,
  name text not null,
  description text not null,
  schema_version text not null,
  required_framework_code text not null references public.requirement_frameworks(code),
  status text not null default 'draft' check (status in ('draft', 'published', 'deprecated')),
  created_at timestamptz not null default now()
);

alter table public.regulatory_packs enable row level security;

create policy "Authenticated users can read published regulatory packs"
on public.regulatory_packs for select to authenticated
using (status = 'published');

insert into public.regulatory_packs (pack_code, name, description, schema_version, required_framework_code, status)
values (
  'CPSC-EFILING', 'CPSC eFiling',
  'US Consumer Product Safety Commission electronic filing submission package.',
  'v1', 'US-CPSC', 'draft'
);

create table public.regulatory_pack_submissions (
  id uuid primary key default gen_random_uuid(),
  pack_code text not null references public.regulatory_packs(pack_code),
  dossier_version_id uuid not null references public.dossier_versions(id),
  buyer_id uuid not null references public.buyers(id),
  subject_type text not null check (subject_type in ('supplier', 'facility', 'product')),
  subject_id uuid not null,
  payload jsonb not null,
  validation_status text not null check (validation_status in ('valid', 'invalid')),
  validation_errors jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  generated_by uuid not null,
  storage_path text
);

create index regulatory_pack_submissions_buyer_idx on public.regulatory_pack_submissions(buyer_id);

alter table public.regulatory_pack_submissions enable row level security;

create policy "Buyer members can read their regulatory pack submissions"
on public.regulatory_pack_submissions for select to authenticated
using (private.has_organization_access(auth.uid(), buyer_id, 'buyer'));

create or replace function private.protect_regulatory_pack_submission()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'Regulatory pack submissions are immutable';
end;
$$;

create trigger protect_regulatory_pack_submission_update
before update on public.regulatory_pack_submissions
for each row execute function private.protect_regulatory_pack_submission();

create trigger protect_regulatory_pack_submission_delete
before delete on public.regulatory_pack_submissions
for each row execute function private.protect_regulatory_pack_submission();

-- ============================================================================
-- 5. RPCs
-- ============================================================================

create or replace function public.record_dossier_version_v1(
  p_buyer_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_effective_at date,
  p_content_snapshot jsonb,
  p_content_hash text,
  p_signature text,
  p_signing_key_id uuid,
  p_actor_id uuid,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_dossier_id uuid;
  v_version_id uuid;
  v_version_number integer;
  v_existing record;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;

  select id into v_dossier_id from public.compliance_dossiers
  where buyer_id = p_buyer_id and subject_type = p_subject_type and subject_id = p_subject_id;

  if v_dossier_id is not null and p_idempotency_key is not null then
    select id, version_number, request_hash into v_existing
    from public.dossier_versions
    where dossier_id = v_dossier_id and actor_id = p_actor_id and idempotency_key = p_idempotency_key;

    if v_existing.id is not null then
      if v_existing.request_hash is distinct from p_request_hash then
        raise exception 'Idempotency key was already used for a different request';
      end if;
      return jsonb_build_object(
        'dossier_id', v_dossier_id, 'version_id', v_existing.id,
        'version_number', v_existing.version_number, 'idempotent_replay', true
      );
    end if;
  end if;

  if v_dossier_id is null then
    insert into public.compliance_dossiers (buyer_id, subject_type, subject_id, created_by)
    values (p_buyer_id, p_subject_type, p_subject_id, p_actor_id)
    returning id into v_dossier_id;
  end if;

  update public.dossier_versions set status = 'superseded'
  where dossier_id = v_dossier_id and status = 'current';

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.dossier_versions where dossier_id = v_dossier_id;

  insert into public.dossier_versions (
    dossier_id, version_number, effective_at, content_snapshot, content_hash,
    signature, signing_key_id, status, actor_id, idempotency_key, request_hash
  ) values (
    v_dossier_id, v_version_number, p_effective_at, p_content_snapshot, p_content_hash,
    p_signature, p_signing_key_id, 'current', p_actor_id, p_idempotency_key, p_request_hash
  )
  returning id into v_version_id;

  insert into public.dossier_audit_log (dossier_id, version_id, event_type, actor_id, metadata)
  values (v_dossier_id, v_version_id, 'generated', p_actor_id, jsonb_build_object('version_number', v_version_number));

  insert into public.dossier_audit_log (dossier_id, version_id, event_type, actor_id, metadata)
  values (v_dossier_id, v_version_id, 'signed', p_actor_id, jsonb_build_object('signing_key_id', p_signing_key_id));

  return jsonb_build_object(
    'dossier_id', v_dossier_id, 'version_id', v_version_id,
    'version_number', v_version_number, 'idempotent_replay', false
  );
end;
$function$;

create or replace function public.set_dossier_retention_v1(
  p_dossier_id uuid,
  p_retain_until date,
  p_legal_hold boolean
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
  v_version_id uuid;
begin
  select buyer_id into v_buyer_id from public.compliance_dossiers where id = p_dossier_id;
  if v_buyer_id is null then
    raise exception 'Dossier not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;

  update public.dossier_versions
  set retain_until = p_retain_until, legal_hold = p_legal_hold
  where dossier_id = p_dossier_id and status = 'current'
  returning id into v_version_id;

  if v_version_id is null then
    raise exception 'No current dossier version found';
  end if;

  insert into public.dossier_audit_log (dossier_id, version_id, event_type, actor_id, metadata)
  values (
    p_dossier_id, v_version_id,
    case when p_legal_hold then 'legal_hold_set' else 'legal_hold_released' end,
    v_actor_id, jsonb_build_object('retain_until', p_retain_until)
  );
end;
$function$;

create or replace function public.archive_dossier_v1(
  p_dossier_id uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_buyer_id uuid;
begin
  select buyer_id into v_buyer_id from public.compliance_dossiers where id = p_dossier_id;
  if v_buyer_id is null then
    raise exception 'Dossier not found';
  end if;
  if not private.has_organization_access(v_actor_id, v_buyer_id, 'buyer') then
    raise exception 'Buyer access required';
  end if;
  if exists (select 1 from public.dossier_versions where dossier_id = p_dossier_id and legal_hold) then
    raise exception 'Cannot archive a dossier with an active legal hold';
  end if;

  update public.compliance_dossiers set status = 'archived' where id = p_dossier_id;

  insert into public.dossier_audit_log (dossier_id, version_id, event_type, actor_id)
  select p_dossier_id, id, 'archived', v_actor_id
  from public.dossier_versions where dossier_id = p_dossier_id and status = 'current';
end;
$function$;

-- Edge functions reach the database only through PostgREST/RPC, and the
-- vault schema is deliberately not exposed via PostgREST -- this is the one
-- narrow, service-role-only path to read a signing private key's plaintext
-- out of Vault by signing-key id (never by raw secret name from the caller).
create or replace function public.get_dossier_signing_private_key_v1(p_signing_key_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_vault_secret_name text;
  v_secret text;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;

  select vault_secret_name into v_vault_secret_name
  from public.dossier_signing_keys where id = p_signing_key_id;

  if v_vault_secret_name is null then
    raise exception 'Signing key not found';
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = v_vault_secret_name;

  return v_secret;
end;
$function$;

revoke all on function public.get_dossier_signing_private_key_v1(uuid) from public, anon, authenticated;
grant execute on function public.get_dossier_signing_private_key_v1(uuid) to service_role;

create or replace function public.record_regulatory_pack_submission_v1(
  p_pack_code text,
  p_dossier_version_id uuid,
  p_buyer_id uuid,
  p_subject_type text,
  p_subject_id uuid,
  p_payload jsonb,
  p_validation_status text,
  p_validation_errors jsonb,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_id uuid;
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'service role required';
  end if;

  insert into public.regulatory_pack_submissions (
    pack_code, dossier_version_id, buyer_id, subject_type, subject_id,
    payload, validation_status, validation_errors, generated_by
  ) values (
    p_pack_code, p_dossier_version_id, p_buyer_id, p_subject_type, p_subject_id,
    p_payload, p_validation_status, p_validation_errors, p_actor_id
  )
  returning id into v_id;

  return v_id;
end;
$function$;

grant execute on function public.set_dossier_retention_v1(uuid, date, boolean) to authenticated;
grant execute on function public.archive_dossier_v1(uuid) to authenticated;

-- ============================================================================
-- 6. Storage: dedicated private bucket for rendered dossier/pack files
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('compliance-dossiers', 'compliance-dossiers', false)
on conflict (id) do nothing;

create policy "Buyer members can read their dossier files"
on storage.objects for select to authenticated
using (
  bucket_id = 'compliance-dossiers'
  and exists (
    select 1 from public.compliance_dossiers d
    where d.id::text = (storage.foldername(name))[1]
      and private.has_organization_access(auth.uid(), d.buyer_id, 'buyer')
  )
);

create policy "Buyer members can upload their dossier files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'compliance-dossiers'
  and exists (
    select 1 from public.compliance_dossiers d
    where d.id::text = (storage.foldername(name))[1]
      and private.has_organization_access(auth.uid(), d.buyer_id, 'buyer')
  )
);

-- ============================================================================
-- 7. Feature flag
-- ============================================================================

insert into public.feature_flags (key, description, default_enabled, lifecycle)
values ('compliance_dossiers_v1', 'Audit-ready compliance dossiers and regulatory pack exports', false, 'development')
on conflict (key) do nothing;
