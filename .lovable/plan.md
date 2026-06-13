## Plan

1. Reproduce the report action from the `/audit-assistant` flow and verify the exact failing request/response path for `generate-audit-report`.
2. Replace any edge-incompatible runtime imports or transitive dependencies in `generate-audit-report` (and `audit-assistant` if needed) so the functions no longer pull `node:zlib`, `bufferutil`, or `utf-8-validate` into the Supabase Edge runtime.
3. Redeploy the affected edge functions and validate them directly against the live project, then re-test the report action from the page.
4. Tighten the `/audit-assistant` client error handling so the toast shows the real backend failure reason instead of the generic “Failed to send a request to the Edge Function” message.

## Expected outcome

- The report button in `/audit-assistant` generates a PDF successfully.
- If the backend fails again, the UI surfaces a cleaner, more specific error.

## Technical details

- Current live logs still show the deployed functions crashing on startup with:
  - `module "node:zlib" not found`
  - missing `bufferutil`
  - missing `utf-8-validate`
- That means the issue is not just the page UI; the deployed edge bundle is still incompatible or stale.
- I’ll focus on these files first:
  - `supabase/functions/generate-audit-report/index.ts`
  - `supabase/functions/audit-assistant/index.ts`
  - `src/pages/AuditAssistantPage.tsx`
- Validation will be done with live edge-function logs plus a direct function test after redeploy.