
## Fix bottom whitespace in Overview Dashboard cards

The whitespace exists because each row of the 12-col grid stretches all cards to match the tallest sibling (Technical Approval Record in the middle row; Quick Actions + Recent Activity stack in the lower row). Shorter cards (Compliance Risk Breakdown, AI Summary, Compliance Trend, Upcoming Expiry Trend) keep their natural inner height and leave dead space at the bottom.

Fix without breaking layout: keep equal-height cards (so the row still aligns cleanly) but let each card's content fill the card via `flex flex-col` + `flex-1` on the content area, and push CTA links to the bottom with `mt-auto`.

All edits are in `src/components/dashboard/BuyerOverviewDashboard.tsx` only. No prop, data, or layout-grid changes.

### 1. Compliance Risk Breakdown card
- Outer card: add `flex flex-col`.
- Wrap the donut + legend row in a `flex-1 flex items-center` so it vertically centers in the remaining space.
- "View all suppliers" link: add `mt-auto` so it pins to the bottom edge.

### 2. AI Summary card
- Outer card: add `flex flex-col`.
- The `<ul>` of bullets: add `flex-1` and slightly increase `space-y` (e.g. `space-y-3`) so the bullets distribute through the available height instead of bunching at the top.
- "View AI Recommendations" button: add `mt-auto`.

### 3. Compliance Trend card
- Outer card: add `flex flex-col`.
- Wrap `ResponsiveContainer` in a `flex-1 min-h-0` div and set `ResponsiveContainer height="100%"` (instead of fixed `170`) so the area chart grows to fill the card.

### 4. Upcoming Expiry Trend card
- Outer card: add `flex flex-col`.
- Same treatment: wrap the `ResponsiveContainer` in `flex-1 min-h-0` with `height="100%"`.
- The red "X expire within 30 days" alert stays as the card footer (it already sits at the bottom naturally because the chart now expands).

### Why this is safe
- Recharts' `ResponsiveContainer` already handles `height="100%"` correctly when given a sized flex parent (`flex-1 min-h-0`).
- No grid, col-span, gap, or sibling card changes — the tallest card in each row still defines row height, so existing alignment is preserved.
- KPI row, Technical Approval Record, Quick Actions, Recent Activity, and Manager Attention are untouched.

### Out of scope
- Detailed dashboard, settings modal, supplier views, schemas, and any other components.
