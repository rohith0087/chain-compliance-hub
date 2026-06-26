## Goal
Lift the "Customs hall" theme out of its `.r2c` landing-page scope and make it the global look of the buyer + supplier app (auth, sidebars, top nav, dashboards, tables, modals, forms). Platform/super-admin dark dashboards stay untouched.

## Scope
- Re-skin: `/auth`, buyer shell, supplier shell, all pages inside those shells, shared dialogs, shadcn primitives (via tokens).
- Untouched: `src/pages/PlatformAdminDashboard`, `SuperAdminDashboard`, anything under `src/components/platform-admin`, `src/components/super-admin`, and `src/components/admin` dark surfaces.
- The marketing landing keeps its existing `.r2c` block — we're hoisting the *values*, not deleting the scoped class.

## Design tokens (light mode, `:root` in `src/index.css`)
Replace the current indigo-purple token block with the Customs hall palette, converted to the HSL triplet format Tailwind/shadcn expect:

```text
--background        0 0% 93%      /* #ECEDEA cool steel */
--surface           0 0% 93%
--surface-elevated  60 11% 95%    /* #F4F4F1 */
--card              0 0% 100%
--foreground        220 20% 10%   /* #14181F charcoal-navy */
--muted             0 0% 93%
--muted-foreground  220 5% 38%    /* #5A5F66 */
--border            180 7% 84%    /* #D3D8D9 hairline */
--input             180 7% 84%
--ring              159 51% 19%   /* pine */

--primary           159 51% 19%   /* #16493A deep pine */
--primary-foreground 0 0% 100%
--primary-hover     159 55% 15%
--primary-glow      178 67% 18%   /* #0F4C4A */

--secondary         220 20% 10%   /* ink as secondary */
--secondary-foreground 0 0% 100%
--accent            178 67% 18%
--accent-foreground 0 0% 100%

--success           150 56% 27%   /* #1F6B4A verified */
--warning           32 75% 41%    /* #B8731A caution */
--danger / --destructive  11 70% 51%  /* #D8462A recall */

--sidebar-background  60 11% 95%   /* #F4F4F1 */
--sidebar-foreground  220 20% 10%
--sidebar-border      180 7% 84%
--sidebar-accent      0 0% 93%
--sidebar-primary     159 51% 19%

--radius            0.5rem        /* tighter, more customs-stamp than pill */
```

Gradients/shadows refreshed to pine-on-steel:
```text
--gradient-primary  linear-gradient(135deg, hsl(159 51% 19%), hsl(178 67% 18%))
--gradient-subtle   linear-gradient(180deg, hsl(0 0% 100%), hsl(0 0% 93%))
--gradient-hero     linear-gradient(135deg, hsl(0 0% 93%) 0%, hsl(159 51% 19% / 0.05) 100%)
--shadow-subtle     0 1px 0 hsl(180 7% 84%), 0 2px 8px -4px hsl(220 20% 10% / 0.06)
--shadow-elegant    0 12px 32px -16px hsl(159 51% 19% / 0.25)
```

Dark mode `.dark` block: left as-is for now (admin dashboards already opt into their own dark tokens; nothing in the buyer/supplier shell toggles `.dark` today).

## Typography
Install fontsource packages and wire them globally so the body inherits Customs hall fonts:

```text
bun add @fontsource/archivo @fontsource/instrument-serif @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono
```

- `src/main.tsx` — import the four font CSS entries.
- `tailwind.config.ts` — extend `fontFamily`:
  - `sans: ['"IBM Plex Sans"', ...defaults]` (body default)
  - `display: ['Archivo', '"IBM Plex Sans"', ...]`
  - `serif: ['"Instrument Serif"', 'Georgia', 'serif']` (wordmark/eyebrow only)
  - `mono: ['"IBM Plex Mono"', ...defaults]` (data/tabular numerics)
- `src/index.css` body rule: set `font-family: 'IBM Plex Sans', system-ui, sans-serif;` and apply `font-display` to `h1–h3` globally via a small `@layer base` rule, with `letter-spacing: -0.01em`.

## Motifs available app-wide
Promote the three signature motifs out of `.r2c` into global utilities so any shell/page can opt in:

- `.app-grid` — hairline grid backdrop (38px) for empty states, auth split panel, dashboard heroes.
- `.app-scan` — one-shot scan-beam keyframe for evidence/compliance reveal cards.
- `.app-rise` — masked line-rise for page H1s (auto-applied on `<h1>` inside auth + dashboard headers via a wrapper, not globally — avoids breaking dense tables).
- `.app-link` — animated underline used by inline links (`<a>` inside prose; not nav buttons).

The existing `.r2c-*` classes stay in place so the landing page is untouched.

## Surfaces that need light-touch follow-up
Most pages already consume `bg-background`, `bg-card`, `text-foreground`, `border-border` — so the token swap cascades for free. Targeted adjustments:

1. `src/pages/Auth.tsx` (and split panel) — apply `.app-grid` to the visual side, swap any hardcoded indigo gradient to `bg-gradient-primary`.
2. `BuyerSidebarLayout` / supplier shell — sidebar already uses `--sidebar-*` tokens, so it re-skins automatically; verify the top-nav border picks up the new hairline color.
3. Audit ~10 files flagged in exploration (`MessagesPage`, `HelpCenterPage`, `ProfileSettingsPage`, `ChatPage`, `AuditAssistantPage`, supplier upload modals, buyer onboarding/bulk-invite) for any hardcoded `bg-white` / `text-slate-*` / `bg-indigo-*` and replace with tokens.
4. Replace any `rounded-2xl`/`rounded-full` on primary CTAs with `rounded-md` to match the tighter customs-stamp radius (only on layout containers — leave avatars/pills alone).

## Out of scope
- Platform admin + super admin dark theme.
- The marketing `.r2c` scoped block (kept verbatim).
- Any business logic, routing, data, or schema changes.

## Risks & validation
- Risk: a few components hardcode `text-white` / `bg-slate-50` and will look off-palette. Mitigation: grep + manual visual pass on auth, buyer dashboard, supplier dashboard, one document detail, one modal.
- Validation: load `/auth`, buyer dashboard, supplier dashboard via Playwright at 1280×1800, screenshot each, confirm pine primary + steel background + Archivo headings render.

## Deliverables
1. Updated `src/index.css` tokens, body font, global motifs.
2. Updated `tailwind.config.ts` fontFamily.
3. `bun add` of four fontsource packages + imports in `src/main.tsx`.
4. Targeted edits on ~6–10 component files with hardcoded colors.
5. Playwright screenshot pass for verification.