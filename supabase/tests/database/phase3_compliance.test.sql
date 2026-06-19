begin;
select plan(47);

-- Tables exist
select has_table('public', 'compliance_evaluations', 'compliance evaluations exist');
select has_table('public', 'compliance_decision_results', 'compliance decision results exist');
select has_table('public', 'compliance_approvals', 'compliance approvals exist');
select has_table('public', 'compliance_decision_overrides', 'compliance decision overrides exist');
select has_table('public', 'compliance_exceptions', 'compliance exceptions exist');
select has_table('public', 'compliance_tasks', 'compliance tasks exist');
select has_table('public', 'compliance_findings', 'compliance findings exist');
select has_table('public', 'compliance_corrective_actions', 'compliance corrective actions exist');
select has_table('public', 'compliance_escalations', 'compliance escalations exist');
select has_table('public', 'compliance_domain_events', 'compliance domain events exist');

-- RLS enabled
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_evaluations'::regclass), 'evaluations have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_decision_results'::regclass), 'decision results have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_approvals'::regclass), 'approvals have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_decision_overrides'::regclass), 'decision overrides have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_exceptions'::regclass), 'exceptions have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_tasks'::regclass), 'tasks have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_findings'::regclass), 'findings have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_corrective_actions'::regclass), 'corrective actions have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_escalations'::regclass), 'escalations have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.compliance_domain_events'::regclass), 'domain events have RLS');

-- Phase 2 extension
select has_column('public', 'evidence_claims', 'document_type', 'evidence claims gained a document_type column');

-- Convenience view
select has_view('public', 'compliance_current_status', 'compliance current status view exists');

-- Immutability triggers on the computed snapshot
select has_trigger('public', 'compliance_evaluations', 'protect_compliance_evaluations', 'evaluations are immutable');
select has_trigger('public', 'compliance_decision_results', 'protect_compliance_decision_results', 'decision results are immutable');

-- Function privileges: service-role-only RPCs
select function_privs_are(
  'public', 'claim_compliance_events_v1', array['integer'], 'authenticated', array[]::text[],
  'authenticated cannot claim compliance events directly'
);
select function_privs_are(
  'public', 'claim_compliance_events_v1', array['integer'], 'service_role', array['EXECUTE'],
  'service role can claim compliance events'
);
select function_privs_are(
  'public', 'record_compliance_decision_v1', array['jsonb', 'jsonb'], 'authenticated', array[]::text[],
  'authenticated cannot record compliance decisions directly'
);
select function_privs_are(
  'public', 'record_compliance_decision_v1', array['jsonb', 'jsonb'], 'service_role', array['EXECUTE'],
  'service role can record compliance decisions'
);

-- Function privileges: buyer-authenticated workflow RPCs
select function_privs_are(
  'public', 'create_compliance_task_v1',
  array['uuid', 'text', 'uuid', 'text', 'text', 'text', 'uuid', 'date', 'uuid', 'uuid'],
  'authenticated', array['EXECUTE'], 'a buyer member can attempt to create a task'
);
select function_privs_are(
  'public', 'complete_compliance_task_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to complete a task'
);
select function_privs_are(
  'public', 'raise_compliance_finding_v1',
  array['uuid', 'text', 'uuid', 'text', 'text', 'uuid', 'uuid'],
  'authenticated', array['EXECUTE'], 'a buyer member can attempt to raise a finding'
);
select function_privs_are(
  'public', 'resolve_compliance_finding_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to resolve a finding'
);
select function_privs_are(
  'public', 'create_corrective_action_v1', array['uuid', 'text', 'date', 'uuid'],
  'authenticated', array['EXECUTE'], 'a buyer member can attempt to create a corrective action'
);
select function_privs_are(
  'public', 'complete_corrective_action_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to complete a corrective action'
);
select function_privs_are(
  'public', 'verify_corrective_action_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to verify a corrective action'
);
select function_privs_are(
  'public', 'request_compliance_exception_v1',
  array['uuid', 'text', 'uuid', 'uuid', 'uuid', 'text', 'timestamptz'],
  'authenticated', array['EXECUTE'], 'a buyer member can attempt to request an exception'
);
select function_privs_are(
  'public', 'request_compliance_decision_override_v1', array['uuid', 'text', 'text'],
  'authenticated', array['EXECUTE'], 'a buyer member can attempt to request a decision override'
);
select function_privs_are(
  'public', 'decide_compliance_approval_v1', array['uuid', 'text', 'text'],
  'authenticated', array['EXECUTE'], 'a buyer member can attempt to decide an approval'
);
select function_privs_are(
  'public', 'create_compliance_escalation_v1', array['uuid', 'uuid', 'uuid', 'text'],
  'authenticated', array['EXECUTE'], 'a buyer member can attempt to create an escalation'
);
select function_privs_are(
  'public', 'resolve_compliance_escalation_v1', array['uuid'], 'authenticated', array['EXECUTE'],
  'a buyer member can attempt to resolve an escalation'
);

select is(
  (select default_enabled from public.feature_flags where key = 'compliance_decisions_v1'),
  false,
  'compliance decision engine defaults off (Phase 0 seed)'
);

-- Check constraints protect status-transition invariants even if a future
-- code path forgets to set the right fields. These also violate FKs (no real
-- buyer/finding/task exists), so each one throws regardless; the point is
-- that they throw.
select throws_ok(
  $$insert into public.compliance_tasks (
      buyer_id, subject_type, subject_id, task_type, title, status, created_by
    ) values (gen_random_uuid(), 'supplier', gen_random_uuid(), 'review', 'test', 'done', gen_random_uuid())$$,
  'a task cannot be marked done without completed_by/completed_at'
);
select throws_ok(
  $$insert into public.compliance_findings (
      buyer_id, subject_type, subject_id, severity, description, status, raised_by
    ) values (gen_random_uuid(), 'supplier', gen_random_uuid(), 'low', 'test', 'resolved', gen_random_uuid())$$,
  'a finding cannot be marked resolved without resolved_by/resolved_at'
);
select throws_ok(
  $$insert into public.compliance_corrective_actions (
      finding_id, description, status
    ) values (gen_random_uuid(), 'test', 'verified')$$,
  'a corrective action cannot be marked verified without verified_by/verified_at'
);
select throws_ok(
  $$insert into public.compliance_escalations (
      task_id, finding_id, escalated_to, escalated_by, reason
    ) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'test')$$,
  'an escalation cannot reference both a task and a finding'
);
select throws_ok(
  $$insert into public.compliance_escalations (
      task_id, finding_id, escalated_to, escalated_by, reason
    ) values (null, null, gen_random_uuid(), gen_random_uuid(), 'test')$$,
  'an escalation must reference exactly one of task or finding'
);
select throws_ok(
  $$insert into public.compliance_approvals (
      buyer_id, approval_type, requested_by, status
    ) values (gen_random_uuid(), 'exception', gen_random_uuid(), 'approved')$$,
  'an approval cannot be marked approved without approver_id/decided_at'
);

select * from finish();
rollback;
