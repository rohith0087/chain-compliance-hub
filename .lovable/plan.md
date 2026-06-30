# Passkey Frontend — Settings Enrollment & Management

Adds WebAuthn passkey support so signed-in users can register, list, rename, and delete passkeys from Profile Settings. Uses `@simplewebauthn/browser` on the client and `@simplewebauthn/server` in two edge functions.

## What gets built

### 1. Database
New migration creating `public.user_passkeys`:
- `user_id` (uuid → auth.users)
- `credential_id` (text, unique) — base64url
- `public_key` (bytea)
- `counter` (bigint)
- `transports` (text[])
- `device_type` (text), `backed_up` (bool)
- `nickname` (text) — user-editable label
- `last_used_at`, `created_at`, `updated_at`

Plus a short-lived `public.passkey_challenges` table (`user_id`, `challenge`, `type`, `expires_at`) for ceremony state.

GRANTs + RLS: users select/update/delete their own rows; service_role full access (edge functions write via service role).

### 2. Edge functions (verify JWT in code)
- `passkey-register-begin` — returns `PublicKeyCredentialCreationOptions`, stores challenge.
- `passkey-register-finish` — verifies attestation, inserts row in `user_passkeys`.

(Sign-in ceremony is intentionally out of scope per your choice — Settings only.)

Both use `@simplewebauthn/server` via `npm:` specifier, RP ID = `compliance.tracer2c.com` (matches your Supabase config), origin allowlist read from a constant.

### 3. Frontend
- Install `@simplewebauthn/browser` via `bun add`.
- New component `src/components/settings/PasskeysSettingsSection.tsx`:
  - Lists enrolled passkeys (nickname, device type, created, last used).
  - "Add a passkey" button → calls begin → `startRegistration()` → calls finish → toast + refresh.
  - Per-row Rename (inline) and Delete (confirm dialog) — direct supabase updates against `user_passkeys` (RLS-scoped).
- Mount it in `ProfileSettingsPage.tsx` next to `MFASettingsSection`.
- New hook `src/hooks/usePasskeys.tsx` for list/refresh/delete/rename.

### 4. UX details
- Browser support gate: hide "Add" button if `!window.PublicKeyCredential`.
- Error handling for user cancel (`NotAllowedError`) — silent, no toast.
- Empty state: short copy explaining what passkeys are.

## Out of scope (can add later)
- Passkey sign-in on `/auth` (requires discoverable-credentials flow + pre-auth challenge endpoint).
- Signup-time enrollment prompt.

## Files
- migration (new tables + RLS + grants)
- `supabase/functions/passkey-register-begin/index.ts`
- `supabase/functions/passkey-register-finish/index.ts`
- `src/hooks/usePasskeys.tsx`
- `src/components/settings/PasskeysSettingsSection.tsx`
- `src/pages/ProfileSettingsPage.tsx` (mount section)
- `package.json` (+ `@simplewebauthn/browser`)

Note: Your Supabase dashboard "Passkeys" toggle configures Supabase's native MFA-factor passkey path; this plan implements a self-managed WebAuthn store, which is the only way to get full enrollment/management UI today. The RP ID/origin you've set still apply.
