

# CRITICAL: `exec_readonly` RPC -- Unauthenticated SQL Injection Still Present

## Finding

The `exec_sql` function was removed, but an equivalent function called **`exec_readonly`** still exists in the database. It is:

1. **A dynamic SQL executor** -- accepts arbitrary SQL via a JSON parameter `{"q": "<sql>", "params": {...}}` and runs it with `EXECUTE`
2. **SECURITY DEFINER** -- runs with the function owner's elevated privileges, bypassing all RLS policies
3. **Granted to PUBLIC** -- callable by the anonymous key with no authentication required
4. **Not used anywhere** in application code (zero references outside `types.ts`)

### Why the "guardrails" are insufficient

The function attempts to block non-SELECT statements via regex, but these checks are trivially bypassed:

- **Data exfiltration**: An attacker can `SELECT * FROM auth.users` to dump all user emails, password hashes, and metadata -- RLS is bypassed because of SECURITY DEFINER
- **Subquery writes**: `SELECT * FROM (DELETE FROM profiles RETURNING *)` may bypass the keyword check depending on regex ordering
- **Function calls**: `SELECT exec_readonly('{"q":"..."}'::jsonb)` -- recursive calls or `SELECT pg_sleep(30)` for DoS

### Impact

Any unauthenticated user with the public anon key can read **any table in any schema** (including `auth.users`, `vault.secrets`, etc.) by calling this function directly.

---

## Remediation Plan

### Step 1: Drop `exec_readonly` from the database

Run a migration to permanently remove this function:

```sql
DROP FUNCTION IF EXISTS public.exec_readonly(jsonb);
```

This function has zero references in application code, so removal has no side effects.

### Step 2: Verify no other dynamic SQL executors exist

Query for any remaining functions that use `EXECUTE` with text parameters -- already checked, `exec_readonly` is the only one of this pattern.

---

### Files affected
- **Database**: Drop `exec_readonly` function via migration
- No application code changes needed (function is unused)

