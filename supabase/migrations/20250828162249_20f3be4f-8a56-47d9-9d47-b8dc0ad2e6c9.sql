-- Create user_invitations table to track invitation tokens and temporary passwords
CREATE TABLE IF NOT EXISTS public.user_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  company_id UUID NOT NULL,
  company_type TEXT NOT NULL CHECK (company_type IN ('buyer', 'supplier')),
  branch_id UUID,
  role TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  temp_password TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  used_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for user_invitations
CREATE POLICY "Users can view their own invitations" ON public.user_invitations
  FOR SELECT USING (email = auth.email() OR user_id = auth.uid());

CREATE POLICY "System can manage invitations" ON public.user_invitations
  FOR ALL USING (true);

-- Create index for faster token lookups
CREATE INDEX idx_user_invitations_token ON public.user_invitations(token);
CREATE INDEX idx_user_invitations_email ON public.user_invitations(email);
CREATE INDEX idx_user_invitations_expires_at ON public.user_invitations(expires_at);

-- Update company_users table to better track invitation status
ALTER TABLE public.company_users 
ADD COLUMN IF NOT EXISTS invitation_token TEXT,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT false;

-- Create index for faster user lookups
CREATE INDEX IF NOT EXISTS idx_company_users_email_lookup ON public.company_users(profile_id, company_id, company_type);

-- Update the handle_new_user function to better handle invited users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  user_roles user_role[];
  invitation_data RECORD;
BEGIN
  -- Check if this user was invited (has invitation metadata)
  IF NEW.raw_user_meta_data ? 'invite_token' THEN
    -- This is an invited user, get details from invitation
    SELECT company_type, role INTO invitation_data
    FROM user_invitations 
    WHERE token = NEW.raw_user_meta_data->>'invite_token' 
    AND user_id = NEW.id;
    
    IF invitation_data.company_type = 'buyer' THEN
      user_roles := ARRAY['buyer']::user_role[];
    ELSE
      user_roles := ARRAY['supplier']::user_role[];
    END IF;
  ELSE
    -- Regular signup, use provided roles or default to supplier
    IF NEW.raw_user_meta_data ? 'roles' AND NEW.raw_user_meta_data->'roles' IS NOT NULL THEN
      SELECT ARRAY(
        SELECT jsonb_array_elements_text(NEW.raw_user_meta_data->'roles')::user_role
      ) INTO user_roles;
    ELSE
      user_roles := ARRAY['supplier']::user_role[];
    END IF;
  END IF;

  INSERT INTO profiles (id, email, full_name, roles, company_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    user_roles,
    NEW.raw_user_meta_data->>'company_name'
  );
  
  RETURN NEW;
END;
$$;