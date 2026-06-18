begin;
select plan(37);

select has_table('public', 'requirement_frameworks', 'framework catalog exists');
select has_table('public', 'requirement_framework_versions', 'framework versions exist');
select has_table('public', 'requirement_jurisdictions', 'jurisdictions exist');
select has_table('public', 'requirements', 'stable requirements exist');
select has_table('public', 'requirement_versions', 'requirement versions exist');
select has_table('public', 'company_requirement_configurations', 'buyer extensions exist');
select has_table('public', 'legacy_requirement_mappings', 'legacy mappings exist');
select has_table('public', 'requirement_evaluations', 'evaluations exist');
select has_table('public', 'requirement_evaluation_results', 'evaluation results exist');

select ok((select relrowsecurity from pg_class where oid = 'public.requirement_frameworks'::regclass), 'frameworks have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.requirement_framework_versions'::regclass), 'framework versions have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.requirement_jurisdictions'::regclass), 'jurisdictions have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.requirements'::regclass), 'requirements have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.requirement_versions'::regclass), 'requirement versions have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.company_requirement_configurations'::regclass), 'buyer configurations have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.legacy_requirement_mappings'::regclass), 'legacy mappings have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.requirement_evaluations'::regclass), 'evaluations have RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.requirement_evaluation_results'::regclass), 'results have RLS');

select is((select status from public.requirement_framework_versions where version = 'CPSC-2026.1'), 'draft', 'CPSC content defaults to draft');
select is((select default_enabled from public.feature_flags where key = 'compliance_requirements_v1'), false, 'requirement engine defaults off');
select is((select count(*)::integer from public.requirement_frameworks where code in ('TR2C-LEGACY', 'US-CPSC')), 2, 'pilot frameworks are seeded');
select is((select count(*)::integer from public.requirements where framework_id = (select id from public.requirement_frameworks where code = 'US-CPSC')), 5, 'CPSC requirement identities are seeded');
select is((select count(*)::integer from public.requirement_framework_versions where framework_id = (select id from public.requirement_frameworks where code = 'US-CPSC')), 3, 'effective CPSC versions are seeded');
select is((select count(*)::integer from public.requirement_versions rv join public.requirements r on r.id = rv.requirement_id where r.stable_key = 'CERTIFICATE-EFILING'), 2, 'only future-effective eFiling versions are seeded');
select is((select count(*)::integer from public.requirement_framework_versions where status = 'published'), 0, 'no regulatory content is auto-published');
select ok((select bool_and(jsonb_array_length(source_urls) > 0) from public.requirement_framework_versions), 'seeded versions carry official sources');

select function_privs_are(
  'public', 'record_requirement_evaluation_v1', array['jsonb', 'jsonb'], 'authenticated', array[]::text[],
  'authenticated cannot record privileged evaluations'
);
select function_privs_are(
  'public', 'record_requirement_evaluation_v1', array['jsonb', 'jsonb'], 'service_role', array['EXECUTE'],
  'service role can record evaluations transactionally'
);
select function_privs_are(
  'public', 'publish_requirement_framework_version_v1', array['uuid', 'uuid'], 'authenticated', array[]::text[],
  'authenticated cannot invoke the service publication primitive'
);
select function_privs_are(
  'public', 'publish_requirement_framework_version_v1', array['uuid', 'uuid'], 'service_role', array['EXECUTE'],
  'service role can invoke administrator-validated publication'
);
select has_trigger('public', 'requirement_evaluations', 'protect_requirement_evaluations', 'evaluations are immutable');
select has_trigger('public', 'requirement_evaluation_results', 'protect_requirement_evaluation_results', 'results are immutable');
select has_trigger('public', 'requirement_framework_versions', 'protect_published_framework_versions', 'published framework versions are protected');
select has_trigger('public', 'requirement_framework_versions', 'validate_framework_publication', 'publication metadata is validated');
select has_trigger('public', 'requirement_versions', 'protect_published_requirement_versions', 'published requirement content is protected');

select throws_ok(
  $$update public.requirement_framework_versions set status = 'published' where version = 'CPSC-2026.1'$$,
  'A current platform administrator must review published framework versions',
  'draft content cannot be published without an administrator review'
);

select is(
  (select applicability_rule #>> '{all,1,fact}' from public.requirement_versions rv
   join public.requirements r on r.id = rv.requirement_id
   join public.requirement_framework_versions rfv on rfv.id = rv.framework_version_id
   where r.stable_key = 'CERTIFICATE-EFILING' and rfv.version = 'CPSC-2026.1'),
  'domestic_import_status',
  'future-effective import applicability is encoded deterministically'
);

select * from finish();
rollback;
