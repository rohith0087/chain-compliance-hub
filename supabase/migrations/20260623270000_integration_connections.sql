-- ============================================================
-- Integration Connections: multi-tenant OAuth token storage
-- ============================================================

create table public.integration_connections (
  id                uuid        primary key default gen_random_uuid(),
  organization_id   uuid        not null references public.buyers(id) on delete cascade,
  provider          text        not null
                    check (provider in ('slack','docusign','notion','box','sharepoint')),
  status            text        not null default 'active'
                    check (status in ('active','revoked','error','needs_reauth')),
  access_token      text,
  refresh_token     text,
  token_expires_at  timestamptz,
  config            jsonb       not null default '{}',
  connected_by      uuid        references public.profiles(id),
  connected_at      timestamptz not null default now(),
  last_synced_at    timestamptz,
  last_error        text,
  unique (organization_id, provider)
);

create index integration_connections_org_idx
  on public.integration_connections(organization_id);

alter table public.integration_connections enable row level security;

-- helper: is the current user a member of org?
create or replace function private.is_buyer_member(p_org_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.buyers where id = p_org_id and profile_id = auth.uid()
  ) or exists (
    select 1 from public.company_users
    where profile_id = auth.uid()
      and company_id  = p_org_id
      and company_type = 'buyer'
      and status = 'active'
  );
$$;

-- helper: is the current user an admin/owner of org?
create or replace function private.is_buyer_admin(p_org_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.buyers where id = p_org_id and profile_id = auth.uid()
  ) or exists (
    select 1 from public.company_users
    where profile_id = auth.uid()
      and company_id  = p_org_id
      and company_type = 'buyer'
      and role in ('company_admin')
      and status = 'active'
  );
$$;

create policy "ic_select"  on public.integration_connections
  for select using (private.is_buyer_member(organization_id));
create policy "ic_insert"  on public.integration_connections
  for insert with check (private.is_buyer_admin(organization_id));
create policy "ic_update"  on public.integration_connections
  for update using (private.is_buyer_admin(organization_id));
create policy "ic_delete"  on public.integration_connections
  for delete using (private.is_buyer_admin(organization_id));

-- ============================================================
-- Sync log: audit trail of every integration action
-- ============================================================

create table public.integration_sync_log (
  id             uuid        primary key default gen_random_uuid(),
  connection_id  uuid        not null references public.integration_connections(id) on delete cascade,
  event_type     text        not null,
  request_id     uuid        references public.document_requests(id),
  status         text        not null check (status in ('success','failed')),
  payload        jsonb,
  created_at     timestamptz not null default now()
);

create index integration_sync_log_connection_idx
  on public.integration_sync_log(connection_id, created_at desc);

alter table public.integration_sync_log enable row level security;

create policy "isl_select" on public.integration_sync_log
  for select using (
    exists (
      select 1 from public.integration_connections ic
      where ic.id = integration_sync_log.connection_id
        and private.is_buyer_member(ic.organization_id)
    )
  );

-- service role inserts (edge functions)
create policy "isl_insert_service" on public.integration_sync_log
  for insert with check (true);

-- ============================================================
-- OAuth state nonces (15-min TTL, CSRF protection)
-- ============================================================

create table public.integration_oauth_state (
  state           text        primary key,
  organization_id uuid        not null references public.buyers(id) on delete cascade,
  provider        text        not null,
  initiated_by    uuid        not null references public.profiles(id),
  return_url      text,
  expires_at      timestamptz not null default (now() + interval '15 minutes')
);

create index integration_oauth_state_expires_idx
  on public.integration_oauth_state(expires_at);

alter table public.integration_oauth_state enable row level security;

create policy "oas_insert" on public.integration_oauth_state
  for insert with check (initiated_by = auth.uid());
create policy "oas_select" on public.integration_oauth_state
  for select using (initiated_by = auth.uid());
create policy "oas_delete" on public.integration_oauth_state
  for delete using (initiated_by = auth.uid());

-- service role can read state during OAuth callback (no user session in callback)
create policy "oas_service_select" on public.integration_oauth_state
  for select using (true);
