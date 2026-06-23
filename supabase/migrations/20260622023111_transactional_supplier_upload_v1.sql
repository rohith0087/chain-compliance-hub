insert into public.feature_flags(key,description,default_enabled,lifecycle)
values ('transactional_supplier_upload_v1','Idempotent supplier upload sessions and atomic database finalization',false,'development')
on conflict (key) do update set description=excluded.description;

create table public.supplier_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.document_requests(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'initiated' check (status in ('initiated','uploaded','verifying','scanning','finalizing','completed','failed','expired','canceled')),
  idempotency_key text not null,
  storage_path text not null unique,
  original_file_name text not null,
  declared_mime_type text,
  detected_mime_type text,
  file_size bigint check (file_size is null or file_size between 1 and 10485760),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  scan_status text not null default 'pending' check (scan_status in ('pending','clean','infected','failed')),
  scan_provider text,
  scan_result jsonb,
  expiration_date date,
  no_expiration boolean not null default false,
  document_name text,
  notes text,
  linked_item_ids uuid[] not null default '{}',
  document_upload_id uuid references public.document_uploads(id) on delete set null,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now()+interval '2 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(uploader_id,idempotency_key),
  check (no_expiration or expiration_date is not null)
);

create index supplier_upload_sessions_request_idx on public.supplier_upload_sessions(request_id,created_at desc);
create index supplier_upload_sessions_reconcile_idx on public.supplier_upload_sessions(status,expires_at)
where status not in ('completed','canceled','expired');

alter table public.supplier_upload_sessions enable row level security;
create policy "Supplier members can read upload sessions" on public.supplier_upload_sessions
for select to authenticated using (
  uploader_id=(select auth.uid()) and private.has_organization_access((select auth.uid()),supplier_id,'supplier')
);
create policy "Buyer members can read completed upload sessions" on public.supplier_upload_sessions
for select to authenticated using (
  status='completed' and private.has_organization_access((select auth.uid()),buyer_id,'buyer')
);
revoke all on public.supplier_upload_sessions from anon,authenticated;
grant select on public.supplier_upload_sessions to authenticated;
grant all on public.supplier_upload_sessions to service_role;

create or replace function public.create_supplier_upload_session_v1(
  p_request_id uuid,p_idempotency_key text,p_file_name text,p_mime_type text,p_file_size bigint,
  p_expiration_date date,p_no_expiration boolean,p_document_name text default null,p_notes text default null,
  p_linked_item_ids uuid[] default '{}'
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid()); v_request public.document_requests%rowtype; v_session public.supplier_upload_sessions%rowtype;
  v_safe_name text; v_path text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select * into v_request from public.document_requests where id=p_request_id for share;
  if v_request.id is null then raise exception 'Request not found'; end if;
  if not private.has_organization_access(v_actor,v_request.supplier_id,'supplier') then raise exception 'Supplier access required'; end if;
  if v_request.status not in ('pending','rejected') then raise exception 'Request does not accept uploads in its current state'; end if;
  if coalesce(length(btrim(p_idempotency_key)),0)<8 then raise exception 'Valid idempotency key required'; end if;
  if p_file_size not between 1 and 10485760 then raise exception 'File size must be between 1 byte and 10 MB'; end if;
  if not p_no_expiration and p_expiration_date is null then raise exception 'Expiration date or no-expiration selection required'; end if;
  select * into v_session from public.supplier_upload_sessions where uploader_id=v_actor and idempotency_key=p_idempotency_key;
  if v_session.id is not null then
    if v_session.request_id<>p_request_id or v_session.original_file_name<>p_file_name or v_session.file_size<>p_file_size then
      raise exception 'Idempotency key was used for a different upload';
    end if;
    return jsonb_build_object('session_id',v_session.id,'storage_path',v_session.storage_path,'expires_at',v_session.expires_at,'idempotent',true);
  end if;
  v_safe_name:=regexp_replace(regexp_replace(btrim(p_file_name),'[^A-Za-z0-9._-]+','_','g'),'^[._-]+','','g');
  if coalesce(v_safe_name,'')='' then v_safe_name:='document'; end if;
  v_session.id:=gen_random_uuid();
  v_path:=v_request.supplier_id::text||'/'||v_request.id::text||'/'||v_session.id::text||'/'||left(v_safe_name,180);
  insert into public.supplier_upload_sessions(id,request_id,buyer_id,supplier_id,uploader_id,idempotency_key,storage_path,
    original_file_name,declared_mime_type,file_size,expiration_date,no_expiration,document_name,notes,linked_item_ids)
  values(v_session.id,v_request.id,v_request.buyer_id,v_request.supplier_id,v_actor,p_idempotency_key,v_path,
    p_file_name,p_mime_type,p_file_size,p_expiration_date,p_no_expiration,p_document_name,p_notes,coalesce(p_linked_item_ids,'{}'));
  return jsonb_build_object('session_id',v_session.id,'storage_path',v_path,'expires_at',now()+interval '2 hours','idempotent',false);
end $$;

create or replace function public.complete_supplier_upload_v1(
  p_session_id uuid,p_detected_mime_type text,p_file_size bigint,p_sha256 text,
  p_scan_status text,p_scan_provider text default null,p_scan_result jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=(select auth.uid()); v_session public.supplier_upload_sessions%rowtype;
  v_request public.document_requests%rowtype; v_upload uuid; v_version integer; v_canonical jsonb;
begin
  select * into v_session from public.supplier_upload_sessions where id=p_session_id for update;
  if v_session.id is null then raise exception 'Upload session not found'; end if;
  if v_session.status='completed' then return jsonb_build_object('session_id',v_session.id,'document_upload_id',v_session.document_upload_id,'idempotent',true); end if;
  if v_session.expires_at<=now() then update public.supplier_upload_sessions set status='expired',updated_at=now() where id=v_session.id; raise exception 'Upload session expired'; end if;
  if not private.has_organization_access(v_actor,v_session.supplier_id,'supplier') and coalesce((select auth.role()),'')<>'service_role' then raise exception 'Supplier access required'; end if;
  if p_file_size<>v_session.file_size or p_file_size not between 1 and 10485760 then raise exception 'Uploaded file size mismatch'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Lowercase SHA-256 required'; end if;
  if p_scan_status<>'clean' then raise exception 'A clean malware scan is required'; end if;
  select * into v_request from public.document_requests where id=v_session.request_id for update;
  if v_request.status not in ('pending','rejected') then raise exception 'Request no longer accepts uploads'; end if;
  update public.supplier_upload_sessions set status='finalizing',detected_mime_type=p_detected_mime_type,file_size=p_file_size,
    sha256=p_sha256,scan_status=p_scan_status,scan_provider=p_scan_provider,scan_result=p_scan_result,updated_at=now() where id=v_session.id;
  select coalesce(max(version),0)+1 into v_version from public.document_uploads where request_id=v_request.id;
  insert into public.document_uploads(request_id,uploader_id,file_name,file_path,file_size,mime_type,document_name,status,
    reviewer_notes,expiration_date,version,linked_item_ids)
  values(v_request.id,v_session.uploader_id,v_session.original_file_name,v_session.storage_path,p_file_size,p_detected_mime_type,
    coalesce(nullif(v_session.document_name,''),v_session.original_file_name),'pending_review',v_session.notes,
    case when v_session.no_expiration then null else v_session.expiration_date end,v_version,
    case when cardinality(v_session.linked_item_ids)>0 then v_session.linked_item_ids else null end)
  returning id into v_upload;
  update public.document_requests set status='submitted',updated_at=now() where id=v_request.id;
  v_canonical:=public.finalize_canonical_upload_v1('document_upload',v_upload,p_sha256,v_request.document_type,
    coalesce(nullif(v_session.document_name,''),v_session.original_file_name),null,'[]'::jsonb,
    jsonb_build_object('expiry_date',case when v_session.no_expiration then null else v_session.expiration_date end,
      'covered_product_ids',to_jsonb(v_session.linked_item_ids),'covered_facility_ids',
      case when v_request.supplier_branch_id is null then '[]'::jsonb else jsonb_build_array(v_request.supplier_branch_id) end,
      'malware_scan_status','clean','schema_version',1));
  update public.supplier_upload_sessions set status='completed',document_upload_id=v_upload,completed_at=now(),updated_at=now() where id=v_session.id;
  return jsonb_build_object('session_id',v_session.id,'document_upload_id',v_upload,'canonical',v_canonical,'idempotent',false);
end $$;

revoke all on function public.create_supplier_upload_session_v1(uuid,text,text,text,bigint,date,boolean,text,text,uuid[]) from public,anon;
grant execute on function public.create_supplier_upload_session_v1(uuid,text,text,text,bigint,date,boolean,text,text,uuid[]) to authenticated;
revoke all on function public.complete_supplier_upload_v1(uuid,text,bigint,text,text,text,jsonb) from public,anon;
grant execute on function public.complete_supplier_upload_v1(uuid,text,bigint,text,text,text,jsonb) to authenticated,service_role;
