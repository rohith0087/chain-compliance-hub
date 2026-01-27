-- Create impersonation_logs table for audit tracking
CREATE TABLE public.impersonation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  super_admin_id UUID NOT NULL,
  impersonated_user_id UUID REFERENCES public.profiles(id),
  impersonated_company_id UUID NOT NULL,
  impersonated_company_type TEXT NOT NULL CHECK (impersonated_company_type IN ('buyer', 'supplier')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.impersonation_logs ENABLE ROW LEVEL SECURITY;

-- Only super admins can view impersonation logs
CREATE POLICY "Super admins can view all impersonation logs"
ON public.impersonation_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'platform_admin')
  )
);

-- Only super admins can insert impersonation logs
CREATE POLICY "Super admins can insert impersonation logs"
ON public.impersonation_logs
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'platform_admin')
  )
);

-- Only super admins can update their own impersonation logs (to set ended_at)
CREATE POLICY "Super admins can update their own impersonation logs"
ON public.impersonation_logs
FOR UPDATE
USING (
  super_admin_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'platform_admin')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_impersonation_logs_super_admin ON public.impersonation_logs(super_admin_id);
CREATE INDEX idx_impersonation_logs_active ON public.impersonation_logs(super_admin_id) WHERE ended_at IS NULL;

-- Add comment
COMMENT ON TABLE public.impersonation_logs IS 'Audit log for super admin impersonation sessions';