-- Phase 0 is intentionally additive. Existing business tables and workflows remain unchanged.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.has_organization_access(
  _user_id uuid,
  _organization_id uuid,
  _organization_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    _user_id is not null
    and _organization_type in ('buyer', 'supplier')
    and (
      exists (
        select 1
        from public.company_users cu
        where cu.profile_id = _user_id
          and cu.company_id = _organization_id
          and cu.company_type = _organization_type
          and cu.status = 'active'
      )
      or (
        _organization_type = 'buyer'
        and exists (
          select 1 from public.buyers b
          where b.id = _organization_id and b.profile_id = _user_id
        )
      )
      or (
        _organization_type = 'supplier'
        and exists (
          select 1 from public.suppliers s
          where s.id = _organization_id and s.profile_id = _user_id
        )
      )
      or exists (
        select 1
        from public.platform_administrators pa
        where pa.auth_user_id = _user_id and pa.is_active = true
      )
    );
$$;

revoke all on function private.has_organization_access(uuid, uuid, text) from public;
grant execute on function private.has_organization_access(uuid, uuid, text) to authenticated, service_role;

create table if not exists public.feature_flags (
  key text primary key,
  description text not null,
  default_enabled boolean not null default false,
  lifecycle text not null default 'development'
    check (lifecycle in ('development', 'canary', 'stable', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_feature_flags (
  organization_id uuid not null,
  organization_type text not null check (organization_type in ('buyer', 'supplier')),
  feature_key text not null references public.feature_flags(key) on delete cascade,
  enabled boolean not null,
  configured_by uuid references public.profiles(id),
  configured_at timestamptz not null default now(),
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  primary key (organization_id, organization_type, feature_key)
);

create index if not exists organization_feature_flags_feature_key_idx
  on public.organization_feature_flags(feature_key);
create index if not exists organization_feature_flags_expires_at_idx
  on public.organization_feature_flags(expires_at)
  where expires_at is not null;

alter table public.feature_flags enable row level security;
alter table public.organization_feature_flags enable row level security;

drop policy if exists "Authenticated users can read feature catalog" on public.feature_flags;
create policy "Authenticated users can read feature catalog"
on public.feature_flags for select to authenticated
using (true);

drop policy if exists "Organization members can read feature overrides" on public.organization_feature_flags;
create policy "Organization members can read feature overrides"
on public.organization_feature_flags for select to authenticated
using (
  private.has_organization_access(auth.uid(), organization_id, organization_type)
);

insert into public.feature_flags (key, description, default_enabled, lifecycle)
values
  ('compliance_requirements_v1', 'Versioned deterministic requirement engine', false, 'development'),
  ('structured_evidence_v1', 'Structured evidence extraction and verification', false, 'development'),
  ('compliance_decisions_v1', 'Explainable compliance decision engine', false, 'development'),
  ('supplier_evidence_network_v1', 'Permissioned cross-organization evidence sharing', false, 'development')
on conflict (key) do update
set description = excluded.description,
    updated_at = now();

-- Replace unrestricted audit and notification INSERT policies with actor-bound policies.
drop policy if exists "Anyone can insert auth logs" on public.auth_audit_logs;
create policy "Authenticated users can insert their own auth logs"
on public.auth_audit_logs for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "Users can create activity logs" on public.document_activity_logs;
create policy "Authenticated users can create their own document activity"
on public.document_activity_logs for insert to authenticated
with check (user_id = auth.uid());

drop policy if exists "System can insert audit logs" on public.communication_audit_logs;
drop policy if exists "System can insert expiry notifications" on public.document_expiry_notifications;
drop policy if exists "System can create notifications" on public.notifications;
drop policy if exists "System can insert audit logs" on public.platform_admin_audit_logs;
drop policy if exists "System can insert activity logs" on public.user_activity_logs;

drop policy if exists "Anyone can create tickets" on public.support_tickets;
create policy "Authenticated users can create their own tickets"
on public.support_tickets for insert to authenticated
with check (
  user_id = auth.uid()
  and status = 'open'
  and assigned_to is null
  and char_length(subject) between 3 and 200
  and char_length(description) between 10 and 10000
);
create policy "Guests can create constrained support tickets"
on public.support_tickets for insert to anon
with check (
  user_id is null
  and coalesce(user_type, 'guest') = 'guest'
  and status = 'open'
  and assigned_to is null
  and char_length(subject) between 3 and 200
  and char_length(description) between 10 and 10000
);

-- Public buckets do not need broad SELECT policies for public object URLs.
-- Restrict listing to the authenticated owner's folder.
drop policy if exists "Public read access for avatars" on storage.objects;
create policy "Users can list their own avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Company logos are publicly accessible" on storage.objects;
drop policy if exists "Users can view company logos" on storage.objects;
create policy "Users can list their own company logos"
on storage.objects for select to authenticated
using (
  bucket_id = 'company-logos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Compliance exports contain tenant data and must use signed URLs.
update storage.buckets set public = false where id = 'exports';
drop policy if exists "Public can download exports" on storage.objects;
drop policy if exists "Users can upload exports" on storage.objects;
drop policy if exists "Users can delete old exports" on storage.objects;

comment on table public.feature_flags is
  'Platform feature catalog. Defaults are safe-off and promoted through development, canary, stable, and retired states.';
comment on table public.organization_feature_flags is
  'Organization-scoped feature overrides. Writes are service-side only; members receive read access through RLS.';
