

# Remove Supplier Risk Badges + Add COA/Risk Query to Compliance Compass

## Part 1: Remove "Connected" and "Monitoring ON" Badges

Remove the two badges from the header in `SupplierRiskAssessment.tsx` (lines 62-67). Keep the "Last refresh" badge as it provides useful temporal context.

**File**: `src/components/buyer/supplier-risk/SupplierRiskAssessment.tsx`

---

## Part 2: Add COA and Supplier Risk Querying to Compliance Compass

The Compliance Compass chat (`simple-rag-chat` edge function) currently queries live Supabase data for documents/suppliers. COA analysis and supplier risk data live as **client-side demo data** (`coaDemoData.ts`, `riskData.ts`). To let users ask questions about these, we embed the demo data directly into two new tool functions in the edge function.

### New Tools

**Tool 1: `query_coa_data`**
- Description: Query COA analysis data including submissions, analyte results, schedules, specs, and policies
- Parameters: `supplier_name` (optional filter), `status` (pass/fail/partial), `analyte_name` (optional)
- Implementation: Returns hardcoded demo data (3 submissions with full analyte results, 4 schedules, 15 specs) filtered by params
- The function embeds the demo data as a const inside the edge function

**Tool 2: `query_supplier_risk`**
- Description: Query supplier risk assessment data including risk scores, drivers, news signals, recalls, documents, and questionnaire responses
- Parameters: `supplier_name` (optional), `risk_level` (High/Medium/Low), `include_details` (boolean for full profile vs summary)
- Implementation: Returns hardcoded demo data (3 suppliers with full risk profiles) filtered by params

### System Prompt Addition

Add routing guidance:
- "COA results", "analyte failures", "which lots failed", "COA score" --> `query_coa_data`
- "supplier risk", "risk score", "risk drivers", "recalls", "risk assessment" --> `query_supplier_risk`

### Switch Case Addition

Add two new cases in the `executeTool` switch statement calling the embedded data functions.

### Files Modified
- `src/components/buyer/supplier-risk/SupplierRiskAssessment.tsx` -- remove 2 badges
- `supabase/functions/simple-rag-chat/index.ts` -- add 2 tool definitions, 2 handler functions, 2 switch cases, system prompt additions

