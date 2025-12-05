-- Create auth audit logs table for tracking login/logout events
CREATE TABLE public.auth_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  user_email TEXT NOT NULL,
  user_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('login', 'logout', 'signup', 'password_reset')),
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX idx_auth_audit_logs_created_at ON public.auth_audit_logs(created_at DESC);
CREATE INDEX idx_auth_audit_logs_user_id ON public.auth_audit_logs(user_id);
CREATE INDEX idx_auth_audit_logs_action ON public.auth_audit_logs(action);

-- Enable RLS
ALTER TABLE public.auth_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Platform admins can view all auth logs
CREATE POLICY "Platform admins can view auth logs" ON public.auth_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM platform_administrators 
      WHERE auth_user_id = auth.uid() AND is_active = true
    )
  );

-- Policy: Users can insert their own auth logs
CREATE POLICY "Users can insert own auth logs" ON public.auth_audit_logs
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);