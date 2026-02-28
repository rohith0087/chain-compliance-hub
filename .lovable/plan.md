

# Fix: CSP Blocking Turnstile and Lovable Scripts

## Root Cause

The Content Security Policy (CSP) meta tag added in `index.html` during the previous security hardening is **too restrictive**. It's actively breaking the app by blocking:

1. **Lovable's platform script** (`cdn.gpteng.co/lovable.js`) -- visible in your console error
2. **Turnstile widget resources** -- the widget can't fully load, so it never renders
3. Potentially other third-party resources (Mapbox, i18next/locize)

The `X-Frame-Options: DENY` meta tag is also invalid (browsers ignore it via meta tags, only HTTP headers work) and should be removed to reduce console noise.

## Fix

### Update `index.html` (line 7-8)

1. **Remove** the `X-Frame-Options` meta tag (line 7) -- it only works as an HTTP header, not a meta tag, and causes a console warning
2. **Update the CSP** to include all required domains:

**`script-src`** -- add:
- `https://cdn.gpteng.co` (Lovable platform)
- `https://static.cloudflareinsights.com` (Cloudflare analytics)

**`connect-src`** -- add:
- `https://cdn.gpteng.co`
- `https://*.mapbox.com` (Mapbox GL)
- `https://api.mapbox.com`

**`worker-src`** -- add:
- `blob:` (needed by Mapbox GL for web workers)

**`frame-src`** -- already has `https://challenges.cloudflare.com` (correct)

The updated CSP will look like:
```
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://maps.googleapis.com https://cdn.gpteng.co https://static.cloudflareinsights.com;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://maps.googleapis.com https://challenges.cloudflare.com https://cdn.gpteng.co https://*.mapbox.com https://api.mapbox.com;
worker-src 'self' blob:;
```

### Files Modified
- `index.html` -- fix CSP directives, remove invalid X-Frame-Options meta tag

