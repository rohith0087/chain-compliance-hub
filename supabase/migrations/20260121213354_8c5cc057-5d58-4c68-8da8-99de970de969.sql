-- Drop existing policies
DROP POLICY IF EXISTS "Buyers can view submissions for their templates" ON template_submissions;
DROP POLICY IF EXISTS "Buyers can update submission status" ON template_submissions;

-- Create updated SELECT policy that includes company_users
CREATE POLICY "Buyers can view submissions for their templates"
ON template_submissions
FOR SELECT
USING (
  template_id IN (
    SELECT cdt.id
    FROM custom_document_templates cdt
    WHERE cdt.buyer_id IN (
      -- Buyer owner access
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
      UNION
      -- Buyer company user access
      SELECT cu.company_id FROM company_users cu 
      WHERE cu.profile_id = auth.uid() 
        AND cu.company_type = 'buyer' 
        AND cu.status = 'active'
    )
  )
);

-- Create updated UPDATE policy that includes company_users
CREATE POLICY "Buyers can update submission status"
ON template_submissions
FOR UPDATE
USING (
  template_id IN (
    SELECT cdt.id
    FROM custom_document_templates cdt
    WHERE cdt.buyer_id IN (
      -- Buyer owner access
      SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid()
      UNION
      -- Buyer company user access
      SELECT cu.company_id FROM company_users cu 
      WHERE cu.profile_id = auth.uid() 
        AND cu.company_type = 'buyer' 
        AND cu.status = 'active'
    )
  )
);