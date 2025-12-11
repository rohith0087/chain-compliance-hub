-- Fix remove_company_user to support dual-role users
-- Only remove the specific company_users record, NOT the entire profile
-- This allows users to have memberships in multiple companies (buyer + supplier)

CREATE OR REPLACE FUNCTION public.remove_company_user(
  p_company_user_id uuid,
  p_force_delete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_user RECORD;
  v_profile_id uuid;
  v_user_email text;
  v_company_type text;
  v_has_data boolean;
  v_remaining_memberships int;
BEGIN
  -- Get user details including company_type
  SELECT cu.*, p.email, p.id as profile_id
  INTO v_company_user
  FROM company_users cu
  LEFT JOIN profiles p ON p.id = cu.profile_id
  WHERE cu.id = p_company_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  v_profile_id := v_company_user.profile_id;
  v_user_email := v_company_user.email;
  v_company_type := v_company_user.company_type;

  -- For PENDING invitations: Check if user has other memberships before full cleanup
  IF v_company_user.status = 'pending' THEN
    RAISE LOG 'Processing pending invitation removal for user: % (company_type: %)', v_user_email, v_company_type;
    
    -- Delete from company_users first
    DELETE FROM company_users WHERE id = p_company_user_id;
    
    -- Check remaining memberships AFTER deletion
    SELECT COUNT(*) INTO v_remaining_memberships
    FROM company_users 
    WHERE profile_id = v_profile_id 
      AND status IN ('active', 'pending');
    
    RAISE LOG 'User % has % remaining memberships after deletion', v_user_email, v_remaining_memberships;
    
    -- Only delete user_roles for this specific company_type
    DELETE FROM user_roles 
    WHERE user_id = v_profile_id 
      AND role = v_company_type::app_role;
    
    -- Update profiles.roles array to remove this role
    UPDATE profiles 
    SET roles = array_remove(roles, v_company_type::user_role)
    WHERE id = v_profile_id;
    
    -- Only delete profile and auth user if NO remaining memberships
    IF v_remaining_memberships = 0 THEN
      DELETE FROM profiles WHERE id = v_profile_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', 'hard_delete_required',
        'profile_id', v_profile_id,
        'email', v_user_email,
        'message', 'Pending invitation deleted - no other memberships, email can be reused'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', true,
        'action', 'membership_removed',
        'profile_id', v_profile_id,
        'remaining_memberships', v_remaining_memberships,
        'message', 'Membership removed - user still has access to other companies'
      );
    END IF;
  END IF;

  -- For ACTIVE users: Check for historical data
  SELECT EXISTS (
    SELECT 1 FROM document_assignments 
    WHERE assigned_to = v_profile_id OR assigned_by = v_profile_id
  ) INTO v_has_data;

  IF v_has_data AND NOT p_force_delete THEN
    -- SOFT DELETE: Just mark inactive
    UPDATE company_users 
    SET status = 'inactive' 
    WHERE id = p_company_user_id;
    
    RAISE LOG 'Soft deleting active user with data: %', v_user_email;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'soft_deleted',
      'message', 'User deactivated (has historical data)'
    );
  ELSE
    -- HARD DELETE for active users without data or forced
    RAISE LOG 'Processing active user removal for: % (company_type: %)', v_user_email, v_company_type;
    
    -- Delete from company_users first
    DELETE FROM company_users WHERE id = p_company_user_id;
    
    -- Check remaining memberships AFTER deletion
    SELECT COUNT(*) INTO v_remaining_memberships
    FROM company_users 
    WHERE profile_id = v_profile_id 
      AND status IN ('active', 'pending');
    
    RAISE LOG 'User % has % remaining memberships after deletion', v_user_email, v_remaining_memberships;
    
    -- Only delete user_roles for this specific company_type
    DELETE FROM user_roles 
    WHERE user_id = v_profile_id 
      AND role = v_company_type::app_role;
    
    -- Update profiles.roles array to remove this role
    UPDATE profiles 
    SET roles = array_remove(roles, v_company_type::user_role)
    WHERE id = v_profile_id;
    
    -- Only delete profile and auth user if NO remaining memberships
    IF v_remaining_memberships = 0 THEN
      DELETE FROM profiles WHERE id = v_profile_id;
      
      RETURN jsonb_build_object(
        'success', true,
        'action', 'hard_delete_required',
        'profile_id', v_profile_id,
        'email', v_user_email,
        'message', 'User removed completely - email can be reused'
      );
    ELSE
      RETURN jsonb_build_object(
        'success', true,
        'action', 'membership_removed',
        'profile_id', v_profile_id,
        'remaining_memberships', v_remaining_memberships,
        'message', 'Membership removed - user still has access to other companies'
      );
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.remove_company_user IS 'Removes a company user with proper support for dual-role users. Only removes the specific company_users record and associated role. Profile and auth user are only deleted if the user has no remaining company memberships.';