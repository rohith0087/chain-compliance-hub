
# Fix Platform Admin Login CAPTCHA Issue

## Problem Analysis

The Platform Administration login page is failing with "captcha verification process failed" because:

1. Cloudflare Turnstile CAPTCHA is enabled at the Supabase project level
2. The main AuthPage includes the TurnstileWidget and passes the token to `signInWithPassword`
3. The PlatformAdminLogin page does NOT include the Turnstile widget
4. Supabase Auth requires a valid CAPTCHA token for ALL sign-in attempts when CAPTCHA is enabled project-wide

## Solution: Add Turnstile to Platform Admin Login

The fix involves adding the same Turnstile CAPTCHA widget to the Platform Admin login page and passing the token through the authentication flow.

## Technical Changes

### 1. Update PlatformAdminLogin.tsx

Add Turnstile widget integration:

- Import the `TurnstileWidget` component
- Add state for `turnstileToken` 
- Check if Turnstile is enabled via `VITE_TURNSTILE_ENABLED`
- Render the widget in the form (conditionally based on environment variable)
- Disable submit button until token is received (when enabled)
- Pass token to the sign-in function

### 2. Update usePlatformAdmin.tsx

Modify `signInPlatformAdmin` function to accept and pass CAPTCHA token:

- Add `captchaToken` parameter to the function signature
- Pass token to `supabase.auth.signInWithPassword` via `options.captchaToken`
- Reset token on authentication failure

## Implementation Details

### PlatformAdminLogin.tsx Changes

```text
New imports:
- TurnstileWidget from '@/components/auth/TurnstileWidget'

New state:
- turnstileToken: string | null
- Check isTurnstileEnabled from environment

Form changes:
- Add TurnstileWidget before submit button (when enabled)
- Disable button until token received OR if Turnstile is disabled
- Pass token to signInPlatformAdmin

Token reset:
- Clear token on error to force re-verification
```

### usePlatformAdmin.tsx Changes

```text
signInPlatformAdmin function signature:
  Before: (email: string, password: string)
  After:  (email: string, password: string, captchaToken?: string)

signInWithPassword call:
  Add: options: captchaToken ? { captchaToken } : undefined
```

## Files to Modify

1. **src/pages/PlatformAdminLogin.tsx** - Add Turnstile widget and token handling
2. **src/hooks/usePlatformAdmin.tsx** - Accept and pass captchaToken parameter

## Security Consideration

This maintains consistent security posture across all authentication entry points. The Platform Admin login is an especially sensitive endpoint, so CAPTCHA protection is appropriate here.

## Environment Variable Toggle

The implementation respects the existing `VITE_TURNSTILE_ENABLED` environment variable:
- When `true`: Widget renders and token is required
- When `false`: No widget, button immediately enabled, no token passed

This allows CAPTCHA to be disabled for development/testing while remaining enabled in production.
