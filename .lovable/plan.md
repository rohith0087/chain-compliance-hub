

# Console Log Cleanup Plan

## Overview
Remove or conditionalize ~817 `console.log` statements across 34 frontend files and sanitize ~1611 statements across 47 edge function files. The goal is to prevent PII leakage in production browser DevTools while preserving useful server-side logging.

## Approach

### Create a shared logger utility
Create `src/utils/logger.ts` -- a thin wrapper that only outputs logs in development mode (`import.meta.env.DEV`). All frontend `console.log` calls will be replaced with this utility.

```text
logger.debug("message")  --> only logs when import.meta.env.DEV is true
logger.info("message")   --> only logs when import.meta.env.DEV is true  
logger.warn("message")   --> always logs (keeps console.warn behavior)
logger.error("message")  --> always logs (keeps console.error behavior)
```

### Frontend files (34 files, ~817 matches)
Replace all `console.log(...)` calls with `logger.debug(...)` or `logger.info(...)`. This silences them entirely in production while keeping them available during development.

**Files to update:**
- `src/contexts/ImpersonationContext.tsx` -- logs impersonation user emails
- `src/contexts/LanguageContext.tsx` -- logs location detection
- `src/hooks/usePlatformAdmin.tsx` -- logs real-time subscription events
- `src/hooks/useUserContexts.tsx` -- logs context switches
- `src/pages/ChatPage.tsx` -- logs session IDs
- `src/components/BuyerDashboard.tsx` -- logs company IDs, profile refreshes
- `src/components/chat/ComplianceEmailComposer.tsx` -- logs user IDs, email payloads
- `src/components/chat/ActionExecutor.tsx` -- logs action parameters
- `src/components/buyer/IndustryBasedSupplierSetup.tsx` -- logs supplier names
- `src/components/agents/AgentTimeline.tsx` -- logs agent payloads
- `src/utils/addSampleSuppliers.ts` -- logs supplier data
- All remaining ~23 files with console.log statements

### Edge Functions (47 files, ~1611 matches) -- lighter touch
Edge function logs go to Supabase server logs (not browser DevTools), so the risk is lower. The plan is to:
1. Remove logs that print full request/response payloads or user emails
2. Keep operational logs (function start/end, error paths) but redact PII
3. No utility wrapper needed -- just targeted removals

Key files to sanitize:
- `secure-document-url/index.ts` -- logs raw request bodies and file paths
- `knowledge-populator/index.ts` -- logs user IDs
- `send-assignment-notification/index.ts` -- logs user emails
- All email-sending functions -- remove payload logging

## Steps

1. **Create `src/utils/logger.ts`** -- development-only logger utility
2. **Update all 34 frontend files** -- replace `console.log` with `logger.debug`/`logger.info`, add import
3. **Sanitize edge function logs** -- remove PII from ~47 edge function files, keep operational logs
4. **Leave `console.error` and `console.warn` untouched** -- these are appropriate for production

## Estimated scope
- 1 new file created
- ~81 files modified (34 frontend + 47 edge functions)
- No behavioral changes -- only log output affected

