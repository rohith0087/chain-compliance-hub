-- record_canonical_extraction_v1 dead-lettered ~38% of extraction jobs with
-- "Immutable evidence version identity cannot be changed".
--
-- Cause: the function did an unconditional
--   update evidence_versions set issue_date=.., expiry_date=.., standards=..,
--     extraction_model_version=..
-- but the protect_evidence_version_identity trigger raises whenever any of those
-- already-set fields changes. When finalize_canonical_upload_v1 (or a prior run)
-- had already populated them, the overwrite tripped the guard and the job failed.
--
-- Fix: fill NULLs only (coalesce / empty-array guard), so the identity fields are
-- populated once and never re-written -- which satisfies the trigger (it only
-- fires when old.x is not null and distinct). Also make the field-observation
-- insert idempotent so a re-run doesn't duplicate observations. Everything else
-- (validation runs, resolution events, security definer) is unchanged.

create or replace function public.record_canonical_extraction_v1(p_claim_id uuid, p_fields jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim public.evidence_claims%rowtype;
  v_version uuid;
  v_item jsonb;
  v_run uuid;
  v_type text;
  v_required text[];
  v_missing text[];
begin
  if current_user not in ('service_role','postgres') then raise exception 'service role required'; end if;
  if jsonb_typeof(p_fields) <> 'array' then raise exception 'Fields must be an array'; end if;
  select * into v_claim from public.evidence_claims where id=p_claim_id;
  if v_claim.id is null then raise exception 'Evidence claim not found'; end if;
  v_version := v_claim.canonical_evidence_version_id;
  if v_version is null then
    select canonical_evidence_version_id into v_version from public.document_uploads where id=v_claim.document_upload_id;
    update public.evidence_claims set canonical_evidence_version_id=v_version where id=p_claim_id;
  end if;
  if v_version is null then raise exception 'Canonical upload must be finalized before recording extraction'; end if;

  -- Fill NULLs only. RHS column refs are the existing (old) row values, so an
  -- already-set identity field keeps its value and the immutability trigger
  -- never fires. issue_date isn't guarded but is coalesced for the same
  -- write-once semantics; standards is an array so guard on cardinality.
  update public.evidence_versions ev set
    issue_date               = coalesce(ev.issue_date, v_claim.issue_date),
    expiry_date              = coalesce(ev.expiry_date, v_claim.expiry_date),
    standards                = case when cardinality(coalesce(ev.standards,'{}'::text[])) > 0
                                    then ev.standards else v_claim.standards end,
    extraction_model_version = coalesce(ev.extraction_model_version, v_claim.extraction_model_version)
  where ev.id = v_version;

  -- Idempotent: only record observations if this version has none yet.
  if not exists (
    select 1 from public.evidence_field_observations
    where evidence_version_id = v_version and observation_type = 'extracted'
  ) then
    for v_item in select * from jsonb_array_elements(p_fields) loop
      if coalesce(v_item->>'field_name','') <> '' then
        insert into public.evidence_field_observations (
          evidence_version_id,field_name,raw_value,normalized_value,source_page,source_quote,
          confidence,extraction_model_version,observation_type
        ) values (
          v_version,v_item->>'field_name',v_item->'value',coalesce(v_item->'normalized_value',v_item->'value'),
          nullif(v_item->>'source_page','')::integer,v_item->>'source_quote',nullif(v_item->>'confidence','')::numeric,
          v_claim.extraction_model_version,'extracted'
        );
      end if;
    end loop;
  end if;

  select er.canonical_document_type into v_type
  from public.evidence_versions ev join public.evidence_records er on er.id=ev.evidence_record_id where ev.id=v_version;
  select required_fields into v_required from public.document_type_definitions where code=v_type;
  select coalesce(array_agg(missing_field),'{}'::text[]) into v_missing
  from unnest(coalesce(v_required,'{}'::text[])) missing_field
  where not exists (select 1 from public.evidence_field_observations o where o.evidence_version_id=v_version and o.field_name=missing_field and coalesce(o.normalized_value,o.raw_value) is not null);
  insert into public.evidence_validation_runs (evidence_version_id,validator_version,status,completeness,completed_at)
  values (v_version,'canonical-validation-v1',case when cardinality(v_missing)=0 then 'passed' else 'needs_review' end,
    case when cardinality(v_required)=0 then 1 else (cardinality(v_required)-cardinality(v_missing))::numeric/cardinality(v_required) end,now())
  returning id into v_run;
  if cardinality(v_missing)>0 then
    insert into public.evidence_validation_results (validation_run_id,rule_code,outcome,severity,message,details)
    values (v_run,'required_fields','needs_review','error','Required evidence fields are missing',jsonb_build_object('missing_fields',v_missing));
  end if;
  update public.evidence_versions set validation_completeness=(select completeness from public.evidence_validation_runs where id=v_run) where id=v_version;
  insert into public.evidence_resolution_events (supplier_id,evidence_version_id,event_type,metadata)
  values (v_claim.supplier_id,v_version,'canonical_extraction_recorded',jsonb_build_object('claim_id',p_claim_id,'validation_run_id',v_run));
  return v_version;
end;
$$;
