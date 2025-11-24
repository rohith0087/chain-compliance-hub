-- Create or replace the remove_company_user function to properly handle invitation cancellation
-- This ensures both company_users and user_invitations tables are cleaned up correctly

CREATE OR REPLACE FUNCTION public.remove_company_user(
  p_company_user_id uuid,
  p_force_delete boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_company_user RECORD;
  v_invitation_token text;
  v_pending_assignments int;
  v_deleted_count int;
BEGIN
  -- Get company user details
  SELECT 
    cu.*,
    p.email,
    p.full_name
  INTO v_company_user
  FROM company_users cu
  LEFT JOIN profiles p ON p.id = cu.profile_id
  WHERE cu.id = p_company_user_id;

  IF v_company_user.id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', 'User not found'
    );
  END IF;

  -- Check for pending document assignments if this is an active user
  IF v_company_user.status = 'active' AND NOT p_force_delete THEN
    SELECT COUNT(*) INTO v_pending_assignments
    FROM document_assignments
    WHERE assigned_to = v_company_user.profile_id
      AND status IN ('pending', 'in_progress');

    IF v_pending_assignments > 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'has_pending_assignments',
        'message', 'User has ' || v_pending_assignments || ' pending assignment(s). Please reassign or complete them first.',
        'requires_confirmation', true,
        'pending_assignments', v_pending_assignments
      );
    END IF;
  END IF;

  -- Store invitation token for logging
  v_invitation_token := v_company_user.invitation_token;

  -- CRITICAL: For pending invitations, delete from user_invitations first
  -- This will CASCADE delete the company_users record automatically
  IF v_company_user.status = 'pending' AND v_invitation_token IS NOT NULL THEN
    -- Delete from user_invitations (CASCADE will handle company_users)
    DELETE FROM user_invitations 
    WHERE token = v_invitation_token;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RAISE LOG 'Deleted invitation with token %, CASCADE deleted company_users record. Deleted count: %', 
              v_invitation_token, v_deleted_count;

    RETURN jsonb_build_object(
      'success', true,
      'action', 'deleted_invitation',
      'message', 'Invitation cancelled successfully',
      'email', v_company_user.email,
      'invitation_token', v_invitation_token
    );
  END IF;

  -- For active users or users without invitation tokens
  -- First try to clean up any orphaned user_invitations record
  IF v_invitation_token IS NOT NULL THEN
    DELETE FROM user_invitations 
    WHERE token = v_invitation_token;
    
    RAISE LOG 'Cleaned up invitation token % for active user', v_invitation_token;
  END IF;

  -- Now delete from company_users (soft delete for active users with history)
  IF v_company_user.status = 'active' THEN
    -- Check if user has any historical data (assignments, etc.)
    SELECT COUNT(*) INTO v_pending_assignments
    FROM document_assignments
    WHERE assigned_to = v_company_user.profile_id;

    IF v_pending_assignments > 0 AND NOT p_force_delete THEN
      -- Soft delete: mark as inactive
      UPDATE company_users
      SET status = 'inactive',
          updated_at = now()
      WHERE id = p_company_user_id;

      RAISE LOG 'Soft-deleted active user % with % historical assignments', 
                v_company_user.profile_id, v_pending_assignments;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'soft_deleted',
        'message', 'User deactivated (has historical data)',
        'email', v_company_user.email
      );
    ELSE
      -- Hard delete: no historical data or forced
      DELETE FROM company_users WHERE id = p_company_user_id;

      RAISE LOG 'Hard-deleted active user %', v_company_user.profile_id;

      RETURN jsonb_build_object(
        'success', true,
        'action', 'hard_deleted',
        'message', 'User removed successfully',
        'email', v_company_user.email
      );
    END IF;
  END IF;

  -- Should not reach here, but handle as fallback
  DELETE FROM company_users WHERE id = p_company_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'action', 'deleted',
    'message', 'User removed successfully',
    'email', v_company_user.email
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.remove_company_user(uuid, boolean) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.remove_company_user IS 'Removes a company user with proper cleanup of both company_users and user_invitations tables. For pending invitations, deletes from user_invitations first to leverage CASCADE. For active users, checks for pending assignments and either soft-deletes or hard-deletes based on historical data.';

-- Clean up any existing orphaned records
-- Find and delete orphaned user_invitations (no matching company_users)
WITH orphaned_invitations AS (
  SELECT ui.token
  FROM user_invitations ui
  LEFT JOIN company_users cu ON cu.invitation_token = ui.token
  WHERE cu.id IS NULL
)
DELETE FROM user_invitations
WHERE token IN (SELECT token FROM orphaned_invitations);

-- Log the cleanup
DO $$
DECLARE
  v_orphaned_invitations int;
  v_orphaned_company_users int;
BEGIN
  -- Count would-be orphaned company_users (invitation_token exists but no user_invitations record)
  SELECT COUNT(*) INTO v_orphaned_company_users
  FROM company_users cu
  WHERE cu.invitation_token IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM user_invitations ui 
      WHERE ui.token = cu.invitation_token
    );
  
  IF v_orphaned_company_users > 0 THEN
    RAISE LOG 'Found % orphaned company_users records with missing invitation tokens', v_orphaned_company_users;
  END IF;
END $$;