begin;
select plan(29);

-- Tables exist
select has_table('public', 'compliance_dossiers', 'compliance dossiers exist');
select has_table('public', 'dossier_versions', 'dossier versions exist');
select has_table('public', 'dossier_signing_keys', 'dossier signing keys exist');
select has_table('public', 'dossier_audit_log', 'dossier audit log exists');
select has_table('public', 'regulatory_packs', 'regulatory packs exist');
select has_table('public', 'regulatory_pack_submissions', 'regulatory pack submissions exist');

-- RLS enabled
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_dossiers'::regclass), 'dossiers have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.dossier_versions'::regclass), 'dossier versions have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.dossier_signing_keys'::regclass), 'signing keys have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.dossier_audit_log'::regclass), 'audit log has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.regulatory_packs'::regclass), 'regulatory packs have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.regulatory_pack_submissions'::regclass), 'submissions have RLS');

-- Immutability / chaining triggers
select has_trigger('public', 'dossier_versions', 'protect_dossier_version_content_before_update', 'version content is protected from update');
select has_trigger('public', 'dossier_versions', 'protect_dossier_version_before_delete', 'versions cannot be deleted');
select has_trigger('public', 'dossier_audit_log', 'chain_dossier_audit_log_row_before_insert', 'audit log rows are hash-chained on insert');
select has_trigger('public', 'dossier_audit_log', 'protect_dossier_audit_log_update', 'audit log is protected from update');
select has_trigger('public', 'regulatory_pack_submissions', 'protect_regulatory_pack_submission_update', 'submissions are protected from update');

-- Function privileges
select function_privs_are(
  'public', 'record_dossier_version_v1',
  array['uuid','text','uuid','date','jsonb','text','text','uuid','uuid','text','text'],
  'authenticated', array[]::text[], 'authenticated cannot record dossier versions directly'
);
select function_privs_are(
  'public', 'set_dossier_retention_v1', array['uuid','date','boolean'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to set dossier retention'
);
select function_privs_are(
  'public', 'archive_dossier_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to archive a dossier'
);
select function_privs_are(
  'public', 'verify_dossier_audit_chain_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to verify a dossier audit chain'
);

select is(
  (select default_enabled from public.feature_flags where key = 'compliance_dossiers_v1'),
  false,
  'compliance dossiers default off (Phase 5 seed)'
);

-- Check constraints throw (also violate FKs since these reference nothing real; the point is that they throw)
select throws_ok(
  $$insert into public.compliance_dossiers (buyer_id, subject_type, subject_id, created_by)
    values (gen_random_uuid(), 'distributor', gen_random_uuid(), gen_random_uuid())$$,
  'compliance_dossiers.subject_type only accepts supplier, facility, or product'
);
select throws_ok(
  $$insert into public.regulatory_packs (pack_code, name, description, schema_version, required_framework_code, status)
    values ('TEST-PACK', 'Test', 'Test', 'v1', 'US-CPSC', 'live')$$,
  'regulatory_packs.status only accepts draft, published, or deprecated'
);

-- Functional fixtures: a real buyer + signing key + dossier + version, to
-- exercise the immutability split and the hash-chain tamper detection.
insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999991', 'phase5-buyer@test.local');
insert into public.buyers (id, profile_id, company_name, contact_email) values (
  '99999999-9999-9999-9999-999999999992', '99999999-9999-9999-9999-999999999991', 'Phase5 Test Buyer', 'phase5-buyer@test.local'
);

insert into public.dossier_signing_keys (id, public_key_jwk, vault_secret_name) values (
  '99999999-9999-9999-9999-999999999993', '{"kty":"EC"}'::jsonb, 'phase5_test_signing_key'
);

-- record_dossier_version_v1 is service_role-only -- called here as the
-- default test-runner role (postgres), which the function explicitly
-- allows alongside service_role, never as 'authenticated'.
select lives_ok(
  $$select public.record_dossier_version_v1(
    '99999999-9999-9999-9999-999999999992'::uuid, 'supplier', gen_random_uuid(), current_date,
    '{"statements": []}'::jsonb, 'deadbeef', 'sig', '99999999-9999-9999-9999-999999999993'::uuid,
    '99999999-9999-9999-9999-999999999991'::uuid, 'test-key-1', 'hash-1'
  )$$,
  'record_dossier_version_v1 is callable by the service-role/postgres path'
);

-- Immutability split: content is protected, but status/retention/legal_hold may change.
select throws_ok(
  $$update public.dossier_versions set content_hash = 'tampered' where dossier_id in (
    select id from public.compliance_dossiers where buyer_id = '99999999-9999-9999-9999-999999999992'
  )$$,
  'dossier_versions content_hash cannot be changed once written'
);

select set_config('request.jwt.claims', json_build_object('sub', '99999999-9999-9999-9999-999999999991')::text, true);
set local role authenticated;
select lives_ok(
  $$select public.set_dossier_retention_v1(
    (select id from public.compliance_dossiers where buyer_id = '99999999-9999-9999-9999-999999999992'),
    current_date + 365, true
  )$$,
  'a buyer member can update retention/legal_hold on their own dossier'
);
reset role;

-- Hash chain: a clean chain validates; a tampered row is detected.
select set_config('request.jwt.claims', json_build_object('sub', '99999999-9999-9999-9999-999999999991')::text, true);
set local role authenticated;
select is(
  (select (public.verify_dossier_audit_chain_v1(
    (select id from public.compliance_dossiers where buyer_id = '99999999-9999-9999-9999-999999999992')
  )->>'valid')::boolean),
  true,
  'a freshly recorded audit chain validates'
);
reset role;

alter table public.dossier_audit_log disable trigger chain_dossier_audit_log_row_before_insert;
insert into public.dossier_audit_log (dossier_id, version_id, event_type, actor_id, prev_hash, row_hash)
select id, null, 'viewed', '99999999-9999-9999-9999-999999999991', 'not-the-real-prev-hash', 'not-a-real-hash'
from public.compliance_dossiers where buyer_id = '99999999-9999-9999-9999-999999999992';
alter table public.dossier_audit_log enable trigger chain_dossier_audit_log_row_before_insert;

select set_config('request.jwt.claims', json_build_object('sub', '99999999-9999-9999-9999-999999999991')::text, true);
set local role authenticated;
select is(
  (select (public.verify_dossier_audit_chain_v1(
    (select id from public.compliance_dossiers where buyer_id = '99999999-9999-9999-9999-999999999992')
  )->>'valid')::boolean),
  false,
  'a chain with a row inserted outside the chaining trigger is detected as broken'
);
reset role;

select * from finish();
rollback;
