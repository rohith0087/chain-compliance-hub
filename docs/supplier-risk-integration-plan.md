# Supplier Risk — Integration Plan (Adaptive External Risk)

Status: **proposal / for review**. No code lands until this is approved slice by slice.

## 1. What we're adding, and what we're NOT

We're adding **adaptive, external supplier-risk intelligence**: buyer-specific risk from public/government signals (sanctions, product recalls, forced-labor / UFLPA, regulatory enforcement, environmental, adverse media, geopolitical), scored per **buyer × supplier × product × geography**, traceable to evidence, and explainable across dimensions (Regulatory, Product Safety, Labor/ESG, Geopolitical, Operational, Financial, Cyber).

This **complements** — does not replace — the existing risk in `supplier_performance_metrics` (`risk_score`, `risk_level`, `risk_factors`, `auto_calculated_risk`), which is **compliance/document-performance** risk (on-time submissions, expired docs, doc quality) computed by `calculate-supplier-metrics`. That subsystem stays **untouched**.

**Out of scope (handled by other systems already in this app):**
- Document *upload*, OCR, buyer document library, certification/expiry tracking → existing `document_*`, `evidence_*`, `coa_*`, `check-document-expiry`.
- Compliance evaluation / dossiers / audits → existing `compliance_*`, `assessments`, `audit_*`.

The design intent comes from the standalone TraceR2C spec (`product.md` / `plan.md` in the `Supplier_Risk` repo). **Only the design carries over** — the standalone Python/FastAPI/Neo4j implementation does **not** embed here; this app is React + Vite + Supabase (Postgres/RLS/Auth) + Deno edge functions, so the risk feature is built **Supabase-native**.

## 2. Non-negotiable principles (adapted to this stack)

1. **The LLM never computes the final score.** Scoring is deterministic (a Postgres function or a pure-TS module in an edge function), fully reproducible and versioned. AI only extracts, classifies, entity-matches, and explains.
2. **Every risk event and score is traceable to evidence** — source URL, fetched-at, hash, raw payload.
3. **Buyer-specific, not universal.** The same supplier scores differently per buyer (industry/product/geography/exposure via `buyer_supplier_connections`).
4. **Append-only** risk score snapshots and evidence extractions; never overwrite.
5. **Reuse existing tenancy + RLS.** No new auth. Scope every table with the app's existing helpers.
6. **Provenance flag on inferred facts**: `verified` (from a government record) vs `ai_inferred`.
7. **Feature-flagged rollout** via the existing `feature_flags` / `organization_feature_flags` + `_shared/featureFlags.ts`.

## 3. How it fits the existing app (reuse map)

| Need | Reuse (existing) |
| --- | --- |
| Buyer (tenant) & supplier identity | `buyers`, `suppliers`, `company_users`, `organizations` |
| Buyer↔supplier relationship / exposure | `buyer_supplier_connections`, `branch_supplier_connections` |
| Tenancy scoping in RLS | `get_connected_supplier_ids_for_buyer(buyer_id)`, `get_user_buyer_ids()`, `get_user_supplier_id()`, `supplier_can_view_buyer()`, `is_admin()` |
| Roles | `user_role` enum (`buyer`, `admin`, `company_admin`, `auditor`, `super_admin`, …) |
| Edge-function scaffolding | `_shared/corsHeaders.ts`, `authValidation.ts`, `roleValidation.ts`, `rateLimiter.ts`, `requestContext.ts`, `env.ts` |
| AI access | `_shared/ai`, `_shared/openai`, `ai-platform-keys-v1`, `org_ai_settings` (OpenAI gpt-4o/-mini, Claude haiku already in use) |
| Ownership graph edges | `entity_relationships` (source/target/relationship_type/confidence/source_url) — evaluate reuse vs. dedicated table (see §5) |
| Scheduling connectors | same pattern as `check-document-expiry`, `coa-schedule-reminder`, `check-onboarding-deadlines` |
| UI | shadcn-ui, existing buyer dashboards (`BuyerDashboard`, `BuyerOverviewDashboard`, `BuyerComplianceDashboard`), Recharts |

## 4. New data model (Supabase migrations)

All tables prefixed `supplier_risk_*` / `buyer_risk_*` to namespace the subsystem. Timestamped migration `YYYYMMDDHHMMSS_supplier_risk_*.sql`.

- **`risk_source_records`** — provenance for ingested signals. `id, source_type, source_url, retrieved_at, connector, connector_version, content_sha256, raw_payload jsonb`. Append-only. (No blob store; raw record lives in `raw_payload`.)
- **`supplier_risk_events`** — buyer-AGNOSTIC structured events. `id, supplier_id (fk suppliers), facility_id?, event_type, dimension, severity, entity_match_confidence, source_confidence, industry_relevance jsonb, occurred_at, detected_at, status, remediation_status, evidence_status, source_record_id, event_key (dedup)`. **No final score stored here.**
- **`buyer_risk_policies`** — per-buyer versioned weights & rules. `id, buyer_id, policy_key, version, industry, dimensions jsonb, event_rules jsonb, critical_topics text[], low_relevance_topics text[], is_published`. Seeded from industry templates (footwear, food, pharma).
- **`supplier_risk_scores`** — append-only snapshots per **buyer × supplier**. `id, buyer_id, supplier_id, overall_score, dimension_scores jsonb, policy_version, engine_version, input_event_ids uuid[], previous_score, change_reasons jsonb, calculated_at`.
- **`risk_entities`** + **`risk_entity_edges`** (ownership graph: parent companies, co-packers, facilities, beneficial owners) — OR extend `entity_relationships`. Decide in §5. Carries provenance + `verified|ai_inferred`.
- **`supplier_risk_feedback`** — analyst labels (`relevant`, `not_relevant`, `false_entity_match`, `escalated`, `remediated`, `disruption_occurred`).

**RLS** (mirroring the app): a buyer/team member sees rows for suppliers in `get_connected_supplier_ids_for_buyer(buyer_id)`; `buyer_risk_policies` and `supplier_risk_scores` scoped by `buyer_id IN get_user_buyer_ids()`; suppliers may read their own events; `is_admin()`/platform admins manage connectors and `risk_source_records`. `supplier_risk_events` and `risk_entities` are cross-buyer knowledge (readable to any connected buyer, writable only by service-role ingestion).

## 5. Open decision — ownership graph storage

`entity_relationships` already exists but is `assessment_id`-scoped and generic. Options:
- **(a)** Reuse it with a risk `relationship_type` namespace — less schema, but couples risk to assessments.
- **(b)** Dedicated `risk_entities` + `risk_entity_edges` — cleaner separation, provenance-first. **Leaning (b).**

## 6. Deterministic scoring engine (no LLM)

A pure module invoked by an edge function `calculate-supplier-risk` (mirrors `calculate-supplier-metrics`), or a Postgres function for reproducibility. Versioned (`engine_version`).

```
event_impact = severity × source_confidence × entity_match_confidence
             × industry_applicability × product_applicability
             × buyer_exposure × recency_decay × unresolved_factor
```
- **Applicability**, not flat source weights (a food recall barely dents a footwear buyer).
- **Time decay** per event type (sanctions: none while active; forced-labor: slow; news: fast unless confirmed).
- **Remediation ladder** scales impact (open 100% → corrective 80% → evidence 60% → buyer-verified 30% → closed 10%).
- Aggregates to per-dimension + overall; writes an append-only `supplier_risk_scores` snapshot with `change_reasons` for explainability.

## 7. Ingestion (connectors)

One edge function per source, service-role, scheduled like `check-document-expiry`:
- Fetch → write `risk_source_records` (raw + hash + provenance) → normalize → upsert `supplier_risk_events` (idempotent via `event_key`) → enqueue rescore.
- **First connectors:** OFAC sanctions, CPSC/openFDA recalls, one enforcement source (OSHA/EPA/SAM.gov). UFLPA/forced-labor next.
- Entity matching supplier↔record is the hard part (see §8); low-confidence matches go to a review queue, not auto-applied.

## 8. AI usage (via existing `_shared/ai` + `org_ai_settings`)

AI does: entity resolution / name-variant matching, event classification into dimensions, industry/product applicability tagging, adverse-media extraction, and analyst-facing explanations. **Strict structured outputs**; **prompt-injection isolation** (fetched text → untrusted buffer → schema-validated extraction → deterministic scoring; scraped text never triggers tools or writes scores). AI **proposes** entity merges / weight changes → human review → publish.

## 9. Frontend (React feature)

New feature module `src/features/supplier-risk/` (following the emerging `src/features/` pattern), reusing shadcn-ui + existing buyer data hooks:
- **Risk panel** on the buyer's supplier detail view — external risk score + dimensions, alongside the existing compliance risk.
- **Combined headline**: read-only rollup showing *Compliance risk* (existing `supplier_performance_metrics`) + *External risk* (new) → overall. Does not modify existing metrics.
- **Buyer risk policy** config (onboarding/settings): dimension weights from an industry template, critical topics.
- **Explainability drill-down**: every score movement → contributing events → source record.
- **Network graph** (later): supplier → parent/facilities/co-packers, verified vs inferred edges. (Mapbox GL already present for geo.)

## 10. Roles & permissions

- Buyer users: read risk for connected suppliers; buyer admins/`approver` edit their `buyer_risk_policies`.
- Suppliers: read their own events (transparency), no scores of other buyers.
- Platform/super admins: manage connectors, `risk_source_records`, entity-merge review, engine/policy versions.

## 11. Phased rollout (each slice = 1 reviewable PR, feature-flagged)

- **Slice 0 ✅ DONE (applied to prod)** — 7 tables + RLS (12 policies) + `supplier_risk` flag (enabled, canary). Migration `20260714222014_supplier_risk_slice0_schema.sql`.
- **Slice 1 ✅ built (live behind flag)** — `buyer_risk_policies` + industry templates + policy config UI at `/supplier-risk/policy`. tsc/lint clean.
- **Slice 2 ✅ DONE (deployed to prod)** — `ingest-ofac-sanctions` edge fn deployed + test-run (19,210 SDN entries, 42 suppliers, 0 false positives); write path proven; weekly `pg_cron` scheduled (`20260714231845_supplier_risk_ofac_cron.sql`). Confidence-gated: ≥0.90 active, 0.75–0.90 under_review.
- **Slice 3 ✅ DONE (applied to prod)** — deterministic `calculate_supplier_risk_score` Postgres fn + append-only snapshots. Golden-tested (overall 33). Migration `20260714233412_supplier_risk_scoring_engine_v1.sql`.
- **Slice 4 ✅ built** — `SupplierRiskPanel` (external score + dimensions + contributing events) shown side-by-side with existing compliance risk, on-demand recompute (RPC), at `/supplier-risk`. tsc/lint clean. *(Live UI test pending a logged-in buyer session.)*
- **Slice 5 — NEXT** — ownership graph (`risk_entities`/edges) + network viz.
- **Slice 6 ✅ mostly DONE (deployed to prod)** — shared ingest helper (`_shared/supplierRiskIngest.ts`) + CPSC recalls + openFDA food enforcement (targeted per-supplier search) connectors; OFAC refactored onto the helper. All 3 scheduled weekly. Fixed a real bug (partial index → `ON CONFLICT` 42P10). Produced real events (Deb El Food Products → 2 Class I FDA egg recalls → score 14, correctly time-decayed). **AI adverse-media extraction deferred to a focused follow-up (Slice 6b).**
- **Slice 7** — feedback loop; (later) predictive weight suggestions with human approval.

## 12. Decisions locked (2026-07-13)

1. **Scheduling** → **pg_cron** invoking edge functions over `net.http_post`, exactly like the existing `check-document-expiry-daily` cron job.
2. **First connectors** → **OFAC sanctions + CPSC recalls + UFLPA / forced-labor** (US-first). Recalls/enforcement expand from there.
3. **Ownership graph** → **dedicated tables** (`risk_entities` + `risk_entity_edges`) — we pull in parents, co-packers, facilities, so a purpose-built graph beats overloading `entity_relationships`.
4. **AI keys** → **per-org via `org_ai_settings` / `ai-platform-keys-v1`**.
5. **Combined view** → **side-by-side** for now (Compliance risk | External risk), no blended number yet.
6. **Raw payloads** → **no constraint**; store verbatim in `raw_payload` for reproducibility.

### Conventions confirmed against the codebase (for implementers)
- Tenancy in RLS: `... buyer_id IN (SELECT public.get_user_buyer_ids())`; connected suppliers via `public.get_connected_supplier_ids_for_buyer()`; supplier self via `public.get_user_supplier_id()`; admin via `public.is_admin(auth.uid())`. These are `STABLE SECURITY DEFINER` and use `auth.uid()`.
- Table style: `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `timestamptz DEFAULT now()`, `GRANT ... TO authenticated` + `GRANT ALL ... TO service_role`, `ENABLE ROW LEVEL SECURITY`, `updated_at` trigger.
- Migration naming: `YYYYMMDDHHMMSS_*.sql`.
- Feature flags: insert into `feature_flags (key, description, default_enabled, lifecycle)`; per-org overrides via `organization_feature_flags` + `_shared/featureFlags.ts`.

### Milestone after the 7 slices
Onboard **5–10 real suppliers** and produce their first ratings — treated as a **tuning baseline, not gospel**: accuracy hinges on entity matching, so low-confidence matches route to human review rather than auto-scoring.

---
*Reference: standalone design lives in the `Supplier_Risk` repo (`product.md`, `tech_stack.md`, `plan.md`). This document supersedes that implementation for the embedded build.*
