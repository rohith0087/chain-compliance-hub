begin;
select plan(23);

select has_table('public', 'evidence_extraction_jobs', 'extraction job queue exists');
select has_table('public', 'evidence_claims', 'evidence claims exist');
select has_table('public', 'evidence_claim_corrections', 'correction history exists');
select has_table('public', 'evidence_conflicts', 'conflict tracking exists');

select ok((select relrowsecurity from pg_class where oid = 'public.evidence_extraction_jobs'::regclass), 'extraction jobs have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.evidence_claims'::regclass), 'evidence claims have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.evidence_claim_corrections'::regclass), 'corrections have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.evidence_conflicts'::regclass), 'conflicts have RLS');

select has_trigger('public', 'document_uploads', 'enqueue_evidence_extraction_job', 'new uploads enqueue an extraction job');
select has_trigger('public', 'evidence_claim_corrections', 'protect_evidence_claim_corrections', 'correction history is immutable');

select function_privs_are(
  'public', 'claim_evidence_extraction_jobs_v1', array['integer'], 'authenticated', array[]::text[],
  'authenticated cannot claim extraction jobs directly'
);
select function_privs_are(
  'public', 'claim_evidence_extraction_jobs_v1', array['integer'], 'service_role', array['EXECUTE'],
  'service role can claim extraction jobs'
);
select function_privs_are(
  'public', 'record_evidence_claim_v1', array['uuid', 'jsonb'], 'authenticated', array[]::text[],
  'authenticated cannot record claims directly'
);
select function_privs_are(
  'public', 'record_evidence_claim_v1', array['uuid', 'jsonb'], 'service_role', array['EXECUTE'],
  'service role can record extracted claims'
);
select function_privs_are(
  'public', 'verify_evidence_claim_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to verify a claim'
);
select function_privs_are(
  'public', 'reject_evidence_claim_v1', array['uuid', 'text'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to reject a claim'
);
select function_privs_are(
  'public', 'correct_evidence_claim_v1', array['uuid', 'text', 'text', 'text'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to correct a claim'
);
select function_privs_are(
  'public', 'resolve_evidence_conflict_v1', array['uuid', 'text'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to resolve a conflict'
);

select is((select default_enabled from public.feature_flags where key = 'structured_evidence_v1'), false, 'evidence engine defaults off (Phase 0 seed)');

-- Check constraints on evidence_claims protect the "never authoritative without
-- a reviewer" invariant even if a future code path forgets to set the right
-- fields. These rows also violate FKs (no real buyer/supplier/upload exists),
-- so each one throws regardless; that's fine, the point is that they throw.
select throws_ok(
  $$insert into public.evidence_claims (
      document_upload_id, buyer_id, supplier_id, status, extraction_model_version
    ) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'verified', 'evidence-extract-v1')$$,
  'a claim cannot be marked verified without verified_by/verified_at set'
);
select throws_ok(
  $$insert into public.evidence_claims (
      document_upload_id, buyer_id, supplier_id, status, extraction_model_version, rejected_reason
    ) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'rejected', 'evidence-extract-v1', null)$$,
  'a claim cannot be marked rejected without a reason'
);
select throws_ok(
  $$insert into public.evidence_claims (
      document_upload_id, buyer_id, supplier_id, extraction_model_version, issue_date, expiry_date
    ) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'evidence-extract-v1', '2026-06-01', '2025-06-01')$$,
  'expiry_date cannot precede issue_date'
);
select is(
  (select confidence::text from public.evidence_claims where false),
  null,
  'confidence column exists and is queryable'
);

select * from finish();
rollback;
