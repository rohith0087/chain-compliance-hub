# Phase 0 rollout and rollback

## Environments

Use three isolated Supabase projects:

| Environment | Data | Deployment rule |
|---|---|---|
| Development | Local containers and generated fixtures only | Every branch and CI run |
| Staging | Sanitized production-shaped data | Required before production |
| Production | Customer data | Manual approval after staging gates |

Configure `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_APP_ENV` independently in each hosting environment. Configure Edge Function secrets in Supabase; never expose them through `VITE_*` variables.

The current production project has only a legacy `anon` key. Create a modern publishable/secret key pair in Supabase, deploy environment configuration while both key systems are active, verify traffic, and only then disable legacy keys. Do not rotate JWT signing keys in the same deployment.

## Staging gate

1. Create a database backup and verify that it can be restored to a separate project.
2. Reconcile the remote migration ledger before pushing any migration. Do not use `migration repair` until every unmatched entry has been reviewed.
3. Run `npm ci`, `npm run typecheck`, `npm run lint:baseline`, `npm run security:edge`, `npm run test:unit`, and `npm run build`.
4. Start local Supabase and run `npm run test:db`.
5. Apply `phase0_security_foundation` to staging only.
6. Deploy the four reconciled functions plus `simple-rag-chat` to staging.
7. Run the Playwright smoke tests and manual buyer/supplier document, invitation, support, avatar, logo, and export checks.
8. Run Supabase security and performance advisors; retain the report as release evidence.

## Production order

1. Deploy the disabled `get-openai-key` and `cleanup-all-auth-users` functions first.
2. Deploy authenticated `elevenlabs-tts` and `send-user-invitation`.
3. Deploy `simple-rag-chat` so exports use signed URLs.
4. Apply the additive Phase 0 migration.
5. Enable the release for internal organizations, monitor errors and authorization failures, then expand normally.

No Compliance OS feature flag is enabled by this release.

## Rollback

- Never restore the secret-return or bulk-user-deletion behavior.
- Edge Functions can be rolled back to their previous safe version independently.
- If private exports fail, return inline CSV while signed URL delivery is repaired; do not make compliance exports public.
- If actor-bound audit writes fail, route them through a service-side function rather than restoring `WITH CHECK (true)`.
- Feature-flag tables are additive and can remain disabled. Drop them only after confirming no later phase references them.
- Restore the pre-migration database backup only for unrecoverable schema failure, because restoring discards writes made after the backup.

## Required monitoring

- Alert on HTTP 401, 403, 429, and 5xx rates by Edge Function.
- Track correlation IDs across browser, Edge Function, and database audit events.
- Alert on changes to RLS policies, storage bucket visibility, Edge Function JWT settings, and API keys.
- Review authentication, platform-admin, and document audit logs after every canary expansion.
