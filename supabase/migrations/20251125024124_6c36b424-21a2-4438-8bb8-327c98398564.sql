-- Drop the existing restrictive RLS policy that only works for company owners
DROP POLICY IF EXISTS "Buyers can manage their onboarding requests" ON supplier_onboarding_requests;

-- Create new comprehensive policy that allows both company owners AND team members
CREATE POLICY "Buyers and team members can manage their onboarding requests"
ON supplier_onboarding_requests
FOR ALL
USING (
  -- Company owners: their profile_id matches the buyer record
  buyer_id IN (
    SELECT id 
    FROM buyers 
    WHERE profile_id = auth.uid()
  )
  OR
  -- Team members: their profile_id is in company_users with matching company_id
  buyer_id IN (
    SELECT company_id 
    FROM company_users 
    WHERE profile_id = auth.uid() 
      AND company_type = 'buyer' 
      AND status = 'active'
  )
);