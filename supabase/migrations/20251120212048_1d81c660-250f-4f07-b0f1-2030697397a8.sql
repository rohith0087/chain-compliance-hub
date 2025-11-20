-- Function to safely delete branches with validation
CREATE OR REPLACE FUNCTION delete_branch_with_validation(p_branch_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_active_users int;
  v_pending_requests int;
  v_assigned_suppliers int;
  v_branch_name text;
  v_company_id uuid;
  v_company_type text;
BEGIN
  -- Get branch details
  SELECT branch_name, company_id, company_type 
  INTO v_branch_name, v_company_id, v_company_type
  FROM company_branches 
  WHERE id = p_branch_id;
  
  IF v_branch_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'branch_not_found',
      'message', 'Branch not found'
    );
  END IF;
  
  -- Cannot delete Main Office
  IF v_branch_name = 'Main Office' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'cannot_delete_main_office',
      'message', 'Cannot delete the Main Office branch'
    );
  END IF;
  
  -- Check for active users
  SELECT COUNT(*) INTO v_active_users 
  FROM company_users 
  WHERE branch_id = p_branch_id AND status = 'active';
  
  -- Check for pending document requests
  SELECT COUNT(*) INTO v_pending_requests 
  FROM document_requests 
  WHERE branch_id = p_branch_id AND status IN ('pending', 'under_review');
  
  -- Check for assigned suppliers
  SELECT COUNT(*) INTO v_assigned_suppliers 
  FROM branch_supplier_connections 
  WHERE branch_id = p_branch_id AND status = 'active';
  
  -- Validation checks
  IF v_active_users > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'cannot_delete_active_users',
      'message', 'Cannot delete branch with ' || v_active_users || ' active user(s). Please reassign or remove users first.',
      'active_users', v_active_users
    );
  END IF;
  
  IF v_pending_requests > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'cannot_delete_pending_requests',
      'message', 'Cannot delete branch with ' || v_pending_requests || ' pending request(s). Please complete or cancel them first.',
      'pending_requests', v_pending_requests
    );
  END IF;
  
  -- Soft delete or hard delete based on dependencies
  IF v_assigned_suppliers > 0 THEN
    -- Soft delete - keep data but mark inactive
    UPDATE company_branches 
    SET status = 'inactive', updated_at = now()
    WHERE id = p_branch_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'soft_delete',
      'message', 'Branch "' || v_branch_name || '" deactivated (has historical data)',
      'assigned_suppliers', v_assigned_suppliers
    );
  ELSE
    -- Hard delete - no dependencies
    DELETE FROM company_branches WHERE id = p_branch_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'hard_delete',
      'message', 'Branch "' || v_branch_name || '" permanently deleted'
    );
  END IF;
END;
$$;

-- Function to safely remove company users
CREATE OR REPLACE FUNCTION remove_company_user(p_company_user_id uuid, p_force_delete boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_email text;
  v_user_name text;
  v_user_status text;
  v_pending_assignments int;
  v_profile_id uuid;
BEGIN
  -- Get user details
  SELECT 
    cu.profile_id,
    COALESCE(p.email, 'Unknown'),
    COALESCE(p.full_name, 'Unknown User'),
    cu.status
  INTO v_profile_id, v_user_email, v_user_name, v_user_status
  FROM company_users cu
  LEFT JOIN profiles p ON p.id = cu.profile_id
  WHERE cu.id = p_company_user_id;
  
  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', 'User not found'
    );
  END IF;
  
  -- Handle pending invitations differently
  IF v_user_status = 'pending' THEN
    -- Always hard delete pending invitations
    DELETE FROM company_users WHERE id = p_company_user_id;
    
    RETURN jsonb_build_object(
      'success', true,
      'action', 'deleted_invitation',
      'message', 'Pending invitation for ' || v_user_email || ' has been removed'
    );
  END IF;
  
  -- Check for pending assignments (only for active users)
  SELECT COUNT(*) INTO v_pending_assignments
  FROM document_assignments
  WHERE assigned_to = v_profile_id
    AND status IN ('pending', 'in_progress');
  
  -- For active users, check assignments
  IF v_pending_assignments > 0 AND NOT p_force_delete THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'has_pending_assignments',
      'message', 'User has ' || v_pending_assignments || ' pending assignment(s). Please reassign them first or use force delete.',
      'pending_assignments', v_pending_assignments,
      'requires_confirmation', true
    );
  END IF;
  
  -- Soft delete active users (preserve audit trail)
  UPDATE company_users 
  SET status = 'inactive', updated_at = now()
  WHERE id = p_company_user_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'action', 'deactivated',
    'message', 'User "' || v_user_name || '" has been deactivated'
  );
END;
$$;