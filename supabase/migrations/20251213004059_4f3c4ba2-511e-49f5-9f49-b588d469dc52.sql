-- Create the approve_connection_with_onboarding RPC function
CREATE OR REPLACE FUNCTION public.approve_connection_with_onboarding(
  p_connection_id UUID,
  p_onboarding_type TEXT, -- 'default', 'custom', 'none'
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_connection RECORD;
  v_buyer RECORD;
  v_supplier RECORD;
  v_onboarding_request_id UUID;
  v_default_settings RECORD;
BEGIN
  -- Validate onboarding type
  IF p_onboarding_type NOT IN ('default', 'custom', 'none') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid onboarding type. Must be default, custom, or none');
  END IF;

  -- Get connection details
  SELECT * INTO v_connection
  FROM buyer_supplier_connections
  WHERE id = p_connection_id;

  IF v_connection IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connection not found');
  END IF;

  IF v_connection.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connection is not pending');
  END IF;

  -- Get buyer details
  SELECT * INTO v_buyer
  FROM buyers
  WHERE id = v_connection.buyer_id;

  IF v_buyer IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Buyer not found');
  END IF;

  -- Get supplier details
  SELECT * INTO v_supplier
  FROM suppliers
  WHERE id = v_connection.supplier_id;

  IF v_supplier IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Supplier not found');
  END IF;

  -- Handle based on onboarding type
  IF p_onboarding_type = 'none' THEN
    -- Just approve the connection without creating onboarding
    UPDATE buyer_supplier_connections
    SET status = 'approved',
        notes = p_notes,
        responded_at = now()
    WHERE id = p_connection_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', 'Connection approved without onboarding',
      'connection_id', p_connection_id
    );

  ELSIF p_onboarding_type IN ('default', 'custom') THEN
    -- Create onboarding request
    INSERT INTO supplier_onboarding_requests (
      buyer_id,
      supplier_id,
      supplier_email,
      supplier_company_name,
      status,
      can_choose_branches,
      created_by
    ) VALUES (
      v_connection.buyer_id,
      v_connection.supplier_id,
      v_supplier.contact_email,
      v_supplier.company_name,
      CASE WHEN p_onboarding_type = 'custom' THEN 'draft' ELSE 'pending' END,
      true,
      auth.uid()
    )
    RETURNING id INTO v_onboarding_request_id;

    -- If default onboarding, copy default documents and form fields
    IF p_onboarding_type = 'default' THEN
      -- Get default settings
      SELECT * INTO v_default_settings
      FROM buyer_default_onboarding_settings
      WHERE buyer_id = v_connection.buyer_id;

      -- Copy default document requirements
      INSERT INTO onboarding_document_requirements (
        onboarding_request_id,
        document_name,
        document_type,
        is_required,
        description,
        display_order,
        template_file_path,
        template_file_name
      )
      SELECT 
        v_onboarding_request_id,
        document_name,
        document_type,
        is_required,
        description,
        display_order,
        template_file_path,
        template_file_name
      FROM default_document_requirements
      WHERE buyer_id = v_connection.buyer_id
      ORDER BY display_order;

      -- Copy default form fields
      INSERT INTO onboarding_form_fields (
        onboarding_request_id,
        field_label,
        field_type,
        is_required,
        field_order,
        field_options,
        field_category,
        field_description
      )
      SELECT 
        v_onboarding_request_id,
        field_label,
        field_type,
        is_required,
        field_order,
        field_options,
        field_category,
        field_description
      FROM default_form_fields
      WHERE buyer_id = v_connection.buyer_id
      ORDER BY field_order;
    END IF;

    -- Update connection with onboarding request ID and approve
    UPDATE buyer_supplier_connections
    SET status = 'approved',
        notes = p_notes,
        responded_at = now(),
        onboarding_request_id = v_onboarding_request_id
    WHERE id = p_connection_id;

    RETURN jsonb_build_object(
      'success', true,
      'message', CASE 
        WHEN p_onboarding_type = 'default' THEN 'Connection approved with default onboarding'
        ELSE 'Connection approved with custom onboarding draft created'
      END,
      'connection_id', p_connection_id,
      'onboarding_request_id', v_onboarding_request_id
    );
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Unknown error occurred');
END;
$function$;