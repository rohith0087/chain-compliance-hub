drop function if exists public.complete_supplier_upload_v1(uuid,text,bigint,text,text,text,jsonb);

create or replace function public.complete_supplier_upload_v1(
  p_actor_id uuid,p_session_id uuid,p_detected_mime_type text,p_file_size bigint,p_sha256 text,
  p_scan_status text,p_scan_provider text default null,p_scan_result jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_actor uuid:=p_actor_id; v_session public.supplier_upload_sessions%rowtype;
  v_request public.document_requests%rowtype; v_upload uuid; v_version integer; v_canonical jsonb;
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if v_actor is null then raise exception 'Actor is required'; end if;
  select * into v_session from public.supplier_upload_sessions where id=p_session_id for update;
  if v_session.id is null then raise exception 'Upload session not found'; end if;
  if v_session.uploader_id<>v_actor then raise exception 'Upload session actor mismatch'; end if;
  if v_session.status='completed' then return jsonb_build_object('session_id',v_session.id,'document_upload_id',v_session.document_upload_id,'idempotent',true); end if;
  if v_session.expires_at<=now() then update public.supplier_upload_sessions set status='expired',updated_at=now() where id=v_session.id; raise exception 'Upload session expired'; end if;
  if not private.has_organization_access(v_actor,v_session.supplier_id,'supplier') then raise exception 'Supplier access required'; end if;
  if p_file_size<>v_session.file_size or p_file_size not between 1 and 10485760 then raise exception 'Uploaded file size mismatch'; end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' then raise exception 'Lowercase SHA-256 required'; end if;
  if p_scan_status<>'clean' then raise exception 'A clean malware scan is required'; end if;
  if coalesce(p_scan_provider,'')='' then raise exception 'Malware scan provider is required'; end if;
  select * into v_request from public.document_requests where id=v_session.request_id for update;
  if v_request.status not in ('pending','rejected') then raise exception 'Request no longer accepts uploads'; end if;
  if v_request.supplier_id<>v_session.supplier_id or v_request.buyer_id<>v_session.buyer_id then raise exception 'Upload session request ownership mismatch'; end if;
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

revoke all on function public.complete_supplier_upload_v1(uuid,uuid,text,bigint,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_supplier_upload_v1(uuid,uuid,text,bigint,text,text,text,jsonb) to service_role;
