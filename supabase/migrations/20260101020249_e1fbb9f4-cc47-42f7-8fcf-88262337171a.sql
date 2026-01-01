-- Create ticket_responses table for conversation threads
CREATE TABLE IF NOT EXISTS public.ticket_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id),
  author_type TEXT NOT NULL CHECK (author_type IN ('user', 'support')),
  author_name TEXT,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  attachments JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add has_unread_response column to support_tickets for user notification
ALTER TABLE public.support_tickets 
ADD COLUMN IF NOT EXISTS has_unread_response BOOLEAN DEFAULT false;

-- Enable RLS on ticket_responses
ALTER TABLE public.ticket_responses ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors on re-run)
DROP POLICY IF EXISTS "Users can view responses on their tickets" ON public.ticket_responses;
DROP POLICY IF EXISTS "Users can create responses on their tickets" ON public.ticket_responses;

-- RLS: Users can view responses on their own tickets OR platform admins can view all
CREATE POLICY "Users can view responses on their tickets"
ON public.ticket_responses
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = ticket_responses.ticket_id
    AND st.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.platform_administrators pa
    WHERE pa.auth_user_id = auth.uid()
    AND pa.is_active = true
  )
);

-- RLS: Users can create responses on their own tickets OR platform admins can create
CREATE POLICY "Users can create responses on their tickets"
ON public.ticket_responses
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = ticket_responses.ticket_id
    AND st.user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM public.platform_administrators pa
    WHERE pa.auth_user_id = auth.uid()
    AND pa.is_active = true
  )
);

-- Enable realtime for ticket_responses (ignore error if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_responses;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;