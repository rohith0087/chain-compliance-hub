# Reskin /white-paper to the R2C aesthetic

The landing page (`/`) and auth page (`/auth`) share a scoped design system: an industrial "customs hall" look with Archivo Expanded display type, IBM Plex Sans body, IBM Plex Mono for data, a steel/charcoal/pine‑green palette, hairline grid backdrops, dashed certificate borders, and rubber‑stamp accents. Everything is scoped under the `.r2c` class and driven by `--r2c-*` CSS variables already defined in `index.css`.

The current `/white-paper` page uses the generic shadcn theme (`bg-background`, `text-foreground`, purple‑ish `primary`/`accent` gradients, default sans). It looks like a different product. This plan reskins it so it feels like a chapter of the same brand.

## Scope

- Single file: `src/pages/WhitePaperPage.tsx`
- No content/copy changes, no route changes, no new dependencies
- All section structure, stats, ROI table, data‑point cards remain — only visual styling, typography, and motion tokens change

## Visual changes

1. **Wrap root in `.r2c`** so all scoped tokens, fonts, and helper classes apply.
2. **Background**: swap `bg-background` for `bg-[var(--r2c-bg)]` (cool steel) with the `r2c-grid` hairline backdrop on the hero, replacing the dot‑grid and floating purple/accent orbs.
3. **Typography**:
   - Headlines → `font-display` (Archivo Expanded), tight tracking, 600–800 weight, no purple gradient — use solid `--r2c-ink` with `--r2c-stamp` underline accents like the landing hero.
   - Body → `font-body` (IBM Plex Sans), color `--r2c-muted`.
   - Section numbers, labels, stat suffixes → `font-data` (IBM Plex Mono), uppercase, wide tracking.
4. **Color tokens** (replace throughout):
   - `text-foreground` → `text-[var(--r2c-ink)]`
   - `text-muted-foreground` → `text-[var(--r2c-muted)]`
   - `text-primary` / accent gradients → `text-[var(--r2c-stamp)]`
   - `text-destructive` → `text-[var(--r2c-recall)]`
   - `text-warning` → `text-[var(--r2c-caution)]`
   - `text-success` → `text-[var(--r2c-verified)]`
   - `bg-muted/*` section bands → `bg-[var(--r2c-surface-2)]` with top/bottom hairline borders
   - `border-border` → `border-[var(--r2c-line)]`
5. **Cards** (`DataPointCard`, ROI block, TOC items): 18px rounded corners, 2px `--r2c-line` border, `--r2c-surface` background, dashed bottom borders on key/value rows like the certificate card on the landing page. Remove the `bg-card/80 backdrop-blur` glassy look.
6. **Buttons**: replace shadcn `Button` styling with the R2C pill style — pine‑green primary (`bg-[var(--r2c-stamp)]` → hover `--r2c-stamp-deep`, white text, rounded‑full) and ghost outline variant matching the landing CTAs.
7. **Reading progress bar**: keep, but recolor to solid `--r2c-stamp` instead of the primary→accent gradient.
8. **Section header rail**: keep the `SECTION 0X` mono label + hairline, but use `--r2c-stamp` for the label and `--r2c-line` for the rule.
9. **Hero badge**: replace the soft `bg-primary/10` pill with a hard‑edged R2C chip — `border-[var(--r2c-stamp)]/40 bg-[var(--r2c-stamp)]/[0.06] text-[var(--r2c-stamp)] font-data uppercase tracking-[0.18em]`, mirroring the "WHITE PAPER — 2026 EDITION" treatment used for kickers on the landing page.
10. **Stat numbers** (`StatBlock`): use `font-display` with tabular numerals, drop the purple gradient; for `accent` variant render in `--r2c-stamp` with a thin underline mark, matching the evidence‑card numerals.
11. **Motion**: keep `FadeInSection`, scroll progress, and the ChevronDown bounce. Remove the two animated purple/accent blur orbs in the hero — they read as generic SaaS and clash with the customs‑hall vibe. Replace with a subtle scan‑beam line under the hero headline like the evidence card on `/`.
12. **Print styles**: keep `@media print` block; ensure printed output uses `--r2c-bg` white fallback and ink‑on‑paper colors.

## Out of scope

- No edits to `index.css`, `tailwind.config.ts`, or any shared component — all tokens already exist.
- No copy, data, or section restructuring.
- Dashboard / app‑shell pages are untouched (the `.r2c` scope stays page‑local).

## Verification

After the edit:
- Open `/white-paper` and confirm fonts, colors, and section bands match `/` and `/auth`.
- Confirm dark dashboard pages are unaffected (no global CSS changed).
- Confirm `window.print()` still produces a clean PDF.
