-- Fix user deletion to support complete cleanup for pending invitations
-- This allows re-inviting users with the same email after deletion

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
  v_has_data boolean;
BEGIN
  -- Get user details
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

  -- For PENDING invitations: HARD DELETE everything
  IF v_company_user.status = 'pending' THEN
    RAISE LOG 'Hard deleting pending invitation for user: %', v_user_email;
    
    -- Delete from company_users
    DELETE FROM company_users WHERE id = p_company_user_id;
    
    -- Delete from user_roles
    DELETE FROM user_roles WHERE user_id = v_profile_id;
    
    -- Delete from profiles
    DELETE FROM profiles WHERE id = v_profile_id;
    
    -- Signal to delete auth.users via edge function
    RETURN jsonb_build_object(
      'success', true,
      'action', 'hard_delete_required',
      'profile_id', v_profile_id,
      'email', v_user_email,
      'message', 'Pending invitation deleted - email can be reused'
    );
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
    RAISE LOG 'Hard deleting active user without data: %', v_user_email;
    
    DELETE FROM company_users WHERE id = p_company_user_id;
    DELETE FROM user_roles WHERE user_id = v_profile_id;
    DELETE FROM profiles WHERE id = v_profile_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'hard_delete_required',
      'profile_id', v_profile_id,
      'email', v_user_email,
      'message', 'User removed completely - email can be reused'
    );
  END IF;
END;
$$;