begin;
select plan(10);

select has_table('public', 'feature_flags', 'feature flag catalog exists');
select has_table('public', 'organization_feature_flags', 'organization feature overrides exist');
select is(
  (select relrowsecurity from pg_class where oid = 'public.feature_flags'::regclass),
  true,
  'feature_flags has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.organization_feature_flags'::regclass),
  true,
  'organization_feature_flags has RLS enabled'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      and coalesce(with_check, '') = 'true'
      and 'public' = any(roles)
  ),
  'public role has no unrestricted mutation policies'
);

select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Public read access for avatars',
        'Company logos are publicly accessible',
        'Users can view company logos',
        'Public can download exports'
      )
  ),
  'broad public bucket listing policies are absent'
);

select is((select public from storage.buckets where id = 'exports'), false, 'exports bucket is private');
select is((select default_enabled from public.feature_flags where key = 'compliance_requirements_v1'), false, 'requirements engine defaults off');
select is((select default_enabled from public.feature_flags where key = 'structured_evidence_v1'), false, 'evidence engine defaults off');
select is((select count(*)::integer from public.feature_flags), 4, 'all Phase 0 feature gates are seeded');

select * from finish();
rollback;
