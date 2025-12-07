-- Add MFA tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mfa_grace_period_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT false;

-- Create index for grace period queries
CREATE INDEX IF NOT EXISTS idx_profiles_mfa_grace_period 
ON public.profiles(mfa_grace_period_expires_at) 
WHERE mfa_grace_period_expires_at IS NOT NULL;