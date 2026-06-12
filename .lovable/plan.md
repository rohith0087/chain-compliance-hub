# Auditor Mode — Hide Irrelevant Pages, Relabel Dashboard, Default Entity Type

Build on the existing `useWorkspaceProfile()` hook. Auditor buyers should see a trimmed, re-skinned UI; everything else stays untouched.

## 1. Hide non-auditor menu items in the sidebar

`src/components/buyer/BuyerSidebarLayout.tsx`

Add a flag `flags.hideCOAAnalysis` (true for auditor) on `AUDITOR_PROFILE` in `src/config/workspaceProfiles.ts`. When `isAuditor`, filter out these submenu items:

- Requests & Documents → **COA Analysis**
- Suppliers → **Pre-populate Documents** (sample/buyer-template oriented — not auditor-relevant)
- Compliance → **Item Compliance** and **Facility Matrix** (food-supply-chain specific)
- Requests & Documents → **Buyer Samples** (rename hidden via flag)

Top-level items stay; only the listed submenu entries are filtered when `isAuditor`.

## 2. Dashboard: use Client terminology + hide COA quick action

`src/components/BuyerDashboard.tsx`

- Replace the hardcoded stat label `"Suppliers"` (line ~319) with `wsTerms.suppliers` (so it reads "Clients" in auditor mode).
- Section heading "Connected Suppliers" / "Supplier Risk" / similar strings → `wsTerms.*`.

`src/components/dashboard/ActivityQuickActionsPanel.tsx`

- Hide the **COA Ana…** quick-action button when `isAuditor` (already visible in screenshot).
- Relabel **Supplier …** button using `wsTerms.supplier_risk`.
- Relabel **Suppliers** button using `wsTerms.suppliers`.

"Needs Your Attention" cards currently show `Test Supplier` — this is user data (`supplier.name`), not a label; leave as-is. Only static labels change.

## 3. New Request modal — default entity type for auditors

`src/components/NewRequestModal.tsx` (lines 445–463)

- Import `useWorkspaceProfile`.
- When `isAuditor`:
  - Replace dropdown options with a single `"Auditor"` option (value `"Auditor"`).
  - Default `selectedSupplierType` to `"Auditor"` on mount.
  - Relabel the field `Label` to `wsTerms.workspace_label`-friendly text → use `"Engagement Type"` for auditors, keep `"Entity Type"` for default.
- Non-auditor flow unchanged (`General Supplier` / `Egg Processing`).

The `"Auditor"` value maps to the existing auditor onboarding template already added to `defaultOnboardingTemplates.ts`, so document selection auto-populates with engagement-letter type docs.

## 4. Workspace profile flag additions

`src/config/workspaceProfiles.ts` — extend `WorkspaceFlags`:

```ts
export interface WorkspaceFlags {
  showAuditFindings: boolean;
  showEngagementDocs: boolean;
  hideCOAAnalysis: boolean;      // new
  hideItemCompliance: boolean;   // new
  hideFacilityMatrix: boolean;   // new
  hidePrePopulate: boolean;      // new
  hideBuyerSamples: boolean;     // new
  defaultEntityType?: string;    // new — 'Auditor' for auditors
}
```

DEFAULT_PROFILE: all hide-flags false, no defaultEntityType.
AUDITOR_PROFILE: all hide-flags true, `defaultEntityType: 'Auditor'`.

## Files Modified

- `src/config/workspaceProfiles.ts` — extend flags
- `src/components/buyer/BuyerSidebarLayout.tsx` — filter submenu via flags
- `src/components/BuyerDashboard.tsx` — relabel stat/section strings via `wsTerms`
- `src/components/dashboard/ActivityQuickActionsPanel.tsx` — hide COA action, relabel buttons
- `src/components/NewRequestModal.tsx` — default + lock entity type to "Auditor" for auditors

## Non-goals

- No DB changes.
- No removal of COA features for non-auditors.
- No supplier-side changes.
- No new pages (Audit Findings already exists on supplier detail).
