-- Phase 1: Add onboarding_request_id to buyer_supplier_connections
ALTER TABLE buyer_supplier_connections 
ADD COLUMN onboarding_request_id uuid REFERENCES supplier_onboarding_requests(id);

-- Phase 2: Create temporary_branch_selections table
CREATE TABLE temporary_branch_selections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  onboarding_request_id uuid NOT NULL REFERENCES supplier_onboarding_requests(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES company_branches(id),
  selected_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on temporary_branch_selections
ALTER TABLE temporary_branch_selections ENABLE ROW LEVEL SECURITY;

-- RLS policies for temporary_branch_selections
CREATE POLICY "Suppliers can manage their temporary branch selections"
ON temporary_branch_selections
FOR ALL
USING (selected_by = auth.uid());

CREATE POLICY "Users can view temporary selections for accessible requests"
ON temporary_branch_selections 
FOR SELECT
USING (onboarding_request_id IN (
  SELECT supplier_onboarding_requests.id
  FROM supplier_onboarding_requests
  WHERE (supplier_onboarding_requests.buyer_id IN (
    SELECT buyers.id FROM buyers WHERE buyers.profile_id = auth.uid()
  )) OR (supplier_onboarding_requests.supplier_id IN (
    SELECT suppliers.id FROM suppliers WHERE suppliers.profile_id = auth.uid()
  )) OR (supplier_onboarding_requests.supplier_email = auth.email())
));

-- Phase 3: Create function to handle unified connection approval
CREATE OR REPLACE FUNCTION handle_unified_connection_approval(
  p_connection_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_connection buyer_supplier_connections%ROWTYPE;
  v_buyer_profile_id uuid;
  v_supplier_profile_id uuid;
  v_onboarding_request_id uuid;
  v_message text;
BEGIN
  -- Get connection details
  SELECT * INTO v_connection
  FROM buyer_supplier_connections
  WHERE id = p_connection_id;
  
  IF v_connection.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connection not found');
  END IF;
  
  -- Get profile IDs
  SELECT profile_id INTO v_buyer_profile_id
  FROM buyers WHERE id = v_connection.buyer_id;
  
  SELECT profile_id INTO v_supplier_profile_id
  FROM suppliers WHERE id = v_connection.supplier_id;
  
  -- Update connection status
  UPDATE buyer_supplier_connections
  SET status = p_action,
      notes = p_notes,
      updated_at = now()
  WHERE id = p_connection_id;
  
  IF p_action = 'approved' THEN
    -- Create onboarding request automatically
    INSERT INTO supplier_onboarding_requests (
      buyer_id,
      supplier_id,
      supplier_email,
      supplier_company_name,
      status,
      created_by,
      custom_message
    )
    SELECT 
      v_connection.buyer_id,
      v_connection.supplier_id,
      s.contact_email,
      s.company_name,
      'pending',
      v_buyer_profile_id,
      'Auto-generated onboarding request from approved connection'
    FROM suppliers s
    WHERE s.id = v_connection.supplier_id
    RETURNING id INTO v_onboarding_request_id;
    
    -- Link the onboarding request to the connection
    UPDATE buyer_supplier_connections
    SET onboarding_request_id = v_onboarding_request_id
    WHERE id = p_connection_id;
    
    -- Create notification for supplier
    v_message := 'Your connection request has been approved. Please complete the onboarding process.';
    PERFORM create_notification(
      v_supplier_profile_id,
      'Connection Approved - Onboarding Required',
      v_message,
      'onboarding_request',
      v_onboarding_request_id
    );
    
  ELSIF p_action = 'rejected' THEN
    -- Create notification for supplier
    v_message := CASE 
      WHEN p_notes IS NOT NULL AND p_notes != '' THEN
        'Your connection request has been declined. Reason: ' || p_notes
      ELSE
        'Your connection request has been declined.'
    END;
    
    PERFORM create_notification(
      v_supplier_profile_id,
      'Connection Request Declined',
      v_message,
      'connection_declined',
      p_connection_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Connection ' || p_action || ' successfully',
    'onboarding_request_id', v_onboarding_request_id
  );
END;
$$;

-- Phase 4: Create function to finalize onboarding approval
CREATE OR REPLACE FUNCTION finalize_onboarding_approval(
  p_onboarding_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_request supplier_onboarding_requests%ROWTYPE;
  v_supplier_profile_id uuid;
  v_temp_selection_count integer;
BEGIN
  -- Get onboarding request details
  SELECT * INTO v_request
  FROM supplier_onboarding_requests
  WHERE id = p_onboarding_request_id;
  
  IF v_request.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Onboarding request not found');
  END IF;
  
  -- Get supplier profile ID
  SELECT profile_id INTO v_supplier_profile_id
  FROM suppliers WHERE id = v_request.supplier_id;
  
  -- Update onboarding request status
  UPDATE supplier_onboarding_requests
  SET status = 'approved',
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  WHERE id = p_onboarding_request_id;
  
  -- Move temporary branch selections to permanent connections
  INSERT INTO branch_supplier_connections (
    branch_id,
    supplier_id,
    buyer_id,
    assigned_by,
    notes
  )
  SELECT 
    tbs.branch_id,
    v_request.supplier_id,
    v_request.buyer_id,
    auth.uid(),
    'Auto-assigned from approved onboarding'
  FROM temporary_branch_selections tbs
  WHERE tbs.onboarding_request_id = p_onboarding_request_id
  ON CONFLICT (branch_id, supplier_id) DO NOTHING;
  
  -- Get count of assignments made
  SELECT COUNT(*) INTO v_temp_selection_count
  FROM temporary_branch_selections
  WHERE onboarding_request_id = p_onboarding_request_id;
  
  -- Clean up temporary selections
  DELETE FROM temporary_branch_selections
  WHERE onboarding_request_id = p_onboarding_request_id;
  
  -- Create notification for supplier
  IF v_supplier_profile_id IS NOT NULL THEN
    PERFORM create_notification(
      v_supplier_profile_id,
      'Onboarding Approved',
      'Your onboarding has been approved! You can now receive document requests.',
      'onboarding_approved',
      p_onboarding_request_id
    );
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Onboarding approved successfully',
    'branch_assignments', v_temp_selection_count
  );
END;
$$;