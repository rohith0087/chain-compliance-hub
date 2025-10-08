-- Add foreign key constraints to document_assignments table
ALTER TABLE document_assignments
ADD CONSTRAINT fk_assigned_to 
FOREIGN KEY (assigned_to) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

ALTER TABLE document_assignments
ADD CONSTRAINT fk_assigned_by 
FOREIGN KEY (assigned_by) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

ALTER TABLE document_assignments
ADD CONSTRAINT fk_document_upload_id 
FOREIGN KEY (document_upload_id) 
REFERENCES document_uploads(id) 
ON DELETE CASCADE;