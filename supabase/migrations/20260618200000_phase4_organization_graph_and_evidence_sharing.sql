-- Phase 4: Organization Graph and Supplier Evidence Network
--
-- Introduces a canonical organization registry that reuses existing
-- buyers/suppliers ids verbatim (no new id space, no translation layer),
-- a read-only organization-relationship view over buyer_supplier_connections,
-- and a supplier-controlled evidence sharing model (grants + immutable
-- audit log) that lets evidence extracted under one buyer's document
-- request become visible to other buyers the supplier explicitly grants
-- access to. Buyer-scoped requirements/decisions (Phase 1/3) are untouched.

-- ============================================================================
-- 1. Organization registry (thin adapter over buyers/suppliers)
-- ============================================================================

create table public.organizations (
  id uuid primary key,
  organization_type text not null check (organization_type in ('buyer', 'supplier')),
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create policy "Members can read organizations they belong to"
on public.organizations for select to authenticated
using (private.has_organization_access(auth.uid(), id, organization_type));

insert into public.organizations (id, organization_type, display_name)
select id, 'buyer', company_name from public.buyers
union all
select id, 'supplier', company_name from public.suppliers;

create or replace function private.sync_organization_from_buyer()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  insert into public.organizations (id, organization_type, display_name)
  values (new.id, 'buyer', new.company_name)
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

create trigger sync_organization_after_buyer_insert
after insert on public.buyers
for each row execute function private.sync_organization_from_buyer();

create or replace function private.sync_organization_from_supplier()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  insert into public.organizations (id, organization_type, display_name)
  values (new.id, 'supplier', new.company_name)
  on conflict (id) do update set display_name = excluded.display_name;
  return new;
end;
$$;

create trigger sync_organization_after_supplier_insert
after insert on public.suppliers
for each row execute function private.sync_organization_from_supplier();

-- ============================================================================
-- 2. Organization relationship view (read-only adapter, no new write path)
-- ============================================================================

create view public.organization_relationships
with (security_invoker = true) as
select
  bsc.id,
  bsc.buyer_id as organization_a_id,
  bsc.supplier_id as organization_b_id,
  'buyer_supplier'::text as relationship_type,
  bsc.status,
  bsc.requested_at,
  bsc.responded_at
from public.buyer_supplier_connections bsc;

comment on view public.organization_relationships is
  'Canonical organization-graph read surface over buyer_supplier_connections, the single source of truth for connection state. security_invoker means it is governed by that table''s existing RLS policies.';

-- ============================================================================
-- 3. Evidence sharing grants
-- ============================================================================

create table public.evidence_sharing_grants (
  id uuid primary key default gen_random_uuid(),
  owner_organization_id uuid not null references public.organizations(id),
  granted_to_organization_id uuid not null references public.organizations(id),
  claim_id uuid references public.evidence_claims(id),
  document_type text,
  purpose text not null check (purpose in ('compliance_decision', 'audit_review', 'due_diligence')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  granted_by uuid not null,
  granted_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  check (
    (claim_id is not null and document_type is null)
    or (claim_id is null and document_type is not null)
  ),
  check (status <> 'revoked' or (revoked_by is not null and revoked_at is not null))
);

create index evidence_sharing_grants_owner_idx on public.evidence_sharing_grants(owner_organization_id);
create index evidence_sharing_grants_grantee_idx on public.evidence_sharing_grants(granted_to_organization_id);
create index evidence_sharing_grants_claim_idx on public.evidence_sharing_grants(claim_id) where claim_id is not null;

alter table public.evidence_sharing_grants enable row level security;

create policy "Owner supplier can read its own grants"
on public.evidence_sharing_grants for select to authenticated
using (private.has_organization_access(auth.uid(), owner_organization_id, 'supplier'));

create policy "Grantee buyer can read grants made to it"
on public.evidence_sharing_grants for select to authenticated
using (private.has_organization_access(auth.uid(), granted_to_organization_id, 'buyer'));

create or replace function private.validate_evidence_sharing_grant()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  v_owner_type text;
  v_grantee_type text;
  v_connection_exists boolean;
begin
  select organization_type into v_owner_type
  from public.organizations where id = new.owner_organization_id;

  select organization_type into v_grantee_type
  from public.organizations where id = new.granted_to_organization_id;

  if v_owner_type is distinct from 'supplier' then
    raise exception 'evidence_sharing_grants.owner_organization_id must be a supplier organization';
  end if;

  if v_grantee_type is distinct from 'buyer' then
    raise exception 'evidence_sharing_grants.granted_to_organization_id must be a buyer organization';
  end if;

  select exists (
    select 1 from public.buyer_supplier_connections
    where buyer_id = new.granted_to_organization_id
      and supplier_id = new.owner_organization_id
      and status = 'approved'
  ) into v_connection_exists;

  if not v_connection_exists then
    raise exception 'Cannot grant evidence access without an approved buyer-supplier connection';
  end if;

  if new.claim_id is not null and not exists (
    select 1 from public.evidence_claims
    where id = new.claim_id and supplier_id = new.owner_organization_id
  ) then
    raise exception 'evidence_sharing_grants.claim_id must belong to the owner organization''s supplier';
  end if;

  return new;
end;
$$;

create trigger validate_evidence_sharing_grant_before_insert
before insert on public.evidence_sharing_grants
for each row execute function private.validate_evidence_sharing_grant();

-- Grants widen direct SELECT visibility on evidence_claims (any active
-- grant, regardless of purpose -- a buyer can look at evidence shared for
-- audit/due-diligence purposes even though it never feeds an automated
-- compliance outcome). This is an additional permissive policy alongside
-- evidence_claims' existing buyer/supplier-ownership policy from Phase 2;
-- Postgres ORs permissive policies together, so direct ownership still
-- works unchanged.
create policy "Grantee buyer can read claims shared via an active grant"
on public.evidence_claims for select to authenticated
using (
  exists (
    select 1 from public.evidence_sharing_grants g
    where g.owner_organization_id = evidence_claims.supplier_id
      and g.status = 'active'
      and (g.expires_at is null or g.expires_at > now())
      and (
        g.claim_id = evidence_claims.id
        or (g.claim_id is null and g.document_type = evidence_claims.document_type)
      )
      and private.has_organization_access(auth.uid(), g.granted_to_organization_id, 'buyer')
  )
);

-- ============================================================================
-- 4. Evidence sharing audit log (immutable)
-- ============================================================================

create table public.evidence_sharing_audit_log (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.evidence_sharing_grants(id),
  event_type text not null check (event_type in ('granted', 'revoked', 'accessed')),
  actor_id uuid,
  organization_id uuid not null references public.organizations(id),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index evidence_sharing_audit_log_grant_idx on public.evidence_sharing_audit_log(grant_id);

alter table public.evidence_sharing_audit_log enable row level security;

create policy "Owner supplier can read its grants' audit log"
on public.evidence_sharing_audit_log for select to authenticated
using (
  exists (
    select 1 from public.evidence_sharing_grants g
    where g.id = grant_id
      and private.has_organization_access(auth.uid(), g.owner_organization_id, 'supplier')
  )
);

create policy "Grantee buyer can read its grants' audit log"
on public.evidence_sharing_audit_log for select to authenticated
using (
  exists (
    select 1 from public.evidence_sharing_grants g
    where g.id = grant_id
      and private.has_organization_access(auth.uid(), g.granted_to_organization_id, 'buyer')
  )
);

create or replace function private.protect_evidence_sharing_audit_log()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  raise exception 'Evidence sharing audit log entries are immutable';
end;
$$;

create trigger protect_evidence_sharing_audit_log_update
before update on public.evidence_sharing_audit_log
for each row execute function private.protect_evidence_sharing_audit_log();

create trigger protect_evidence_sharing_audit_log_delete
before delete on public.evidence_sharing_audit_log
for each row execute function private.protect_evidence_sharing_audit_log();

-- ============================================================================
-- 5. RPCs
-- ============================================================================

create or replace function public.grant_evidence_access_v1(
  p_owner_organization_id uuid,
  p_granted_to_buyer_id uuid,
  p_claim_id uuid,
  p_document_type text,
  p_purpose text,
  p_expires_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_grant_id uuid;
begin
  if not private.has_organization_access(v_actor_id, p_owner_organization_id, 'supplier') then
    raise exception 'Supplier access required';
  end if;

  insert into public.evidence_sharing_grants (
    owner_organization_id, granted_to_organization_id, claim_id, document_type,
    purpose, expires_at, granted_by
  ) values (
    p_owner_organization_id, p_granted_to_buyer_id, p_claim_id, p_document_type,
    p_purpose, p_expires_at, v_actor_id
  )
  returning id into v_grant_id;

  insert into public.evidence_sharing_audit_log (grant_id, event_type, actor_id, organization_id, metadata)
  values (
    v_grant_id, 'granted', v_actor_id, p_owner_organization_id,
    jsonb_build_object('granted_to', p_granted_to_buyer_id, 'purpose', p_purpose)
  );

  return v_grant_id;
end;
$function$;

create or replace function public.revoke_evidence_access_v1(
  p_grant_id uuid
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_owner_organization_id uuid;
begin
  select owner_organization_id into v_owner_organization_id
  from public.evidence_sharing_grants where id = p_grant_id;

  if v_owner_organization_id is null then
    raise exception 'Grant not found';
  end if;

  if not private.has_organization_access(v_actor_id, v_owner_organization_id, 'supplier') then
    raise exception 'Supplier access required';
  end if;

  update public.evidence_sharing_grants
  set status = 'revoked', revoked_by = v_actor_id, revoked_at = now()
  where id = p_grant_id and status = 'active';

  if not found then
    raise exception 'Grant is not active';
  end if;

  insert into public.evidence_sharing_audit_log (grant_id, event_type, actor_id, organization_id)
  values (p_grant_id, 'revoked', v_actor_id, v_owner_organization_id);
end;
$function$;

grant execute on function public.grant_evidence_access_v1(uuid, uuid, uuid, text, text, timestamptz) to authenticated;
grant execute on function public.revoke_evidence_access_v1(uuid) to authenticated;

-- An "accessed" audit row is written directly by evaluate-compliance-v1's
-- service-role client (which bypasses RLS, same as how
-- process-compliance-events-v1 already inserts into notifications directly)
-- whenever a computed decision actually cites a grant-sourced claim. No
-- separate RPC needed for this -- it's a plain insert from a trusted caller.

-- supplier_evidence_network_v1 feature flag already seeded default-off by
-- Phase 0 (supabase/migrations/20260618091355_phase0_security_foundation.sql)
-- with the exact description "Permissioned cross-organization evidence
-- sharing" -- this phase is what starts using it, no new seed needed.
