-- Step 1: First, let's check if platform_role enum exists, if not create it
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
    CREATE TYPE platform_role AS ENUM ('super_admin', 'platform_admin', 'support_admin');
  END IF;
END $$;

-- Step 2: Create platform admin invitations table with proper enum casting
CREATE TABLE IF NOT EXISTS platform_admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  invitation_token text NOT NULL UNIQUE,
  platform_roles platform_role[] NOT NULL DEFAULT ARRAY['platform_admin'::platform_role],
  invited_by uuid REFERENCES platform_administrators(auth_user_id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  is_used boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 3: Add security enhancements to platform_administrators
ALTER TABLE platform_administrators 
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS password_reset_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS security_metadata jsonb DEFAULT '{}';

-- Step 4: Create platform admin audit logs table
CREATE TABLE IF NOT EXISTS platform_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES platform_administrators(auth_user_id),
  action_type text NOT NULL,
  resource_type text,
  resource_id uuid,
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Step 5: Enable RLS on new tables
ALTER TABLE platform_admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 6: Create function to check if user is platform admin
CREATE OR REPLACE FUNCTION is_platform_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators 
    WHERE auth_user_id = user_id 
    AND is_active = true
  );
$$;

-- Step 7: Create RLS policies for invitations
CREATE POLICY "Platform admins can manage invitations" ON platform_admin_invitations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_administrators pa
    WHERE pa.auth_user_id = auth.uid()
      AND pa.is_active = true
      AND 'super_admin' = ANY(pa.platform_roles)
  )
);

-- Step 8: Create RLS policies for audit logs
CREATE POLICY "Platform admins can view audit logs" ON platform_admin_audit_logs
FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "System can insert audit logs" ON platform_admin_audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);