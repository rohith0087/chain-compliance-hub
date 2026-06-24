-- Enable structured_evidence_v1 and canonical_evidence_v1 for the test buyer
-- (80bf0ccc-ea3a-469a-b8b2-34990f70ba96) so that evidence extraction runs
-- against uploaded documents. Both flags default_enabled=false globally;
-- this per-org override activates the GPT-4o extraction cron for this buyer.

insert into public.organization_feature_flags (organization_id, organization_type, feature_key, enabled)
values
  ('80bf0ccc-ea3a-469a-b8b2-34990f70ba96', 'buyer', 'structured_evidence_v1',  true),
  ('80bf0ccc-ea3a-469a-b8b2-34990f70ba96', 'buyer', 'canonical_evidence_v1',   true)
on conflict (organization_id, organization_type, feature_key)
do update set enabled = excluded.enabled;

-- Re-queue any skipped jobs for the last 7 days so they get picked up on
-- the next cron tick without needing new uploads.
update public.evidence_extraction_jobs
set status       = 'pending',
    scheduled_at = now(),
    last_error   = null
where buyer_id   = '80bf0ccc-ea3a-469a-b8b2-34990f70ba96'
  and status     = 'skipped'
  and created_at >= now() - interval '7 days';
