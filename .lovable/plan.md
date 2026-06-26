
## Buyer Overview Dashboard — Polish Pass

All changes are in `src/components/dashboard/BuyerOverviewDashboard.tsx`. No backend, schema, or other component changes.

### 1. Re-prioritize the right column (AI Summary up)
Restructure the middle row so the manager sees insight first:

```text
Middle row (12-col grid):
[ Technical Approval Record  (col-span 5) ] [ Compliance Risk (col-span 4) ] [ AI Summary (col-span 3) ]

Lower row (12-col grid):
[ Compliance Trend (col-span 4) ] [ Upcoming Expiry Trend (col-span 4) ] [ Quick Actions + Recent Activity stacked (col-span 4) ]
```

- AI Summary moves from the lower row up into the middle row, top-right.
- Quick Actions moves down into the lower-right column and becomes shorter (compact rows, no extra padding) with a small footer link "Manage workflows".
- A small Recent Activity stub sits under Quick Actions in the same column so the right column fills naturally without dead space.

### 2. Reduce KPI card height
- `StatCard` and the Compliance Score card: `p-5` → `p-4`, `min-h-[140px]` → `min-h-[112px]`, icon box slightly smaller.
- Row gap: outer `space-y-5` stays; grid `gap-4` stays; remove any tall inner spacing inside KPI cards.

### 3. Fix Overall Compliance Score card (Option A)
- Keep the large `54%` + `↗ 4% vs last month` on the left.
- Render `ComplianceRing` on the right with **no number inside the ring** (pass a prop like `showLabel={false}`, or wrap the ring and hide its inner label via an overlay). If `ComplianceRing` doesn't already support hiding the label, add a minimal `showLabel?: boolean` prop in that component — purely presentational, default `true` so existing usages are unaffected.

### 4. Rename + expand "Technical Approval Overview"
- Title → **Technical Approval Record**.
- Legend gains a fourth series: Approved / Pending / **Blocked** / Rejected.
- Add a `blocked` field to `approvalData` (derived from `stats.pendingReview` similar to existing derivations) and a 4th stacked `<Bar dataKey="blocked" fill="#64748b" />` between pending and rejected.

### 5. Fix chart/data consistency
- Month labels: current code hardcodes `'25` for every month. Replace with a date-driven generator that walks the last 6 months ending on the current month, formatted as `MMM ''YY` (e.g. `Dec '25, Jan '26, … May '26`). Same generator used by `approvalData` and `complianceTrend` so they stay aligned.
- Footer line under the bar chart: compute `totalThisMonth = approved + pending + blocked + rejected` for the last bar and render that number, so the caption matches the bar visually.

### 6. Shorten Quick Actions
- Move under AI Summary in the right column.
- Reduce row padding (`py-2` instead of current spacing), drop fixed height, add footer link `Manage workflows →` routing to `onTabChange('documents')` (or similar existing route — pick the one already wired).

### 7. Reduce vertical space so lower charts aren't cut off
- Outer container: `space-y-5` (keep) but middle/lower grids `gap-4` (keep) — main savings come from KPI height reduction and card `p-5` → `p-4` on the middle/lower cards.
- Chart heights: bar chart `220` → `200`; line/area charts stay at `170`.
- Outer scroll container height stays `h-[calc(100vh-120px)]` but content now fits on first screen at common laptop heights.

### 8. Manager Attention table (already present, keep visible)
- No structural change — it already exists at the bottom with Priority / Supplier / Issue / Due / Status.
- Cap to 4 rows max (slice the data array) and reduce card `p-5` → `p-4` so it lands within the first scroll region.

### Out of scope
- Detailed dashboard, settings modal, supplier-side views, schema, and `ComplianceRing` visual styling (only the optional `showLabel` prop is touched, if needed).
