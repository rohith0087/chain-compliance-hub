# Auditor Workspace Mode

## Concept

An **Auditor** is just a buyer whose `industry = 'Auditor'`. Their "suppliers" are their **clients**. We do NOT fork the data model. Instead we introduce a **Workspace Profile** layer that:

1. Swaps terminology across the buyer-side UI
2. Toggles a couple of auditor-only modules on/off

The user switches modes from **Company Management → Company Profile → Industry** (already exists, value = "Auditor").

---

## Part 1 — Terminology System

### New file: `src/config/workspaceProfiles.ts`

Defines a `WorkspaceProfile` per industry group. Two packs to start:

```text
default  → Supplier, Suppliers, Supplier Risk, Onboarding, Document Request,
           Connected Suppliers, Compliance Compass
auditor  → Client,   Clients,   Audit Risk,    Engagement, Evidence Request,
           Active Clients,      Audit Assistant
```

Each profile exports:
- `terms`: label dictionary (singular/plural/section titles/CTA copy)
- `flags`: `{ showAuditFindings: boolean, showEngagementDocs: boolean, ... }`
- `brandAccent` (optional): allows a subtle accent shift later

Industry → profile map:
- `"Auditor"` → `auditor`
- everything else → `default`

### New hook: `src/hooks/useWorkspaceProfile.tsx`

- Reads the current buyer's `industry` (via existing buyer fetch / `useBuyerSetup`)
- Returns `{ profile, t, flags, isAuditor }`
- `t.supplier`, `t.suppliers`, `t.supplier_risk`, `t.onboarding`, `t.document_request`, `t.connected_suppliers`, `t.compliance_compass`, etc.
- Memoized; falls back to `default` while loading

### Refactor buyer-side labels to use `t.*`

Targeted, high-visibility surfaces only (no logic changes):

- `src/components/BuyerDashboard.tsx` — tab/section titles, headers
- Buyer sidebar / nav labels
- `src/components/buyer/supplier-risk/SupplierRiskAssessment.tsx` — header "Supplier Risk" → `t.supplier_risk`
- `SupplierProfileSidebar.tsx` — "Supplier Profile" → `t.supplier_profile`, "Download Report" copy
- Connected suppliers / supplier list page titles
- Compliance Compass chat header + welcome message → `t.compliance_compass` (auditor: "Audit Assistant")
- Onboarding pipeline page title + primary CTA
- Document request flow titles
- Toast strings on the same screens

PDF generator (`generateSupplierRiskPDF.ts`) gets a small label-pack parameter so the exported report says "Client Risk Report" when in auditor mode.

We will NOT touch: DB column names, route paths, internal variable names, supplier-side UI.

---

## Part 2 — Auditor-only modules (gated by `flags`)

### A) Audit Findings log

Lightweight per-client findings tracker on the Client (supplier) detail page.

- New tab "Audit Findings" on the supplier risk / supplier detail view, visible only when `flags.showAuditFindings`
- Fields per finding: title, severity (Minor / Major / Critical), status (Open / In Progress / Closed), date, description, linked document (optional)
- New table `audit_findings` (buyer_id, supplier_id, ...) with RLS + GRANTs (separate migration, will surface for approval)
- New hook `useAuditFindings(supplierId)` + simple list/create/edit UI
- Findings count surfaces as a chip on the supplier card in auditor mode

### B) Engagement document type

- Adds an "Engagement Letter" entry to the default document templates set used when the buyer's industry is "Auditor" (via `src/config/defaultOnboardingTemplates.ts`)
- Adds an "Auditor" template entry there with a small auditor-appropriate document list (Engagement Letter, Scope Document, Independence Confirmation, Prior Year Workpapers, Management Representation Letter)
- No schema change — uses existing `default_document_requirements` flow already wired up in `BuyerProfileSetup.tsx`

---

## Part 3 — Settings UX polish

In Company Management → Company Profile:
- Keep the existing Industry dropdown as the switch (no new field)
- When the user selects "Auditor", show an inline info note:
  > "Auditor workspace enabled. Your dashboard will use auditor terminology (Clients, Audit Risk, Engagement, Evidence) and unlock Audit Findings."
- Live label preview is automatic on next render via the hook

---

## Technical Details

### Files created
- `src/config/workspaceProfiles.ts` — terminology + flags
- `src/hooks/useWorkspaceProfile.tsx` — active profile resolver
- `src/components/buyer/audit/AuditFindingsTab.tsx` — new module UI
- `src/hooks/useAuditFindings.tsx` — CRUD hook
- One Supabase migration: `audit_findings` table + RLS + GRANTs (auditor buyer can manage their own findings; supplier cannot read)

### Files edited (terminology pass)
- `src/components/BuyerDashboard.tsx`
- `src/components/buyer/supplier-risk/SupplierRiskAssessment.tsx`
- `src/components/buyer/supplier-risk/SupplierProfileSidebar.tsx`
- Buyer sidebar / nav component
- Compliance Compass chat header component
- Onboarding pipeline header
- `src/utils/generateSupplierRiskPDF.ts` (accepts label pack)
- `src/config/defaultOnboardingTemplates.ts` (add Auditor template)

### Non-goals (this pass)
- No CAPA tracker
- No audit calendar
- No supplier-side relabeling (supplier still sees themselves as a supplier; clean separation)
- No route renames
- No new role in `user_roles` — auditor is an industry, not a role
