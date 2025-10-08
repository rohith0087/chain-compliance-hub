-- Drop the duplicate foreign key constraint on document_assignments
-- Keep the original document_assignments_document_upload_id_fkey
ALTER TABLE document_assignments
DROP CONSTRAINT IF EXISTS fk_document_upload_id;