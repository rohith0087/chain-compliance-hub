# Settings modal polish + relocate Subscription

## 1. One close button only

`DialogContent` from shadcn already renders a built-in `X` in the top-right (with hover opacity transition). `UnifiedSettingsModal.tsx` adds a second custom `X` button on top of it.

Fix: **delete the custom close button** in `UnifiedSettingsModal.tsx` (the `<Button variant="ghost" ...>` wrapping `<X />` at lines ~165-173) and **drop the unused `X` import**. Then in `src/components/ui/dialog.tsx`, tune the built-in close so it matches the rest of the app:

- Add `p-1.5 rounded-full hover:bg-slate-100 transition-colors` to the `DialogPrimitive.Close` className for a subtle round hover background.
- Keep the existing opacity transition.

This is the only edit to `dialog.tsx` and is a one-class addition — no behavioral change to other dialogs (they currently get no hover bg, after change they get a subtle one which improves them all consistently).

## 2. Dashboard View moves under General → Overview tab

Currently the General tab opens `CompanyManagementDashboard` with `defaultTab="company"`, and the Dashboard View card sits **above** it as a separate floating card — which feels detached and uses sky-blue colors that don't match the app's primary (indigo/blue).

Fix:

- In `UnifiedSettingsModal.tsx`, **remove** the standalone `DashboardViewPreference` rendering above `CompanyManagementDashboard` and **change `defaultTab` from `"company"` to `"overview"`** so users land on the new Overview tab.
- **Delete the local `DashboardViewPreference` component** from `UnifiedSettingsModal.tsx`.
- Create a new file `src/components/settings/DashboardViewPreference.tsx` that exports the same toggle, restyled to match the app:
  - Use shadcn `Card` (matches every other settings card)
  - Use `text-primary`, `border-primary`, `bg-primary/5`, `ring-primary/20` semantic tokens — no hard-coded sky colors
  - Heading `text-base font-semibold` matching `CompanyProfile` style, smaller `LayoutDashboard` icon in a `bg-primary/10` chip
  - Selected option gets `border-primary bg-primary/5`, unselected hover gets `hover:border-border hover:bg-muted/30`
- In `CompanyManagementDashboard.tsx`, inside the existing `<TabsContent value="overview">` block, render `<DashboardViewPreference />` at the **top** when `companyType === 'buyer'` (gated, so suppliers don't see it). It sits naturally above the stats grid.

The toggle still writes to `localStorage` key `buyerDashboard_view` and dispatches `buyer-dashboard-view-changed` — no contract change with `BuyerDashboard.tsx`.

## 3. Move Subscription from main nav to Settings → Billing

- In `src/components/buyer/BuyerSidebarLayout.tsx`, **remove the "Subscription & Billing" / "Billing" item** from the main navigation array (lines ~352-356) and the `subscription`-related filter and click-handler branches that only existed for that item.
- In `src/components/settings/UnifiedSettingsModal.tsx`:
  - Replace the disabled `Billing (Soon)` placeholder at the bottom of the sidebar with an **active** nav button `{ id: 'billing', label: 'Billing', icon: CreditCard }`. Wire it to set `activeTab` like the others.
  - Add a new content branch `activeTab === 'billing'` that renders `<SubscriptionPage />` inside the same scroll container used by other tabs. Wrap it in a `max-w-3xl mx-auto p-10 pb-20` container override by adding a small class wrapper to neutralize `SubscriptionPage`'s `min-h-screen` (use `<div className="[&>div]:min-h-0 [&>div]:bg-transparent">`); content remains identical.
- In `BuyerDashboard.tsx`, the `activeTab === 'subscription'` route stays intact as a fallback (deep links / admin impersonation still work), but it is no longer reachable via the sidebar. No edits needed there.

## 4. Out of scope

- Supplier sidebar untouched.
- No schema or backend changes.
- `SubscriptionPage` itself unchanged — only embedded.
- Workspace flag `renameSubscriptionToBilling` left alone; it no longer matters for the sidebar since the entry is gone.

## Files

- **Edit** `src/components/ui/dialog.tsx` — subtle hover bg on built-in close.
- **Edit** `src/components/settings/UnifiedSettingsModal.tsx` — remove custom close + inline preference component, switch General defaultTab to overview, add Billing nav + content.
- **New** `src/components/settings/DashboardViewPreference.tsx` — themed toggle card.
- **Edit** `src/components/company/CompanyManagementDashboard.tsx` — render Dashboard View card at top of Overview tab for buyers.
- **Edit** `src/components/buyer/BuyerSidebarLayout.tsx` — remove Subscription/Billing main nav entry.
