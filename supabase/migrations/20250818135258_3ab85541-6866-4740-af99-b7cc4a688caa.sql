-- Add RLS policy for buyers to update document_uploads for their requests
CREATE POLICY "Buyers can update document uploads for their requests" 
ON public.document_uploads 
FOR UPDATE 
USING (
  request_id IN (
    SELECT dr.id 
    FROM document_requests dr
    JOIN buyers b ON b.id = dr.buyer_id
    WHERE b.profile_id = auth.uid()
  )
);

-- Create secure function for document approval
CREATE OR REPLACE FUNCTION public.approve_document_request(
  p_request_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id uuid;
  v_supplier_profile_id uuid;
  v_document_title text;
  v_upload_id uuid;
BEGIN
  -- Verify buyer has access to this request
  SELECT dr.buyer_id, dr.title, s.profile_id
  INTO v_buyer_id, v_document_title, v_supplier_profile_id
  FROM document_requests dr
  JOIN suppliers s ON s.id = dr.supplier_id
  JOIN buyers b ON b.id = dr.buyer_id
  WHERE dr.id = p_request_id
    AND b.profile_id = auth.uid();

  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document request not found or access denied');
  END IF;

  -- Get the upload ID
  SELECT id INTO v_upload_id
  FROM document_uploads
  WHERE request_id = p_request_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_upload_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No document upload found for this request');
  END IF;

  -- Update document request status
  UPDATE document_requests
  SET status = 'approved', updated_at = now()
  WHERE id = p_request_id;

  -- Update document upload status
  UPDATE document_uploads
  SET status = 'approved', 
      reviewer_notes = p_notes,
      updated_at = now()
  WHERE id = v_upload_id;

  -- Create notification for supplier
  IF v_supplier_profile_id IS NOT NULL THEN
    PERFORM create_notification(
      v_supplier_profile_id,
      'Document Approved',
      'Your document "' || v_document_title || '" has been approved and meets all requirements.',
      'document_approved',
      p_request_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Document approved successfully');
END;
$$;

-- Create secure function for document rejection
CREATE OR REPLACE FUNCTION public.reject_document_request(
  p_request_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id uuid;
  v_supplier_profile_id uuid;
  v_document_title text;
  v_upload_id uuid;
BEGIN
  -- Verify buyer has access to this request
  SELECT dr.buyer_id, dr.title, s.profile_id
  INTO v_buyer_id, v_document_title, v_supplier_profile_id
  FROM document_requests dr
  JOIN suppliers s ON s.id = dr.supplier_id
  JOIN buyers b ON b.id = dr.buyer_id
  WHERE dr.id = p_request_id
    AND b.profile_id = auth.uid();

  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document request not found or access denied');
  END IF;

  -- Get the upload ID
  SELECT id INTO v_upload_id
  FROM document_uploads
  WHERE request_id = p_request_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_upload_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No document upload found for this request');
  END IF;

  -- Update document request status
  UPDATE document_requests
  SET status = 'rejected', updated_at = now()
  WHERE id = p_request_id;

  -- Update document upload status
  UPDATE document_uploads
  SET status = 'rejected', 
      reviewer_notes = p_reason,
      updated_at = now()
  WHERE id = v_upload_id;

  -- Create notification for supplier
  IF v_supplier_profile_id IS NOT NULL THEN
    DECLARE
      v_message text;
    BEGIN
      v_message := CASE 
        WHEN p_reason IS NOT NULL AND p_reason != '' THEN
          'Your document "' || v_document_title || '" has been declined. Reason: ' || p_reason
        ELSE
          'Your document "' || v_document_title || '" has been declined. Please contact the buyer for more details.'
      END;

      PERFORM create_notification(
        v_supplier_profile_id,
        'Document Declined',
        v_message,
        'document_declined',
        p_request_id
      );
    END;
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Document rejected successfully');
END;
$$;