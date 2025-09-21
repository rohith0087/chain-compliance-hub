-- Step 1: Create platform admin invitations table
CREATE TABLE IF NOT EXISTS platform_admin_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  invitation_token text NOT NULL UNIQUE,
  platform_roles platform_role[] NOT NULL DEFAULT ARRAY['platform_admin'],
  invited_by uuid REFERENCES platform_administrators(auth_user_id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  is_used boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Step 2: Add security enhancements to platform_administrators
ALTER TABLE platform_administrators 
ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS password_reset_required boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS security_metadata jsonb DEFAULT '{}';

-- Step 3: Create platform admin audit logs table
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

-- Step 4: Enable RLS on new tables
ALTER TABLE platform_admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies for invitations
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

-- Step 6: Create RLS policies for audit logs
CREATE POLICY "Platform admins can view audit logs" ON platform_admin_audit_logs
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM platform_administrators pa
    WHERE pa.auth_user_id = auth.uid()
      AND pa.is_active = true
  )
);

CREATE POLICY "System can insert audit logs" ON platform_admin_audit_logs
FOR INSERT TO authenticated
WITH CHECK (true);

-- Step 7: Function to create platform admin invitation
CREATE OR REPLACE FUNCTION create_platform_admin_invitation(
  p_email text,
  p_roles platform_role[] DEFAULT ARRAY['platform_admin'],
  p_invited_by uuid DEFAULT auth.uid()
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_token text;
  invitation_id uuid;
  inviter_check boolean;
BEGIN
  -- Check if inviter is a super admin
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators pa
    WHERE pa.auth_user_id = p_invited_by
      AND pa.is_active = true
      AND 'super_admin' = ANY(pa.platform_roles)
  ) INTO inviter_check;
  
  IF NOT inviter_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;
  
  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM platform_administrators WHERE email = p_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin with this email already exists');
  END IF;
  
  -- Generate secure token
  invitation_token := encode(gen_random_bytes(32), 'base64');
  
  -- Insert invitation
  INSERT INTO platform_admin_invitations (
    email, invitation_token, platform_roles, invited_by
  ) VALUES (
    p_email, invitation_token, p_roles, p_invited_by
  ) RETURNING id INTO invitation_id;
  
  -- Log the action
  INSERT INTO platform_admin_audit_logs (
    admin_id, action_type, resource_type, resource_id, details
  ) VALUES (
    p_invited_by, 'create_invitation', 'platform_admin_invitation', invitation_id,
    jsonb_build_object('email', p_email, 'roles', p_roles)
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', invitation_id,
    'token', invitation_token,
    'expires_at', (now() + interval '7 days')
  );
END;
$$;

-- Step 8: Function to accept platform admin invitation
CREATE OR REPLACE FUNCTION accept_platform_admin_invitation(
  p_token text,
  p_full_name text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invitation_record record;
  new_admin_id uuid;
  current_user_id uuid;
BEGIN
  -- Get current user
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get invitation details
  SELECT * INTO invitation_record 
  FROM platform_admin_invitations 
  WHERE invitation_token = p_token 
    AND expires_at > now() 
    AND NOT is_used;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Get user email from auth
  DECLARE
    user_email text;
  BEGIN
    SELECT email INTO user_email FROM auth.users WHERE id = current_user_id;
    
    -- Verify email matches invitation
    IF user_email != invitation_record.email THEN
      RETURN jsonb_build_object('success', false, 'error', 'Email mismatch');
    END IF;
  END;
  
  -- Create platform admin record
  INSERT INTO platform_administrators (
    auth_user_id, email, full_name, platform_roles, is_active, created_by
  ) VALUES (
    current_user_id, invitation_record.email, p_full_name, 
    invitation_record.platform_roles, true, invitation_record.invited_by
  ) RETURNING id INTO new_admin_id;
  
  -- Mark invitation as used
  UPDATE platform_admin_invitations 
  SET is_used = true, accepted_at = now(), accepted_by = current_user_id
  WHERE id = invitation_record.id;
  
  -- Log the action
  INSERT INTO platform_admin_audit_logs (
    admin_id, action_type, resource_type, resource_id, details
  ) VALUES (
    current_user_id, 'accept_invitation', 'platform_admin', new_admin_id,
    jsonb_build_object('invitation_id', invitation_record.id)
  );
  
  RETURN jsonb_build_object('success', true, 'admin_id', new_admin_id);
END;
$$;

-- Step 9: Function to get pending invitations
CREATE OR REPLACE FUNCTION get_platform_admin_invitations()
RETURNS TABLE (
  id uuid,
  email text,
  platform_roles platform_role[],
  invited_by_name text,
  expires_at timestamptz,
  created_at timestamptz,
  is_used boolean
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is platform admin
  IF NOT EXISTS (
    SELECT 1 FROM platform_administrators pa
    WHERE pa.auth_user_id = auth.uid() AND pa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;
  
  RETURN QUERY
  SELECT 
    pai.id,
    pai.email,
    pai.platform_roles,
    pa.full_name as invited_by_name,
    pai.expires_at,
    pai.created_at,
    pai.is_used
  FROM platform_admin_invitations pai
  LEFT JOIN platform_administrators pa ON pa.auth_user_id = pai.invited_by
  ORDER BY pai.created_at DESC;
END;
$$;

-- Step 10: Function to revoke invitation
CREATE OR REPLACE FUNCTION revoke_platform_admin_invitation(p_invitation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_check boolean;
BEGIN
  -- Check if user is super admin
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators pa
    WHERE pa.auth_user_id = auth.uid()
      AND pa.is_active = true
      AND 'super_admin' = ANY(pa.platform_roles)
  ) INTO admin_check;
  
  IF NOT admin_check THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;
  
  -- Delete the invitation
  DELETE FROM platform_admin_invitations 
  WHERE id = p_invitation_id AND NOT is_used;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or already used');
  END IF;
  
  -- Log the action
  INSERT INTO platform_admin_audit_logs (
    admin_id, action_type, resource_type, resource_id, details
  ) VALUES (
    auth.uid(), 'revoke_invitation', 'platform_admin_invitation', p_invitation_id,
    jsonb_build_object('action', 'revoked')
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Step 11: Bootstrap function (one-time use)
CREATE OR REPLACE FUNCTION create_bootstrap_super_admin(
  p_email text,
  p_full_name text DEFAULT 'Bootstrap Admin',
  p_temp_password text DEFAULT 'ChangeMe2024!'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  admin_exists boolean;
BEGIN
  -- Check if any super admin already exists
  SELECT EXISTS (
    SELECT 1 FROM platform_administrators 
    WHERE 'super_admin' = ANY(platform_roles) AND is_active = true
  ) INTO admin_exists;
  
  IF admin_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Super admin already exists');
  END IF;
  
  -- Generate new user ID
  new_user_id := gen_random_uuid();
  
  -- Insert into auth.users
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data
  ) VALUES (
    new_user_id,
    p_email,
    crypt(p_temp_password, gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"bootstrap_admin":true}'
  );
  
  -- Insert into platform_administrators
  INSERT INTO platform_administrators (
    auth_user_id,
    email,
    full_name,
    platform_roles,
    is_active,
    created_by,
    must_change_password,
    metadata
  ) VALUES (
    new_user_id,
    p_email,
    p_full_name,
    ARRAY['super_admin']::platform_role[],
    true,
    new_user_id,
    true,
    '{"bootstrap":true,"temp_password":"' || p_temp_password || '"}'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', new_user_id,
    'email', p_email,
    'temp_password', p_temp_password,
    'message', 'Bootstrap super admin created successfully'
  );
END;
$$;