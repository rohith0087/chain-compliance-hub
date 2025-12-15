-- Update RLS policy on company_branches to include 'partially_approved' status
-- This allows suppliers to view buyer branches when they need to resubmit rejected documents

DROP POLICY IF EXISTS "Suppliers in onboarding can view buyer branches" ON company_branches;

CREATE POLICY "Suppliers in onboarding can view buyer branches"
  ON company_branches
  FOR SELECT
  USING (
    company_type = 'buyer' AND
    EXISTS (
      SELECT 1 FROM supplier_onboarding_requests r
      LEFT JOIN suppliers s ON s.id = r.supplier_id
      LEFT JOIN profiles p ON p.id = auth.uid()
      WHERE r.buyer_id = company_branches.company_id
      AND r.status IN ('pending', 'invited', 'onboarding_initiated', 'under_review', 'partially_approved')
      AND (s.profile_id = auth.uid() OR r.supplier_email = p.email)
    )
  );