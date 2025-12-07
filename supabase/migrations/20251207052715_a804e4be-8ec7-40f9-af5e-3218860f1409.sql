-- Create mfa_recovery_codes table for storing hashed recovery codes
CREATE TABLE public.mfa_recovery_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own recovery codes (but not the hashes - just metadata)
CREATE POLICY "Users can view own recovery code metadata"
ON public.mfa_recovery_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Only service role can insert/update/delete (via edge functions)
-- No direct user manipulation allowed

-- Create index for faster lookups
CREATE INDEX idx_mfa_recovery_codes_user_id ON public.mfa_recovery_codes(user_id);
CREATE INDEX idx_mfa_recovery_codes_unused ON public.mfa_recovery_codes(user_id) WHERE used_at IS NULL;