-- Fix 1: Add RLS policy for buyer team members to update document requests
CREATE POLICY "Buyer team members can update company document requests"
ON document_requests
FOR UPDATE
TO authenticated
USING (
  buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
)
WITH CHECK (
  buyer_id IN (
    SELECT company_id FROM company_users 
    WHERE profile_id = auth.uid() 
    AND company_type = 'buyer' 
    AND status = 'active'
  )
);

-- Fix 2: Update CHECK constraint on document_activity_logs to include 'withdrawn'
ALTER TABLE document_activity_logs 
DROP CONSTRAINT IF EXISTS document_activity_logs_action_type_check;

ALTER TABLE document_activity_logs 
ADD CONSTRAINT document_activity_logs_action_type_check 
CHECK (action_type = ANY (ARRAY[
  'link_created', 
  'link_accessed', 
  'document_viewed', 
  'document_downloaded', 
  'document_approved', 
  'document_declined', 
  'requested', 
  'uploaded', 
  'approved', 
  'rejected', 
  'downloaded',
  'withdrawn'
]));