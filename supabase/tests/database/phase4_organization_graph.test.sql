begin;
select plan(19);

-- Tables exist
select has_table('public', 'organizations', 'organizations registry exists');
select has_table('public', 'evidence_sharing_grants', 'evidence sharing grants exist');
select has_table('public', 'evidence_sharing_audit_log', 'evidence sharing audit log exists');

-- RLS enabled
select ok((select relrowsecurity from pg_class where oid = 'public.organizations'::regclass), 'organizations have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.evidence_sharing_grants'::regclass), 'grants have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.evidence_sharing_audit_log'::regclass), 'audit log has RLS');

-- Convenience view
select has_view('public', 'organization_relationships', 'organization relationships view exists');

-- Sync, validation, and immutability triggers
select has_trigger('public', 'buyers', 'sync_organization_after_buyer_insert', 'buyer inserts sync into organizations');
select has_trigger('public', 'suppliers', 'sync_organization_after_supplier_insert', 'supplier inserts sync into organizations');
select has_trigger('public', 'evidence_sharing_grants', 'validate_evidence_sharing_grant_before_insert', 'grants are validated before insert');
select has_trigger('public', 'evidence_sharing_audit_log', 'protect_evidence_sharing_audit_log_update', 'audit log updates are blocked');
select has_trigger('public', 'evidence_sharing_audit_log', 'protect_evidence_sharing_audit_log_delete', 'audit log deletes are blocked');

-- Function privileges: supplier-facing RPCs
select function_privs_are(
  'public', 'grant_evidence_access_v1', array['uuid', 'uuid', 'uuid', 'text', 'text', 'timestamptz'],
  'authenticated', array['EXECUTE'], 'a supplier member can attempt to grant evidence access'
);
select function_privs_are(
  'public', 'revoke_evidence_access_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a supplier member can attempt to revoke evidence access'
);

select is(
  (select default_enabled from public.feature_flags where key = 'supplier_evidence_network_v1'),
  false,
  'supplier evidence network defaults off (Phase 0 seed)'
);

-- Check constraints protect structural invariants even if a future code path
-- forgets to set the right fields. These also violate FKs (no real
-- organization/grant exists), so each one throws regardless; the point is
-- that they throw.
select throws_ok(
  $$insert into public.organizations (id, organization_type, display_name)
    values (gen_random_uuid(), 'platform', 'test')$$,
  'organizations.organization_type only accepts buyer or supplier'
);
select throws_ok(
  $$insert into public.evidence_sharing_grants (
      owner_organization_id, granted_to_organization_id, claim_id, document_type, purpose
    ) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'business_license', 'compliance_decision')$$,
  'a grant cannot set both claim_id and document_type'
);
select throws_ok(
  $$insert into public.evidence_sharing_grants (
      owner_organization_id, granted_to_organization_id, document_type, purpose, status
    ) values (gen_random_uuid(), gen_random_uuid(), 'business_license', 'compliance_decision', 'revoked')$$,
  'a grant cannot be marked revoked without revoked_by/revoked_at'
);
select throws_ok(
  $$insert into public.evidence_sharing_audit_log (grant_id, event_type, organization_id)
    values (gen_random_uuid(), 'archived', gen_random_uuid())$$,
  'audit log event_type only accepts granted, revoked, or accessed'
);

select * from finish();
rollback;
