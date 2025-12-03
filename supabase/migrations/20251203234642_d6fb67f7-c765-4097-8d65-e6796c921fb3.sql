-- Phase 1: Update approve_document_request() to allow team members with approval rights
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
  v_has_access boolean := false;
BEGIN
  -- Get the document request details
  SELECT dr.buyer_id, dr.title, s.profile_id
  INTO v_buyer_id, v_document_title, v_supplier_profile_id
  FROM document_requests dr
  JOIN suppliers s ON s.id = dr.supplier_id
  WHERE dr.id = p_request_id;

  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document request not found');
  END IF;

  -- Check if user is company owner
  IF EXISTS (SELECT 1 FROM buyers b WHERE b.id = v_buyer_id AND b.profile_id = auth.uid()) THEN
    v_has_access := true;
  END IF;

  -- Check if user is a team member with approval rights
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
    RETURN jsonb_build_object('success', false, 'error', 'Access denied - insufficient permissions');
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
$function$;

-- Phase 2: Update reject_document_request() to allow team members with approval rights
CREATE OR REPLACE FUNCTION public.reject_document_request(p_request_id uuid, p_reason text)
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
  v_has_access boolean := false;
BEGIN
  -- Get the document request details
  SELECT dr.buyer_id, dr.title, s.profile_id
  INTO v_buyer_id, v_document_title, v_supplier_profile_id
  FROM document_requests dr
  JOIN suppliers s ON s.id = dr.supplier_id
  WHERE dr.id = p_request_id;

  IF v_buyer_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Document request not found');
  END IF;

  -- Check if user is company owner
  IF EXISTS (SELECT 1 FROM buyers b WHERE b.id = v_buyer_id AND b.profile_id = auth.uid()) THEN
    v_has_access := true;
  END IF;

  -- Check if user is a team member with approval/rejection rights
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
    RETURN jsonb_build_object('success', false, 'error', 'Access denied - insufficient permissions');
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
    PERFORM create_notification(
      v_supplier_profile_id,
      'Document Declined',
      CASE 
        WHEN p_reason IS NOT NULL AND p_reason != '' THEN
          'Your document "' || v_document_title || '" has been declined. Reason: ' || p_reason
        ELSE
          'Your document "' || v_document_title || '" has been declined. Please contact the buyer for more details.'
      END,
      'document_declined',
      p_request_id
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Document rejected successfully');
END;
$function$;

-- Phase 3: Update user_has_permission() to add 'approve' permission to document_manager
CREATE OR REPLACE FUNCTION public.user_has_permission(
  p_user_id uuid, 
  p_company_id uuid, 
  p_company_type text, 
  p_permission permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check explicit permissions first
  IF EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = p_user_id 
      AND up.company_id = p_company_id 
      AND up.company_type = p_company_type
      AND up.permission_type = p_permission
      AND (up.expires_at IS NULL OR up.expires_at > now())
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check role-based permissions
  RETURN EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = p_user_id 
      AND cu.company_id = p_company_id 
      AND cu.company_type = p_company_type
      AND cu.status = 'active'
      AND (
        (cu.role = 'company_admin') OR
        (cu.role = 'branch_manager' AND p_permission IN ('read', 'write', 'approve')) OR
        (cu.role = 'document_manager' AND p_permission IN ('read', 'write', 'approve')) OR
        (cu.role = 'approver' AND p_permission IN ('read', 'approve')) OR
        (cu.role = 'viewer' AND p_permission = 'read')
      )
  );
END;
$function$;

-- Phase 4: Update Storage RLS Policy for document downloads
DROP POLICY IF EXISTS "Users can view their own compliance documents" ON storage.objects;

CREATE POLICY "Users can view their own compliance documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents' 
  AND (
    -- Supplier company owner - owns the folder
    (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM suppliers s WHERE s.profile_id = auth.uid()
    )
    -- OR supplier team member
    OR (storage.foldername(name))[1] IN (
      SELECT cu.company_id::text 
      FROM company_users cu 
      WHERE cu.profile_id = auth.uid() 
        AND cu.company_type = 'supplier' 
        AND cu.status = 'active'
    )
    -- OR buyer company owner with connected supplier documents
    OR (storage.foldername(name))[1] IN (
      SELECT s.id::text
      FROM suppliers s
      JOIN document_requests dr ON dr.supplier_id = s.id
      JOIN buyers b ON b.id = dr.buyer_id
      WHERE b.profile_id = auth.uid()
    )
    -- OR buyer team member with connected supplier documents
    OR (storage.foldername(name))[1] IN (
      SELECT s.id::text
      FROM suppliers s
      JOIN document_requests dr ON dr.supplier_id = s.id
      JOIN company_users cu ON cu.company_id = dr.buyer_id
      WHERE cu.profile_id = auth.uid()
        AND cu.company_type = 'buyer'
        AND cu.status = 'active'
    )
    -- OR custom templates folder access for buyers
    OR (
      name LIKE 'custom-templates/%'
      AND (
        EXISTS (
          SELECT 1 FROM buyers b
          WHERE b.profile_id = auth.uid() 
            AND b.id::text = (storage.foldername(name))[2]
        )
        OR EXISTS (
          SELECT 1 FROM company_users cu
          WHERE cu.profile_id = auth.uid()
            AND cu.company_id::text = (storage.foldername(name))[2]
            AND cu.company_type = 'buyer'
            AND cu.status = 'active'
        )
      )
    )
    -- OR buyer corporate documents folder
    OR (
      name LIKE 'buyer-corporate-documents/%'
      AND (
        EXISTS (
          SELECT 1 FROM buyers b
          WHERE b.profile_id = auth.uid() 
            AND b.id::text = (storage.foldername(name))[2]
        )
        OR EXISTS (
          SELECT 1 FROM company_users cu
          WHERE cu.profile_id = auth.uid()
            AND cu.company_id::text = (storage.foldername(name))[2]
            AND cu.company_type = 'buyer'
            AND cu.status = 'active'
        )
      )
    )
  )
);

-- Phase 5: Update custom template upload policy
DROP POLICY IF EXISTS "Buyers custom template upload" ON storage.objects;

CREATE POLICY "Buyers custom template upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compliance-documents' 
  AND name LIKE 'custom-templates/%'
  AND (
    -- Company owner
    EXISTS (
      SELECT 1 FROM buyers b
      WHERE b.profile_id = auth.uid() 
        AND b.id::text = (storage.foldername(name))[2]
    )
    -- OR team member with write access
    OR EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.profile_id = auth.uid()
        AND cu.company_id::text = (storage.foldername(name))[2]
        AND cu.company_type = 'buyer'
        AND cu.status = 'active'
        AND cu.role IN ('company_admin', 'branch_manager', 'document_manager')
    )
  )
);

-- Phase 6: Update custom template delete policy
DROP POLICY IF EXISTS "Buyers custom template delete" ON storage.objects;

CREATE POLICY "Buyers custom template delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'compliance-documents' 
  AND name LIKE 'custom-templates/%'
  AND (
    -- Company owner
    EXISTS (
      SELECT 1 FROM buyers b
      WHERE b.profile_id = auth.uid() 
        AND b.id::text = (storage.foldername(name))[2]
    )
    -- OR team member with write access
    OR EXISTS (
      SELECT 1 FROM company_users cu
      WHERE cu.profile_id = auth.uid()
        AND cu.company_id::text = (storage.foldername(name))[2]
        AND cu.company_type = 'buyer'
        AND cu.status = 'active'
        AND cu.role IN ('company_admin', 'branch_manager', 'document_manager')
    )
  )
);