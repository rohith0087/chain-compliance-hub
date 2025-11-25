-- Drop existing restrictive policies on onboarding_document_requirements
DROP POLICY IF EXISTS "Users can view requirements for accessible requests" 
ON onboarding_document_requirements;

DROP POLICY IF EXISTS "Buyers can manage requirements for their requests" 
ON onboarding_document_requirements;

-- Create comprehensive SELECT policy including team members
CREATE POLICY "Users can view requirements for accessible requests"
ON onboarding_document_requirements
FOR SELECT
USING (
  onboarding_request_id IN (
    SELECT id FROM supplier_onboarding_requests
    WHERE 
      -- Buyer company owners
      buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
      OR
      -- Buyer team members (including company admins)
      buyer_id IN (
        SELECT company_id FROM company_users 
        WHERE profile_id = auth.uid() 
          AND company_type = 'buyer' 
          AND status = 'active'
      )
      OR
      -- Supplier company owners
      supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
      OR
      -- Supplier team members
      supplier_id IN (
        SELECT company_id FROM company_users
        WHERE profile_id = auth.uid()
          AND company_type = 'supplier'
          AND status = 'active'
      )
      OR
      -- Suppliers matching by email (for pending invitations)
      supplier_email = auth.email()
  )
);

-- Create comprehensive ALL policy including team members
CREATE POLICY "Buyers can manage requirements for their requests"
ON onboarding_document_requirements
FOR ALL
USING (
  onboarding_request_id IN (
    SELECT id FROM supplier_onboarding_requests
    WHERE 
      -- Buyer company owners
      buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
      OR
      -- Buyer team members (including company admins)
      buyer_id IN (
        SELECT company_id FROM company_users 
        WHERE profile_id = auth.uid() 
          AND company_type = 'buyer' 
          AND status = 'active'
      )
  )
);

-- Drop existing restrictive policy on onboarding_document_submissions
DROP POLICY IF EXISTS "Users can view submissions for accessible requests" 
ON onboarding_document_submissions;

-- Create comprehensive SELECT policy including team members
CREATE POLICY "Users can view submissions for accessible requests"
ON onboarding_document_submissions
FOR SELECT
USING (
  onboarding_request_id IN (
    SELECT id FROM supplier_onboarding_requests
    WHERE 
      -- Buyer company owners
      buyer_id IN (SELECT id FROM buyers WHERE profile_id = auth.uid())
      OR
      -- Buyer team members (including company admins)
      buyer_id IN (
        SELECT company_id FROM company_users 
        WHERE profile_id = auth.uid() 
          AND company_type = 'buyer' 
          AND status = 'active'
      )
      OR
      -- Supplier company owners
      supplier_id IN (SELECT id FROM suppliers WHERE profile_id = auth.uid())
      OR
      -- Supplier team members
      supplier_id IN (
        SELECT company_id FROM company_users
        WHERE profile_id = auth.uid()
          AND company_type = 'supplier'
          AND status = 'active'
      )
      OR
      -- Suppliers matching by email (for pending invitations)
      supplier_email = auth.email()
  )
);