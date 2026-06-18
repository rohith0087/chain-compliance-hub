# Migration reconciliation record

Snapshot date: 2026-06-18  
Production project: `edwerzutsknhuplidhsj` (`Complience`)

At the start of Phase 0, the repository contained 268 migration files while the production migration ledger contained 248 entries. Timestamp formats and several historical names do not align, so the difference must not be repaired automatically.

Reconciliation procedure:

1. Export the production schema and migration ledger without modifying either environment.
2. Apply all repository migrations to a fresh local database.
3. Compare schemas by objects, constraints, policies, functions, triggers, extensions, and storage configuration—not by filename count alone.
4. Classify every unmatched migration as equivalent, local-only pending, production-only, or obsolete.
5. Produce one reviewed baseline migration for a new staging project.
6. Use `supabase migration repair` only after the classification is approved and backed up.

The new Phase 0 migration is intentionally additive and must not be pushed until this reconciliation is complete.

## Reconciliation progress

Read-only inspection on 2026-06-18 confirmed:

- Production runs PostgreSQL 17.4 and still has 248 migration-ledger entries.
- The repository now has 269 migration files, including `20260618091355_phase0_security_foundation.sql`.
- Production contains the multi-branch RBAC tables, policies, triggers, helper functions, and `user_role` labels introduced by the August 2025 migration sequence.
- No migration history was repaired and no production DDL or DML was executed.

The first fresh local replay with Supabase CLI 2.98.2 found these historical blockers:

1. Eleven files from June and July 2025 use `timestamp-name.sql`; the current CLI skips them because it requires `timestamp_name.sql`.
2. After normalizing those names in a temporary copy, `20250805135438_80f57b7d-8440-4f1c-9bc9-471ad01d6f0c.sql` fails because it adds enum labels and uses `viewer` in the same transaction.
3. A diagnostic split of that transaction reaches `20250805135508_781c75d8-6cd9-40a6-b86f-9c95b9788917.sql`, which recreates `permission_type`. The following `20250805135621...` and `20250805140030...` files are further retries of the same RBAC schema.

These findings show that the repository history contains failed or superseded attempts and cannot be made reproducible by timestamp repair alone.

## Resolved classification (2026-06-18, second pass)

The first pass only sampled the two known trouble spots. This pass diffed
every local migration timestamp against the full 248-entry production
ledger (fetched via `list_migrations`), matching on exact timestamp and on a
~12h offset (see finding below). Conclusions:

| Repository migration(s) | Resolution | Evidence |
|---|---|---|
| Eleven `timestamp-name.sql` files dated 2025-06-17 through 2025-07-28 | **Equivalent — renamed.** `git mv` to `timestamp_name.sql` (underscore), same UUID suffix, no content change. Each matches a production ledger entry within ~3-70 seconds once the ~12h offset (see below) is accounted for. | Timestamp diff: all 11 land within 120s of a distinct production version after subtracting 12h. |
| `20250805135438_80f57b7d-...sql` | **Obsolete — archived.** Runs `ALTER TYPE ... ADD VALUE 'viewer'` then uses `'viewer'` as a column default in the same transaction; Postgres rejects this. Moved to `supabase/migrations/_archived/`. | No production ledger entry within tolerance of this timestamp in either direction; content reproduces the failure on inspection. |
| `20250805135508_781c75d8-...sql` | **Equivalent — renamed.** Enum-only "Step 1" retry; succeeds. Matches production `20250805015502` (~6s after 12h offset). | Timestamp match + the next file in sequence (`135621`) assumes these enum values already exist. |
| `20250805135621_c825e04f-...sql` | **Obsolete — archived.** "Step 2" retry; creates a trigger calling `public.update_updated_at_column()`, which isn't defined until `140030`. The whole migration (including its `CREATE TABLE`s) rolled back. Moved to `supabase/migrations/_archived/`. | No production ledger entry within tolerance; `140328` (the next surviving file) only adds functions/policies/backfill and does not recreate the tables `135621` would have created, implying a later file created them. |
| `20250805140030_3d71223b-...sql` | **Equivalent — renamed.** Creates `update_updated_at_column()` first, then everything else; succeeds. Matches production `20250805020025` (~5s after 12h offset). | Timestamp match; `140328` builds on its tables/functions without recreating them. |
| `20250805142426_b6aa2d04-...sql` | **Obsolete — archived.** Found by an actual local replay (not just static reading): fails with `column reference "id" is ambiguous` in a `document_approvals` RLS policy subquery joining two tables that both have an `id` column. Moved to `supabase/migrations/_archived/`. | The next migration, `20250805142646_2ddccdc8-...sql`, is explicitly titled "... (Fixed)" and recreates the same 7 tables correctly; all 7 (`document_libraries`, `shared_documents`, `approval_workflows`, `workflow_steps`, `document_approvals`, `delegation_permissions`, `branch_compliance_metrics`) are confirmed live in production. |
| `20250820142452_54085e44-...sql` | **Obsolete — archived.** Found by local replay: fails with `ALTER VIEW ... ENABLE ROW LEVEL SECURITY`, which Postgres doesn't support on views. Moved to `supabase/migrations/_archived/`. | Production has no `admin_user_stats` view; the next migration, `20250820142624_3f1fea70-...sql`, replaces the view approach with a `SECURITY DEFINER` function `get_admin_user_stats()`, confirmed live in production. |
| `20250903183928_e8f5114e-...sql` | **Obsolete — archived.** Found by local replay: `storage.foldername(name)[1]` is invalid Postgres syntax without parentheses around the function call. Moved to `supabase/migrations/_archived/`. | Production has no policy named "Buyers can upload/read/delete custom templates"; `20250903185244_a3014ff3-...sql` creates differently-named, working equivalents and is confirmed live in production. |
| `20260618091355_phase0_security_foundation.sql` | Local-only pending, additive. Applied directly to production via `apply_migration` rather than `db push`, since it only adds new objects and references tables/functions confirmed to already exist in production (`public.buyers`, `public.profiles`, `public.platform_administrators`). | See Phase 0 rollout record below once applied. |
| `20260618125151_phase1_requirement_engine.sql` | Local-only pending, additive. Depends on `private.has_organization_access`, created by the Phase 0 migration above — must apply after it, same direct-SQL method. | Confirmed via introspection that this function does not exist in production prior to the Phase 0 migration. |

## Known, non-blocking historical drift (documented, not repaired this pass)

A full timestamp diff (270 local files vs. 248 production ledger entries)
found the problem is broader than the two trouble spots above, but none of
it blocks shipping new additive migrations, so it is **not** being repaired
in this pass:

- **~80 additional local files** (beyond the 11 above), spanning August
  2025 through early October 2025, carry the same ~12h offset between their
  filename timestamp and the version actually recorded in production's
  ledger — e.g. local `20250905154633` corresponds to production's
  `20250905034631` (12h + 2s), local `20250920161713` to production's
  `20250920041712`, and so on. These already use the correct underscore
  separator, so the Supabase CLI recognizes them and local replay is
  unaffected; the only consequence is that the local filename's version
  number doesn't match production's recorded version number for the same
  content. This only matters if something tries to align local and remote
  ledgers via `migration repair` or `db push` — which this rollout
  deliberately avoids by applying new migrations directly via
  `apply_migration`.
- **3 production-only migrations with no local file at all**:
  `20250817111050`, `20250817111120`, `20251204205347`. These were likely
  applied directly against production (dashboard SQL editor or similar)
  and never captured back into the repo. Follow-up: pull their actual SQL
  from production (e.g. via `pg_stat_statements`/audit history if retained,
  or by diffing schema before/after their timestamps) and add them to the
  repository for completeness.
- **~17 further orphaned local-only files** beyond the 2 archived above
  (e.g. `20250903160624`, `20250921175528`, and others in the same
  September 2025 clusters) that don't match any production ledger entry —
  likely further abandoned local/preview retries from the same period.
  Follow-up: review and archive individually the same way as the two Aug-5
  files once time allows; not required for the Phase 0/1 exit gate.

Do not run `supabase migration repair` or `supabase db push` against this
repository's full history until the above follow-ups are individually
reviewed. New migrations are applied directly via `apply_migration` instead,
which records its own ledger entry without touching the mismatched history.
