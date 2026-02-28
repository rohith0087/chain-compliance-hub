

# Security Hardening Plan

## Findings Summary

After a thorough audit of the codebase, here are the vulnerabilities discovered across edge functions, frontend code, and configuration, organized by severity.

---

## CRITICAL Vulnerabilities

### 1. Five Edge Functions Missing from config.toml (No JWT enforcement)

These functions exist in `supabase/functions/` but have **no entry** in `config.toml`, meaning Supabase applies the default (which may be `verify_jwt = false`):

- `send-batch-request-email` -- sends emails to suppliers
- `send-compliance-followup` -- sends compliance follow-up emails
- `send-generic-email` -- sends arbitrary emails with custom body/subject
- `send-new-request-email` -- sends document request notifications
- `validate-turnstile` -- validates CAPTCHA tokens

**Risk**: An unauthenticated attacker could invoke these functions directly, sending spam emails through your Resend account or bypassing CAPTCHA validation.

**Fix**: Add all five to `config.toml` with `verify_jwt = true` (except `validate-turnstile` which should remain `false` but needs internal rate limiting).

### 2. `text-to-voice` is Public (verify_jwt = false) and Has No Auth Check

This function calls the OpenAI TTS API with no authentication or rate limiting. Anyone with the function URL can burn through your OpenAI credits.

**Fix**: Set `verify_jwt = true` since it's only called from authenticated contexts (ChatPage and simulation narration).

### 3. `send-password-reset` Sends Temporary Passwords in Email Body

The function accepts `temp_password` in the request body and includes it in the email HTML. Since this function is public (`verify_jwt = false`), an attacker could craft requests to send phishing-style emails with arbitrary "temporary passwords" to any email address.

**Fix**: Add internal validation -- verify the requesting user is an authenticated admin, or add a shared secret/API key check.

### 4. `send-ticket-notification` is Public and Sends to All Platform Admins

Anyone can call this function with arbitrary ticket data, flooding all platform admin inboxes with fake support tickets.

**Fix**: Add authentication check or move to `verify_jwt = true` since it's always called from an authenticated frontend context.

---

## HIGH Vulnerabilities

### 5. No Rate Limiting on Any Edge Function

Zero rate limiting across all 50+ edge functions. Functions that call external paid APIs (OpenAI, Resend) are especially vulnerable to abuse.

**Fix**: Add basic in-memory or database-backed rate limiting to public-facing functions, especially `validate-turnstile`, `send-password-reset`, `text-to-voice`, `document-link-handler`, and all email-sending functions.

### 6. `dangerouslySetInnerHTML` in ComplianceEmailComposer

`ComplianceEmailComposer.tsx` renders `currentDraft.body` (which can contain AI-generated or user-edited content) using `dangerouslySetInnerHTML` without sanitization. This is an XSS vector.

**Fix**: Sanitize using DOMPurify before rendering, or switch to a safe markdown renderer.

### 7. CORS Set to Wildcard (`*`) on All Edge Functions

Every single edge function uses `Access-Control-Allow-Origin: '*'`, allowing any website to make requests to your API endpoints.

**Fix**: Restrict to your known domains: `https://compliance.tracer2c.com`, `https://chain-compliance-hub.lovable.app`, and the preview URL.

---

## MEDIUM Vulnerabilities

### 8. Excessive Console Logging (918 matches across 43 files)

Sensitive data like user IDs, email addresses, and auth state changes are logged to the browser console. In production, this leaks information to anyone who opens DevTools.

**Fix**: Remove or guard console.log statements behind a development-only flag. At minimum, remove logs containing user PII (emails, IDs).

### 9. `workflow-engine` is Public with No Input Validation

The workflow engine is public (`verify_jwt = false`) and accepts arbitrary workflow context. While it validates internally, there's no authentication layer to prevent unauthorized triggering of workflows.

**Fix**: Add a shared secret or API key check for cron/system-triggered invocations.

### 10. `check-document-expiry` is Public

While this is designed for cron triggers, it can be invoked by anyone, potentially causing mass notification spam.

**Fix**: Add a shared secret header check for system-triggered functions.

---

## Implementation Plan

### Step 1: Register Missing Edge Functions in config.toml
Add `verify_jwt = true` entries for `send-batch-request-email`, `send-compliance-followup`, `send-generic-email`, `send-new-request-email`. Add `verify_jwt = false` for `validate-turnstile` (public by nature).

### Step 2: Secure Public Edge Functions
- Change `text-to-voice` to `verify_jwt = true`
- Add auth validation to `send-ticket-notification` (add JWT check or shared secret)
- Add shared secret validation to `send-password-reset` to prevent abuse
- Add shared secret headers to `workflow-engine`, `check-document-expiry`, and `coa-schedule-reminder` for system-invoked functions

### Step 3: Add Rate Limiting
Create a shared `_shared/rateLimiter.ts` utility using a simple in-memory counter (per-IP or per-user). Apply to all public endpoints.

### Step 4: Fix XSS in ComplianceEmailComposer
Install DOMPurify and sanitize `currentDraft.body` before passing to `dangerouslySetInnerHTML`.

### Step 5: Restrict CORS Origins
Create a shared `_shared/corsHeaders.ts` that restricts `Access-Control-Allow-Origin` to your production and preview domains. Update all edge functions to import from there.

### Step 6: Clean Up Console Logging
Remove or conditionalize all `console.log` statements containing PII. Keep error-level logs only.

### Files Modified
- `supabase/config.toml` -- add 5 missing entries, change 1 JWT setting
- `supabase/functions/_shared/rateLimiter.ts` -- new file
- `supabase/functions/_shared/corsHeaders.ts` -- new file
- `supabase/functions/text-to-voice/index.ts` -- already protected by JWT after config change
- `supabase/functions/send-ticket-notification/index.ts` -- add auth validation
- `supabase/functions/send-password-reset/index.ts` -- add caller validation
- `supabase/functions/workflow-engine/index.ts` -- add shared secret check
- `supabase/functions/check-document-expiry/index.ts` -- add shared secret check
- `src/components/chat/ComplianceEmailComposer.tsx` -- add DOMPurify sanitization
- ~43 files in `src/` -- console.log cleanup
- ~51 edge function files -- update CORS imports

