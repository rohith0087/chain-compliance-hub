## Disable Cloudflare Turnstile for Development

### Problem
Cloudflare Turnstile CAPTCHA is currently enforced on login, signup, and password reset flows, adding friction during active development and testing.

### Solution
The app already supports toggling Turnstile via the `VITE_TURNSTILE_ENABLED` environment variable. Both `AuthPage.tsx` and `PlatformAdminLogin.tsx` conditionally render the widget and skip token validation when this flag is disabled.

### Plan
1. **Set `VITE_TURNSTILE_ENABLED="false"`** in `.env`
2. **Verify** no other flows are hardcoded to require Turnstile (WhitePaperPage only mentions it in marketing copy, so no change needed)

### To Re-enable Later
Simply flip the same env variable back to `"true"` before pre-production / go-live. No code changes required.

### Files Changed
- `.env` (1 line change)