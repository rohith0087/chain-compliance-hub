-- Create RPC function to send supplier connection request (bypasses RLS to fetch supplier email)
CREATE OR REPLACE FUNCTION public.send_supplier_connection_request(
  p_buyer_id UUID,
  p_supplier_id UUID,
  p_created_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supplier_email TEXT;
  v_supplier_company_name TEXT;
  v_onboarding_request_id UUID;
  v_connection_id UUID;
BEGIN
  -- Fetch supplier details internally (bypasses RLS safely)
  SELECT contact_email, company_name 
  INTO v_supplier_email, v_supplier_company_name
  FROM suppliers 
  WHERE id = p_supplier_id;

  IF v_supplier_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Supplier not found or has no email'
    );
  END IF;

  -- Check if connection already exists
  IF EXISTS (
    SELECT 1 FROM buyer_supplier_connections 
    WHERE buyer_id = p_buyer_id AND supplier_id = p_supplier_id
  ) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Connection request already exists for this supplier'
    );
  END IF;

  -- Create onboarding request
  INSERT INTO supplier_onboarding_requests (
    buyer_id, supplier_id, supplier_email, supplier_company_name,
    status, can_choose_branches, created_by
  ) VALUES (
    p_buyer_id, p_supplier_id, v_supplier_email, v_supplier_company_name,
    'requested', true, p_created_by
  )
  RETURNING id INTO v_onboarding_request_id;

  -- Create connection request
  INSERT INTO buyer_supplier_connections (
    buyer_id, supplier_id, status, initiated_by, onboarding_request_id
  ) VALUES (
    p_buyer_id, p_supplier_id, 'pending', 'buyer', v_onboarding_request_id
  )
  RETURNING id INTO v_connection_id;

  RETURN json_build_object(
    'success', true,
    'onboarding_request_id', v_onboarding_request_id,
    'connection_id', v_connection_id,
    'supplier_company_name', v_supplier_company_name
  );
END;
$$;