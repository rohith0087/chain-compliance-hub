## Changes in `src/pages/ChatPage.tsx`

### 1. Chat History — Clear All button
In the History Sheet header (around line 1434), next to the existing **New** button, add a **Clear All** button (destructive variant, trash icon).

- Opens a confirm dialog ("Delete all chat history? This cannot be undone.").
- On confirm: delete all rows from `chat_sessions` where `user_id = current user` (Supabase), also clears related `chat_messages` if FK cascade isn't set (will check and add a `.delete()` on `chat_messages` by `session_id in (...)` as a safety net).
- After success: `setChatSessions([])`, if the currently open session was deleted call `startNewChat()`, toast "Chat history cleared".
- Button is disabled when `chatSessions.length === 0`.

### 2. Replace third suggested insight with "Today's focus"
In `suggestedInsights` (lines 1409–1413), replace `"Documents frequently missing across suppliers"` with:

```
"What needs my attention today?"
```

The query sent to the agent will be:
> "Give me a snapshot of today: documents expiring today/this week, pending approvals, overdue supplier requests, and the top 3 things I should act on right now."

This reuses the existing `handleQuickAction` flow — the agent already has tools to surface expiring docs, pending items, and overdue requests, so no backend changes are needed.

### Out of scope
- No schema, edge function, or AI prompt changes.
- Other pre-existing TS errors remain untouched.
