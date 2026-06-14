## Problem

Supabase auth has CAPTCHA protection enabled. Login and Signup already pass a Turnstile token, but the "Forgot Password" dialog calls `resetPassword(email)` without a token, so Supabase rejects it with `captcha protection: request disallowed (no captcha_token found)`.

## Fix

1. **`src/hooks/useAuth.tsx`**
   - Update `resetPassword` signature to accept an optional `captchaToken`:
     ```ts
     resetPassword: (email: string, captchaToken?: string) => Promise<{ error: any }>
     ```
   - Pass it to Supabase:
     ```ts
     supabase.auth.resetPasswordForEmail(email, {
       redirectTo: `${window.location.origin}/reset-password`,
       captchaToken,
     })
     ```

2. **`src/components/auth/AuthPage.tsx`** — Forgot Password dialog
   - Add a separate Turnstile token state for the reset dialog (`resetTurnstileToken`) with its own widget ref, so it doesn't collide with login/signup widgets.
   - Render `<TurnstileWidget>` inside the reset dialog when `isTurnstileEnabled`, between the email field and the action buttons.
   - Disable the "Send Reset Link" button until a token is present (when Turnstile is enabled).
   - Pass the token into `resetPassword(resetEmail.trim(), isTurnstileEnabled ? resetTurnstileToken! : undefined)`.
   - Reset the widget on error and after successful submit / dialog close.

No backend or migration changes — the captcha is enforced by Supabase Auth itself; we only need to supply the token.