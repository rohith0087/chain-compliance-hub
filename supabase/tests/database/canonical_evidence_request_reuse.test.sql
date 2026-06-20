begin;
select plan(58);

select has_table('public','document_type_definitions','document type registry exists');
select has_table('public','evidence_review_policies','review policy exists');
select has_table('public','document_assets','immutable asset table exists');
select has_table('public','document_asset_sources','asset source links exist');
select has_table('public','evidence_records','canonical records exist');
select has_table('public','evidence_versions','canonical versions exist');
select has_table('public','evidence_field_observations','field observations exist');
select has_table('public','evidence_validation_runs','validation runs exist');
select has_table('public','evidence_validation_results','validation results exist');
select has_table('public','evidence_attestations','separate attestations exist');
select has_table('public','request_evidence_links','request evidence links exist');
select has_table('public','requirement_evidence_links','requirement evidence links exist');
select has_table('public','evidence_resolution_events','resolution audit events exist');
select has_table('public','compliance_reevaluation_queue','event-driven reevaluation queue exists');
select has_table('public','canonical_asset_hash_jobs','restartable asset hash backfill queue exists');

select ok((select relrowsecurity from pg_class where oid='public.document_assets'::regclass),'assets have RLS');
select ok((select relrowsecurity from pg_class where oid='public.evidence_records'::regclass),'records have RLS');
select ok((select relrowsecurity from pg_class where oid='public.evidence_versions'::regclass),'versions have RLS');
select ok((select relrowsecurity from pg_class where oid='public.evidence_field_observations'::regclass),'field observations have RLS');
select ok((select relrowsecurity from pg_class where oid='public.evidence_attestations'::regclass),'attestations have RLS');
select ok((select relrowsecurity from pg_class where oid='public.request_evidence_links'::regclass),'request links have RLS');
select ok((select relrowsecurity from pg_class where oid='public.compliance_reevaluation_queue'::regclass),'reevaluation queue has RLS');
select ok((select relrowsecurity from pg_class where oid='public.canonical_asset_hash_jobs'::regclass),'asset hash queue has RLS');

select has_column('public','document_requests','fulfillment_status','request lifecycle is separate from fulfillment');
select has_column('public','document_requests','request_reason_code','intentional duplicate reason is stored');
select has_column('public','document_requests','minimum_remaining_validity_days','minimum validity snapshot is stored');
select has_column('public','document_uploads','canonical_evidence_version_id','legacy uploads link to canonical versions');
select has_column('public','evidence_claims','canonical_evidence_version_id','legacy claims link to canonical versions');
select has_column('public','compliance_tasks','request_id','canonical review tasks target a request');
select has_column('public','compliance_tasks','evidence_version_id','canonical review tasks target an evidence version');
select has_column('public','compliance_tasks','legacy_document_assignment_id','legacy assignments retain an adapter link');

select has_function('public','finalize_canonical_upload_v1',array['text','uuid','text','text','text','text','jsonb','jsonb'],'canonical uploads finalize transactionally');
select has_function('public','preflight_document_requests_v1',array['uuid','jsonb'],'batch preflight exists');
select has_function('public','create_document_requests_v2',array['jsonb'],'transactional batch creation exists');
select has_function('public','resolve_document_request_v1',array['uuid','text','uuid','text'],'supplier resolution exists');
select has_function('public','review_evidence_v2',array['uuid','uuid','jsonb','boolean','text'],'combined review exists');
select has_function('public','claim_compliance_reevaluations_v1',array['integer'],'reevaluation worker claim exists');
select has_function('public','attest_supplier_evidence_v1',array['uuid','text'],'supplier verification is explicit');
select has_function('public','approve_verified_evidence_v1',array['uuid','text'],'four-eyes final approval is explicit');
select has_function('public','set_evidence_review_policy_v1',array['uuid','boolean','integer','jsonb'],'buyer review policy is configurable');
select has_function('public','claim_canonical_asset_hash_jobs_v1',array['integer'],'asset hash backfill claim is restartable');
select has_function('public','hydrate_canonical_asset_hash_v1',array['uuid','text'],'same-supplier asset hashes merge canonically');

select ok(not has_function_privilege('anon','public.grant_canonical_evidence_access_v1(uuid,uuid,uuid,text)','EXECUTE'),'anonymous users cannot grant canonical evidence access');
select ok(not has_function_privilege('anon','public.attest_supplier_evidence_v1(uuid,text)','EXECUTE'),'anonymous users cannot attest supplier evidence');
select ok(not has_function_privilege('anon','public.set_evidence_review_policy_v1(uuid,boolean,integer,jsonb)','EXECUTE'),'anonymous users cannot change review policy');
select ok(not has_function_privilege('anon','public.finalize_canonical_upload_v1(text,uuid,text,text,text,text,jsonb,jsonb)','EXECUTE'),'anonymous users cannot finalize canonical uploads');
select ok(not has_function_privilege('anon','public.preflight_document_requests_v1(uuid,jsonb)','EXECUTE'),'anonymous users cannot preflight document requests');
select ok(not has_function_privilege('anon','public.create_document_requests_v2(jsonb)','EXECUTE'),'anonymous users cannot create document requests');
select ok(not has_function_privilege('anon','public.review_evidence_v2(uuid,uuid,jsonb,boolean,text)','EXECUTE'),'anonymous users cannot review canonical evidence');
select ok(not has_function_privilege('authenticated','public.claim_compliance_reevaluations_v1(integer)','EXECUTE'),'authenticated users cannot claim service worker jobs');

select is((select default_enabled from public.feature_flags where key='canonical_evidence_v1'),false,'canonical evidence defaults off');
select has_trigger('public','evidence_field_observations','protect_evidence_field_observations','field history is immutable');
select has_trigger('public','evidence_attestations','protect_evidence_attestations','attestations are immutable');
select has_trigger('public','evidence_attestations','queue_reevaluation_after_attestation','attestations queue impacted reevaluation');
select has_trigger('public','document_assets','protect_document_asset_identity','asset identity is immutable');
select has_trigger('public','evidence_versions','protect_evidence_version_identity','version identity is immutable');
select has_trigger('public','evidence_sharing_grants','validate_evidence_sharing_grant_before_write','canonical grants are validated on every active write');
select has_trigger('storage','objects','protect_canonical_storage_object','canonical storage objects are retained');

select * from finish();
rollback;
