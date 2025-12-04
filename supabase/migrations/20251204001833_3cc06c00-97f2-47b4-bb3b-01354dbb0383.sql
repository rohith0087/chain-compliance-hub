-- Drop the old constraint
ALTER TABLE document_activity_logs 
DROP CONSTRAINT IF EXISTS document_activity_logs_action_type_check;

-- Add updated constraint with all action types
ALTER TABLE document_activity_logs 
ADD CONSTRAINT document_activity_logs_action_type_check 
CHECK (action_type = ANY (ARRAY[
  'link_created'::text, 
  'link_accessed'::text, 
  'document_viewed'::text, 
  'document_downloaded'::text, 
  'document_approved'::text, 
  'document_declined'::text,
  'requested'::text,
  'uploaded'::text,
  'approved'::text,
  'rejected'::text,
  'downloaded'::text
]));