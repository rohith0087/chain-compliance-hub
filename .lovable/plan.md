

# Security Linter Issues -- Full Breakdown and Remediation Plan

After running the linter and querying the database, here are all 24 issues grouped by severity:

---

## ERRORS (Critical -- Must Fix)

### 1. RLS Disabled on 2 Tables
These public tables have **no Row Level Security** at all, meaning any authenticated (or anonymous) user can read/write all data:

| Table | Risk |
|-------|------|
| `assessments` | Full read/write access to all assessment data |
| `entity_relationships` | Full read/write access to all entity relationship data |

**Fix**: Enable RLS on both tables and add appropriate policies (e.g., users can only access assessments/relationships tied to their company).

### 2. Security Definer View: `profiles_with_roles`
This view joins `profiles` with `user_roles` and runs with the **view creator's privileges**, bypassing RLS. Any user who can query this view sees all profiles and roles.

**Fix**: Recreate as a regular view (drop `SECURITY DEFINER`) or replace with a security definer **function** that filters by `auth.uid()`.

---

## WARNINGS (Should Fix)

### 3. Functions Missing `search_path` (4 issues)
These SECURITY DEFINER functions don't set `search_path`, making them vulnerable to search path injection:

| Function |
|----------|
| `delete_branch_with_validation` |
| `platform_admin_reset_password` |
| + 2 others (likely `grant_pg_net_access`, `handle_new_user` -- from the vector extension functions that share the pattern) |

**Fix**: Add `SET search_path = 'public'` to each function definition.

### 4. Overly Permissive RLS Policies (13 policies with `true`)
These policies use `WITH CHECK (true)` or `USING (true)` on INSERT/UPDATE/DELETE/ALL, allowing any user to perform the operation:

| Table | Policy | Command | Risk Level |
|-------|--------|---------|------------|
| `notifications` | System can create notifications | INSERT | Low -- notifications are created by system functions |
| `user_activity_logs` | System can insert activity logs | INSERT | Low -- append-only logging |
| `credit_transactions` | System can insert credit transactions | INSERT | **Medium** -- could forge credit transactions |
| `auth_audit_logs` | Anyone can insert auth logs | INSERT | Low -- needed for auth flow |
| `document_activity_logs` | Users can create activity logs | INSERT | Low -- append-only logging |
| `supplier_response_metrics` | System can manage response metrics | ALL | **Medium** -- full access to all metrics |
| `ai_knowledge_entries` | System can manage knowledge entries | ALL | **Medium** -- full access to knowledge base |
| `subscriptions` | System can manage subscriptions | ALL | **High** -- any user could modify subscriptions |
| `platform_admin_audit_logs` | System can insert audit logs | INSERT | Low -- append-only logging |
| `supplier_performance_metrics` | System can manage performance metrics | ALL | **Medium** -- full access to metrics |
| `document_expiry_notifications` | System can insert expiry notifications | INSERT | Low -- system-generated |
| `support_tickets` | Anyone can create tickets | INSERT | Low -- intentional public access |
| `communication_audit_logs` | System can insert audit logs | INSERT | Low -- append-only logging |

**Fix**: For the high/medium-risk ones (`subscriptions`, `credit_transactions`, `supplier_response_metrics`, `supplier_performance_metrics`, `ai_knowledge_entries`), replace `true` with proper checks (e.g., restrict to service_role or check `auth.uid()`). Low-risk logging tables can remain as-is or be tightened to `role() = 'service_role'`.

### 5. Extensions in Public Schema (2 issues)
Extensions like `vector` are installed in the `public` schema instead of a dedicated `extensions` schema. This is a Supabase configuration issue.

**Fix**: This is a manual Supabase dashboard change -- move extensions to the `extensions` schema. Low priority and may require downtime.

### 6. Auth OTP Long Expiry
OTP tokens have an expiry longer than recommended.

**Fix**: In Supabase Dashboard > Authentication > Settings, reduce OTP expiry to 300 seconds (5 minutes).

### 7. Postgres Version Needs Security Patches
**Fix**: In Supabase Dashboard > Settings > Infrastructure, upgrade Postgres to the latest available version.

---

## Implementation Plan

### Migration 1: Enable RLS on unprotected tables
```sql
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relationships ENABLE ROW LEVEL SECURITY;
-- Add appropriate SELECT/INSERT/UPDATE/DELETE policies
```

### Migration 2: Fix mutable search paths
```sql
ALTER FUNCTION public.delete_branch_with_validation(uuid) SET search_path = 'public';
ALTER FUNCTION public.platform_admin_reset_password(...) SET search_path = 'public';
```

### Migration 3: Tighten permissive policies on sensitive tables
Replace `USING (true)` / `WITH CHECK (true)` on `subscriptions`, `credit_transactions`, `supplier_response_metrics`, `supplier_performance_metrics`, and `ai_knowledge_entries` with `role() = 'service_role'` checks so only edge functions (using service_role key) can modify them.

### Migration 4: Fix security definer view
Drop and recreate `profiles_with_roles` without SECURITY DEFINER, or restrict access.

### Manual Steps (Supabase Dashboard)
- Reduce OTP expiry to 300 seconds
- Upgrade Postgres version
- Optionally move extensions to `extensions` schema

---

### Files affected
- **Database only**: 3-4 migration files for the SQL changes
- No application code changes needed

