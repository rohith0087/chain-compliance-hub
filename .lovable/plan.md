

# COA (Certificate of Analysis) Comparison & Scheduling System

## Overview

Build a standalone COA management system that allows buyers to define analyte specifications, schedule recurring COA submissions from suppliers, automatically compare incoming COAs against those specs, flag deviations, and assign a COA score. The supplier uploads COAs through their existing document upload flow; the buyer sees results in a new "COA Analysis" sub-tab under Requests & Documents.

---

## Architecture

```text
+------------------+       +-------------------+       +--------------------+
|  BUYER SIDE      |       |  BACKEND          |       |  SUPPLIER SIDE     |
|                  |       |                   |       |                    |
| COA Spec Editor  |       | coa-analyzer      |       | Existing Upload    |
| (analyte limits) +------>| Edge Function     |<------+ Dialog (unchanged) |
|                  |       |                   |       |                    |
| COA Schedule     |       | coa-schedule-     |       | COA Requests shown |
| Manager         +------->| reminder          |       | in Requests tab    |
|                  |       | (cron edge fn)    |       |                    |
| COA Results      |       |                   |       |                    |
| Dashboard       <--------+ Normalizer +      |       |                    |
|                  |       | Comparator logic  |       |                    |
+------------------+       +-------------------+       +--------------------+
```

---

## Database Schema (New Tables)

### 1. `coa_specifications`
Buyer-defined acceptable limits for analytes per supplier (or globally).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| buyer_id | uuid FK buyers | |
| supplier_id | uuid FK suppliers (nullable) | NULL = global default |
| analyte_name | text | e.g. "Salmonella", "E. coli", "Lead" |
| analyte_code | text | Normalized code e.g. "SALMONELLA" |
| category | text | "Microbiological", "Heavy Metals", "Allergens", "Chemical" |
| spec_min | numeric (nullable) | Lower acceptable bound |
| spec_max | numeric (nullable) | Upper acceptable bound |
| unit | text | Normalized unit e.g. "CFU/g", "mg/kg", "ppm" |
| method | text (nullable) | Canonical method code e.g. "ISO_6579" |
| acceptable_methods | text[] | Array of equivalent methods |
| action_on_exceed | text | "flag", "reject", "notify" |
| basis | text (nullable) | "as-is", "dry", "per_g", "per_mL" |
| is_active | boolean DEFAULT true | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 2. `coa_schedules`
Recurring schedule for COA submissions per supplier.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| buyer_id | uuid FK buyers | |
| supplier_id | uuid FK suppliers | |
| frequency | text | "weekly", "monthly", "quarterly", "per_lot", "custom" |
| custom_interval_days | int (nullable) | For custom frequency |
| next_due_date | date | Next expected COA |
| last_submitted_date | date (nullable) | Last time supplier submitted |
| grace_period_days | int DEFAULT 3 | Days after due before flagging |
| auto_remind | boolean DEFAULT true | |
| reminder_days_before | int[] DEFAULT {7,3,1} | When to send reminders |
| status | text DEFAULT 'active' | "active", "paused", "cancelled" |
| product_name | text (nullable) | What product the COA covers |
| notes | text (nullable) | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 3. `coa_submissions`
Each COA submission (linked to document_uploads for file storage).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| schedule_id | uuid FK coa_schedules (nullable) | |
| buyer_id | uuid FK buyers | |
| supplier_id | uuid FK suppliers | |
| document_upload_id | uuid FK document_uploads (nullable) | Links to actual file |
| lot_number | text (nullable) | |
| product_name | text (nullable) | |
| submission_date | timestamptz DEFAULT now() | |
| analysis_status | text DEFAULT 'pending' | "pending", "analyzing", "completed", "error" |
| overall_score | numeric (nullable) | 0-100 COA score |
| pass_fail | text (nullable) | "pass", "fail", "partial" |
| flags_count | int DEFAULT 0 | Number of flagged analytes |
| raw_extracted_data | jsonb (nullable) | Raw parsed COA data |
| normalized_data | jsonb (nullable) | After normalization |
| comparison_results | jsonb (nullable) | Per-analyte comparison output |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### 4. `coa_analyte_results`
Per-analyte detail for each submission (denormalized for easy querying).

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| submission_id | uuid FK coa_submissions | |
| analyte_name | text | Raw name from COA |
| analyte_code | text | Normalized code |
| raw_value | text | Original value string (e.g. "<0.01", "ND", "5.2") |
| numeric_value | numeric (nullable) | Parsed numeric |
| is_censored | boolean DEFAULT false | ND, less-than-LOD, less-than-LOQ |
| censored_type | text (nullable) | "ND", "less_than_LOD", "less_than_LOQ" |
| censored_threshold | numeric (nullable) | |
| raw_unit | text | Original unit from COA |
| normalized_unit | text | Converted unit |
| raw_method | text (nullable) | Original method string |
| normalized_method | text (nullable) | Canonical method code |
| basis | text (nullable) | "as-is", "dry" |
| spec_min | numeric (nullable) | Spec limit applied |
| spec_max | numeric (nullable) | |
| status | text | "pass", "fail", "flagged", "unknown_analyte" |
| flag_reason | text (nullable) | Why flagged |
| confidence | text DEFAULT 'high' | "high", "medium", "low" |
| conversion_notes | text (nullable) | Audit trail for unit conversion |
| created_at | timestamptz | |

### 5. `coa_method_equivalencies`
User-defined method equivalency rules.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| buyer_id | uuid FK buyers | |
| analyte_code | text | Which analyte this applies to |
| method_a | text | e.g. "ISO_6579" |
| method_b | text | e.g. "AOAC_2016_02" |
| rule_name | text | |
| authority | text (nullable) | e.g. "FDA", "Internal" |
| notes | text (nullable) | |
| is_active | boolean DEFAULT true | |
| created_at | timestamptz | |

### 6. `coa_policy_settings`
Per-buyer policy toggles.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid PK | |
| buyer_id | uuid FK buyers (UNIQUE) | |
| within_spec_is_match | boolean DEFAULT true | |
| censored_equivalent_is_match | boolean DEFAULT true | |
| require_basis_conversion | boolean DEFAULT false | |
| flag_non_convertible_units | boolean DEFAULT true | |
| auto_flag_unknown_analytes | boolean DEFAULT true | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

---

## RLS Policies

All new tables:
- Buyers can SELECT/INSERT/UPDATE/DELETE their own records (WHERE buyer_id matches)
- Suppliers can SELECT `coa_submissions` and `coa_analyte_results` for their own supplier_id (read-only view of their own results)
- Suppliers can SELECT `coa_schedules` for their own supplier_id (to see upcoming due dates)

---

## Edge Functions

### 1. `coa-analyzer` (new)
Triggered when a COA document is uploaded (via webhook or manual trigger).

**Flow:**
1. Receive `{ submission_id }` or `{ document_upload_id }`
2. Download the file from storage
3. Extract text (reuse PDF/DOCX/image extraction logic from `backfill-buyer-document-content`)
4. Send extracted text to GPT-4o with a structured prompt to parse analyte results into JSON
5. **Normalize** the parsed data:
   - Unit normalization: ppm to mg/kg, ppb to ug/kg, % to mg/kg (with conversion factor), CFU/g and CFU/mL
   - Method normalization: Map raw method strings to canonical codes
   - Analyte normalization: Map names to standard codes
   - Censored value parsing: ND, less-than-LOD, less-than-LOQ, less-than-X to type + threshold
   - Basis normalization: "dry basis", "as-is", "per g", "per mL"
6. **Compare** each analyte against buyer specs:
   - Check value against spec_min/spec_max
   - Apply method equivalency rules
   - Apply policy toggles (censored equivalence, within-spec matching)
   - Flag unknown analytes not in spec list
7. Calculate overall COA score (weighted pass rate)
8. Write results to `coa_submissions` and `coa_analyte_results`
9. If any flags, update submission status accordingly

### 2. `coa-schedule-reminder` (new)
Cron job (daily) to check upcoming and overdue COA submissions.

**Flow:**
1. Query `coa_schedules` where `next_due_date` is approaching (within reminder_days_before)
2. For upcoming: send reminder notification to supplier via existing `send-generic-email` edge function
3. For overdue (past due_date + grace_period_days): 
   - Flag the schedule as overdue
   - Notify the buyer that supplier has not submitted
   - Create a notification in the notifications table
4. When a COA is submitted on schedule, advance `next_due_date` based on frequency

---

## Frontend Components

### Buyer Side

#### Navigation
Add "COA Analysis" as a new sub-item under **Requests & Documents** in the buyer sidebar:

```text
Requests & Documents
  |-- Documents
  |-- Templates
  |-- Buyer Samples
  |-- Document Sets
  |-- COA Analysis    <-- NEW
```

#### New Components (in `src/components/buyer/coa/`)

| Component | Purpose |
|-----------|---------|
| `COADashboard.tsx` | Main container with tabs: Overview, Specifications, Schedules, Results, Policy |
| `COAOverview.tsx` | Summary cards: total submissions, pass rate, flagged count, upcoming schedules |
| `COASpecEditor.tsx` | CRUD table for analyte specifications with category grouping, unit picker, method picker |
| `COAScheduleManager.tsx` | List of supplier schedules, create/edit schedule modal, status indicators (on time, overdue, upcoming) |
| `COAResultsView.tsx` | List of COA submissions with expandable detail showing per-analyte comparison, pass/fail badges, score |
| `COASubmissionDetail.tsx` | Full detail view of a single COA submission: analyte table, flags, raw vs normalized values, conversion audit trail |
| `COAPolicySettings.tsx` | Toggle switches for policy settings, method equivalency rules editor |
| `COAScoreCard.tsx` | Visual score display (reuse donut chart pattern from Supplier Risk) |
| `COASpecTemplates.tsx` | Pre-built spec templates for common industries (Food & Beverage microbiological panel, heavy metals panel, allergen panel) |
| `CreateScheduleModal.tsx` | Modal to set up recurring COA schedule: select supplier, frequency, product, grace period, reminders |
| `COAComparisonTable.tsx` | Side-by-side comparison table showing analyte, raw value, normalized value, spec range, status, flag reason |
| `COAFlagsBanner.tsx` | Alert banner showing critical flags requiring attention |

#### Pre-built Spec Templates
For Food & Beverage industry, include these default templates:

**Microbiological Panel:**
- Salmonella: Negative/25g (method: ISO 6579 or AOAC 2016.02)
- E. coli: max 100 CFU/g
- Total Plate Count: max 10,000 CFU/g
- Yeast & Mold: max 500 CFU/g
- Listeria monocytogenes: Negative/25g
- Coliforms: max 100 CFU/g

**Heavy Metals Panel:**
- Lead: max 0.1 mg/kg
- Arsenic: max 0.5 mg/kg
- Cadmium: max 0.1 mg/kg
- Mercury: max 0.02 mg/kg

**Allergen Panel:**
- Peanut: max 10 ppm (or ND)
- Tree Nuts: max 10 ppm
- Milk: max 10 ppm
- Soy: max 10 ppm
- Wheat/Gluten: max 20 ppm
- Egg: max 10 ppm
- Fish: max 10 ppm
- Shellfish: max 10 ppm
- Sesame: max 10 ppm

### Supplier Side

No new navigation items. Changes are minimal:
- When a buyer creates a COA schedule, a `document_request` is automatically created with `document_type = 'COA'` and a `category = 'COA_Scheduled'`
- The supplier sees this in their existing **Requests** tab like any other document request
- After uploading, the system automatically triggers COA analysis
- Supplier can view their COA results (pass/fail/score) in their existing **Documents** tab via an expandable detail section

---

## Edge Cases & Special Handling

| Edge Case | Handling |
|-----------|----------|
| **Unknown analyte** (not in buyer specs) | Auto-flag with status "unknown_analyte", show in results as informational |
| **Non-convertible units** (e.g. "arbitrary units") | Flag for manual review if policy `flag_non_convertible_units` is ON |
| **Censored values** (ND, less-than-LOD) | Parse into type + threshold; if both COA and spec are ND/less-than-LOD with same threshold, treat as match per policy |
| **Basis mismatch** (dry vs as-is) | If `require_basis_conversion` is ON and moisture data unavailable, flag rather than guess |
| **Method mismatch** | Check method equivalency rules; if no rule exists, flag with "method_not_equivalent" |
| **Supplier misses deadline** | After grace period: notify buyer, mark schedule as overdue, create attention item |
| **Multiple COAs per schedule period** | Accept and analyze all; latest is "active", previous are archived |
| **GPT extraction failure** | Set analysis_status = "error", show user-friendly message, allow manual data entry fallback |
| **Partial COA** (missing some analytes) | Flag missing analytes as "not_reported", deduct from score |
| **Score = 0 submissions** | Distinguish between "all failed" vs "analysis error" in UI |
| **Supplier uploads COA without a schedule** | Allow ad-hoc COA submissions; buyer can still compare against specs |

---

## Scoring Algorithm

```text
COA Score = (passed_analytes / total_spec_analytes) * 100

Adjustments:
- Each "flagged" analyte: -5 points from base
- Each "unknown_analyte": -2 points (informational deduction)
- Missing/not-reported analyte: -10 points each
- Method mismatch (non-equivalent): -3 points per analyte
- Floor: 0, Ceiling: 100
```

Overall status:
- **Pass**: Score >= 80 AND zero critical flags (Salmonella, Listeria)
- **Partial**: Score >= 50 OR has non-critical flags
- **Fail**: Score < 50 OR any critical analyte exceeds spec

---

## Implementation Order

1. **Database**: Create all 6 tables with RLS policies via migration
2. **Static UI first**: Build `COADashboard` with all sub-components using hardcoded demo data (same pattern as Supplier Risk Assessment), to validate the UI with the user
3. **Edge function `coa-analyzer`**: Build the extraction + normalization + comparison pipeline
4. **Edge function `coa-schedule-reminder`**: Build the cron-based reminder system
5. **Wire up**: Connect frontend to real Supabase queries, replace demo data
6. **Integration**: Auto-trigger COA analysis on document upload when document_type = 'COA'

For this first implementation, we will build **steps 1 and 2** (database schema + full static UI) to get feedback before building the edge functions.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/[timestamp]_coa_system.sql` | All 6 tables, RLS, indexes |
| `src/components/buyer/coa/COADashboard.tsx` | Main container |
| `src/components/buyer/coa/COAOverview.tsx` | Summary cards |
| `src/components/buyer/coa/COASpecEditor.tsx` | Spec CRUD |
| `src/components/buyer/coa/COAScheduleManager.tsx` | Schedule management |
| `src/components/buyer/coa/COAResultsView.tsx` | Submissions list |
| `src/components/buyer/coa/COASubmissionDetail.tsx` | Single submission detail |
| `src/components/buyer/coa/COAPolicySettings.tsx` | Policy toggles |
| `src/components/buyer/coa/COAComparisonTable.tsx` | Analyte comparison |
| `src/components/buyer/coa/COAScoreCard.tsx` | Score visualization |
| `src/components/buyer/coa/COASpecTemplates.tsx` | Pre-built templates |
| `src/components/buyer/coa/CreateScheduleModal.tsx` | Schedule creation |
| `src/components/buyer/coa/coaDemoData.ts` | Static demo data |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/buyer/BuyerSidebarLayout.tsx` | Add "COA Analysis" to Requests & Documents submenu |
| `src/components/BuyerDashboard.tsx` | Import and render `COADashboard` for `coa-analysis` tab |
| `src/components/buyer/CommandPaletteSearch.tsx` | Add COA Analysis to search |

