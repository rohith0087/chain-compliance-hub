-- Fix: private.enqueue_initial_request_delivery_v1() coalesced an unqualified
-- text literal 'member' against the enum-typed company_users.role column,
-- which made Postgres try to cast 'member' into public.user_role (it isn't a
-- valid label there) and aborted every document_requests insert for any
-- buyer with reliable_request_delivery_v1 enabled. Cast the column to text
-- first so the literal stays a plain string, matching the 'owner'::text
-- branch it's unioned with.

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
      select cu.profile_id,coalesce(cu.role::text,'member'),cu.branch_id from public.company_users cu
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
