## Why the Audit Assistant is failing

Both edge functions exist on disk but are **not registered in `supabase/config.toml`**, so they were never deployed. That's why the chat returns "Failed to fetch" and the report button returns "Failed to send a request to the Edge Function".

## Fix + redesign plan

### 1. Deploy the missing edge functions
Add two entries to `supabase/config.toml` so Lovable Cloud actually ships them:
```
[functions.audit-assistant]
[functions.generate-audit-report]
```
(They already validate the JWT in code; default verify_jwt=false is fine.)

### 2. Replace the generic "Sparkles" identity
The agent logo currently uses `lucide-react`'s `Sparkles` (flagged as generic AI). Generate a dedicated **Audit Assistant mark** — a minimalist navy "shield + checkmark + spark" glyph on transparent background — and use it in:
- Header beside the title
- Empty-state hero in the chat pane

### 3. Redesign the page (visual polish only, no behavior change)

**Header**
- Compact 56px bar, brand mark + "Audit Assistant" wordmark, breadcrumb-style client/engagement chips on the right, subtle bottom border.
- Replace the gradient purple "Generate Report" button — switch to a solid `primary` style for consistency with the app.

**Left rail (Context)**
- Rename "Quick prompts" cards into a polished list with:
  - icon per prompt (Compass, FileSearch, ShieldAlert, FilePlus, ListChecks)
  - 2-line layout: bold short title + muted one-line description
  - hover ring + subtle shadow, full-radius cards (not flat borders)
  - section heading "Suggested actions" with helper subtext
- Promote the "Context" card with industry badge and engagement status pill.

**Center chat**
- Wider readable column, message bubbles tuned (assistant: no bg, just markdown; user: primary bubble — already correct).
- Empty state replaced with new logo + 3 starter chips (re-using top 3 quick prompts) horizontally instead of the lonely sparkle.
- Composer: rounded input group, send button inside the textarea (not external), Shift+Enter hint, character of the active client shown as a faint chip above input when set.

**Right rail (Tabs)**
- Tabs styled as segmented control (not pill list), full width.
- Report tab: replace gradient CTA with two cards — "Generate report" (primary action) and "Latest report" (appears after generation with download icon and timestamp).
- Evidence/Findings tabs get a small count badge in the trigger.

**Theme tokens**
- All colors via semantic tokens (`bg-card`, `border-border`, `text-foreground`, `bg-primary`) — drop hardcoded gradients (`from-primary to-primary-glow` purple).

### Files to touch
- `supabase/config.toml` — register 2 functions
- `src/assets/audit-assistant-logo.png` — new generated mark (transparent)
- `src/pages/AuditAssistantPage.tsx` — full UI redesign, swap Sparkles → new logo, restructure quick prompts, polish header/composer/tabs

### Non-goals
- No changes to edge function logic, tools, or PDF content.
- No changes to routing, gating, or data model.
- No new dependencies.
