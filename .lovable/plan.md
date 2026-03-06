

# Supabase API Schema Disclosure -- Assessment and Remediation Plan

## Auditor's Recommendation Assessment

The auditor is correct that the `/rest/v1/` endpoint exposes the full OpenAPI schema (table names, columns, RPC function signatures) to anyone with the public anon key. However, **Supabase does not provide a built-in toggle to hide this endpoint from the anon role** -- it's a core PostgREST behavior. Blocking it would require an external reverse proxy (Cloudflare Worker, API gateway), which adds infrastructure complexity.

**That said, the real risk is not schema visibility -- it's what the anon role can actually DO.** And here we found critical issues.

---

## CRITICAL FINDING: Dangerous RPC Functions Callable by Anonymous Users

All 80+ RPC functions are granted `EXECUTE` to `PUBLIC` (which includes `anon`). While most use `auth.uid()` internally (which returns NULL for anon, blocking execution), **several have no authentication checks at all**:

### Critical -- No Auth Check (exploitable by anon)
| Function | Risk | Detail |
|----------|------|--------|
| `add_credits` | **CRITICAL** | Accepts arbitrary `user_id` + `credits_amount`. No `auth.uid()` check. An attacker can give any user unlimited credits via the anon key. |
| `consume_credits` | **HIGH** | Accepts arbitrary `user_id`. Could drain another user's credits. |

### Medium -- Has Internal Guards but Should Be Restricted
| Function | Risk | Detail |
|----------|------|--------|
| `create_bootstrap_super_admin` | Medium | Has "admin exists" guard but shouldn't be publicly callable |
| `cleanup_expired_knowledge_entries` | Medium | System maintenance -- no reason to expose |
| `get_companies_for_knowledge_refresh` | Medium | Internal system function |
| `get_latest_expiring_documents` | Medium | Leaks document metadata |

### Trigger/Internal Functions -- Should Not Be Exposed as RPC
Functions like `handle_new_user`, `normalize_request_status`, `sync_document_upload_status`, `update_updated_at_column`, `increment_unread_counts`, `reset_unread_on_read`, `auto_refresh_knowledge_base` are trigger functions that should never be callable via RPC.

---

## Remediation Plan

### Migration 1: Revoke PUBLIC EXECUTE on all functions, grant only to authenticated

The safest approach is to **revoke EXECUTE from PUBLIC on all application functions** and explicitly grant to `authenticated` only. This means:
- Anonymous users cannot call ANY RPC function
- Authenticated users can call functions (which then use `auth.uid()` internally for authorization)
- Service role bypasses grants entirely, so edge functions are unaffected

```sql
-- For each application function:
REVOKE EXECUTE ON FUNCTION public.add_credits FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consume_credits FROM PUBLIC;
-- ... (all ~80 functions)
GRANT EXECUTE ON FUNCTION public.add_credits TO authenticated;
-- etc.
```

For trigger-only functions, revoke from both `PUBLIC` and `authenticated` (they don't need to be callable via RPC at all).

### Migration 2: Add auth checks to `add_credits` and `consume_credits`

Even after revoking anon access, these functions should validate the caller:
- `add_credits`: Should only be callable by service_role (edge functions). Add a check that `auth.uid()` is not null, or better, restrict EXECUTE to `service_role` only.
- `consume_credits`: Same -- restrict to service_role or validate `auth.uid() = p_user_id`.

### Response to Auditor

For the schema disclosure finding specifically, you can respond:
> "We have restricted all RPC function execution to authenticated users only, and sensitive administrative functions are restricted to service_role. While the PostgREST OpenAPI endpoint remains visible (an inherent Supabase/PostgREST architectural characteristic), the attack surface has been eliminated: no table data is accessible to the anon role (all tables have RLS), and no functions are executable by anonymous callers. Schema metadata visibility without actionable access does not constitute an exploitable vulnerability."

---

### Files Affected
- **Database**: 1 migration file with REVOKE/GRANT statements for all functions
- No application code changes (authenticated users and service_role are unaffected)

### Manual Steps
- Consider adding a Cloudflare Worker to block `/rest/v1/` for unauthenticated requests (optional, for full compliance with auditor's letter)
- Remove `graphql_public` from exposed schemas in Supabase Dashboard if GraphQL is not used

