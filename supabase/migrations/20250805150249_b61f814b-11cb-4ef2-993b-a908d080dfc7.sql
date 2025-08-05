-- Fix the remaining functions with missing search_path
CREATE OR REPLACE FUNCTION public.supplier_can_view_buyer(buyer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if the current user is a supplier with an approved connection to this buyer
  RETURN EXISTS (
    SELECT 1 
    FROM buyer_supplier_connections bsc
    JOIN suppliers s ON s.id = bsc.supplier_id
    WHERE bsc.buyer_id = supplier_can_view_buyer.buyer_id
      AND s.profile_id = auth.uid()
      AND bsc.status = 'approved'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_supplier_to_buyer_connection(p_buyer_id_number text, p_supplier_profile_id uuid, p_notes text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  -- Find supplier by profile ID
  SELECT id INTO v_supplier_id
  FROM suppliers
  WHERE profile_id = p_supplier_profile_id;
  
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
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;