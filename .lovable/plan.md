## Passkey Sign-in on `/auth`

Add a "Sign in with a passkey" option to the existing Sign In tab. Uses the passkeys already enrolled in Settings.

### Flow
1. User clicks **Sign in with a passkey** button on the Sign In tab.
   - Optional email field: if filled, do a discoverable + allowList-scoped auth; if empty, use fully discoverable (resident key) flow.
2. Browser calls `passkey-auth-begin` edge function → returns `PublicKeyCredentialRequestOptions` + stores challenge.
3. `@simplewebauthn/browser` `startAuthentication()` prompts the OS/browser (Touch ID, Windows Hello, security key…).
4. Browser posts the assertion to `passkey-auth-finish` edge function.
5. Edge function:
   - Looks up the credential row in `user_passkeys` by `credential_id`.
   - Verifies the assertion against stored `public_key` + `counter` via `@simplewebauthn/server`.
   - Updates `counter` + `last_used_at`.
   - Uses `service_role` admin client to mint a Supabase session for that `user_id` via `auth.admin.generateLink({ type: 'magiclink' })` → exchanges the resulting token hash, or uses `signInWithIdToken` pattern. **Concrete approach:** call `supabase.auth.admin.generateLink({ type: 'magiclink', email: user.email })`, extract the `hashed_token`, and return it to the client. The client then calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` to establish the session.
6. Client sets session and navigates to the post-login destination (same as password sign-in).

### Files

**New edge functions** (verify_jwt = false; CORS; zod validation):
- `supabase/functions/passkey-auth-begin/index.ts`
  - Input: `{ email?: string }`
  - If email: resolve user_id, fetch their passkeys → `allowCredentials`. Else: empty allowList (discoverable).
  - `generateAuthenticationOptions({ rpID, allowCredentials, userVerification: 'preferred' })`
  - Insert into `passkey_challenges` (ceremony_type='authentication', user_id nullable for discoverable).
- `supabase/functions/passkey-auth-finish/index.ts`
  - Input: assertion response from `startAuthentication`.
  - Look up `user_passkeys` by `credential_id` → get `user_id`, `public_key`, `counter`.
  - Look up matching challenge row, verify with `verifyAuthenticationResponse`.
  - On success: bump `counter`, `last_used_at`; delete challenge; mint session via `generateLink` → return `{ token_hash, email }`.

**DB migration:** make `passkey_challenges.user_id` nullable (currently NOT NULL) to support discoverable flow. Add index on `user_passkeys.credential_id` if not present.

**Frontend:**
- `src/components/auth/AuthPage.tsx` — add "Sign in with a passkey" button under the password form (gated on `window.PublicKeyCredential`). On click → call begin → `startAuthentication` → finish → `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })` → reuse existing post-signin redirect logic. Surface errors via existing toast.

### Out of scope
- Conditional UI / autofill (`mediation: 'conditional'`) — can be added later.
- Passkey-only accounts (we assume the user enrolled a passkey while signed in via password).
- MFA interaction (passkey sign-in bypasses password MFA since the passkey itself is multi-factor; keep current MFA flow untouched for password sign-in).