## Bypass credits for report exports

Remove the credit gate from PDF generation so exports work regardless of balance.

### Change
`src/services/AdvancedPDFExportService.ts` — delete the `supabase.functions.invoke("consume-credits", ...)` call (and its error/`creditResult.success` checks) from both:
- `generateSingleSupplierReport` (lines ~56–73)
- `generateComparisonReport` (lines ~116–133)

PDF generation proceeds directly. No changes to the `consume-credits` edge function, no schema changes, no UI changes.

### Out of scope
- Subscription page, credit packages, credit ledger — left intact for when you want to re-enable.
- The 5 pre-existing TS errors in `SupplierDashboard.tsx`, `OnboardingPipelineView.tsx`, `AuditorFlowPresentation.tsx`, `useDocumentAssignments.tsx`, `useItemFacilityMappings.tsx` are unrelated to credits/exports. Say the word if you want me to fix them in a follow-up.

### To re-enable later
Restore the two `consume-credits` invoke blocks (or wrap them in an env flag like `VITE_CREDITS_ENABLED`).

### Files changed
- `src/services/AdvancedPDFExportService.ts`
