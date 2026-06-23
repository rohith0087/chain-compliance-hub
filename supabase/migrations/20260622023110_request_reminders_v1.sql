-- Durable request-email delivery and reminder scheduling foundation.

insert into public.feature_flags(key,description,default_enabled,lifecycle)
values
  ('reliable_request_delivery_v1','Durable Resend delivery ledger and request deep links',false,'development'),
  ('request_reminders_v1','Policy-driven reminders for pending document requests',false,'development')
on conflict (key) do update set description=excluded.description;

create table public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  recipient_profile_id uuid references public.profiles(id) on delete set null,
  recipient_email text not null check (recipient_email = lower(btrim(recipient_email)) and position('@' in recipient_email) > 1),
  recipient_name text,
  recipient_role text,
  message_type text not null check (message_type in ('initial_request','pre_due_reminder','due_today','overdue_reminder','manual_resend')),
  status text not null default 'queued' check (status in ('queued','processing','provider_accepted','delivered','delivery_delayed','bounced','failed','complained','suppressed','canceled')),
  provider text not null default 'resend' check (provider='resend'),
  provider_message_id text unique,
  idempotency_key text not null unique,
  dedupe_key text not null unique,
  template_key text not null default 'document_request',
  template_version integer not null default 1 check (template_version > 0),
  subject text not null,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  provider_accepted_at timestamptz,
  delivered_at timestamptz,
  delayed_at timestamptz,
  bounced_at timestamptz,
  failed_at timestamptz,
  complained_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  last_event_at timestamptz,
  transport_last_event_at timestamptz,
  error_code text,
  error_message text,
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.email_delivery_requests (
  delivery_id uuid not null references public.email_deliveries(id) on delete cascade,
  request_id uuid not null references public.document_requests(id) on delete cascade,
  purpose text not null check (purpose in ('initial_request','pre_due_reminder','due_today','overdue_reminder','manual_resend')),
  reminder_stage text,
  policy_version integer,
  created_at timestamptz not null default now(),
  primary key(delivery_id,request_id)
);

create table public.email_delivery_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend' check (provider='resend'),
  provider_event_id text not null unique,
  provider_message_id text not null,
  event_type text not null,
  event_at timestamptz not null,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.request_reminder_policies (
  buyer_id uuid primary key references public.buyers(id) on delete cascade,
  enabled boolean not null default true,
  pre_due_days integer[] not null default '{7,3,1}',
  send_due_today boolean not null default true,
  overdue_interval_days integer not null default 7 check (overdue_interval_days between 1 and 90),
  max_overdue_reminders integer not null default 4 check (max_overdue_reminders between 0 and 52),
  send_time_local time not null default '09:00',
  timezone text not null default 'UTC',
  include_weekends boolean not null default false,
  policy_version integer not null default 1 check (policy_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (0 < all(pre_due_days) and cardinality(pre_due_days) <= 12)
);

insert into public.request_reminder_policies(buyer_id,timezone)
select id,'UTC' from public.buyers
on conflict (buyer_id) do nothing;

create or replace function private.create_default_request_reminder_policy()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
  insert into public.request_reminder_policies(buyer_id,timezone) values(new.id,'UTC')
  on conflict (buyer_id) do nothing;
  return new;
end $$;
create trigger create_default_request_reminder_policy
after insert on public.buyers for each row execute function private.create_default_request_reminder_policy();

create index email_deliveries_queue_idx on public.email_deliveries(status,next_attempt_at,created_at)
where status='queued';
create index email_deliveries_buyer_idx on public.email_deliveries(buyer_id,created_at desc);
create index email_deliveries_supplier_idx on public.email_deliveries(supplier_id,created_at desc);
create index email_delivery_requests_request_idx on public.email_delivery_requests(request_id,created_at desc);
create index email_delivery_events_message_idx on public.email_delivery_events(provider_message_id,event_at);

alter table public.email_deliveries enable row level security;
alter table public.email_delivery_requests enable row level security;
alter table public.email_delivery_events enable row level security;
alter table public.request_reminder_policies enable row level security;

create policy "Buyer members can read email deliveries" on public.email_deliveries
for select to authenticated using (private.has_organization_access((select auth.uid()),buyer_id,'buyer'));
create policy "Buyer members can read delivery request links" on public.email_delivery_requests
for select to authenticated using (exists (
  select 1 from public.email_deliveries d where d.id=delivery_id
  and private.has_organization_access((select auth.uid()),d.buyer_id,'buyer')
));
create policy "Buyer members can read reminder policies" on public.request_reminder_policies
for select to authenticated using (private.has_organization_access((select auth.uid()),buyer_id,'buyer'));
create policy "Buyer members can insert reminder policies" on public.request_reminder_policies
for insert to authenticated with check (private.has_organization_access((select auth.uid()),buyer_id,'buyer'));
create policy "Buyer members can update reminder policies" on public.request_reminder_policies
for update to authenticated
using (private.has_organization_access((select auth.uid()),buyer_id,'buyer'))
with check (private.has_organization_access((select auth.uid()),buyer_id,'buyer'));

revoke all on public.email_deliveries,public.email_delivery_requests,public.email_delivery_events from anon,authenticated;
grant select on public.email_deliveries,public.email_delivery_requests to authenticated;
grant select,insert,update on public.request_reminder_policies to authenticated;
grant all on public.email_deliveries,public.email_delivery_requests,public.email_delivery_events,public.request_reminder_policies to service_role;

create or replace function public.claim_email_deliveries_v1(p_batch_size integer default 25)
returns setof public.email_deliveries
language plpgsql security invoker set search_path=''
as $$
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if p_batch_size not between 1 and 100 then raise exception 'batch size must be between 1 and 100'; end if;
  return query
  update public.email_deliveries d set status='processing',attempt_count=d.attempt_count+1,updated_at=now()
  where d.id in (
    select q.id from public.email_deliveries q
    where q.status='queued' and coalesce(q.next_attempt_at,q.created_at)<=now()
    order by coalesce(q.next_attempt_at,q.created_at),q.id limit p_batch_size for update skip locked
  ) returning d.*;
end $$;
revoke all on function public.claim_email_deliveries_v1(integer) from public,anon,authenticated;
grant execute on function public.claim_email_deliveries_v1(integer) to service_role;

-- Missing settings must not silently suppress transactional request mail.
insert into public.supplier_notification_settings(supplier_id,enabled,new_request_in_app_enabled,new_request_email_enabled)
select s.id,true,true,true from public.suppliers s
where not exists (select 1 from public.supplier_notification_settings n where n.supplier_id=s.id);
alter table public.supplier_notification_settings alter column new_request_email_enabled set default true;

create or replace function private.enqueue_initial_request_delivery_v1()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_enabled boolean;
  v_email_enabled boolean;
  v_buyer_name text;
  v_recipient record;
  v_delivery uuid;
begin
  if new.status <> 'pending' then return new; end if;
  select coalesce(
    (select off.enabled from public.organization_feature_flags off
      where off.organization_id=new.buyer_id and off.organization_type='buyer'
        and off.feature_key='reliable_request_delivery_v1'
        and (off.expires_at is null or off.expires_at>now())),
    (select ff.default_enabled from public.feature_flags ff where ff.key='reliable_request_delivery_v1'),false
  ) into v_enabled;
  if not v_enabled then return new; end if;
  select coalesce(n.enabled,true) and coalesce(n.new_request_email_enabled,true)
  into v_email_enabled from public.supplier_notification_settings n where n.supplier_id=new.supplier_id;
  v_email_enabled:=coalesce(v_email_enabled,true);
  select company_name into v_buyer_name from public.buyers where id=new.buyer_id;
  for v_recipient in
    select distinct on (lower(p.email)) p.id profile_id,lower(p.email) email,p.full_name name,src.role
    from (
      select s.profile_id,'owner'::text role,null::uuid branch_id from public.suppliers s where s.id=new.supplier_id
      union all
      select cu.profile_id,coalesce(cu.role,'member'),cu.branch_id from public.company_users cu
      where cu.company_id=new.supplier_id and cu.company_type='supplier' and cu.status='active'
        and (cu.role='company_admin' or (new.supplier_branch_id is not null and cu.branch_id=new.supplier_branch_id))
    ) src join public.profiles p on p.id=src.profile_id
    where p.email is not null and position('@' in p.email)>1
    order by lower(p.email),case when src.role='owner' then 0 else 1 end
  loop
    insert into public.email_deliveries(
      buyer_id,supplier_id,recipient_profile_id,recipient_email,recipient_name,recipient_role,
      message_type,status,idempotency_key,dedupe_key,template_key,template_version,subject,created_by,metadata
    ) values (
      new.buyer_id,new.supplier_id,v_recipient.profile_id,v_recipient.email,v_recipient.name,v_recipient.role,
      'initial_request',case when v_email_enabled then 'queued' else 'suppressed' end,
      'initial-request/'||new.id::text||'/'||encode(extensions.digest(v_recipient.email,'sha256'),'hex'),
      'initial:'||new.id::text||':'||v_recipient.email,'document_request',1,
      'New document request from '||coalesce(v_buyer_name,'your buyer')||': '||new.title,new.requester_id,
      jsonb_build_object('request_id',new.id,'title',new.title,'due_date',new.due_date,'priority',new.priority)
    ) on conflict(dedupe_key) do nothing returning id into v_delivery;
    if v_delivery is not null then
      insert into public.email_delivery_requests(delivery_id,request_id,purpose)
      values(v_delivery,new.id,'initial_request') on conflict do nothing;
    end if;
  end loop;
  return new;
end $$;

create trigger enqueue_initial_request_delivery_v1
after insert on public.document_requests for each row execute function private.enqueue_initial_request_delivery_v1();

do $$ declare v_job_id bigint; begin
  select jobid into v_job_id from cron.job where jobname='process-request-reminders-v1';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end $$;

select cron.schedule('process-request-reminders-v1','0 * * * *',$$
  select net.http_post(
    url:='https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-request-reminders-v1',
    headers:=jsonb_build_object('Content-Type','application/json','X-System-Secret',(
      select decrypted_secret from vault.decrypted_secrets where name='system_cron_invocation'
    )),body:='{}'::jsonb,timeout_milliseconds:=120000
  ) as request_id;
$$);

do $$ declare v_job_id bigint; begin
  select jobid into v_job_id from cron.job where jobname='process-email-deliveries-v1';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end $$;

select cron.schedule('process-email-deliveries-v1','* * * * *',$$
  select net.http_post(
    url:='https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-email-deliveries-v1',
    headers:=jsonb_build_object('Content-Type','application/json','X-System-Secret',(
      select decrypted_secret from vault.decrypted_secrets where name='system_cron_invocation'
    )),body:='{}'::jsonb,timeout_milliseconds:=120000
  ) as request_id;
$$);
