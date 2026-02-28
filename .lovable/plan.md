# Secrets & Sensitive Info Exposure Audit -- Findings & Hardening Plan

## Audit Results

---

### 1. CRITICAL: `.env` File Not in `.gitignore` -- API Keys Committed to Git

The `.gitignore` file does NOT include `.env`. The `.env` file contains:

- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key -- publishable, acceptable)
- `VITE_GOOGLE_MAPS_API_KEY` -- a Google Maps API key committed in plaintext
- `VITE_TURNSTILE_SITE_KEY` -- a Cloudflare Turnstile site key (publishable, acceptable)

Additionally, these same values are **hardcoded** in `src/integrations/supabase/client.ts` (Supabase URL + anon key). These are publishable keys by design, but the `.env` should still be gitignored as a best practice to prevent accidentally adding private keys later.

The Google Maps API key is also exposed in the compiled frontend JS (via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`). This is somewhat expected for Maps keys but should have HTTP referrer restrictions configured in the Google Cloud Console.

**Fix:** Add `.env` to `.gitignore`. Note: Since this is a Lovable project, there is no `.env` file mechanism -- values are embedded at build time. The fix is to add `.env` to gitignore for safety.

---

### 2. HIGH: Raw `error.message` Leaked to API Clients in ~40 Edge Functions

Almost all edge functions return `error.message` directly in HTTP responses:

```javascript
return new Response(JSON.stringify({ error: error.message }), { status: 500 })
```

This leaks internal implementation details to attackers, including:

- Database column names and table structures
- Supabase internal error messages
- Authentication flow details (e.g., "User not found")
- File system paths

Affected: ~40 out of 52 edge functions including `rag-chat`, `buyer-agent`, `supplier-agent`, `agent-coordinator`, `document-analyzer`, `send-generic-email`, `workflow-engine`, and more.

**Fix:** Replace raw `error.message` in HTTP responses with generic error messages. Keep `error.message` in `console.error` for server-side debugging only.

---

### 3. HIGH: `rag-chat` Executes Raw SQL via `exec_sql` RPC

In `supabase/functions/rag-chat/index.ts` (line 1417), the function calls:

```javascript
await supabase.rpc('exec_sql', { query: searchFunctionSQL });
```

This uses a service-role client to execute arbitrary SQL through an `exec_sql` RPC function. While the SQL string is hardcoded (not user-provided), the existence of an `exec_sql` RPC function in the database is itself a critical vulnerability -- if any other code path or function uses it with user input, it enables SQL injection.

**Fix:** Remove the `exec_sql` RPC call from `rag-chat`. The `search_knowledge_entries` function already exists as a proper database function (confirmed in the DB schema). Delete the `exec_sql` database function entirely if it exists.

---

### 4. MEDIUM: `AIInsightsService.ts` Has Dead Code Path for Client-Side OpenAI Calls

`src/services/AIInsightsService.ts` still contains the full structure for making direct OpenAI API calls from the browser (lines 6-80), including:

- `OPENAI_API_URL` constant pointing to `https://api.openai.com/v1/chat/completions`
- `apiKey` parameter on public methods
- `Authorization: Bearer ${openaiKey}` header construction
- A `getOpenAIKey()` method (currently returns `null`)

While `getOpenAIKey()` returns `null` today, the code path still accepts an `apiKey` parameter that could be passed from the UI. If any caller passes a key, it would make direct browser-to-OpenAI requests, exposing the key in browser DevTools network tab.

**Fix:** Remove the dead OpenAI client-side code path entirely. Keep only the static insights fallback.

---

### 5. MEDIUM: No Security Headers (X-Content-Type-Options, CSP, etc.)

The `index.html` and edge function responses don't set security headers:

- No `Content-Security-Policy` header
- No `X-Content-Type-Options: nosniff`
- No `X-Frame-Options` or `frame-ancestors` CSP directive
- No `Strict-Transport-Security` header

These should be added to prevent MIME sniffing attacks, clickjacking, and ensure HTTPS enforcement.

**Fix:** Add security headers to edge function responses via the shared CORS utility, and add a CSP meta tag to `index.html`.

---

### 6. LOW: `SYSTEM_INVOCATION_SECRET` -- Properly Handled

The `systemAuth.ts` utility correctly:

- Reads the secret from `Deno.env.get()` (server-side only)
- Uses constant-time comparison to prevent timing attacks
- Denies access if the secret is not configured
- Never logs or exposes the secret value

No issues found.

---

## Implementation Plan

### Step 1: Add `.env` to `.gitignore`

Add `.env` and `.env.*` patterns to the gitignore file.

### Step 2: Sanitize Error Responses in ~40 Edge Functions

Replace `error.message` in HTTP response bodies with a generic message while keeping the detailed error in `console.error` for server-side debugging:

```typescript
// Before:
JSON.stringify({ error: error.message })

// After:  
JSON.stringify({ error: 'Internal server error' })
```

Keep specific error messages only for client-actionable 400-level errors (e.g., "Missing required field", "Invalid email format").

### Step 3: Remove `exec_sql` RPC Call from `rag-chat`

Remove the `ensureSearchFunction()` call and its function definition from `rag-chat/index.ts`. The database function already exists.

### Step 4: Clean Up `AIInsightsService.ts`

Remove the OpenAI API URL constant, the `apiKey` parameter from methods, and the `getOpenAIKey` method. Keep only static insights generation.

### Step 5: Add Security Headers

- Add `<meta http-equiv="Content-Security-Policy">` to `index.html` (script-src, style-src, connect-src directives)
- Add `X-Content-Type-Options: nosniff` to edge function response headers via `_shared/corsHeaders.ts`
- Add `X-Frame-Options: DENY` to edge function responses

### Files Modified

- `.gitignore` -- add `.env`
- ~40 edge function files -- sanitize error responses
- `supabase/functions/rag-chat/index.ts` -- remove `exec_sql` RPC
- `src/services/AIInsightsService.ts` -- remove dead OpenAI code
- `index.html` -- add CSP meta tag
- `supabase/functions/_shared/corsHeaders.ts` -- add security headers