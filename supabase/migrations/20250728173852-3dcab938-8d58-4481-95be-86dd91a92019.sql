-- Fix search path security issue for the new function
CREATE OR REPLACE FUNCTION public.create_supplier_to_buyer_connection(
  p_buyer_id_number TEXT,
  p_supplier_profile_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_buyer_id UUID;
  v_supplier_id UUID;
  v_connection_id UUID;
  v_existing_connection_id UUID;
BEGIN
  -- Find buyer by ID number
  SELECT id INTO v_buyer_id
  FROM public.buyers
  WHERE buyer_id_number = p_buyer_id_number;
  
  IF v_buyer_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'No buyer found with ID: ' || p_buyer_id_number
    );
  END IF;
  
  -- Find supplier by profile ID
  SELECT id INTO v_supplier_id
  FROM public.suppliers
  WHERE profile_id = p_supplier_profile_id;
  
  IF v_supplier_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Supplier not found'
    );
  END IF;
  
  -- Check if connection already exists
  SELECT id INTO v_existing_connection_id
  FROM public.buyer_supplier_connections
  WHERE buyer_id = v_buyer_id AND supplier_id = v_supplier_id;
  
  IF v_existing_connection_id IS NOT NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Connection already exists with this buyer'
    );
  END IF;
  
  -- Create the connection
  INSERT INTO public.buyer_supplier_connections (
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
  PERFORM public.create_notification(
    (SELECT profile_id FROM public.buyers WHERE id = v_buyer_id),
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
$$;