-- Update the create_supplier_to_buyer_connection function to accept both UUID and buyer_id_number
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
  -- First try: Find buyer by buyer_id_number
  SELECT id INTO v_buyer_id
  FROM buyers
  WHERE buyer_id_number = p_buyer_id_number;
  
  -- Second try: If not found by ID number, try to match as UUID
  IF v_buyer_id IS NULL THEN
    BEGIN
      -- Try to cast input as UUID and lookup by id column
      SELECT id INTO v_buyer_id
      FROM buyers
      WHERE id = p_buyer_id_number::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      -- Input is not a valid UUID format, that's fine - just continue with NULL
      v_buyer_id := NULL;
    END;
  END IF;
  
  IF v_buyer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No buyer found with ID: ' || p_buyer_id_number
    );
  END IF;

  -- Get supplier_id from profile_id
  SELECT id INTO v_supplier_id
  FROM suppliers
  WHERE profile_id = p_supplier_profile_id;

  IF v_supplier_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No supplier profile found for this user'
    );
  END IF;

  -- Check if connection already exists
  SELECT id INTO v_existing_connection_id
  FROM buyer_supplier_connections
  WHERE buyer_id = v_buyer_id AND supplier_id = v_supplier_id;

  IF v_existing_connection_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'A connection request already exists with this buyer'
    );
  END IF;

  -- Create the connection request
  INSERT INTO buyer_supplier_connections (
    buyer_id,
    supplier_id,
    status,
    initiated_by,
    notes
  ) VALUES (
    v_buyer_id,
    v_supplier_id,
    'pending',
    'supplier',
    p_notes
  )
  RETURNING id INTO v_connection_id;

  -- Create notification for buyer
  INSERT INTO notifications (user_id, title, message, type, reference_id)
  SELECT 
    b.profile_id,
    'New Connection Request',
    'A supplier has requested to connect with you',
    'connection_request',
    v_connection_id
  FROM buyers b
  WHERE b.id = v_buyer_id AND b.profile_id IS NOT NULL;

  RETURN json_build_object(
    'success', true,
    'connection_id', v_connection_id,
    'message', 'Connection request sent successfully'
  );
END;
$function$;