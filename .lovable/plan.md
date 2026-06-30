## Goal

Re-skin `/auth` to match the uploaded Plasma reference exactly: pure black canvas, a single centered two-pane card, grainy purple→magenta gradient hero on the left, dark form on the right, with the legal footer below the card. Keep all existing auth functionality (login, signup, MFA, forgot password, Turnstile) intact.

## Reference anatomy

```text
┌────────────────────────────────────────────────────────────┐
│   (pure black canvas, small accent dot top-right)          │
│                                                            │
│      ┌───────────────────────┬───────────────────────┐     │
│      │  PURPLE GRAIN PANEL   │   DARK FORM PANEL     │     │
│      │  ⚡ TraceR2C          │                       │     │
│      │                       │   Welcome to TraceR2C │     │
│      │                       │   Sign up or sign in  │     │
│      │                       │                       │     │
│      │   "                   │   [ Continue Google ] │     │
│      │   Testimonial quote   │   ───── or ─────      │     │
│      │   in serif italic     │   [ Email Address  ]  │     │
│      │                       │   [ Password    👁 ]  │     │
│      │   👤 Name             │   [    Sign In     ]  │     │
│      │      @handle          │   Don't have? Sign up │     │
│      └───────────────────────┴───────────────────────┘     │
│                                                            │
│      By continuing, you agree to Terms and Privacy…        │
└────────────────────────────────────────────────────────────┘
```

## Visual spec (Plasma-exact)

- Canvas: `#000000`, no chrome, no nav, no "Book a demo".
- Card: ~960×600, centered, rounded `1rem`, hairline border `rgba(255,255,255,0.06)`, no outer shadow.
- Left pane (hero):
  - Radial gradient from `#7B2D8E` (warm magenta, top-right) through `#5B2470` to `#2A1438` (bottom-left).
  - Grain texture (the uploaded webp) overlaid at ~35% opacity, `mix-blend-overlay`, tiled.
  - Top-left: lightning glyph + "TraceR2C" wordmark in white.
  - Bottom-left block: oversized serif quote mark, italic serif testimonial pulled from existing copy, avatar circle + name/handle line in muted white.
- Right pane (form):
  - Solid `#0B0B0F` with the same grain overlay at ~15% opacity for cohesion.
  - "Welcome to TraceR2C" (sans, 24px, white), "Sign up or sign in to your account" (13px, `rgba(255,255,255,0.55)`).
  - Continue with Google button: full-width, `#1A1A1F` fill, `rgba(255,255,255,0.08)` border, white text, Google "G" mark.
  - Divider row: thin hairlines + "or" label.
  - Email / Password inputs: `#0F0F14` fill, `rgba(255,255,255,0.08)` border, 44px tall, white text, muted placeholder, eye toggle on password.
  - Sign In button: full-width, brand-tinted indigo `#6366F1` at ~85% opacity over the dark card (matches the reference's translucent indigo CTA). Disabled state dims to ~40%.
  - "Don't have an account? Sign up" link in indigo under the CTA.
- Footer (outside the card): centered two-line muted text "By continuing, you agree to TraceR2C's Terms of Service and Privacy Policy, and to receive periodic emails with updates." — Terms / Privacy underlined.
- Accent dot top-right of the canvas: 6px solid indigo `#6366F1`, decorative only.

## Component changes (`src/components/auth/AuthPage.tsx`)

1. Replace the current full-bleed split layout with a centered card:
   - Outer wrapper: `min-h-screen bg-black flex flex-col items-center justify-center px-4 py-10`.
   - Card: `grid lg:grid-cols-2 w-full max-w-[960px] rounded-2xl overflow-hidden border border-white/[0.06]`.
   - On `<lg` collapse to single column: hide hero pane, keep form pane.
2. Hero pane:
   - Replace `ParticleBackground`, `login-art.jpg`, and current overlays with the new gradient + grain.
   - Move wordmark inside the pane top-left, keep `navigate('/')` click.
   - Add testimonial block (serif quote, body, avatar). Avatar: reuse `/logo.png` or a placeholder circle; copy can stay in code.
3. Form pane:
   - Remove the top-right nav and "Book a demo" button entirely (they don't exist in the reference).
   - Rebuild header copy ("Welcome to TraceR2C" / subhead).
   - Add a Google sign-in button that calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })`. Wire a `handleGoogleSignIn` handler beside the existing email/password flow.
   - Keep the existing `handleSignIn`, `handleSignUp`, MFA step, forgot-password dialog, Turnstile widget, rate-limit logic, and validation — only their wrappers/classes change.
   - Replace `Tabs` chrome with a tab look that matches the reference: when on Sign Up, the same shell shows the signup fields stacked below the Google button.
   - "Sign up" / "Sign in" toggle line under the CTA replaces the current centered Tabs trigger on the login view (Tabs still drive state; the visible trigger becomes a text link).
   - Drop the `.r2c-glass-card` / Customs Hall token usage on this page — replace with hardcoded Plasma palette via Tailwind arbitrary values (`bg-[#0B0B0F]`, `border-white/[0.08]`, etc.).
4. Footer block: render once under the card, centered, muted, with Terms / Privacy as `<a>` placeholders (`/terms`, `/privacy`).

## Assets

- Reuse the existing `public/grain-texture.webp` we just added; no new upload.
- No new icons (lightning glyph already in `Wordmark`; Google "G" via inline SVG to avoid an extra dependency).

## Scope guardrails

- This change is local to `src/components/auth/AuthPage.tsx` and does NOT alter the global `.r2c` Customs Hall tokens used elsewhere in the app. The Plasma look is hardcoded on this page only.
- No changes to `ResetPassword.tsx`, `PlatformAdminLogin.tsx`, auth hooks, or Supabase config.
- No backend/auth logic changes beyond adding the Google OAuth call (which only fires if the user clicks the button — if Google provider isn't enabled in Supabase, the existing toast/error surface handles it).

## Open questions before I build

1. The reference shows a "Continue with Google" button. Do you want Google OAuth wired up now (requires the Google provider enabled in Supabase Auth) — or render the button as visual-only / hide it for v1?
2. The reference shows a single testimonial. Use the line currently in your hero ("Compliance you can read at a glance…") or write a new short quote with a fake attribution?
3. Confirm: keep both Buyer/Supplier role selection on the Sign Up view (current behavior) — the reference doesn't show it, but removing it would break onboarding.

Answer those three and I'll implement exactly to spec.