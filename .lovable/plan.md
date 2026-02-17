

# Make COA Analysis System Fully Dynamic (End-to-End)

## Overview

Wire all 5 COA tabs (Overview, Specifications, Schedules, Results, Policy) to live Supabase data, build the `coa-analyzer` edge function for automated COA extraction/normalization/comparison, and build the `coa-schedule-reminder` edge function for deadline tracking. The static demo data remains as fallback when no dynamic data exists -- no "static" labels shown.

---

## Part 1: React Hooks for Supabase Data

Create a single hooks file `src/hooks/useCOA.ts` with custom hooks for each COA table. Each hook resolves `buyer_id` from the authenticated user's profile (same pattern as `AllSuppliersPerformanceDashboard`).

### Hooks to create:

| Hook | Table | Operations |
|------|-------|------------|
| `useBuyerIdResolver()` | `buyers` | Shared helper: profile.id -> buyer_id |
| `useCOASpecifications()` | `coa_specifications` | CRUD: list, add, update, delete, load template |
| `useCOASchedules()` | `coa_schedules` | CRUD: list, create, pause, cancel |
| `useCOASubmissions()` | `coa_submissions` + `coa_analyte_results` | Read: list submissions with analyte results joined |
| `useCOAPolicySettings()` | `coa_policy_settings` | Read + upsert (single row per buyer) |
| `useCOAMethodEquivalencies()` | `coa_method_equivalencies` | CRUD: list, add, delete, toggle active |
| `useCOAOverviewStats()` | Aggregates from submissions + schedules | Read-only computed stats |

Each hook uses `@tanstack/react-query` for caching and returns `{ data, isLoading, error, mutate... }`.

### Fallback strategy
- When `data` is empty/null and `isLoading` is false, components use demo data arrays from `coaDemoData.ts` as visual placeholder
- No "static" or "demo" labels displayed anywhere
- When real data exists, it fully replaces demo data

---

## Part 2: Update All Frontend Components

### `COAOverview.tsx`
- Import `useCOAOverviewStats` hook
- Compute stats from real submissions + schedules
- Fall back to demo data stats when no data

### `COASpecEditor.tsx`
- Import `useCOASpecifications` hook
- Wire "Add Spec" button to insert mutation
- Wire template loading to batch insert
- Wire table rows to show real specs
- Add inline edit and delete actions

### `COAScheduleManager.tsx`
- Import `useCOASchedules` hook
- Wire "New Schedule" to `CreateScheduleModal` (new modal component)
- Show real schedules with live due date calculations
- Add pause/cancel actions

### `COAResultsView.tsx`
- Import `useCOASubmissions` hook
- Display real submissions with their analyte results
- Keep expandable detail with `COAComparisonTable`

### `COAPolicySettings.tsx`
- Import `useCOAPolicySettings` and `useCOAMethodEquivalencies` hooks
- Wire toggle switches to upsert policy
- Wire equivalency table to real CRUD

### `CreateScheduleModal.tsx` (new)
- Modal with form fields: supplier selector (from `buyer_supplier_connections`), frequency, product name, next due date, grace period, reminder preferences
- On submit: insert into `coa_schedules`

---

## Part 3: Edge Function -- `coa-analyzer`

### Purpose
Receives a COA document (via `submission_id` or `document_upload_id`), extracts analyte data using GPT-4o Vision, normalizes units/methods/analytes, compares against buyer specs, scores, and writes results.

### File: `supabase/functions/coa-analyzer/index.ts`

### Flow:
```text
1. Authenticate caller (JWT)
2. Fetch submission record + linked document_upload
3. Download file from Supabase storage
4. Extract content:
   - PDF: Use unpdf for text extraction, fallback to Vision API for scanned PDFs
   - Images: Direct Vision API
   - DOCX: JSZip extraction (reuse existing pattern)
5. Send to GPT-4o with COA-specific structured prompt:
   "Parse this Certificate of Analysis. Extract each analyte tested with:
    analyte_name, value (raw string), unit, method, basis, lot_number"
   Response format: JSON array
6. Normalize each result:
   - Unit: ppm->mg/kg, ppb->ug/kg, %->mg/kg(*10000), CFU/g, CFU/mL
   - Method: map raw strings to canonical codes via dictionary
   - Analyte: map names to codes via dictionary
   - Censored: parse ND, <LOD, <LOQ, <X into type + threshold
   - Basis: standardize to "as-is" or "dry"
7. Fetch buyer's specs from coa_specifications
8. Fetch buyer's policy from coa_policy_settings
9. Fetch method equivalencies from coa_method_equivalencies
10. Compare each analyte:
    - Match analyte_code to spec
    - Check value vs spec_min/spec_max
    - Check method equivalency
    - Apply policy toggles
    - Determine status: pass/fail/flagged/unknown_analyte
11. Score: baseline 100, deductions per plan (-5 flagged, -2 unknown, -10 missing, -3 method mismatch)
12. Determine pass_fail: pass (>=80, no critical), partial (>=50 or non-critical flags), fail (<50 or critical)
13. Write to coa_analyte_results (per analyte)
14. Update coa_submissions with score, pass_fail, flags_count, analysis_status='completed'
15. If schedule_id exists, update coa_schedules.last_submitted_date
```

### Normalization Dictionaries (embedded in edge function):

```text
Unit Dictionary:
  ppm -> mg/kg (factor: 1)
  ppb -> ug/kg (factor: 1)
  ug/g -> mg/kg (factor: 1)
  mg/L -> mg/kg (factor: 1, aqueous assumption)
  % -> mg/kg (factor: 10000)
  CFU/g -> CFU/g
  CFU/mL -> CFU/mL
  CFU/25g -> CFU/25g

Analyte Dictionary:
  "e. coli" / "escherichia coli" -> E_COLI
  "salmonella" / "salmonella spp" -> SALMONELLA
  "total plate count" / "tpc" / "aerobic plate count" / "apc" -> TPC
  "yeast and mold" / "yeast & mold" / "y&m" -> YEAST_MOLD
  "listeria" / "listeria monocytogenes" / "l. mono" -> LISTERIA
  "coliforms" / "total coliforms" -> COLIFORMS
  "lead" / "pb" -> LEAD
  "arsenic" / "as" -> ARSENIC
  "cadmium" / "cd" -> CADMIUM
  "mercury" / "hg" -> MERCURY
  "peanut" -> PEANUT
  "gluten" / "wheat" -> GLUTEN
  "milk" / "casein" / "whey" -> MILK
  "soy" / "soybean" -> SOY
  "sesame" -> SESAME
  (and more mappings)

Method Dictionary:
  "iso 6579" / "iso 6579:2017" -> ISO_6579
  "aoac 2016.02" -> AOAC_2016_02
  "icp-ms" / "icp ms" -> ICP_MS
  "icp-oes" / "icp oes" -> ICP_OES
  "elisa" -> ELISA
  "r5 elisa" / "r5-elisa" -> R5_ELISA
  "pcr" / "real-time pcr" -> PCR
  "hplc" -> HPLC
  (and more)
```

### Censored Value Parser:
```text
Input -> Output
"ND" -> { is_censored: true, type: "ND", threshold: 0, numeric: 0 }
"<0.01" -> { is_censored: true, type: "less_than_LOD", threshold: 0.01, numeric: 0.01 }
"<LOD" -> { is_censored: true, type: "less_than_LOD", threshold: null, numeric: 0 }
"<LOQ" -> { is_censored: true, type: "less_than_LOQ", threshold: null, numeric: 0 }
"Not Detected" / "Negative" -> { is_censored: true, type: "ND", threshold: 0, numeric: 0 }
"Detected" / "Positive" -> { is_censored: false, numeric: 1, flag: "qualitative_positive" }
```

### Error Handling:
- GPT extraction failure: set `analysis_status = 'error'`, store error in `raw_extracted_data`
- Partial extraction: process what was extracted, flag missing analytes
- Timeout: 120-second function timeout, chunked processing for large documents

---

## Part 4: Edge Function -- `coa-schedule-reminder`

### File: `supabase/functions/coa-schedule-reminder/index.ts`

### Purpose
Daily cron job that checks COA schedules for upcoming due dates and overdue submissions.

### Config: `verify_jwt = false` (system-triggered)

### Flow:
```text
1. Query coa_schedules WHERE status = 'active'
2. For each schedule:
   a. Calculate days until next_due_date
   b. If days_until_due IN reminder_days_before AND auto_remind = true:
      - Look up supplier email from suppliers table
      - Call send-generic-email to remind supplier
      - Log notification
   c. If days_until_due < -grace_period_days (overdue):
      - Update schedule status to 'overdue'
      - Notify buyer via notifications table
      - Optionally email buyer
   d. If a submission exists after last next_due_date:
      - Advance next_due_date based on frequency
      - Reset status to 'active' if was overdue
```

---

## Part 5: Trigger COA Analysis on Upload

### How it works:
- When a supplier uploads a document via the existing upload flow, if the document is linked to a `document_request` with `document_type = 'COA'`, automatically:
  1. Create a `coa_submissions` record linking to the `document_upload`
  2. Call the `coa-analyzer` edge function
- This is triggered from the frontend upload success handler (no database trigger needed)

### Modification:
- In the document upload success handler, check if the request type is COA
- If yes, invoke `supabase.functions.invoke('coa-analyzer', { body: { document_upload_id, buyer_id, supplier_id } })`

---

## Part 6: Config & Dependencies

### `supabase/config.toml` additions:
```toml
[functions.coa-analyzer]
verify_jwt = true

[functions.coa-schedule-reminder]
verify_jwt = false
```

### Secrets needed:
- `OPENAI_API_KEY` -- already configured
- `RESEND_API_KEY` -- already configured
- No new secrets required

---

## Files Summary

### New files:
| File | Purpose |
|------|---------|
| `src/hooks/useCOA.ts` | All COA React Query hooks |
| `src/components/buyer/coa/CreateScheduleModal.tsx` | Schedule creation modal with supplier picker |
| `supabase/functions/coa-analyzer/index.ts` | GPT-4o extraction + normalization + comparison + scoring |
| `supabase/functions/coa-schedule-reminder/index.ts` | Daily cron for reminders and overdue flagging |

### Modified files:
| File | Change |
|------|--------|
| `src/components/buyer/coa/COAOverview.tsx` | Use `useCOAOverviewStats`, fallback to demo |
| `src/components/buyer/coa/COASpecEditor.tsx` | Use `useCOASpecifications`, wire CRUD + templates |
| `src/components/buyer/coa/COAScheduleManager.tsx` | Use `useCOASchedules`, wire create/pause/cancel |
| `src/components/buyer/coa/COAResultsView.tsx` | Use `useCOASubmissions`, show real results |
| `src/components/buyer/coa/COAPolicySettings.tsx` | Use `useCOAPolicySettings` + `useCOAMethodEquivalencies` |
| `supabase/config.toml` | Add JWT config for both new edge functions |

### Unchanged:
| File | Reason |
|------|--------|
| `coaDemoData.ts` | Kept as fallback data source, no modifications |
| `COAScoreCard.tsx` | Pure presentation, no data source change needed |
| `COAComparisonTable.tsx` | Pure presentation, receives props |
| `COAFlagsBanner.tsx` | Pure presentation, receives props |
| `COADashboard.tsx` | Already correct tab structure |

---

## Implementation Order

1. Create `useCOA.ts` hooks file
2. Create `CreateScheduleModal.tsx`
3. Update all 5 tab components to use hooks (with demo fallback)
4. Create `coa-analyzer` edge function
5. Create `coa-schedule-reminder` edge function
6. Update `supabase/config.toml`
7. Deploy and test

