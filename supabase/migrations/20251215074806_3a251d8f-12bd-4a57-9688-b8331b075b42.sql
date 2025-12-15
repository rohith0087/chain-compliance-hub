-- Add RLS policy for buyers to update onboarding document submissions (approve/reject)
CREATE POLICY "Buyers can update onboarding submissions for review"
ON onboarding_document_submissions
FOR UPDATE
USING (
  onboarding_request_id IN (
    SELECT id FROM supplier_onboarding_requests
    WHERE buyer_id IN (
      -- Company owner
      SELECT id FROM buyers WHERE profile_id = auth.uid()
      UNION
      -- Team members
      SELECT company_id FROM company_users 
      WHERE profile_id = auth.uid() 
      AND company_type = 'buyer' 
      AND status = 'active'
    )
  )
);