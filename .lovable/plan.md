

# Endpoint Security Audit -- Findings & Hardening Plan

## Audit Scope
Reviewed all 52 Edge Functions for: unauthenticated access, payload manipulation, role escalation, token replay, and rate limiting bypass.

---

## CRITICAL FINDINGS

### 1. Unauthenticated Email Sending (2 functions)

**`send-batch-request-email`** and **`send-new-request-email`** have `verify_jwt = false` in config.toml AND contain **zero authentication checks** in their code. Any attacker who knows the function URL can:
- Send unlimited emails to arbitrary supplier recipients via Resend (consuming your email quota)
- Trigger email spam from your `@tracer2c.com` domain, risking domain reputation/blacklisting
- Enumerate supplier IDs by observing 200 vs 404 responses

Additionally, `send-new-request-email` still has a **hardcoded wildcard CORS** (`Access-Control-Allow-Origin: '*'`) at line 5-8, plus missing imports for `getCorsHeaders`/`handleCorsPreflightRequest` (though it calls them at lines 16-18 -- this would cause a runtime error).

**Fix:** Add JWT authentication to both functions (validate Bearer token, extract user, verify they belong to the buyer company making the request).

### 2. Missing Authorization on `delete-auth-user` (Privilege Escalation)

This function verifies the caller is authenticated but does **not check any role or permission**. Any authenticated user can delete ANY other user's auth account by passing their `profile_id`. This is a **critical privilege escalation** -- a regular supplier user could delete a platform admin's account.

**Fix:** Add authorization check -- only company admins (for their own team members) or platform admins should be able to delete users.

### 3. Missing Authorization on `create-company-user` (Privilege Escalation)

This function verifies the caller is authenticated but does **not check** whether the caller is an admin of the target `company_id`. Any authenticated user can:
- Create new users in ANY company (buyer or supplier)
- Assign themselves or others as `company_admin` in any organization
- Use the `also_grant_other_role` feature to add users across multiple companies

**Fix:** Verify the calling user is a `company_admin` or owner of the target `company_id` before creating users.

---

## HIGH FINDINGS

### 4. No Rate Limiting on Most Endpoints

Only 3 functions have rate limiting (`text-to-voice`, `send-ticket-notification`, `send-password-reset`). The remaining ~49 functions have **no rate limiting**, including expensive operations like:
- `document-analyzer` (calls OpenAI for document analysis)
- `rag-chat` / `simple-rag-chat` (calls OpenAI for chat)
- `buyer-agent` / `supplier-agent` (calls OpenAI)
- `knowledge-populator` / `knowledge-refresh` (processes documents)
- `consume-credits` (could drain credits rapidly)

**Fix:** Add rate limiting to AI-powered and credit-consuming endpoints.

### 5. Token Replay -- No Mitigation

JWT tokens are valid for 1 hour (config.toml `jwt_expiry = 3600`). There is no token blocklist, no jti (JWT ID) tracking, and no IP binding. A stolen token can be replayed for the full hour. This is standard for most Supabase apps and mitigated by HTTPS, but worth noting.

**Recommendation:** No immediate action needed -- this is inherent to stateless JWT architecture. Could add a session table for critical operations if needed later.

### 6. `send-new-request-email` has Broken Imports (Runtime Error)

Lines 5-8 define hardcoded `corsHeaders` with wildcard `*`, but lines 16-18 call `getCorsHeaders(req)` and `handleCorsPreflightRequest(req)` which are **never imported**. This function will crash at runtime.

**Fix:** Add the missing import and remove the hardcoded CORS constant.

---

## MEDIUM FINDINGS

### 7. Payload Manipulation -- Email Body Injection

`send-generic-email` and `send-compliance-followup` accept user-provided `body` content which is inserted directly into HTML email templates with minimal sanitization (only markdown-to-HTML conversion). An attacker could inject arbitrary HTML/JavaScript into emails sent to recipients.

**Fix:** Sanitize email body HTML or use a text-only approach for user-provided content.

### 8. Missing Input Validation on Several Functions

- `delete-auth-user`: No UUID format validation on `profile_id`
- `create-company-user`: No email format validation
- `send-batch-request-email`: No array length limit on `requestIds` (could query thousands of records)

---

## Implementation Plan

### Step 1: Add Auth to `send-batch-request-email` and `send-new-request-email`
- Add JWT verification (extract user via `getUser`)
- Verify the calling user belongs to the buyer company that owns the document requests
- Fix broken imports in `send-new-request-email` (add `getCorsHeaders` import, remove hardcoded wildcard CORS)
- Change both to `verify_jwt = true` in config.toml

### Step 2: Add Authorization to `delete-auth-user`
- After verifying auth, check that the caller is either:
  - A platform admin (query `platform_administrators`)
  - A company admin of the same company as the target user (query `company_users` for both caller and target)
- Add UUID validation on `profile_id` input
- Prevent self-deletion

### Step 3: Add Authorization to `create-company-user`
- After verifying auth, check that the caller is a company admin or owner of the target `company_id`
- For dual-role creation, also verify admin access to `other_company_id`
- Add email format validation

### Step 4: Add Rate Limiting to AI/Credit Endpoints
Add rate limiting to these high-cost functions:
- `document-analyzer`: 10 req/min/user
- `rag-chat`: 20 req/min/user
- `simple-rag-chat`: 20 req/min/user
- `buyer-agent`: 10 req/min/user
- `supplier-agent`: 10 req/min/user
- `agent-coordinator`: 10 req/min/user
- `consume-credits`: 30 req/min/user
- `knowledge-populator`: 5 req/min/user
- `coa-analyzer`: 10 req/min/user

### Step 5: Sanitize Email Body Content
- In `send-generic-email` and `send-compliance-followup`, strip HTML tags from user-provided `body` content before inserting into email templates (allow only markdown-to-HTML conversion output)

### Files Modified
- `supabase/functions/send-batch-request-email/index.ts` -- add auth
- `supabase/functions/send-new-request-email/index.ts` -- fix imports, add auth
- `supabase/functions/delete-auth-user/index.ts` -- add authorization
- `supabase/functions/create-company-user/index.ts` -- add authorization
- `supabase/functions/document-analyzer/index.ts` -- add rate limiting
- `supabase/functions/rag-chat/index.ts` -- add rate limiting
- `supabase/functions/simple-rag-chat/index.ts` -- add rate limiting
- `supabase/functions/buyer-agent/index.ts` -- add rate limiting
- `supabase/functions/supplier-agent/index.ts` -- add rate limiting
- `supabase/functions/agent-coordinator/index.ts` -- add rate limiting
- `supabase/functions/consume-credits/index.ts` -- add rate limiting
- `supabase/functions/knowledge-populator/index.ts` -- add rate limiting
- `supabase/functions/coa-analyzer/index.ts` -- add rate limiting
- `supabase/functions/send-generic-email/index.ts` -- sanitize body
- `supabase/functions/send-compliance-followup/index.ts` -- sanitize body
- `supabase/config.toml` -- update verify_jwt for 2 functions

