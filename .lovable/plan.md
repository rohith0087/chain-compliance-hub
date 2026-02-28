

# Rate Limiting & Abuse Audit -- Findings & Hardening Plan

## Audit Results

---

### 1. CRITICAL: No Login Brute-Force Protection (Client or Server)

**Current state:** The `handleSignIn` function in `AuthPage.tsx` has **zero** client-side throttling. A user (or bot) can submit unlimited login attempts with no delay, lockout, or attempt tracking.

**Server-side:** Supabase Auth has a built-in rate limit (~30 requests/5 min per IP for `signInWithPassword`), but this is a blunt global limit and can still allow significant brute-force attempts. There is no per-user lockout.

Turnstile CAPTCHA is configured but **currently broken** (error 110200 in console), meaning there is effectively **no bot protection** on login right now.

**Fix:** Add client-side progressive lockout after failed login attempts (e.g., 5 failures = 30s cooldown, 10 failures = 5min cooldown). This is defense-in-depth alongside Supabase's server-side rate limit.

---

### 2. HIGH: MFA/OTP Bypass -- No Rate Limiting on TOTP Verification

The `handleMFAVerify` function allows unlimited TOTP code guesses. A 6-digit TOTP code has only 1,000,000 combinations. Without rate limiting, an attacker with a valid session (AAL1) can brute-force the TOTP code by submitting thousands of requests.

Similarly, the `verify-mfa-recovery-code` Edge Function has **no rate limiting** -- an attacker can brute-force recovery codes.

**Fix:**
- Add client-side attempt limit on MFA verification (e.g., 5 attempts then lockout for 60s)
- Add rate limiting to `verify-mfa-recovery-code` Edge Function (5 req/min/user)

---

### 3. HIGH: Account Enumeration via Signup Response

In `useAuth.tsx` line 226-231, the signup flow explicitly reveals whether an email is already registered:
```typescript
if (data?.user && data.user.identities?.length === 0) {
  return { error: { message: "An account with this email already exists..." } };
}
```

This allows attackers to enumerate valid email addresses by attempting signups. Additionally, Supabase's `signInWithPassword` returns different error messages for "invalid credentials" vs "email not confirmed", which also enables enumeration.

**Fix:** Return a generic message regardless: "If this email is available, a confirmation will be sent."

---

### 4. HIGH: Password Reset Flooding -- No Rate Limit

The `handleForgotPassword` function has no client-side throttle. An attacker can submit unlimited password reset requests to:
- Flood a victim's inbox
- Consume email sending quota
- Enumerate valid emails (if Supabase returns different responses)

**Fix:** Add client-side cooldown on password reset (one request per 60 seconds), plus rate limiting on the `send-password-reset` Edge Function if not already present.

---

### 5. MEDIUM: `validate-turnstile` Edge Function Has No Rate Limiting

The Turnstile validation endpoint is public (`verify_jwt = false`) and has no rate limiting. An attacker could flood it with requests to:
- Waste compute resources
- Potentially bypass validation through timing attacks

**Fix:** Add rate limiting (20 req/min/IP).

---

### 6. MEDIUM: Signup Has No Rate Limiting

The signup flow has Turnstile protection (when working), but no client-side or server-side rate limiting for repeated registration attempts. Mass registration attacks are possible.

**Fix:** Add client-side cooldown after signup submission (prevent rapid re-submission).

---

## Implementation Plan

### Step 1: Add Client-Side Login Brute-Force Protection

In `AuthPage.tsx`, add:
- Track failed login attempts in component state
- After 5 failed attempts: disable login button for 30 seconds with countdown
- After 10 failed attempts: disable for 5 minutes
- Reset counter on successful login
- Show remaining lockout time to user

### Step 2: Add MFA Verification Rate Limiting

In `AuthPage.tsx` MFA section:
- Track failed MFA attempts in state
- After 3 failed TOTP attempts: 30-second cooldown
- After 5 failed attempts: sign out user entirely (force re-authentication)

In `verify-mfa-recovery-code/index.ts`:
- Add `checkRateLimit` import and enforce 5 req/min/user

### Step 3: Fix Account Enumeration

In `useAuth.tsx`:
- Replace the explicit "account already exists" message with a generic success message: "If this email is available, a confirmation link will be sent."
- Always return success for signup (don't reveal email existence)

### Step 4: Add Password Reset Rate Limiting

In `AuthPage.tsx`:
- Add 60-second cooldown between password reset requests (client-side with timer)
- Disable the reset button during cooldown with countdown display

### Step 5: Add Rate Limiting to `validate-turnstile`

In `validate-turnstile/index.ts`:
- Add `checkRateLimit` import and enforce 20 req/min by IP (from request headers)

### Step 6: Add Signup Cooldown

In `AuthPage.tsx`:
- After successful signup, disable signup form for 30 seconds to prevent re-submission

---

### Files Modified
- `src/components/auth/AuthPage.tsx` -- login lockout, MFA attempt limits, password reset cooldown, signup cooldown
- `src/hooks/useAuth.tsx` -- fix account enumeration message
- `supabase/functions/verify-mfa-recovery-code/index.ts` -- add rate limiting
- `supabase/functions/validate-turnstile/index.ts` -- add rate limiting

