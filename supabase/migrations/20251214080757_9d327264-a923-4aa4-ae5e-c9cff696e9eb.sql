-- Phase 1: Add session state and summary columns to chat_sessions
-- These columns enable production-ready context-aware conversations

-- Add summary column for rolling summarization of older messages
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS summary text;

-- Add timestamp to track when summary was last updated
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz;

-- Add state column for structured session state (supplier context, last filters, pending actions)
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS state jsonb DEFAULT '{}'::jsonb;

-- Add index for efficient state queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_state ON chat_sessions USING gin(state);

-- Add index for summary updates
CREATE INDEX IF NOT EXISTS idx_chat_sessions_summary_updated ON chat_sessions(summary_updated_at) WHERE summary IS NOT NULL;

-- Comment explaining the state structure
COMMENT ON COLUMN chat_sessions.state IS 'Structured session state: {current_supplier_name, current_supplier_id, last_filters, pending_action, last_tool}';
COMMENT ON COLUMN chat_sessions.summary IS 'Rolling summary of older conversation messages for context compression';
COMMENT ON COLUMN chat_sessions.summary_updated_at IS 'Timestamp of last summary generation';