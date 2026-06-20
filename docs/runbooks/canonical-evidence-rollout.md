# Canonical Evidence v1 rollout

`canonical_evidence_v1` is additive and defaults off. Do not enable it until the migration replay, pgTAP suite, backfill reconciliation, and hash queue have completed in the target environment.

## Pre-deploy gates

1. Replay `20260619203148_canonical_evidence_request_reuse.sql` against a production-shaped database.
2. Run `npm run test:db`, `npm run test:unit`, `npm run typecheck`, `npm run lint:baseline`, `npm run security:edge`, and `npm run build`.
3. Deploy all new Edge Functions before scheduling or enabling the feature.
4. Confirm `SYSTEM_INVOCATION_SECRET` and the Vault secret `system_cron_invocation` represent the same secret.

## Backfill reconciliation

```sql
select count(*) as legacy_uploads from public.document_uploads;
select count(*) as linked_uploads from public.document_uploads where canonical_evidence_version_id is not null;
select count(*) as library_documents from public.supplier_document_library;
select count(*) as linked_library_documents from public.supplier_document_library where canonical_evidence_version_id is not null;
select count(*) as legacy_claims from public.evidence_claims;
select count(*) as linked_claims from public.evidence_claims where canonical_evidence_version_id is not null;
select * from public.canonical_migration_exceptions where resolved_at is null order by created_at;
select status,count(*) from public.canonical_asset_hash_jobs group by status order by status;
```

Every source row must have a canonical link or an explicit migration exception. The hash queue must have no `pending`, `processing`, `failed`, or `dead_letter` rows before redundant ingestion paths are disabled.

## Canary enablement

Enable Test Buyer and Test Supplier only after reconciliation. Use their organization IDs rather than matching by company name.

```sql
insert into public.organization_feature_flags
  (organization_id,organization_type,feature_key,enabled,metadata)
values
  ('<test-buyer-id>','buyer','canonical_evidence_v1',true,'{"rollout":"canary"}'::jsonb),
  ('<test-supplier-id>','supplier','canonical_evidence_v1',true,'{"rollout":"canary"}'::jsonb)
on conflict (organization_id,organization_type,feature_key)
do update set enabled=excluded.enabled,metadata=excluded.metadata,configured_at=now();
```

Validate exact-match reuse, supplier consent, near-expiry rejection, scope mismatch, combined review, four-eyes review, revocation, reevaluation, and signed dossier blocking before expanding the canary.

## Rollback

Disable organization overrides. Do not delete canonical rows, audit events, grants, backfill links, or storage objects. Legacy request and upload records remain compatibility sources while the flag is off.
