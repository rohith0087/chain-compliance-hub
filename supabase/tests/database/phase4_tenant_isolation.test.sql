-- Phase 4 tenant-boundary integration tests.
--
-- Unlike phase1-3's pgTAP files (structural assertions only: has_table,
-- function_privs_are, FK-violation throws_ok), this file actually
-- authenticates as simulated buyer/supplier users via
-- set_config('request.jwt.claims', ...) + set local role authenticated,
-- then exercises real read/write paths to confirm cross-tenant access is
-- denied. This is the primary correctness gate for Phase 4, not a
-- formality: the whole point of the organization graph and evidence
-- sharing model is the tenant boundary, so it must be tested as a tenant
-- boundary, not just as a schema.
begin;
select plan(15);

-- ============================================================================
-- Fixtures (as the test-runner role, before any impersonation)
-- ============================================================================

-- auth.users has an AFTER INSERT trigger (handle_new_user) that creates the
-- matching public.profiles row automatically -- inserting one ourselves
-- here would just collide with it, so we rely on the trigger instead.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'phase4-buyer-a@test.local'),
  ('22222222-2222-2222-2222-222222222221', 'phase4-buyer-b@test.local'),
  ('33333333-3333-3333-3333-333333333331', 'phase4-buyer-c@test.local'),
  ('44444444-4444-4444-4444-444444444441', 'phase4-supplier@test.local'),
  ('55555555-5555-5555-5555-555555555551', 'phase4-other-supplier@test.local');

insert into public.buyers (id, profile_id, company_name, contact_email) values
  ('11111111-1111-1111-1111-111111111112', '11111111-1111-1111-1111-111111111111', 'Buyer A Co', 'phase4-buyer-a@test.local'),
  ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222221', 'Buyer B Co', 'phase4-buyer-b@test.local'),
  ('33333333-3333-3333-3333-333333333332', '33333333-3333-3333-3333-333333333331', 'Buyer C Co', 'phase4-buyer-c@test.local');

insert into public.suppliers (id, profile_id, company_name, contact_email) values
  ('44444444-4444-4444-4444-444444444442', '44444444-4444-4444-4444-444444444441', 'Supplier Co', 'phase4-supplier@test.local'),
  ('55555555-5555-5555-5555-555555555552', '55555555-5555-5555-5555-555555555551', 'Other Supplier Co', 'phase4-other-supplier@test.local');

-- Buyer A and Buyer B are both connected to Supplier; Buyer C is not connected to anyone.
insert into public.buyer_supplier_connections (buyer_id, supplier_id, status) values
  ('11111111-1111-1111-1111-111111111112', '44444444-4444-4444-4444-444444444442', 'approved'),
  ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444442', 'approved');

insert into public.document_uploads (id, file_name, file_path) values
  ('66666666-6666-6666-6666-666666666661', 'cert.pdf', 'uploads/cert.pdf'),
  ('66666666-6666-6666-6666-666666666662', 'other-cert.pdf', 'uploads/other-cert.pdf');

-- claim_a: Supplier's evidence, originally extracted for Buyer A's document request.
insert into public.evidence_claims (id, document_upload_id, buyer_id, supplier_id, status, document_type, extraction_model_version) values
  ('77777777-7777-7777-7777-777777777771', '66666666-6666-6666-6666-666666666661',
   '11111111-1111-1111-1111-111111111112', '44444444-4444-4444-4444-444444444442',
   'verified', 'business_license', 'phase4-test-fixture');

-- claim_other: belongs to a different supplier entirely, used to confirm a
-- supplier cannot grant access to a claim it doesn't own.
insert into public.evidence_claims (id, document_upload_id, buyer_id, supplier_id, status, document_type, extraction_model_version) values
  ('77777777-7777-7777-7777-777777777772', '66666666-6666-6666-6666-666666666662',
   '11111111-1111-1111-1111-111111111112', '55555555-5555-5555-5555-555555555552',
   'verified', 'business_license', 'phase4-test-fixture');

-- ============================================================================
-- Direct ownership and cross-tenant denial (before any grant exists)
-- ============================================================================

select set_config('request.jwt.claims', json_build_object('sub', '11111111-1111-1111-1111-111111111111')::text, true);
set local role authenticated;
select is(
  (select count(*) from public.evidence_claims where id = '77777777-7777-7777-7777-777777777771'),
  1::bigint,
  'Buyer A can read a claim it directly originated'
);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222221')::text, true);
set local role authenticated;
select is(
  (select count(*) from public.evidence_claims where id = '77777777-7777-7777-7777-777777777771'),
  0::bigint,
  'Buyer B cannot read Buyer A''s claim before any sharing grant exists'
);
select throws_ok(
  $$select public.grant_evidence_access_v1(
    '44444444-4444-4444-4444-444444444442'::uuid, '22222222-2222-2222-2222-222222222222'::uuid,
    '77777777-7777-7777-7777-777777777771'::uuid, null, 'compliance_decision', null
  )$$,
  'Buyer B cannot call grant_evidence_access_v1 -- it has no supplier access to the owner organization'
);
reset role;

-- ============================================================================
-- Supplier-initiated grant
-- ============================================================================

select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444441')::text, true);
set local role authenticated;

select throws_ok(
  $$select public.grant_evidence_access_v1(
    '44444444-4444-4444-4444-444444444442'::uuid, '22222222-2222-2222-2222-222222222222'::uuid,
    '77777777-7777-7777-7777-777777777772'::uuid, null, 'compliance_decision', null
  )$$,
  'A supplier cannot grant access to a claim that belongs to a different supplier'
);

create temp table t_grant as
select public.grant_evidence_access_v1(
  '44444444-4444-4444-4444-444444444442'::uuid, '22222222-2222-2222-2222-222222222222'::uuid,
  '77777777-7777-7777-7777-777777777771'::uuid, null, 'compliance_decision', null
) as id;

select ok((select id is not null from t_grant), 'Supplier successfully grants Buyer B access to its own claim');
reset role;

-- ============================================================================
-- Visibility widens for the grantee, stays closed for everyone else
-- ============================================================================

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222221')::text, true);
set local role authenticated;
select is(
  (select count(*) from public.evidence_claims where id = '77777777-7777-7777-7777-777777777771'),
  1::bigint,
  'Buyer B can read the claim once an active grant exists'
);
select is(
  (select count(*) from public.evidence_sharing_grants where id = (select id from t_grant)),
  1::bigint,
  'Buyer B (the grantee) can read the grant row'
);
select is(
  (select count(*) from public.evidence_sharing_audit_log where grant_id = (select id from t_grant)),
  1::bigint,
  'Buyer B (the grantee) can read the grant''s audit log'
);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '33333333-3333-3333-3333-333333333331')::text, true);
set local role authenticated;
select is(
  (select count(*) from public.evidence_claims where id = '77777777-7777-7777-7777-777777777771'),
  0::bigint,
  'Buyer C (unrelated, no connection at all) still cannot read the claim -- the grant names Buyer B, not Buyer C'
);
select is(
  (select count(*) from public.evidence_sharing_grants where id = (select id from t_grant)),
  0::bigint,
  'Buyer C cannot read a grant it is not party to'
);
select is(
  (select count(*) from public.organizations where id = '11111111-1111-1111-1111-111111111112'),
  0::bigint,
  'Buyer C cannot read Buyer A''s organization row'
);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444441')::text, true);
set local role authenticated;
select is(
  (select count(*) from public.evidence_sharing_audit_log where grant_id = (select id from t_grant)),
  1::bigint,
  'The owner supplier can read its own grant''s audit log'
);
reset role;

-- ============================================================================
-- Revocation removes visibility again
-- ============================================================================

select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444441')::text, true);
set local role authenticated;
select lives_ok(
  format('select public.revoke_evidence_access_v1(%L::uuid)', (select id from t_grant)),
  'The owner supplier can revoke its own grant'
);
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222221')::text, true);
set local role authenticated;
select is(
  (select count(*) from public.evidence_claims where id = '77777777-7777-7777-7777-777777777771'),
  0::bigint,
  'Buyer B can no longer read the claim once the grant is revoked'
);
reset role;

-- ============================================================================
-- An already-expired grant grants no visibility either
-- ============================================================================

select set_config('request.jwt.claims', json_build_object('sub', '44444444-4444-4444-4444-444444444441')::text, true);
set local role authenticated;
create temp table t_expired_grant as
select public.grant_evidence_access_v1(
  '44444444-4444-4444-4444-444444444442'::uuid, '22222222-2222-2222-2222-222222222222'::uuid,
  '77777777-7777-7777-7777-777777777771'::uuid, null, 'compliance_decision', (now() - interval '1 day')
) as id;
reset role;

select set_config('request.jwt.claims', json_build_object('sub', '22222222-2222-2222-2222-222222222221')::text, true);
set local role authenticated;
select is(
  (select count(*) from public.evidence_claims where id = '77777777-7777-7777-7777-777777777771'),
  0::bigint,
  'An already-expired grant does not make the claim visible'
);
reset role;

select * from finish();
rollback;
