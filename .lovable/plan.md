# Add buyer Dashboard View preference + new Overview dashboard

Buyer-side only. No supplier, no schema, no backend, no other tabs touched.

## 1. New setting in Settings → General

In `src/components/settings/UnifiedSettingsModal.tsx`, when the `general` tab is active **and** `companyType === 'buyer'`, render a new "Display Preferences" card above the existing `CompanyManagementDashboard`.

The card contains a single control:

- **Label:** Dashboard View
- **Helper:** Choose how the buyer dashboard is rendered.
- **Control:** segmented toggle (shadcn `RadioGroup` styled as pill segments) with two options:
  - `Overview` — new sleek summary view (default)
  - `Detailed` — the current full dashboard

Persistence: `localStorage` key `buyerDashboard_view` (`'overview' | 'detailed'`). Lightweight, instant, no DB migration — matches existing pattern used for `buyerDashboard_activeTab` in `BuyerDashboard.tsx`. The setter dispatches a `storage`-like custom event (`window.dispatchEvent(new Event('buyer-dashboard-view-changed'))`) so the dashboard updates live without a reload.

Supplier users never see this card (gated on `companyType`).

## 2. New Overview dashboard component

Create `src/components/dashboard/BuyerOverviewDashboard.tsx` modeled on the uploaded screenshot. It is presentational and reads the same metric sources the current dashboard already loads via `useBuyerOverview`/the existing `dashboardStats` (passed in as props from `BuyerDashboard`). No new hooks, no new queries — reuses what's already fetched.

Sections, top to bottom:

1. **Stat row (5 cards)** — Total Suppliers, Active Suppliers, Technical Approvals Pending, Critical Issues / Expiring Soon, Overall Compliance Score (with mini ring). Each card: rounded-2xl, hairline border, soft tinted icon chip on the left, large tabular number, sublabel, and a colored delta line.
2. **Middle row** — Technical Approval Overview (stacked bar, recharts), Compliance Risk Breakdown (donut, recharts), Quick Actions card (4 pill rows: New Compliance Request, COA Analysis, Supplier Risk Review, Add New Supplier — each wired to existing `setActiveTab` / `setShowRequestForm`).
3. **Lower row** — Compliance Trend (line, recharts) + Upcoming Expiry Trend (line, recharts) + AI Summary card (static bullets sourced from existing AI summary if present, otherwise hidden) + Recent Activity list.
4. **Manager Attention (Priority Actions)** — sleek table: Priority dot, Supplier, Issue, Due/Since, Status pill. Rows clickable → navigate to supplier/document like current AttentionPanel does.

Styling: clean white cards on a `bg-slate-50/40` page background, slate-200 borders, generous padding (`p-6`), Inter-style numerics (`tabular-nums`, `tracking-tight`), subtle hover lift (`hover:shadow-md transition`), color tokens for status (emerald = approved, amber = pending, rose = critical, sky = info). No purple gradients. Uses existing `Card`, `Badge`, recharts components already in the project.

## 3. Wire it into BuyerDashboard

In `src/components/BuyerDashboard.tsx`, the existing `activeTab === 'dashboard'` branch currently renders the detailed view directly. Change it to:

```tsx
{activeTab === 'dashboard' && (
  view === 'overview'
    ? <BuyerOverviewDashboard ...stats onTabChange={setActiveTab} onNewRequest={...} />
    : <ExistingDetailedDashboard /* unchanged JSX moved into a local component */ />
)}
```

Add a `view` state initialized from `localStorage.getItem('buyerDashboard_view') ?? 'overview'`, listening to the `buyer-dashboard-view-changed` event to stay in sync when toggled from Settings.

The detailed JSX is moved as-is into a small private component (or kept inline behind the conditional) — zero behavioral change to it.

## 4. Safety / out of scope

- Supplier dashboard, sidebar, routes, auth, RLS — untouched.
- No new DB tables, no migrations, no edge function changes.
- `companyId` reference fix from the previous turn stays as-is.
- No edits to `tailwind.config.ts` or `index.css`; uses tokens already present.
- Detailed dashboard remains the fallback so nothing existing breaks.

## Files

- **Edit** `src/components/settings/UnifiedSettingsModal.tsx` — add Display Preferences card for buyers in General tab.
- **Edit** `src/components/BuyerDashboard.tsx` — add `view` state + conditional render.
- **New** `src/components/dashboard/BuyerOverviewDashboard.tsx` — sleek overview page.
