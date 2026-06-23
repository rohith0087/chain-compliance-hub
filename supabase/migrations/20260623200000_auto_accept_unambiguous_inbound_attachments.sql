-- Auto-accept inbound email attachments at the intake-routing stage when the
-- match is unambiguous (deterministic single candidate, verified sender,
-- active routing token) and the scan is clean. This does not skip the
-- buyer's compliance approval -- the resulting document_uploads row still
-- lands as 'pending_review', exactly like a portal upload, same as the
-- existing human "Accept into request" action already does. Ambiguous,
-- unknown, suspicious, multi-candidate, AI-shadow-assisted, non-clean, or
-- encrypted attachments are completely unaffected and still require the
-- manual queue.

alter table public.inbound_review_decisions alter column reviewer_id drop not null;

create or replace function public.auto_accept_inbound_attachment_v1(
  p_attachment_id uuid, p_final_storage_path text
) returns jsonb language plpgsql security definer set search_path=''
as $$
declare
  v_attachment public.inbound_email_attachments%rowtype;
  v_message public.inbound_email_messages%rowtype;
  v_request public.document_requests%rowtype;
  v_upload uuid; v_version integer; v_canonical jsonb; v_before jsonb;
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if coalesce(p_final_storage_path,'')='' then raise exception 'Final storage path is required'; end if;

  select * into v_attachment from public.inbound_email_attachments where id=p_attachment_id for update;
  if v_attachment.id is null then raise exception 'Attachment not found'; end if;
  if v_attachment.review_status<>'pending' then raise exception 'Attachment was already reviewed'; end if;
  if v_attachment.scan_status<>'clean' or v_attachment.is_encrypted then raise exception 'Only clean, readable attachments can be auto-accepted'; end if;

  select * into v_message from public.inbound_email_messages where id=v_attachment.message_id for update;
  if v_message.match_result<>'matched' or not (v_message.match_reasons @> '["routing_token_valid"]'::jsonb) then
    raise exception 'Auto-accept requires an unambiguous routing-token match';
  end if;
  if array_length(v_message.candidate_request_ids,1) is distinct from 1 or v_message.candidate_request_ids[1]<>v_attachment.proposed_request_id then
    raise exception 'Auto-accept requires exactly one deterministic candidate request';
  end if;
  if v_message.sender_profile_id is null or v_message.candidate_supplier_id is null then raise exception 'Verified supplier sender is required'; end if;

  select * into v_request from public.document_requests where id=v_attachment.proposed_request_id for update;
  if v_request.id is null or v_request.buyer_id<>v_message.candidate_buyer_id or v_request.supplier_id<>v_message.candidate_supplier_id then raise exception 'Request tenant mismatch'; end if;
  if v_request.status not in ('pending','rejected') then raise exception 'Request no longer accepts evidence'; end if;

  v_before:=to_jsonb(v_attachment);
  select coalesce(max(version),0)+1 into v_version from public.document_uploads where request_id=v_request.id;
  insert into public.document_uploads(request_id,uploader_id,file_name,file_path,file_size,mime_type,document_name,status,version,source_channel,source_reference_id)
  values(v_request.id,v_message.sender_profile_id,v_attachment.original_filename,p_final_storage_path,v_attachment.file_size,v_attachment.detected_mime_type,
    v_attachment.original_filename,'pending_review',v_version,'email_reply',v_attachment.id) returning id into v_upload;
  update public.document_requests set status='submitted',fulfillment_status='new_version_required',updated_at=now() where id=v_request.id;
  v_canonical:=public.finalize_canonical_upload_v1('document_upload',v_upload,v_attachment.sha256,v_request.document_type,v_attachment.original_filename,null,'[]'::jsonb,
    '{"malware_scan_status":"clean","schema_version":1,"source_channel":"email_reply","auto_accepted":true}'::jsonb);
  update public.inbound_email_attachments set review_status='accepted',review_reason_code='auto_accept',
    review_notes='Auto-accepted: routing token valid, single matching request, clean scan',
    final_storage_path=p_final_storage_path,final_document_upload_id=v_upload,
    final_evidence_version_id=(v_canonical->>'evidence_version_id')::uuid,updated_at=now() where id=v_attachment.id;

  insert into public.inbound_review_decisions(message_id,attachment_id,reviewer_id,buyer_id,decision,selected_request_id,reason,reason_code,notes,before_snapshot,after_snapshot)
  select v_message.id,v_attachment.id,null,v_message.candidate_buyer_id,'accept',v_request.id,
    'Auto-accepted: routing token valid, single matching request, clean scan','auto_accept',
    'Auto-accepted: routing token valid, single matching request, clean scan',v_before,to_jsonb(a)
  from public.inbound_email_attachments a where a.id=v_attachment.id;

  if not exists(select 1 from public.inbound_email_attachments where message_id=v_message.id and review_status='pending') then
    update public.inbound_email_messages set status='accepted',processed_at=now(),updated_at=now() where id=v_message.id;
  else
    update public.inbound_email_messages set status='partially_accepted',updated_at=now() where id=v_message.id;
  end if;

  return jsonb_build_object('message_id',v_message.id,'attachment_id',v_attachment.id,'decision','accept','document_upload_id',v_upload,'canonical',v_canonical);
end $$;

revoke all on function public.auto_accept_inbound_attachment_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.auto_accept_inbound_attachment_v1(uuid,text) to service_role;
