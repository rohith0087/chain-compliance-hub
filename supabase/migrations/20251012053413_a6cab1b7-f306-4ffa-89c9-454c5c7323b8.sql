-- Add last_activity_at column to track when session was last used
ALTER TABLE public.chat_sessions 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for faster session queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated 
ON public.chat_sessions(user_id, updated_at DESC);

-- Add trigger to auto-update last_activity_at when messages are added
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_sessions
  SET last_activity_at = now(),
      updated_at = now()
  WHERE id = NEW.session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;

CREATE TRIGGER chat_message_updates_session_activity
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_session_activity();

-- Update existing sessions to have last_activity_at
UPDATE public.chat_sessions
SET last_activity_at = updated_at
WHERE last_activity_at IS NULL;