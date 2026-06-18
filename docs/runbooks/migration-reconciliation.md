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
