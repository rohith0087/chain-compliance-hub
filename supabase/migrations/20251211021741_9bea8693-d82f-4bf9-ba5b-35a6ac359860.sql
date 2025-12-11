-- Add RLS policy for supplier team members to view their company profile
CREATE POLICY "Supplier team members can view company profile" 
ON suppliers FOR SELECT TO authenticated
USING (
  id IN (
    SELECT company_id 
    FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'supplier' 
    AND status = 'active'
  )
);

-- Update create_supplier_to_buyer_connection function to handle team members
CREATE OR REPLACE FUNCTION public.create_supplier_to_buyer_connection(
  p_buyer_id_number text, 
  p_supplier_profile_id uuid, 
  p_notes text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_buyer_id UUID;
  v_supplier_id UUID;
  v_connection_id UUID;
  v_existing_connection_id UUID;
BEGIN
  -- Find buyer by ID number
  SELECT id INTO v_buyer_id
  FROM buyers
  WHERE buyer_id_number = p_buyer_id_number;
  
  IF v_buyer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No buyer found with ID: ' || p_buyer_id_number
    );
  END IF;
  
  -- Find supplier: First check if user owns supplier record directly (company owner)
  SELECT id INTO v_supplier_id
  FROM suppliers
  WHERE profile_id = p_supplier_profile_id;
  
  -- If not found, check if user is a team member
  IF v_supplier_id IS NULL THEN
    SELECT company_id INTO v_supplier_id
    FROM company_users
    WHERE profile_id = p_supplier_profile_id
    AND company_type = 'supplier'
    AND status = 'active';
  END IF;
  
  IF v_supplier_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Supplier not found'
    );
  END IF;
  
  -- Check if connection already exists
  SELECT id INTO v_existing_connection_id
  FROM buyer_supplier_connections
  WHERE buyer_id = v_buyer_id AND supplier_id = v_supplier_id;
  
  IF v_existing_connection_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Connection already exists with this buyer'
    );
  END IF;
  
  -- Create the connection
  INSERT INTO buyer_supplier_connections (
    buyer_id,
    supplier_id,
    status,
    notes,
    initiated_by,
    requested_at
  ) VALUES (
    v_buyer_id,
    v_supplier_id,
    'pending',
    p_notes,
    'supplier',
    now()
  ) RETURNING id INTO v_connection_id;
  
  -- Create notification for buyer
  PERFORM create_notification(
    (SELECT profile_id FROM buyers WHERE id = v_buyer_id),
    'New Connection Request',
    'A supplier has requested to connect with you using your buyer ID.',
    'connection_request',
    v_connection_id
  );
  
  RETURN json_build_object(
    'success', true,
    'connection_id', v_connection_id,
    'message', 'Connection request sent successfully'
  );
END;
$function$;