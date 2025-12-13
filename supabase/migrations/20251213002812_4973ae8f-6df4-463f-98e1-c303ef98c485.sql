CREATE OR REPLACE FUNCTION public.handle_unified_connection_approval(p_connection_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_connection RECORD;
  v_onboarding_request_id UUID;
BEGIN
  -- Get connection details
  SELECT * INTO v_connection
  FROM buyer_supplier_connections
  WHERE id = p_connection_id;

  IF v_connection IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Connection not found');
  END IF;

  -- Validate action
  IF p_action NOT IN ('approved', 'rejected') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action. Must be approved or rejected');
  END IF;

  -- Update the connection status
  UPDATE buyer_supplier_connections
  SET status = p_action,
      notes = p_notes,
      responded_at = now()
  WHERE id = p_connection_id;

  -- If approved, update the onboarding request if exists
  IF p_action = 'approved' AND v_connection.onboarding_request_id IS NOT NULL THEN
    UPDATE supplier_onboarding_requests
    SET status = 'approved',
        updated_at = now()
    WHERE id = v_connection.onboarding_request_id;
  END IF;

  -- If rejected, update the onboarding request if exists
  IF p_action = 'rejected' AND v_connection.onboarding_request_id IS NOT NULL THEN
    UPDATE supplier_onboarding_requests
    SET status = 'rejected',
        updated_at = now()
    WHERE id = v_connection.onboarding_request_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Connection ' || p_action || ' successfully',
    'connection_id', p_connection_id
  );
END;
$function$;