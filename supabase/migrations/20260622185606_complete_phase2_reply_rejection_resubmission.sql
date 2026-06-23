-- Complete Phase 2 reply ingestion, human review, correction delivery, and
-- retention. All behavior remains behind email_reply_ingestion_v1.

insert into public.feature_flags(key,description,default_enabled,lifecycle)
values ('email_reply_ai_shadow_v1','Shadow-only request matching for verified inbound email attachments',false,'development')
on conflict(key) do update set description=excluded.description;

alter table public.document_requests add column if not exists public_reference text;
update public.document_requests
set public_reference='R2C-'||upper(substr(replace(id::text,'-',''),1,10))
where public_reference is null;
alter table public.document_requests alter column public_reference set not null;
create unique index if not exists document_requests_public_reference_idx on public.document_requests(public_reference);
create or replace function private.ensure_document_request_public_reference()
returns trigger language plpgsql set search_path=''
as $$ begin if new.public_reference is null then new.public_reference:='R2C-'||upper(substr(replace(new.id::text,'-',''),1,10)); end if; return new; end $$;
drop trigger if exists ensure_document_request_public_reference on public.document_requests;
create trigger ensure_document_request_public_reference before insert on public.document_requests
for each row execute function private.ensure_document_request_public_reference();

alter table public.document_uploads
  add column if not exists source_channel text not null default 'portal',
  add column if not exists source_reference_id uuid;
alter table public.document_uploads drop constraint if exists document_uploads_source_channel_check;
alter table public.document_uploads add constraint document_uploads_source_channel_check
  check(source_channel in ('portal','email_reply','buyer_upload','supplier_library','migration'));
create unique index if not exists document_uploads_email_source_idx
  on public.document_uploads(source_reference_id) where source_channel='email_reply';

alter table public.inbound_routing_tokens
  add column if not exists recipient_email text,
  add column if not exists superseded_at timestamptz;
alter table public.inbound_routing_tokens drop constraint if exists inbound_routing_tokens_status_check;
alter table public.inbound_routing_tokens add constraint inbound_routing_tokens_status_check
  check(status in ('active','superseded','revoked','expired'));

alter table public.email_deliveries drop constraint if exists email_deliveries_message_type_check;
alter table public.email_deliveries add constraint email_deliveries_message_type_check
  check(message_type in ('initial_request','pre_due_reminder','due_today','overdue_reminder','manual_resend','document_correction_required','intake_clarification_required'));

create table public.document_review_decisions(
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  request_id uuid not null references public.document_requests(id) on delete restrict,
  document_upload_id uuid not null references public.document_uploads(id) on delete restrict,
  evidence_version_id uuid references public.evidence_versions(id) on delete set null,
  buyer_id uuid not null references public.buyers(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check(decision in ('approve','reject')),
  reason_code text not null check(reason_code in ('approved','expired','wrong_supplier','wrong_facility','wrong_document_type','missing_pages','unreadable','scope_mismatch','signature_missing','validity_insufficient','other')),
  reason_notes text not null check(length(btrim(reason_notes))>=3),
  before_snapshot jsonb not null,
  after_snapshot jsonb not null default '{}',
  correction_delivery_id uuid references public.email_deliveries(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index document_review_one_terminal_decision_idx on public.document_review_decisions(document_upload_id);
create index document_review_request_idx on public.document_review_decisions(request_id,created_at desc);
alter table public.document_review_decisions enable row level security;
create policy "Organization members can read document review decisions" on public.document_review_decisions
for select to authenticated using(private.has_organization_access((select auth.uid()),buyer_id,'buyer') or private.has_organization_access((select auth.uid()),supplier_id,'supplier'));
revoke all on public.document_review_decisions from anon,authenticated;
grant select on public.document_review_decisions to authenticated;
grant all on public.document_review_decisions to service_role;

create table public.supplier_email_identities(
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  normalized_email text not null check(normalized_email=lower(btrim(normalized_email)) and position('@' in normalized_email)>1),
  identity_type text not null default 'shared_mailbox' check(identity_type in ('profile','shared_mailbox','approved_alias')),
  status text not null default 'pending' check(status in ('pending','verified','revoked')),
  verification_method text check(verification_method in ('profile_membership','supplier_admin','buyer_out_of_band','platform_out_of_band')),
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(supplier_id,normalized_email)
);
create index supplier_email_identities_lookup_idx on public.supplier_email_identities(normalized_email,supplier_id,status);
alter table public.supplier_email_identities enable row level security;
create policy "Organization members can read supplier email identities" on public.supplier_email_identities
for select to authenticated using(
  private.has_organization_access((select auth.uid()),supplier_id,'supplier')
  or exists(select 1 from public.buyer_supplier_connections sc where sc.supplier_id=supplier_email_identities.supplier_id and sc.status='approved' and private.has_organization_access((select auth.uid()),sc.buyer_id,'buyer'))
);
revoke all on public.supplier_email_identities from anon,authenticated;
grant select on public.supplier_email_identities to authenticated;
grant all on public.supplier_email_identities to service_role;

insert into public.supplier_email_identities(supplier_id,profile_id,normalized_email,identity_type,status,verification_method,verified_by,verified_at)
select s.id,p.id,lower(p.email),'profile','verified','profile_membership',p.id,now()
from public.suppliers s join public.profiles p on p.id=s.profile_id
where p.email is not null
on conflict(supplier_id,normalized_email) do nothing;
insert into public.supplier_email_identities(supplier_id,profile_id,normalized_email,identity_type,status,verification_method,verified_by,verified_at)
select cu.company_id,p.id,lower(p.email),'profile','verified','profile_membership',p.id,now()
from public.company_users cu join public.suppliers s on s.id=cu.company_id join public.profiles p on p.id=cu.profile_id
where cu.company_type='supplier' and cu.status='active' and p.email is not null
on conflict(supplier_id,normalized_email) do nothing;

create table public.email_recipient_suppressions(
  normalized_email text primary key check(normalized_email=lower(btrim(normalized_email))),
  reason text not null check(reason in ('hard_bounce','complaint','administrative')),
  provider_event_id text,
  suppressed_at timestamptz not null default now(),
  released_at timestamptz,
  metadata jsonb not null default '{}'
);
alter table public.email_recipient_suppressions enable row level security;
revoke all on public.email_recipient_suppressions from public,anon,authenticated;
grant all on public.email_recipient_suppressions to service_role;

create table public.inbound_retention_policies(
  buyer_id uuid primary key references public.buyers(id) on delete cascade,
  accepted_days integer not null default 2555 check(accepted_days between 365 and 3650),
  rejected_clean_days integer not null default 90 check(rejected_clean_days between 7 and 365),
  unknown_or_malicious_days integer not null default 30 check(unknown_or_malicious_days between 7 and 180),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.inbound_retention_policies(buyer_id) select id from public.buyers on conflict do nothing;
alter table public.inbound_retention_policies enable row level security;
create policy "Buyer members can read inbound retention" on public.inbound_retention_policies
for select to authenticated using(private.has_organization_access((select auth.uid()),buyer_id,'buyer'));
create policy "Buyer admins can update inbound retention" on public.inbound_retention_policies
for update to authenticated using(private.has_organization_access((select auth.uid()),buyer_id,'buyer'))
with check(private.has_organization_access((select auth.uid()),buyer_id,'buyer'));
revoke all on public.inbound_retention_policies from anon,authenticated;
grant select,update on public.inbound_retention_policies to authenticated;
grant all on public.inbound_retention_policies to service_role;

create or replace function private.create_default_inbound_retention_policy()
returns trigger language plpgsql security definer set search_path=''
as $$ begin insert into public.inbound_retention_policies(buyer_id) values(new.id) on conflict do nothing; return new; end $$;
drop trigger if exists create_default_inbound_retention_policy on public.buyers;
create trigger create_default_inbound_retention_policy after insert on public.buyers
for each row execute function private.create_default_inbound_retention_policy();

alter table public.inbound_email_messages
  add column if not exists legal_hold boolean not null default false,
  add column if not exists content_purged_at timestamptz,
  add column if not exists rate_limit_metadata jsonb not null default '{}';
alter table public.inbound_email_attachments
  add column if not exists legal_hold boolean not null default false,
  add column if not exists content_purged_at timestamptz,
  add column if not exists review_reason_code text,
  add column if not exists review_notes text;
alter table public.inbound_review_decisions add column if not exists reason_code text;
alter table public.inbound_review_decisions drop constraint if exists inbound_review_decisions_decision_check;
alter table public.inbound_review_decisions add constraint inbound_review_decisions_decision_check
  check(decision in ('accept','reassign','reject','mark_malicious','request_clarification','request_correction','not_relevant'));

create table public.inbound_rate_limit_events(
  id bigint generated always as identity primary key,
  routing_token_id uuid references public.inbound_routing_tokens(id) on delete cascade,
  sender_email text not null,
  sender_domain text not null,
  received_at timestamptz not null default now()
);
create index inbound_rate_token_idx on public.inbound_rate_limit_events(routing_token_id,received_at desc);
create index inbound_rate_sender_idx on public.inbound_rate_limit_events(sender_email,received_at desc);
create index inbound_rate_domain_idx on public.inbound_rate_limit_events(sender_domain,received_at desc);
alter table public.inbound_rate_limit_events enable row level security;
revoke all on public.inbound_rate_limit_events from public,anon,authenticated;
grant all on public.inbound_rate_limit_events to service_role;

create table public.inbound_operational_alerts(
  id uuid primary key default gen_random_uuid(),
  alert_key text not null,
  severity text not null check(severity in ('warning','critical')),
  status text not null default 'open' check(status in ('open','acknowledged','resolved')),
  details jsonb not null default '{}',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(alert_key,status)
);
alter table public.inbound_operational_alerts enable row level security;
create policy "Platform admins can read inbound operational alerts" on public.inbound_operational_alerts
for select to authenticated using(exists(select 1 from public.platform_administrators pa where pa.auth_user_id=(select auth.uid()) and pa.is_active));
revoke all on public.inbound_operational_alerts from anon,authenticated;
grant select on public.inbound_operational_alerts to authenticated;
grant all on public.inbound_operational_alerts to service_role;

create policy "Platform admins can read inbound processing jobs" on public.inbound_processing_jobs
for select to authenticated using(exists(select 1 from public.platform_administrators pa where pa.auth_user_id=(select auth.uid()) and pa.is_active));
grant select on public.inbound_processing_jobs to authenticated;

create or replace function private.review_document_submission_v2(
  p_actor_id uuid,p_request_id uuid,p_upload_id uuid,p_decision text,p_reason_code text,p_reason_notes text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_request public.document_requests%rowtype; v_upload public.document_uploads%rowtype; v_decision uuid;
  v_recipient record; v_delivery uuid; v_before jsonb; v_existing public.document_review_decisions%rowtype;
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if p_actor_id is null or coalesce(length(btrim(p_reason_notes)),0)<3 then raise exception 'Reviewer and reason notes are required'; end if;
  if p_decision not in ('approve','reject') then raise exception 'Unsupported decision'; end if;
  if p_decision='approve' and p_reason_code<>'approved' then raise exception 'Approval reason must be approved'; end if;
  if p_decision='reject' and p_reason_code not in ('expired','wrong_supplier','wrong_facility','wrong_document_type','missing_pages','unreadable','scope_mismatch','signature_missing','validity_insufficient','other') then raise exception 'Unsupported rejection reason'; end if;
  if p_reason_code='other' and length(btrim(p_reason_notes))<10 then raise exception 'Other requires a detailed explanation'; end if;
  select * into v_existing from public.document_review_decisions where idempotency_key=p_idempotency_key;
  if v_existing.id is not null then return jsonb_build_object('decision_id',v_existing.id,'duplicate',true,'correction_delivery_id',v_existing.correction_delivery_id); end if;
  select * into v_request from public.document_requests where id=p_request_id for update;
  select * into v_upload from public.document_uploads where id=p_upload_id and request_id=p_request_id for update;
  if v_request.id is null or v_upload.id is null then raise exception 'Request or upload not found'; end if;
  if not private.has_organization_access(p_actor_id,v_request.buyer_id,'buyer') or not exists(
    select 1 from public.buyers b where b.id=v_request.buyer_id and b.profile_id=p_actor_id
    union all select 1 from public.company_users cu where cu.profile_id=p_actor_id and cu.company_id=v_request.buyer_id and cu.company_type='buyer' and cu.status='active' and cu.role::text in ('company_admin','branch_manager','document_manager','approver')
  ) then raise exception 'Evidence reviewer role required'; end if;
  if exists(select 1 from public.document_uploads newer where newer.request_id=p_request_id and (newer.version>v_upload.version or (newer.version=v_upload.version and newer.created_at>v_upload.created_at))) then raise exception 'Only the latest version can be reviewed'; end if;
  if v_upload.status not in ('pending_review','submitted','pending') then raise exception 'Upload is no longer reviewable'; end if;
  v_before=to_jsonb(v_upload);
  perform set_config('tracer2c.human_reviewer_id',p_actor_id::text,true);
  update public.document_uploads set status=case when p_decision='approve' then 'approved' else 'rejected' end,
    reviewer_notes=p_reason_notes,updated_at=now() where id=p_upload_id;
  update public.document_requests set status=case when p_decision='approve' then 'approved'::public.request_status else 'rejected'::public.request_status end,
    fulfillment_status=case when p_decision='approve' then 'fulfilled_new_upload' else 'clarification_requested' end,updated_at=now() where id=p_request_id;
  insert into public.document_review_decisions(idempotency_key,request_id,document_upload_id,evidence_version_id,buyer_id,supplier_id,reviewer_id,decision,reason_code,reason_notes,before_snapshot,after_snapshot)
  values(p_idempotency_key,p_request_id,p_upload_id,v_upload.canonical_evidence_version_id,v_request.buyer_id,v_request.supplier_id,p_actor_id,p_decision,p_reason_code,p_reason_notes,v_before,
    jsonb_build_object('upload_status',case when p_decision='approve' then 'approved' else 'rejected' end,'request_status',case when p_decision='approve' then 'approved' else 'rejected' end)) returning id into v_decision;
  if v_upload.canonical_evidence_version_id is not null then
    insert into public.evidence_attestations(evidence_version_id,organization_id,organization_type,attestation_type,outcome,purpose,actor_id,notes,policy_snapshot)
    values(v_upload.canonical_evidence_version_id,v_request.buyer_id,'buyer',case when p_decision='approve' then 'buyer_acceptance' else 'rejection' end,
      case when p_decision='approve' then 'accepted' else 'rejected' end,'document_review',p_actor_id,p_reason_notes,jsonb_build_object('request_id',p_request_id,'decision_id',v_decision,'reason_code',p_reason_code));
    update public.request_evidence_links set relation=case when p_decision='approve' then 'accepted' else 'rejected' end,
      qualification=case when p_decision='approve' then 'eligible' else 'ineligible' end,
      qualification_reasons=case when p_decision='approve' then '{}'::text[] else array[p_reason_code] end,decided_by=p_actor_id,decided_at=now()
    where request_id=p_request_id and evidence_version_id=v_upload.canonical_evidence_version_id;
  end if;
  perform public.create_notification(v_upload.uploader_id,case when p_decision='approve' then 'Document Approved' else 'Document Correction Required' end,
    case when p_decision='approve' then 'Your document "'||v_request.title||'" was approved.' else 'Your document "'||v_request.title||'" requires correction. Reason: '||p_reason_notes end,
    case when p_decision='approve' then 'document_approved' else 'document_rejected' end,p_request_id);
  if p_decision='reject' then
    select p.id profile_id,lower(p.email) email,p.full_name name into v_recipient from public.profiles p
    where p.id=v_upload.uploader_id and p.email is not null and exists(select 1 from public.supplier_email_identities sei where sei.supplier_id=v_request.supplier_id and sei.normalized_email=lower(p.email) and sei.status='verified');
    if v_recipient.email is null then
      select d.recipient_profile_id profile_id,d.recipient_email email,d.recipient_name name into v_recipient
      from public.email_delivery_requests l join public.email_deliveries d on d.id=l.delivery_id
      where l.request_id=p_request_id and d.status not in ('bounced','complained','suppressed') order by d.created_at desc limit 1;
    end if;
    if v_recipient.email is not null and not exists(select 1 from public.email_recipient_suppressions s where s.normalized_email=v_recipient.email and s.released_at is null) then
      insert into public.email_deliveries(buyer_id,supplier_id,recipient_profile_id,recipient_email,recipient_name,recipient_role,message_type,status,idempotency_key,dedupe_key,template_key,subject,created_by,metadata)
      values(v_request.buyer_id,v_request.supplier_id,v_recipient.profile_id,v_recipient.email,v_recipient.name,'submitter','document_correction_required','queued',
        'document-correction/'||v_decision,'document-correction/'||p_upload_id,'document_correction_required','['||v_request.public_reference||'] Correction required: '||v_request.title,p_actor_id,
        jsonb_build_object('decision_id',v_decision,'upload_id',p_upload_id,'reason_code',p_reason_code,'reason_notes',p_reason_notes,'request_reference',v_request.public_reference)) returning id into v_delivery;
      insert into public.email_delivery_requests(delivery_id,request_id,purpose,reminder_stage) values(v_delivery,p_request_id,'manual_resend','correction_required');
      update public.document_review_decisions set correction_delivery_id=v_delivery where id=v_decision;
    else
      insert into public.inbound_operational_alerts(alert_key,severity,details) values('missing-correction-recipient/'||p_request_id,'critical',jsonb_build_object('request_id',p_request_id,'decision_id',v_decision)) on conflict do nothing;
    end if;
  end if;
  insert into public.evidence_resolution_events(request_id,buyer_id,supplier_id,evidence_version_id,event_type,actor_id,metadata)
  values(p_request_id,v_request.buyer_id,v_request.supplier_id,v_upload.canonical_evidence_version_id,case when p_decision='approve' then 'evidence_approved' else 'evidence_rejected' end,p_actor_id,jsonb_build_object('decision_id',v_decision,'reason_code',p_reason_code));
  insert into public.compliance_domain_events(buyer_id,subject_type,subject_id,event_type,payload)
  values(v_request.buyer_id,'supplier',v_request.supplier_id,'decision_changed',jsonb_build_object('request_id',p_request_id,'upload_id',p_upload_id,'decision_id',v_decision,'decision',p_decision));
  return jsonb_build_object('decision_id',v_decision,'decision',p_decision,'correction_delivery_id',v_delivery,'duplicate',false);
end $$;

create or replace function public.review_document_submission_v2(
  p_actor_id uuid,p_request_id uuid,p_upload_id uuid,p_decision text,p_reason_code text,p_reason_notes text,p_idempotency_key text
) returns jsonb language sql security invoker set search_path=''
as $$ select private.review_document_submission_v2(p_actor_id,p_request_id,p_upload_id,p_decision,p_reason_code,p_reason_notes,p_idempotency_key) $$;
revoke all on function public.review_document_submission_v2(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.review_document_submission_v2(uuid,uuid,uuid,text,text,text,text) to service_role;

create or replace function private.guard_email_originated_human_review()
returns trigger language plpgsql set search_path=''
as $$ begin
  if old.status is distinct from new.status and new.status in ('approved','rejected') and old.source_channel='email_reply'
    and nullif(current_setting('tracer2c.human_reviewer_id',true),'') is null then
    raise exception 'Email-originated evidence requires the human review transaction';
  end if;
  return new;
end $$;
drop trigger if exists guard_email_originated_human_review on public.document_uploads;
create trigger guard_email_originated_human_review before update of status on public.document_uploads
for each row execute function private.guard_email_originated_human_review();

create or replace function private.guard_email_request_human_review()
returns trigger language plpgsql set search_path=''
as $$ begin
  if old.status is distinct from new.status and new.status in ('approved','rejected')
    and nullif(current_setting('tracer2c.human_reviewer_id',true),'') is null
    and exists (
      select 1
      from public.document_uploads u
      where u.request_id = old.id
        and u.source_channel = 'email_reply'
      order by u.version desc, u.created_at desc
      limit 1
    ) then
    raise exception 'Email-originated request decisions require the human review transaction';
  end if;
  return new;
end $$;
drop trigger if exists guard_email_request_human_review on public.document_requests;
create trigger guard_email_request_human_review before update of status on public.document_requests
for each row execute function private.guard_email_request_human_review();

create or replace function public.record_inbound_rate_limit_v1(p_routing_token_id uuid,p_sender_email text)
returns jsonb language plpgsql security invoker set search_path=''
as $$ declare v_domain text:=split_part(lower(p_sender_email),'@',2); v_token_15 integer; v_sender_hour integer; v_domain_hour integer; begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  delete from public.inbound_rate_limit_events where received_at<now()-interval '2 days';
  select count(*) into v_token_15 from public.inbound_rate_limit_events where routing_token_id=p_routing_token_id and received_at>now()-interval '15 minutes';
  select count(*) into v_sender_hour from public.inbound_rate_limit_events where sender_email=lower(p_sender_email) and received_at>now()-interval '1 hour';
  select count(*) into v_domain_hour from public.inbound_rate_limit_events where sender_domain=v_domain and received_at>now()-interval '1 hour';
  insert into public.inbound_rate_limit_events(routing_token_id,sender_email,sender_domain) values(p_routing_token_id,lower(p_sender_email),v_domain);
  return jsonb_build_object('allowed',v_token_15<10 and v_sender_hour<20 and v_domain_hour<100,'token_15m',v_token_15+1,'sender_1h',v_sender_hour+1,'domain_1h',v_domain_hour+1);
end $$;
revoke all on function public.record_inbound_rate_limit_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.record_inbound_rate_limit_v1(uuid,text) to service_role;

create or replace function public.review_inbound_attachment_v1(
  p_actor_id uuid,p_attachment_id uuid,p_decision text,p_request_id uuid,p_final_storage_path text,p_reason text,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_attachment public.inbound_email_attachments%rowtype; v_message public.inbound_email_messages%rowtype;
  v_request public.document_requests%rowtype; v_upload uuid; v_version integer; v_canonical jsonb; v_before jsonb;
  v_platform_admin boolean; v_delivery uuid; v_sender record; v_effective_decision text:=p_decision;
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if p_actor_id is null or coalesce(length(btrim(p_reason)),0)<3 or coalesce(length(btrim(p_notes)),0)<3 then raise exception 'Reviewer, reason code, and notes are required'; end if;
  if p_decision='reject' then v_effective_decision:='not_relevant'; end if;
  if p_decision='request_clarification' then v_effective_decision:='request_correction'; end if;
  if v_effective_decision not in ('accept','reassign','request_correction','not_relevant','mark_malicious') then raise exception 'Unsupported review decision'; end if;
  select * into v_attachment from public.inbound_email_attachments where id=p_attachment_id for update;
  if v_attachment.id is null then raise exception 'Attachment not found'; end if;
  select * into v_message from public.inbound_email_messages where id=v_attachment.message_id for update;
  select exists(select 1 from public.platform_administrators pa where pa.auth_user_id=p_actor_id and pa.is_active) into v_platform_admin;
  if v_message.candidate_buyer_id is null then
    if not v_platform_admin or v_effective_decision not in ('not_relevant','mark_malicious') then raise exception 'Platform quarantine access required'; end if;
  elsif not private.has_organization_access(p_actor_id,v_message.candidate_buyer_id,'buyer') and not v_platform_admin then raise exception 'Buyer review access required';
  end if;
  if v_attachment.review_status<>'pending' then raise exception 'Attachment was already reviewed'; end if;
  v_before:=to_jsonb(v_attachment);
  if v_effective_decision in ('accept','reassign') then
    if p_request_id is null or coalesce(p_final_storage_path,'')='' then raise exception 'Request and final storage path are required'; end if;
    if v_attachment.scan_status<>'clean' or v_attachment.is_encrypted then raise exception 'Only clean, readable attachments can be accepted'; end if;
    if v_message.sender_profile_id is null or v_message.candidate_supplier_id is null then raise exception 'Verified supplier sender is required'; end if;
    select * into v_request from public.document_requests where id=p_request_id for update;
    if v_request.id is null or v_request.buyer_id<>v_message.candidate_buyer_id or v_request.supplier_id<>v_message.candidate_supplier_id then raise exception 'Request tenant mismatch'; end if;
    if v_request.status not in ('pending','rejected') then raise exception 'Request no longer accepts evidence'; end if;
    select coalesce(max(version),0)+1 into v_version from public.document_uploads where request_id=v_request.id;
    insert into public.document_uploads(request_id,uploader_id,file_name,file_path,file_size,mime_type,document_name,status,version,source_channel,source_reference_id)
    values(v_request.id,v_message.sender_profile_id,v_attachment.original_filename,p_final_storage_path,v_attachment.file_size,v_attachment.detected_mime_type,
      v_attachment.original_filename,'pending_review',v_version,'email_reply',v_attachment.id) returning id into v_upload;
    update public.document_requests set status='submitted',fulfillment_status='new_version_required',updated_at=now() where id=v_request.id;
    v_canonical:=public.finalize_canonical_upload_v1('document_upload',v_upload,v_attachment.sha256,v_request.document_type,v_attachment.original_filename,null,'[]'::jsonb,'{"malware_scan_status":"clean","schema_version":1,"source_channel":"email_reply"}'::jsonb);
    update public.inbound_email_attachments set review_status=case when v_effective_decision='reassign' then 'reassigned' else 'accepted' end,
      review_reason_code=p_reason,review_notes=p_notes,proposed_request_id=v_request.id,final_storage_path=p_final_storage_path,final_document_upload_id=v_upload,
      final_evidence_version_id=(v_canonical->>'evidence_version_id')::uuid,updated_at=now() where id=v_attachment.id;
  elsif v_effective_decision='request_correction' then
    if v_message.sender_profile_id is null or v_message.candidate_buyer_id is null or v_message.candidate_supplier_id is null then raise exception 'Verified matched sender is required for correction'; end if;
    if p_request_id is null then p_request_id:=v_attachment.proposed_request_id; end if;
    select * into v_request from public.document_requests where id=p_request_id for update;
    if v_request.id is null or v_request.buyer_id<>v_message.candidate_buyer_id or v_request.supplier_id<>v_message.candidate_supplier_id or v_request.status not in ('pending','rejected') then raise exception 'Open matched request required'; end if;
    select p.id profile_id,lower(p.email) email,p.full_name name into v_sender from public.profiles p where p.id=v_message.sender_profile_id;
    if v_sender.email is null or not exists(select 1 from public.supplier_email_identities sei where sei.supplier_id=v_request.supplier_id and sei.normalized_email=v_sender.email and sei.status='verified') then raise exception 'Verified sender identity required'; end if;
    if exists(select 1 from public.email_recipient_suppressions s where s.normalized_email=v_sender.email and s.released_at is null) then raise exception 'Sender email is suppressed'; end if;
    insert into public.email_deliveries(buyer_id,supplier_id,recipient_profile_id,recipient_email,recipient_name,recipient_role,message_type,status,idempotency_key,dedupe_key,template_key,subject,created_by,metadata)
    values(v_request.buyer_id,v_request.supplier_id,v_sender.profile_id,v_sender.email,v_sender.name,'submitter','intake_clarification_required','queued',
      'intake-correction/'||v_attachment.id,'intake-correction/'||v_attachment.id,'intake_clarification_required','['||v_request.public_reference||'] Clarification required: '||v_request.title,p_actor_id,
      jsonb_build_object('attachment_id',v_attachment.id,'reason_code',p_reason,'reason_notes',p_notes,'request_reference',v_request.public_reference)) returning id into v_delivery;
    insert into public.email_delivery_requests(delivery_id,request_id,purpose,reminder_stage) values(v_delivery,v_request.id,'manual_resend','intake_clarification');
    update public.inbound_email_attachments set review_status='clarification_requested',review_reason_code=p_reason,review_notes=p_notes,updated_at=now() where id=v_attachment.id;
  elsif v_effective_decision='not_relevant' then
    update public.inbound_email_attachments set review_status='rejected',review_reason_code=p_reason,review_notes=p_notes,updated_at=now() where id=v_attachment.id;
  else
    update public.inbound_email_attachments set review_status='malicious',review_reason_code=p_reason,review_notes=p_notes,
      scan_status=case when scan_status='clean' then 'failed' else scan_status end,updated_at=now() where id=v_attachment.id;
    update public.inbound_email_messages set status='quarantined',quarantine_reason='reviewer_marked_malicious',updated_at=now() where id=v_message.id;
  end if;
  insert into public.inbound_review_decisions(message_id,attachment_id,reviewer_id,buyer_id,decision,selected_request_id,reason,reason_code,notes,before_snapshot,after_snapshot)
  select v_message.id,v_attachment.id,p_actor_id,v_message.candidate_buyer_id,v_effective_decision,p_request_id,p_notes,p_reason,p_notes,v_before,to_jsonb(a)
  from public.inbound_email_attachments a where a.id=v_attachment.id;
  if not exists(select 1 from public.inbound_email_attachments where message_id=v_message.id and review_status='pending') then
    update public.inbound_email_messages set status=case when exists(select 1 from public.inbound_email_attachments where message_id=v_message.id and review_status in ('accepted','reassigned')) then 'accepted' else 'rejected' end,processed_at=now(),updated_at=now() where id=v_message.id;
  elsif v_effective_decision in ('accept','reassign') then update public.inbound_email_messages set status='partially_accepted',updated_at=now() where id=v_message.id;
  end if;
  return jsonb_build_object('message_id',v_message.id,'attachment_id',v_attachment.id,'decision',v_effective_decision,'document_upload_id',v_upload,'canonical',v_canonical,'correction_delivery_id',v_delivery);
end $$;
revoke all on function public.review_inbound_attachment_v1(uuid,uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.review_inbound_attachment_v1(uuid,uuid,text,uuid,text,text,text) to service_role;

create or replace view public.inbound_email_operations_v1 with(security_invoker=true) as
select m.candidate_buyer_id buyer_id,m.status,m.match_result,count(*) message_count,min(m.received_at) oldest_received_at,
  count(*) filter(where j.status='dead_letter') dead_letter_count,
  count(*) filter(where exists(select 1 from public.inbound_email_attachments a where a.message_id=m.id and a.scan_status='failed')) scan_failure_count
from public.inbound_email_messages m left join public.inbound_processing_jobs j on j.message_id=m.id
group by m.candidate_buyer_id,m.status,m.match_result;
grant select on public.inbound_email_operations_v1 to authenticated,service_role;

do $$ declare v_job_id bigint; begin
  select jobid into v_job_id from cron.job where jobname='cleanup-inbound-email-v1';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end $$;
select cron.schedule('cleanup-inbound-email-v1','17 3 * * *',$$
  select net.http_post(
    url:='https://edwerzutsknhuplidhsj.supabase.co/functions/v1/cleanup-inbound-email-v1',
    headers:=jsonb_build_object('Content-Type','application/json','X-System-Secret',(select decrypted_secret from vault.decrypted_secrets where name='system_cron_invocation')),
    body:='{}',timeout_milliseconds:=120000
  ) as request_id;
$$);
