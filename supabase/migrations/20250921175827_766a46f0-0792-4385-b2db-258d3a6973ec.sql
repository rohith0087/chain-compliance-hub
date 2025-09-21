-- Step 1: Create platform admin invitations table without foreign key first
CREATE TABLE IF NOT EXISTS platform_admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  invitation_token text NOT NULL UNIQUE,
  platform_roles platform_role[] NOT NULL DEFAULT ARRAY['platform_admin'::platform_role],
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  is_used boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Create platform admin audit logs table
CREATE TABLE IF NOT EXISTS platform_admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  action_type text NOT NULL,
  resource_type text,
  resource_id uuid,
  details jsonb DEFAULT '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- Step 3: Enable RLS on new tables
ALTER TABLE platform_admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for invitations
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

-- Step 5: Create RLS policies for audit logs
CREATE POLICY "Platform admins can view audit logs" ON platform_admin_audit_logs
FOR SELECT TO authenticated
USING (is_platform_admin(auth.uid()));

CREATE POLICY "System can insert audit logs" ON platform_admin_audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);