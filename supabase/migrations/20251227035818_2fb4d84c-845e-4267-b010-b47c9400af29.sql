-- Create email_audit_logs table for tracking sent compliance emails
CREATE TABLE public.email_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sender_id UUID REFERENCES public.profiles(id),
  sender_email TEXT,
  sender_name TEXT,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body_preview TEXT,
  supplier_id UUID REFERENCES public.suppliers(id),
  buyer_id UUID REFERENCES public.buyers(id),
  action_type TEXT,
  status TEXT DEFAULT 'pending',
  resend_id TEXT,
  error_message TEXT,
  metadata JSONB
);

-- Enable RLS
ALTER TABLE public.email_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view emails they sent
CREATE POLICY "Users can view their sent emails"
ON public.email_audit_logs
FOR SELECT
USING (sender_id = auth.uid());

-- Policy: Users can insert their own email logs
CREATE POLICY "Users can insert their email logs"
ON public.email_audit_logs
FOR INSERT
WITH CHECK (sender_id = auth.uid());

-- Index for faster queries
CREATE INDEX idx_email_audit_logs_sender ON public.email_audit_logs(sender_id);
CREATE INDEX idx_email_audit_logs_supplier ON public.email_audit_logs(supplier_id);
CREATE INDEX idx_email_audit_logs_created ON public.email_audit_logs(created_at DESC);