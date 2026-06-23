-- -----------------------------------------------------------------------------
-- AI auto-verification of high-confidence, validation-passed canonical evidence
--
-- Mirrors review_evidence_v2's no-corrections/no-four-eyes accept path
-- (supabase/migrations/20260619203148_canonical_evidence_request_reuse.sql:1770-1782),
-- but is invoked by a system process instead of a human reviewer, with a
-- stricter confidence bar (0.90 vs the 0.70 floor a human is allowed to
-- override) since nothing catches a borderline case before it becomes
-- "approved". Four-eyes buyers are excluded entirely.
-- -----------------------------------------------------------------------------

create or replace function public.list_unattested_evidence_versions_v1(p_limit integer default 50)
returns table (evidence_version_id uuid)
language sql security invoker set search_path = '' as $$
  select distinct rel.evidence_version_id
  from public.request_evidence_links rel
  where rel.relation in ('submitted','offered','candidate')
    and not exists (
      select 1 from public.evidence_attestations att
      where att.evidence_version_id = rel.evidence_version_id
    )
  order by rel.evidence_version_id
  limit greatest(1, least(p_limit, 200));
$$;

revoke all on function public.list_unattested_evidence_versions_v1(integer) from public, anon, authenticated;
grant execute on function public.list_unattested_evidence_versions_v1(integer) to service_role;

create or replace function public.auto_verify_evidence_v1(p_evidence_version_id uuid)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_link public.request_evidence_links%rowtype;
  v_request public.document_requests%rowtype;
  v_type text;
  v_required text[];
  v_four_eyes boolean;
  v_low_confidence text[];
  v_validation_status text;
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;

  if exists (select 1 from public.evidence_attestations where evidence_version_id = p_evidence_version_id) then
    return jsonb_build_object('verified', false, 'reason', 'already_attested');
  end if;

  select * into v_link from public.request_evidence_links
  where evidence_version_id = p_evidence_version_id and relation in ('submitted','offered','candidate')
  order by created_at desc limit 1;
  if v_link.id is null then
    return jsonb_build_object('verified', false, 'reason', 'no_active_link');
  end if;

  select * into v_request from public.document_requests where id = v_link.request_id;
  if v_request.id is null then
    return jsonb_build_object('verified', false, 'reason', 'request_not_found');
  end if;

  select coalesce((select require_four_eyes from public.evidence_review_policies where buyer_id = v_request.buyer_id), false) into v_four_eyes;
  if v_four_eyes then
    return jsonb_build_object('verified', false, 'reason', 'four_eyes_required');
  end if;

  select er.canonical_document_type into v_type
  from public.evidence_versions ev join public.evidence_records er on er.id = ev.evidence_record_id
  where ev.id = p_evidence_version_id;
  select required_fields into v_required from public.document_type_definitions where code = v_type;

  select coalesce(array_agg(required_field), '{}'::text[]) into v_low_confidence
  from unnest(coalesce(v_required, '{}'::text[])) required_field
  left join lateral (
    select confidence from public.evidence_field_observations
    where evidence_version_id = p_evidence_version_id and field_name = required_field
    order by created_at desc, id desc limit 1
  ) latest on true
  where coalesce(latest.confidence, 0) < 0.90;
  if cardinality(v_low_confidence) > 0 then
    return jsonb_build_object('verified', false, 'reason', 'low_confidence_or_missing_fields', 'fields', v_low_confidence);
  end if;

  select status into v_validation_status from public.evidence_validation_runs
  where evidence_version_id = p_evidence_version_id order by created_at desc, id desc limit 1;
  if coalesce(v_validation_status, 'needs_review') <> 'passed' then
    return jsonb_build_object('verified', false, 'reason', 'validation_not_passed');
  end if;

  insert into public.evidence_attestations (evidence_version_id, organization_id, organization_type, attestation_type, outcome, actor_id, notes, policy_snapshot)
  values (p_evidence_version_id, v_request.buyer_id, 'buyer', 'system_validation', 'accepted', null,
    'Auto-verified: all required fields >= 0.90 confidence and validation passed',
    jsonb_build_object('request_id', v_link.request_id, 'auto_verified', true));

  update public.request_evidence_links set relation = 'accepted', qualification = 'eligible', qualification_reasons = '{}'::text[], decided_at = now()
  where id = v_link.id;

  update public.document_requests set status = 'approved', fulfillment_status = case when exists (
    select 1 from public.document_uploads where request_id = v_link.request_id
  ) then 'fulfilled_new_upload' else 'fulfilled_existing' end, updated_at = now()
  where id = v_link.request_id;

  insert into public.evidence_resolution_events (request_id, buyer_id, supplier_id, evidence_version_id, event_type, metadata)
  values (v_link.request_id, v_request.buyer_id, v_request.supplier_id, p_evidence_version_id, 'evidence_reviewed',
    jsonb_build_object('approved', true, 'auto_verified', true));

  return jsonb_build_object('verified', true, 'approved', true, 'auto', true);
end;
$$;

revoke all on function public.auto_verify_evidence_v1(uuid) from public, anon, authenticated;
grant execute on function public.auto_verify_evidence_v1(uuid) to service_role;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='process-evidence-auto-verification';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end;
$$;

select cron.schedule(
  'process-evidence-auto-verification','*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://edwerzutsknhuplidhsj.supabase.co/functions/v1/process-evidence-auto-verification-v1',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-System-Secret',(select decrypted_secret from vault.decrypted_secrets where name='system_cron_invocation')
    ),
    body := '{}'::jsonb
  ) as request_id;
  $$
);
