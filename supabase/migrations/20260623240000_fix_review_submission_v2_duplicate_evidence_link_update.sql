-- When the same PDF is re-submitted after rejection, finalize_canonical_upload_v1
-- deduplicates it to the same canonical_evidence_version_id, leaving two rows in
-- request_evidence_links for the same (request_id, evidence_version_id):
--   row 1: version 1 -> relation='rejected'
--   row 2: version 2 -> relation='submitted'
-- The approval UPDATE matched both rows (same request_id + evidence_version_id),
-- producing two 'accepted' rows and violating the unique partial index
-- request_evidence_one_active_acceptance (request_id WHERE relation='accepted').
-- Fix: restrict the UPDATE to rows that are not already rejected/withdrawn.

create or replace function private.review_document_submission_v2(
  p_actor_id uuid, p_request_id uuid, p_upload_id uuid,
  p_decision text, p_reason_code text, p_reason_notes text, p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_request public.document_requests%rowtype;
  v_upload  public.document_uploads%rowtype;
  v_before  jsonb;
  v_decision uuid;
  v_delivery uuid;
  v_recipient record;
begin
  select * into v_request from public.document_requests where id=p_request_id;
  select * into v_upload  from public.document_uploads  where id=p_upload_id and request_id=p_request_id;
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
    -- Only update rows that are not already rejected/withdrawn — prevents duplicate-'accepted'
    -- constraint violations when the same canonical version is re-submitted after rejection
    -- (finalize_canonical_upload_v1 inserts a new 'submitted' row, leaving the old 'rejected'
    -- row alongside it; updating both to 'accepted' would violate the unique partial index).
    update public.request_evidence_links
      set relation=case when p_decision='approve' then 'accepted' else 'rejected' end,
          qualification=case when p_decision='approve' then 'eligible' else 'ineligible' end,
          qualification_reasons=case when p_decision='approve' then '{}'::text[] else array[p_reason_code] end,
          decided_by=p_actor_id,decided_at=now()
    where request_id=p_request_id
      and evidence_version_id=v_upload.canonical_evidence_version_id
      and relation not in ('rejected','withdrawn');
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
