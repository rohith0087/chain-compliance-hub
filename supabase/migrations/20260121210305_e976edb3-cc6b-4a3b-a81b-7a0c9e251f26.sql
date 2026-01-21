-- Update approve_document_request to handle custom template submissions
CREATE OR REPLACE FUNCTION public.approve_document_request(p_request_id uuid, p_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_buyer_id uuid;
  v_supplier_profile_id uuid;
  v_document_title text;
  v_upload_id uuid;
  v_template_submission_id uuid;
  v_is_custom_template boolean := false;
  v_has_access boolean := false;
BEGIN
  -- Get the document request details including template type
  SELECT dr.buyer_id, dr.title, s.profile_id, 
         (dr.template_type = 'custom') as is_custom
  INTO v_buyer_id, v_document_title, v_supplier_profile_id, v_is_custom_template
  FROM document_requests dr
  JOIN suppliers s ON s.id = dr.supplier_id
  WHERE dr.id = p_request_id;

  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document request not found');
  END IF;

  -- Check if user is the buyer owner
  IF EXISTS (SELECT 1 FROM buyers b WHERE b.id = v_buyer_id AND b.profile_id = auth.uid()) THEN
    v_has_access := true;
  END IF;

  -- Check if user is a company user with approval permissions
  IF NOT v_has_access AND EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = auth.uid()
      AND cu.company_id = v_buyer_id
      AND cu.company_type = 'buyer'
      AND cu.status = 'active'
      AND cu.role IN ('company_admin', 'branch_manager', 'document_manager', 'approver')
  ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Handle custom template submissions
  IF v_is_custom_template THEN
    SELECT id INTO v_template_submission_id
    FROM template_submissions
    WHERE request_id = p_request_id
    ORDER BY submitted_at DESC
    LIMIT 1;

    IF v_template_submission_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No template submission found');
    END IF;

    -- Update template submission status
    UPDATE template_submissions
    SET status = 'approved',
        reviewer_notes = p_notes,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = v_template_submission_id;

  ELSE
    -- Handle regular document uploads (existing logic)
    SELECT id INTO v_upload_id
    FROM document_uploads
    WHERE request_id = p_request_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_upload_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No document upload found');
    END IF;

    UPDATE document_uploads
    SET status = 'approved',
        reviewer_notes = p_notes,
        updated_at = now()
    WHERE id = v_upload_id;
  END IF;

  -- Update document request status
  UPDATE document_requests
  SET status = 'approved', updated_at = now()
  WHERE id = p_request_id;

  -- Create notification for supplier
  IF v_supplier_profile_id IS NOT NULL THEN
    PERFORM create_notification(
      v_supplier_profile_id,
      'Document Approved',
      'Your document "' || v_document_title || '" has been approved.',
      'document_approved',
      p_request_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Document approved successfully');
END;
$function$;

-- Update reject_document_request to handle custom template submissions
CREATE OR REPLACE FUNCTION public.reject_document_request(p_request_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_buyer_id uuid;
  v_supplier_profile_id uuid;
  v_document_title text;
  v_upload_id uuid;
  v_template_submission_id uuid;
  v_is_custom_template boolean := false;
  v_has_access boolean := false;
BEGIN
  -- Get the document request details including template type
  SELECT dr.buyer_id, dr.title, s.profile_id,
         (dr.template_type = 'custom') as is_custom
  INTO v_buyer_id, v_document_title, v_supplier_profile_id, v_is_custom_template
  FROM document_requests dr
  JOIN suppliers s ON s.id = dr.supplier_id
  WHERE dr.id = p_request_id;

  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document request not found');
  END IF;

  -- Check if user is the buyer owner
  IF EXISTS (SELECT 1 FROM buyers b WHERE b.id = v_buyer_id AND b.profile_id = auth.uid()) THEN
    v_has_access := true;
  END IF;

  -- Check if user is a company user with rejection permissions
  IF NOT v_has_access AND EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = auth.uid()
      AND cu.company_id = v_buyer_id
      AND cu.company_type = 'buyer'
      AND cu.status = 'active'
      AND cu.role IN ('company_admin', 'branch_manager', 'document_manager', 'approver')
  ) THEN
    v_has_access := true;
  END IF;

  IF NOT v_has_access THEN
    RETURN jsonb_build_object('success', false, 'error', 'Access denied');
  END IF;

  -- Handle custom template submissions
  IF v_is_custom_template THEN
    SELECT id INTO v_template_submission_id
    FROM template_submissions
    WHERE request_id = p_request_id
    ORDER BY submitted_at DESC
    LIMIT 1;

    IF v_template_submission_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No template submission found');
    END IF;

    -- Update template submission status
    UPDATE template_submissions
    SET status = 'rejected',
        reviewer_notes = p_reason,
        reviewed_at = now(),
        updated_at = now()
    WHERE id = v_template_submission_id;

  ELSE
    -- Handle regular document uploads (existing logic)
    SELECT id INTO v_upload_id
    FROM document_uploads
    WHERE request_id = p_request_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_upload_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'No document upload found');
    END IF;

    UPDATE document_uploads
    SET status = 'rejected',
        reviewer_notes = p_reason,
        updated_at = now()
    WHERE id = v_upload_id;
  END IF;

  -- Update document request status
  UPDATE document_requests
  SET status = 'rejected', updated_at = now()
  WHERE id = p_request_id;

  -- Create notification for supplier
  IF v_supplier_profile_id IS NOT NULL THEN
    PERFORM create_notification(
      v_supplier_profile_id,
      'Document Rejected',
      'Your document "' || v_document_title || '" has been rejected.' || 
        CASE WHEN p_reason IS NOT NULL THEN ' Reason: ' || p_reason ELSE '' END,
      'document_rejected',
      p_request_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Document rejected successfully');
END;
$function$;