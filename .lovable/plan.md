# Add Supplier-Side "Auditee" / Customer Profile

Mirror the buyer-side `Auditor` workspace profile on the supplier side. When a supplier's `industry` is `Auditee` (i.e. a client of an auditor), the supplier UI relabels "Buyers" → "Customers / Auditing Firms", "Document Requests" → "Evidence Requests", "Compliance" → "Audit Readiness", etc., and surfaces evidence/engagement-oriented onboarding templates.

## What changes

### 1. Workspace profile model — supplier variant
`src/config/workspaceProfiles.ts`
- Extend `WorkspaceProfileId` to `'default' | 'auditor' | 'auditee'`.
- Add `WorkspaceTerms` keys used on the supplier side: `buyer`, `buyers`, `connected_buyers`, `buyer_connections`, `document_requests` (already exists), `compliance` (compliance tab), `supplier_workspace_label`.
- Add `AUDITEE_PROFILE` (id: `auditee`) with:
  - terms: Customer / Customers / Active Customers / Auditing Firms / Evidence Requests / Audit Readiness / Auditee Workspace.
  - flags reused: `hideCOAAnalysis`, `hideItemCompliance`, `hideBuyerSamples` (since auditees usually don't ship product), plus a new `showEvidenceLibrary` flag (optional, off by default).
- Update `getWorkspaceProfileForIndustry(industry)` so `industry === 'Auditee'` returns `AUDITEE_PROFILE`. Keep `Auditor` mapping. `default` otherwise.

### 2. Industries list
`src/config/industries.ts`
- Add `'Auditee'` next to `'Auditor'` in `VALID_INDUSTRIES` so suppliers can pick it in `SupplierProfileSetup`.

### 3. Hook — resolve profile for suppliers too
`src/hooks/useWorkspaceProfile.tsx`
- Today the hook only reads `buyers.industry`. Extend it so that when the user is not a buyer, it falls back to a supplier lookup:
  1. Check `company_users` for `company_type = 'supplier'` to get `company_id`.
  2. Otherwise read `suppliers.industry` where `profile_id = user.id`.
- Continues to return the same shape (`profile`, `t`, `flags`, `industry`, `loading`); add `isAuditee` boolean alongside `isAuditor`.

### 4. Supplier sidebar + pages — consume terminology
`src/components/supplier/SupplierSidebarLayout.tsx`
- Replace hardcoded "Buyer Connections" label with `t.buyer_connections` from `useWorkspaceProfile`.
- Use `t.workspace_label` for the workspace label area if one is rendered.

`src/components/supplier/UnifiedBuyerConnections.tsx`, `SupplierConnectionStatus.tsx`, `ConnectWithBuyerModal.tsx`
- Replace user-visible "Buyer"/"Buyers" strings with `t.buyer` / `t.buyers` from `useWorkspaceProfile()`.
- Leave variable/prop names alone (purely a presentation change).

`src/pages/ChatPage.tsx`
- Already imports `useWorkspaceProfile`. Add `isAuditee` branches where needed (e.g. tab titles).

### 5. Onboarding templates parity
`src/config/defaultOnboardingTemplates.ts`
- Add a new `Auditee` template entry mirroring the `Auditor` one but framed from the auditee's side:
  - Welcome message about preparing for an audit engagement.
  - Document requirements: prior audit reports, internal control documentation, financial statements, org chart, policies & procedures, prior management letters, evidence index.
  - Form fields: fiscal year end, primary audit contact, scope of audit, prior auditor.
- Ensure `INDUSTRIES` import already includes `Auditee` (added in step 2).
- Buyers whose industry is `Auditor` and seed templates already exist; this entry is consumed when an `Auditee` supplier exists OR when an auditor buyer's default supplier onboarding wants an auditee-flavored template.

### 6. Locale strings
`src/locales/en/supplier.json` (and matching `es` if present)
- Add `tabs.connections.buyer` / `tabs.connections.customer` variants OR just keep current keys and override at component level using `t.buyers`. We'll do the latter to avoid touching i18n keys.

## What does NOT change
- No DB schema changes; `suppliers.industry` already exists.
- No RLS changes, no edge function changes.
- Buyer-side auditor profile untouched.
- Variable/prop/route names stay the same; only user-visible labels swap.

## Verification
- Set a test supplier's `industry` to `Auditee` in Supabase, log in, confirm:
  - Sidebar shows "Customer Connections" with badge.
  - Connections page reads "Active Customers / Auditing Firms".
  - Onboarding template picker shows the new Auditee template.
- Set industry back to anything else and confirm labels revert to "Buyer Connections" etc.
- Buyer-side auditor flow regression-check: load a buyer with industry `Auditor` and confirm nothing changed.

## Files touched
- `src/config/workspaceProfiles.ts`
- `src/config/industries.ts`
- `src/config/defaultOnboardingTemplates.ts`
- `src/hooks/useWorkspaceProfile.tsx`
- `src/components/supplier/SupplierSidebarLayout.tsx`
- `src/components/supplier/UnifiedBuyerConnections.tsx`
- `src/components/supplier/SupplierConnectionStatus.tsx`
- `src/components/supplier/ConnectWithBuyerModal.tsx`
- `src/pages/ChatPage.tsx` (minor)
