## Diagnosis

It's not an API key problem. The edge function logs for `consume-credits` show every recent export attempt by `amit@tracer2c.com` returning:

```
[CONSUME-CREDITS] Insufficient credits
```

A comparison report costs **15 credits** and the account doesn't have enough. The modal swallows the real reason and shows a generic "There was an error generating the report. Please try again." — which made it look like an API/key bug.

## Plan

**1. Surface the real error in the export modal**
`src/components/exports/SupplierComplianceExportModal.tsx` — in the `catch` block of `handleExport`, use `error.message` (falling back to the generic copy) so users see "Insufficient credits for report generation" instead of a vague failure.

**2. Detect the insufficient-credits case and offer a path forward**
When the message contains "credit" / "Insufficient", show a destructive toast titled **"Not enough credits"** with a CTA action that navigates to `/subscription` (the existing credits/top-up page) so the user can buy more.

**3. Top up credits for the dev account (optional, one-off)**
Separate from the code fix — grant test credits to `amit@tracer2c.com` so you can finish testing exports right now. I'll do this via a one-off SQL insert into the credits ledger after you confirm. No schema changes.

## Out of scope
- No changes to `consume-credits`, pricing, or the PDF service.
- No Turnstile / auth changes.

## Files changed
- `src/components/exports/SupplierComplianceExportModal.tsx` (error handling only)
