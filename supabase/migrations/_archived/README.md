# Archived migrations

These files never applied successfully to any environment and are kept here
for audit history only. The Supabase CLI does not read this directory, so
they are excluded from local replay (`supabase start` / `supabase db reset`)
and from any `db push`.

## `20250805135438_80f57b7d-8440-4f1c-9bc9-471ad01d6f0c.sql`

Fails: runs `ALTER TYPE public.user_role ADD VALUE 'viewer'` and then uses
`'viewer'` as a column default later in the same transaction. PostgreSQL
does not allow a newly added enum value to be used in the same transaction
that added it. A local replay reproduces the failure.

## `20250805135621_c825e04f-5a65-4a86-b272-eaa380a6ce1e.sql`

Fails: creates a trigger that calls `public.update_updated_at_column()`,
which is not defined until the next migration
(`20250805140030_3d71223b-6193-4a4b-a73a-b464b7871aaf.sql`). Since DDL is
transactional, the whole migration (including the table creates) rolled
back. `20250805140030` retried the same work from scratch — creating the
function first — and that is the version confirmed to match production
(see `docs/runbooks/migration-reconciliation.md`).

## `20250805142426_b6aa2d04-3330-4e99-bb2d-194f06249c40.sql`

Fails: `column reference "id" is ambiguous` in the `document_approvals`
RLS policy subquery (`SELECT id FROM document_uploads du JOIN
document_requests dr ...` — both tables have an `id` column). Confirmed by
a full local replay, not just static reading. The very next migration,
`20250805142646_2ddccdc8-6a97-47cc-a09b-b02ff49c396e.sql`, is titled
"Phase 4: Advanced Multi-Branch Features Database Schema (Fixed)" and
recreates the same tables correctly — confirmed live in production
(`document_libraries`, `shared_documents`, `approval_workflows`,
`workflow_steps`, `document_approvals`, `delegation_permissions`,
`branch_compliance_metrics` all exist in `edwerzutsknhuplidhsj`).

## `20250903183928_e8f5114e-d7fa-490b-a757-b0be213d6208.sql`

Fails: `storage.foldername(name)[1]` — a function call result can't be
subscripted directly in Postgres without wrapping it in parentheses, e.g.
`(storage.foldername(name))[1]`. Confirmed by local replay. Production has
no policies named "Buyers can upload/read/delete custom templates"; it has
"Buyers custom template upload/read/delete" instead, created by
`20250903185244_a3014ff3-06b2-4fc1-9909-656d726a1239.sql`, which uses
`split_part(name, '/', 2)` instead of the broken array-subscript pattern
and is confirmed live in production.

## `20250820142452_54085e44-4487-4eba-b98a-bd8f9e670e2e.sql`

Fails: `ALTER VIEW public.admin_user_stats ENABLE ROW LEVEL SECURITY` —
PostgreSQL does not support enabling RLS on a view, only on tables.
Confirmed by a full local replay. Production has no `admin_user_stats`
view at all; the next migration,
`20250820142624_3f1fea70-19dc-41da-bb80-1143f0214b8c.sql`, abandons the
view approach entirely and creates `public.get_admin_user_stats()` as a
`SECURITY DEFINER` function instead — confirmed live in production.
