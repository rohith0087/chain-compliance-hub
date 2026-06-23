insert into public.feature_flags(key,description,default_enabled,lifecycle)
values ('email_reply_ingestion_v1','Resend inbound supplier replies with quarantined attachments and human review',false,'development')
on conflict(key) do update set description=excluded.description;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
  ('inbound-email-quarantine','inbound-email-quarantine',false,41943040,null),
  ('inbound-email-provenance','inbound-email-provenance',false,41943040,array['message/rfc822','application/json'])
on conflict(id) do update set public=false;

create table public.inbound_routing_tokens(
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check(token_hash ~ '^[0-9a-f]{64}$'),
  delivery_id uuid not null references public.email_deliveries(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  request_ids uuid[] not null check(cardinality(request_ids)>0),
  status text not null default 'active' check(status in ('active','revoked','expired')),
  expires_at timestamptz not null,
  grace_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(grace_until>=expires_at),
  unique(delivery_id)
);

create table public.inbound_email_messages(
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'resend' check(provider='resend'),
  provider_email_id text not null unique,
  webhook_event_id text unique,
  rfc_message_id text,
  in_reply_to text,
  reference_headers text[],
  envelope_from text not null,
  normalized_sender text not null,
  sender_profile_id uuid references public.profiles(id) on delete set null,
  recipients text[] not null default '{}',
  cc text[] not null default '{}',
  bcc text[] not null default '{}',
  subject text not null default '',
  text_body text,
  sanitized_html text,
  raw_storage_path text,
  raw_sha256 text check(raw_sha256 is null or raw_sha256 ~ '^[0-9a-f]{64}$'),
  routing_token_id uuid references public.inbound_routing_tokens(id) on delete set null,
  candidate_buyer_id uuid references public.buyers(id) on delete set null,
  candidate_supplier_id uuid references public.suppliers(id) on delete set null,
  candidate_request_ids uuid[] not null default '{}',
  match_result text not null default 'unknown' check(match_result in ('matched','ambiguous','unknown','suspicious')),
  match_confidence numeric(5,4) check(match_confidence between 0 and 1),
  match_reasons jsonb not null default '[]',
  authentication_metadata jsonb not null default '{}',
  status text not null default 'received' check(status in ('received','retrieving','processing','awaiting_review','quarantined','accepted','partially_accepted','rejected','failed')),
  quarantine_reason text,
  processing_error text,
  received_at timestamptz not null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inbound_email_attachments(
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.inbound_email_messages(id) on delete cascade,
  provider_attachment_id text not null,
  original_filename text not null,
  sanitized_filename text not null,
  declared_mime_type text,
  detected_mime_type text,
  content_disposition text,
  content_id text,
  file_size bigint check(file_size is null or file_size>=0),
  sha256 text check(sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  quarantine_storage_path text unique,
  scan_status text not null default 'pending' check(scan_status in ('pending','clean','infected','failed','not_scanned')),
  scan_provider text,
  scan_result jsonb not null default '{}',
  archive_inspection jsonb not null default '{}',
  is_encrypted boolean not null default false,
  is_inline boolean not null default false,
  duplicate_document_asset_id uuid references public.document_assets(id) on delete set null,
  proposed_request_id uuid references public.document_requests(id) on delete set null,
  proposed_document_type text,
  classification jsonb not null default '{}',
  classification_confidence numeric(5,4) check(classification_confidence between 0 and 1),
  match_reasons jsonb not null default '[]',
  review_status text not null default 'pending' check(review_status in ('pending','accepted','reassigned','rejected','malicious','clarification_requested')),
  final_storage_path text,
  final_document_upload_id uuid references public.document_uploads(id) on delete set null,
  final_evidence_version_id uuid references public.evidence_versions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(message_id,provider_attachment_id)
);

create table public.inbound_processing_jobs(
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.inbound_email_messages(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','processing','retry','completed','failed','dead_letter')),
  attempts integer not null default 0 check(attempts>=0),
  max_attempts integer not null default 5 check(max_attempts between 1 and 20),
  scheduled_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.inbound_review_decisions(
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.inbound_email_messages(id) on delete restrict,
  attachment_id uuid not null references public.inbound_email_attachments(id) on delete restrict,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  buyer_id uuid references public.buyers(id) on delete restrict,
  decision text not null check(decision in ('accept','reassign','reject','mark_malicious','request_clarification')),
  selected_request_id uuid references public.document_requests(id) on delete set null,
  reason text not null,
  notes text,
  before_snapshot jsonb not null,
  after_snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create index inbound_routing_tokens_lookup_idx on public.inbound_routing_tokens(token_hash,status,grace_until);
create index inbound_messages_review_idx on public.inbound_email_messages(candidate_buyer_id,status,received_at desc);
create index inbound_messages_sender_idx on public.inbound_email_messages(normalized_sender,received_at desc);
create index inbound_attachments_review_idx on public.inbound_email_attachments(message_id,review_status);
create index inbound_jobs_claim_idx on public.inbound_processing_jobs(status,scheduled_at) where status in ('pending','retry');

alter table public.inbound_routing_tokens enable row level security;
alter table public.inbound_email_messages enable row level security;
alter table public.inbound_email_attachments enable row level security;
alter table public.inbound_processing_jobs enable row level security;
alter table public.inbound_review_decisions enable row level security;

create policy "Buyer reviewers can read matched inbound messages" on public.inbound_email_messages
for select to authenticated using(candidate_buyer_id is not null and private.has_organization_access((select auth.uid()),candidate_buyer_id,'buyer'));
create policy "Platform admins can read quarantined inbound messages" on public.inbound_email_messages
for select to authenticated using(exists(select 1 from public.platform_administrators pa where pa.auth_user_id=(select auth.uid()) and pa.is_active));
create policy "Buyer reviewers can read inbound attachments" on public.inbound_email_attachments
for select to authenticated using(exists(select 1 from public.inbound_email_messages m where m.id=message_id and m.candidate_buyer_id is not null and private.has_organization_access((select auth.uid()),m.candidate_buyer_id,'buyer')));
create policy "Platform admins can read quarantined inbound attachments" on public.inbound_email_attachments
for select to authenticated using(exists(select 1 from public.inbound_email_messages m join public.platform_administrators pa on pa.auth_user_id=(select auth.uid()) and pa.is_active where m.id=message_id));
create policy "Buyer reviewers can read inbound decisions" on public.inbound_review_decisions
for select to authenticated using(buyer_id is not null and private.has_organization_access((select auth.uid()),buyer_id,'buyer'));
create policy "Platform admins can read quarantine decisions" on public.inbound_review_decisions
for select to authenticated using(exists(select 1 from public.platform_administrators pa where pa.auth_user_id=(select auth.uid()) and pa.is_active));

revoke all on public.inbound_routing_tokens,public.inbound_email_messages,public.inbound_email_attachments,public.inbound_processing_jobs,public.inbound_review_decisions from anon,authenticated;
grant select on public.inbound_email_messages,public.inbound_email_attachments,public.inbound_review_decisions to authenticated;
grant all on public.inbound_routing_tokens,public.inbound_email_messages,public.inbound_email_attachments,public.inbound_processing_jobs,public.inbound_review_decisions to service_role;

create or replace function public.claim_inbound_processing_jobs_v1(p_batch_size integer default 5)
returns setof public.inbound_processing_jobs language plpgsql security invoker set search_path=''
as $$ begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if p_batch_size not between 1 and 25 then raise exception 'batch size must be between 1 and 25'; end if;
  return query update public.inbound_processing_jobs j
  set status='processing',attempts=j.attempts+1,started_at=now(),lease_expires_at=now()+interval '5 minutes',updated_at=now()
  where j.id in(select q.id from public.inbound_processing_jobs q
    where (q.status in ('pending','retry') and q.scheduled_at<=now()) or (q.status='processing' and q.lease_expires_at<now())
    order by q.scheduled_at,q.id limit p_batch_size for update skip locked)
  returning j.*;
end $$;
revoke all on function public.claim_inbound_processing_jobs_v1(integer) from public,anon,authenticated;
grant execute on function public.claim_inbound_processing_jobs_v1(integer) to service_role;

create or replace function public.review_inbound_attachment_v1(
  p_actor_id uuid,p_attachment_id uuid,p_decision text,p_request_id uuid,p_final_storage_path text,p_reason text,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_attachment public.inbound_email_attachments%rowtype; v_message public.inbound_email_messages%rowtype;
  v_request public.document_requests%rowtype; v_upload uuid; v_version integer; v_canonical jsonb; v_before jsonb; v_platform_admin boolean;
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if p_actor_id is null or coalesce(length(btrim(p_reason)),0)<3 then raise exception 'Reviewer and reason are required'; end if;
  if p_decision not in ('accept','reassign','reject','mark_malicious','request_clarification') then raise exception 'Unsupported review decision'; end if;
  select * into v_attachment from public.inbound_email_attachments where id=p_attachment_id for update;
  if v_attachment.id is null then raise exception 'Attachment not found'; end if;
  select * into v_message from public.inbound_email_messages where id=v_attachment.message_id for update;
  select exists(select 1 from public.platform_administrators pa where pa.auth_user_id=p_actor_id and pa.is_active) into v_platform_admin;
  if v_message.candidate_buyer_id is null then
    if not v_platform_admin or p_decision not in ('reject','mark_malicious') then raise exception 'Platform quarantine access required'; end if;
  elsif not private.has_organization_access(p_actor_id,v_message.candidate_buyer_id,'buyer') and not v_platform_admin then raise exception 'Buyer review access required';
  end if;
  if v_attachment.review_status<>'pending' then raise exception 'Attachment was already reviewed'; end if;
  v_before:=to_jsonb(v_attachment);
  if p_decision in ('accept','reassign') then
    if p_request_id is null or coalesce(p_final_storage_path,'')='' then raise exception 'Request and final storage path are required'; end if;
    if v_attachment.scan_status<>'clean' or v_attachment.is_encrypted then raise exception 'Only clean, readable attachments can be accepted'; end if;
    if v_message.sender_profile_id is null or v_message.candidate_supplier_id is null then raise exception 'Verified supplier sender is required'; end if;
    select * into v_request from public.document_requests where id=p_request_id for update;
    if v_request.id is null or v_request.buyer_id<>v_message.candidate_buyer_id or v_request.supplier_id<>v_message.candidate_supplier_id then raise exception 'Request tenant mismatch'; end if;
    if v_request.status not in ('pending','rejected') then raise exception 'Request no longer accepts evidence'; end if;
    select coalesce(max(version),0)+1 into v_version from public.document_uploads where request_id=v_request.id;
    insert into public.document_uploads(request_id,uploader_id,file_name,file_path,file_size,mime_type,document_name,status,version)
    values(v_request.id,v_message.sender_profile_id,v_attachment.original_filename,p_final_storage_path,v_attachment.file_size,v_attachment.detected_mime_type,
      v_attachment.original_filename,'pending_review',v_version) returning id into v_upload;
    update public.document_requests set status='submitted',updated_at=now() where id=v_request.id;
    v_canonical:=public.finalize_canonical_upload_v1('document_upload',v_upload,v_attachment.sha256,v_request.document_type,v_attachment.original_filename,null,'[]','{"malware_scan_status":"clean","schema_version":1}');
    update public.inbound_email_attachments set review_status=case when p_decision='reassign' then 'reassigned' else 'accepted' end,
      proposed_request_id=v_request.id,final_storage_path=p_final_storage_path,final_document_upload_id=v_upload,
      final_evidence_version_id=(v_canonical->>'evidence_version_id')::uuid,updated_at=now() where id=v_attachment.id;
  elsif p_decision='reject' then
    update public.inbound_email_attachments set review_status='rejected',updated_at=now() where id=v_attachment.id;
  elsif p_decision='mark_malicious' then
    update public.inbound_email_attachments set review_status='malicious',scan_status=case when scan_status='clean' then 'failed' else scan_status end,updated_at=now() where id=v_attachment.id;
    update public.inbound_email_messages set status='quarantined',quarantine_reason='reviewer_marked_malicious',updated_at=now() where id=v_message.id;
  else
    update public.inbound_email_attachments set review_status='clarification_requested',updated_at=now() where id=v_attachment.id;
  end if;
  insert into public.inbound_review_decisions(message_id,attachment_id,reviewer_id,buyer_id,decision,selected_request_id,reason,notes,before_snapshot,after_snapshot)
  select v_message.id,v_attachment.id,p_actor_id,v_message.candidate_buyer_id,p_decision,p_request_id,p_reason,p_notes,v_before,to_jsonb(a)
  from public.inbound_email_attachments a where a.id=v_attachment.id;
  if not exists(select 1 from public.inbound_email_attachments where message_id=v_message.id and review_status='pending') then
    update public.inbound_email_messages set status=case when exists(select 1 from public.inbound_email_attachments where message_id=v_message.id and review_status in ('accepted','reassigned')) then 'accepted' else 'rejected' end,processed_at=now(),updated_at=now() where id=v_message.id;
  else update public.inbound_email_messages set status='partially_accepted',updated_at=now() where id=v_message.id and p_decision in ('accept','reassign');
  end if;
  return jsonb_build_object('message_id',v_message.id,'attachment_id',v_attachment.id,'decision',p_decision,'document_upload_id',v_upload,'canonical',v_canonical);
end $$;
revoke all on function public.review_inbound_attachment_v1(uuid,uuid,text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.review_inbound_attachment_v1(uuid,uuid,text,uuid,text,text,text) to service_role;

do $$ declare v_job_id bigint; begin
  select jobid into v_job_id from cron.job where jobname='process-inbound-email-jobs-v1';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end $$;
select cron.schedule('process-inbound-email-jobs-v1','*/2 * * * *',$$
  select net.http_post(
    url:='https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-inbound-email-jobs-v1',
    headers:=jsonb_build_object('Content-Type','application/json','X-System-Secret',(select decrypted_secret from vault.decrypted_secrets where name='system_cron_invocation')),
    body:='{}',timeout_milliseconds:=120000
  ) as request_id;
$$);
