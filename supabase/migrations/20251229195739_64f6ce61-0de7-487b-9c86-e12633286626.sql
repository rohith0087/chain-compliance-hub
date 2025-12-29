-- Create email_drafts table for persistent draft storage
CREATE TABLE public.email_drafts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  to_email TEXT NOT NULL,
  to_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sender_context TEXT,
  sender_name TEXT,
  sender_company TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 minutes'),
  sent_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.email_drafts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own drafts
CREATE POLICY "Users can view their own drafts"
ON public.email_drafts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create drafts for themselves
CREATE POLICY "Users can create their own drafts"
ON public.email_drafts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own drafts
CREATE POLICY "Users can update their own drafts"
ON public.email_drafts
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own drafts
CREATE POLICY "Users can delete their own drafts"
ON public.email_drafts
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for efficient lookups
CREATE INDEX idx_email_drafts_user_status ON public.email_drafts(user_id, status, expires_at DESC);

COMMENT ON TABLE public.email_drafts IS 'Stores email drafts for the conversational email flow';