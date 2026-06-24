## Rebuild the hero section to match the reference

Replace the current hero in `src/pages/Index.tsx` with a faithful structural copy of the Twenty reference, themed with the R2C palette. Visual-only change; no routing or data changes.

### Layout (top to bottom, centered)

1. **Eyebrow chip** — small `Compliance Operating System` label (kept for context, sits above headline)
2. **Serif headline** — two stacked lines, generous size:
   - Line 1: `Make every supplier document` (serif, regular weight)
   - Line 2: `something you can defend` (same serif, bolder weight, the word `defend` in `--r2c-stamp` pine green)
   - Font: Instrument Serif (already loaded), 56–88px responsive
3. **Subhead** — muted sans, max-width ~640px, centered
4. **Two pill CTAs**, monospace font (IBM Plex Mono, already loaded):
   - `GET STARTED` — solid `--r2c-ink` background, white text, pill
   - `TALK TO US` — transparent with 1.5px `--r2c-ink` outline
5. **Side barcode patterns** — left + right of the mockup, fading toward center. Rendered as inline SVG: many short horizontal bars at varying widths/positions in `--r2c-stamp` (pine green) with an opacity mask that fades from 100% at the outer edge to 0% near the mockup. Pure CSS/SVG, no library.
6. **macOS window mockup** — large card, ~960px wide, centered, floating with soft shadow:
   - Title bar: 3 traffic-light circles (red/yellow/green dots), centered title text `TraceR2C`
   - Sidebar (left, ~220px): workspace selector pill (`Acme Foods` w/ chevron), `Favorites` section (one item: `Compliance Dashboard`), `Workspace` section with items: `Suppliers` (active/highlighted), `Documents`, `Requests`, `Audits`, `Reports`, `Settings`. Use Lucide icons (Building2, FileCheck, ClipboardList, ShieldCheck, BarChart3, Settings).
   - Main view: Header row `All Suppliers · 9 ▾` with right-aligned `Filter · Sort · Options`. Below it a table:
     - Columns: checkbox, `Supplier`, `Certificate`, `Standard`, `Expires`, `Auditor`, `Status`
     - 8 rows with recognizable food/CPG-style supplier names (e.g. Auburn Foods, Pacific Mills, Granaria Co, Hokkaido Dairy, Sierra Produce, Maple Ridge, Andes Cacao, Nordic Seafood), each row with a colored avatar dot, certificate filename chip, standard like `ISO 22000`, `BRCGS v9`, `SQF Ed 9`, `HACCP`, expiry date, auditor name, and a status pill (`Verified` green, `Pending` amber, `Expired` red) using the existing `--r2c-verified`, `--r2c-caution`, `--r2c-recall` tokens.
   - All text in the mock uses `font-data` (IBM Plex Mono) and `font-body` (IBM Plex Sans) per the design system. No emoji.

### Color & token usage

- Background: `--r2c-bg`
- Ink/headline: `--r2c-ink`
- Accent (highlighted word, sidebar active state, barcode pattern, verified status): `--r2c-stamp`
- Status colors: existing `--r2c-verified`, `--r2c-caution`, `--r2c-recall`
- Borders/lines: `--r2c-line`
- Surfaces (sidebar, table header, window chrome): `--r2c-surface`, `--r2c-surface-2`
- No new CSS variables, no Tailwind config changes.

### Motion

- Headline + subhead + buttons: existing `heroIn(delay)` stagger (already in file)
- Mockup window: fade + slide up from `y: 40`, scale `0.98 → 1`, delay 0.35, duration 0.8
- Barcode side panels: opacity 0 → 1, delay 0.5, duration 1.0 (no transform, respect `prefers-reduced-motion`)

### Files touched

- `src/pages/Index.tsx` — replace the hero `<section>` block (currently lines ~584–639). Add two small inline components below the page component: `BarcodePanel` (SVG generator, accepts `side: 'left' | 'right'`) and `SupplierAppMockup` (the macOS window). Both stay inside the file to keep this change isolated.
- No other files changed. `EvidenceCard` stays defined in the file but is no longer rendered in the hero — it's moved into the Platform section's feature card area (already partly there via the embedded proof chip), so this is just an unused-in-hero change, not a deletion.

### Out of scope

- Header/nav, all sections below the hero, footer, auth page, dashboard, animations elsewhere — untouched.
- No copy edits outside the hero.
- No new dependencies, no font additions (Instrument Serif, IBM Plex Sans, IBM Plex Mono are already loaded).
