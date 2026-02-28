

# OWASP Top 10 Deep Security Audit -- Findings & Hardening Plan

## Audit Results by OWASP Category

---

### 1. CRITICAL: Remote Code Execution via `new Function()` (A03 -- Injection)

**File:** `src/components/chat/CodeVisualizationRenderer.tsx` (line 154)

The `CodeVisualizationRenderer` executes AI-generated code using `new Function(wrappedCode)`. While there is a blocklist of dangerous patterns (`eval`, `fetch`, `localStorage`, etc.), this is trivially bypassable:
- Encoding tricks: `window['lo' + 'calStorage']`
- Indirect references: `this.constructor.constructor('return fetch')()` 
- The blocklist does not cover `window`, `globalThis`, `self`, `top`, `parent`, `XMLHttpRequest` (the regex is case-insensitive but checks the literal)

**Fix:** Render visualizations inside a sandboxed `<iframe>` with `sandbox="allow-scripts"` (no `allow-same-origin`), passing data via `postMessage`. This completely isolates execution from the parent DOM and auth state.

---

### 2. CRITICAL: 45 Edge Functions Still Use Wildcard CORS (A05 -- Security Misconfiguration)

The shared `_shared/corsHeaders.ts` was created but only **7 of 52** functions actually import it. The remaining **45 functions** still have hardcoded `Access-Control-Allow-Origin: '*'`, meaning any website can make authenticated requests to your API.

Affected functions include high-value targets: `document-analyzer`, `secure-document-url`, `simple-rag-chat`, `knowledge-populator`, `create-company-user`, `delete-auth-user`, `consume-credits`, `create-credit-purchase`, all email-sending functions, and more.

**Fix:** Migrate all 45 remaining functions to import and use `getCorsHeaders(req)` from the shared module.

---

### 3. HIGH: IDOR -- No Ownership Validation on Document Operations (A01 -- Broken Access Control)

Several client-side operations pass user-controlled IDs (from URL params, component props) directly to Supabase queries without verifying the caller owns the resource:

- `FileUploadZone.tsx`: Updates `document_requests` status using `requestId` prop directly -- RLS is the only guard
- `OnboardingRequestDetailDrawer.tsx`: Approves/rejects onboarding requests using `request.id` from props
- `BuyerDocumentsDashboard.tsx`: Calls `approve_document_request` / `reject_document_request` RPCs with document IDs from the UI

While RLS provides database-level protection, the RPC functions (`approve_document_request`, `reject_document_request`, `finalize_onboarding_approval`) are `SECURITY DEFINER` -- meaning they bypass RLS. If these functions don't internally validate that the calling user has authority over the resource, this is an IDOR vulnerability.

**Fix:** Audit all `SECURITY DEFINER` RPC functions to ensure they validate `auth.uid()` ownership/membership before performing mutations.

---

### 4. HIGH: Insecure File Upload -- No Server-Side MIME Validation (A04 -- Insecure Design)

- `FileUploadZone.tsx`: Client-side accept filter only (easily bypassed). No server-side file type validation.
- `DocumentUploadDialog.tsx`: No file type restrictions at all -- accepts any file.
- `document-analyzer` edge function: Accepts file uploads via `formData` with no MIME type or file size validation server-side (line 38, 64-66). An attacker could upload executable files or extremely large files.
- Supabase Storage config allows up to 50MB (`max_file_size_limit = "50MiB"`) but individual upload components show 10MB to users.

**Fix:** Add server-side MIME type validation in edge functions that process uploads. Add a Supabase Storage policy or edge function middleware to reject non-allowed file types.

---

### 5. HIGH: `document-link-handler` Leaks User Email (A04 -- Insecure Design)

Line 439: `accessed_by: user?.email || 'Anonymous'` -- the response includes the accessing user's email in the API response. This leaks PII to whoever holds the shared link token.

**Fix:** Remove `user?.email` from the response, or replace with a non-identifying label.

---

### 6. MEDIUM: No CSRF Protection (A01 -- Broken Access Control)

No CSRF tokens are used anywhere in the application. While Supabase uses JWT bearer tokens (which provide some CSRF protection since they're not automatically sent like cookies), the Supabase client stores the session in `localStorage` and attaches it as an `Authorization` header. This is reasonably CSRF-safe but should be noted. No action needed.

---

### 7. MEDIUM: `window.open` Without `noopener,noreferrer` (A03 -- Injection)

Most `window.open` calls across ~27 files don't include `noopener,noreferrer` -- only 2 files do. This allows opened pages to access `window.opener` and potentially redirect the parent window (reverse tabnabbing).

**Fix:** Add `noopener,noreferrer` to all `window.open` calls.

---

### 8. MEDIUM: Remaining `console.log` in Edge Functions with PII (A09 -- Security Logging Failures)

`document-link-handler` still has `console.log` statements including full request bodies (line 69), signed URL paths (line 403), and insert payloads (line 133). Several other edge functions that weren't migrated may also have PII leaks.

**Fix:** Clean remaining PII from `document-link-handler` logs and verify all functions.

---

### 9. LOW: JWT Configuration -- 1 Hour Expiry (A07 -- Identification & Authentication Failures)

`config.toml` sets `jwt_expiry = 3600` (1 hour). This is reasonable. Supabase handles refresh tokens automatically. No issue.

---

### 10. LOW: SQL Injection (A03 -- Injection)

**Not vulnerable.** All database access goes through the Supabase client library which uses parameterized queries. All RPC calls use typed parameters. No raw SQL construction in frontend code.

---

### 11. LOW: Authentication Bypass (A07)

**Not vulnerable.** Auth flows use Supabase Auth with CAPTCHA (`captchaToken` parameter on signIn/signUp). Edge functions validate JWT tokens. Platform admin functions check the `platform_administrators` table. No custom auth implementations.

---

## Implementation Plan

### Step 1: Sandbox CodeVisualizationRenderer (RCE fix)
Replace `new Function()` execution with a sandboxed iframe approach:
- Create an iframe with `sandbox="allow-scripts"` (no `allow-same-origin`)
- Pass visualization code + data via `postMessage`
- Render the chart inside the iframe
- Receive the rendered output or use the iframe directly for display

### Step 2: Migrate 45 Edge Functions to Shared CORS Headers
Update all remaining edge functions to:
1. Import `getCorsHeaders` and `handleCorsPreflightRequest` from `../_shared/corsHeaders.ts`
2. Replace hardcoded `corsHeaders` constant with `const corsHeaders = getCorsHeaders(req)`
3. Replace `if (req.method === 'OPTIONS')` blocks with `handleCorsPreflightRequest(req)`

Functions to update: `agent-coordinator`, `backfill-buyer-document-content`, `bulk-document-downloader`, `bulk-document-processor`, `buyer-agent`, `buyer-document-content-processor`, `calculate-supplier-metrics`, `chat-session-manager`, `check-onboarding-deadlines`, `check-subscription-status`, `coa-analyzer`, `communication-hub`, `consume-credits`, `create-company-user`, `create-credit-purchase`, `create-subscription-checkout`, `delete-auth-user`, `document-analyzer`, `document-content-extractor`, `document-link-handler`, `execute-chat-action`, `generate-mfa-recovery-codes`, `get-audit-logs`, `knowledge-populator`, `knowledge-refresh`, `manage-subscription`, `populate-onboarding-requirements`, `rag-chat`, `reset-password-with-recovery`, `secure-document-url`, `secure-sample-url`, `send-assignment-notification`, `send-batch-request-email`, `send-compliance-followup`, `send-document-request-notification`, `send-expiry-notification`, `send-generic-email`, `send-new-request-email`, `send-rejection-notification`, `send-supplier-invitation`, `simple-rag-chat`, `supplier-agent`, `validate-turnstile`, `verify-mfa-recovery-code`, `voice-to-text`

### Step 3: Fix Document Link Handler PII Leak
- Remove `user?.email` from API response (line 439)
- Clean remaining `console.log` statements with sensitive data

### Step 4: Add `noopener,noreferrer` to `window.open` Calls
Update ~25 files to add security attributes to all `window.open` calls.

### Step 5: Add Server-Side File Validation to `document-analyzer`
Add MIME type allowlist and file size check before processing uploads.

### Files Modified
- `src/components/chat/CodeVisualizationRenderer.tsx` -- sandbox iframe approach
- 45 edge function files -- CORS migration
- `supabase/functions/document-link-handler/index.ts` -- PII fix + log cleanup
- `supabase/functions/document-analyzer/index.ts` -- file validation
- ~25 frontend files -- `window.open` hardening

