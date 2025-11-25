-- Drop existing restrictive storage policy
DROP POLICY IF EXISTS "Suppliers and buyers can view onboarding docs" 
ON storage.objects;

-- Create comprehensive policy including team members
CREATE POLICY "Suppliers and buyers can view onboarding docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents' 
  AND EXISTS (
    SELECT 1
    FROM onboarding_document_submissions sub
    JOIN supplier_onboarding_requests r ON r.id = sub.onboarding_request_id
    LEFT JOIN suppliers s ON s.id = r.supplier_id
    LEFT JOIN buyers b ON b.id = r.buyer_id
    WHERE 
      sub.file_path = objects.name
      AND (
        -- Submitted by current user
        sub.submitted_by = auth.uid()
        -- OR supplier company owner
        OR s.profile_id = auth.uid()
        -- OR supplier team member
        OR EXISTS (
          SELECT 1 FROM company_users cu
          WHERE cu.profile_id = auth.uid()
            AND cu.company_id = r.supplier_id
            AND cu.company_type = 'supplier'
            AND cu.status = 'active'
        )
        -- OR buyer company owner
        OR b.profile_id = auth.uid()
        -- OR buyer team member (including company admins)
        OR EXISTS (
          SELECT 1 FROM company_users cu
          WHERE cu.profile_id = auth.uid()
            AND cu.company_id = r.buyer_id
            AND cu.company_type = 'buyer'
            AND cu.status = 'active'
        )
      )
  )
);