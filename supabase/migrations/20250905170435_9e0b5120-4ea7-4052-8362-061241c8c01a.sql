-- Create storage bucket for compliance documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-documents', 'compliance-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for compliance-documents bucket
CREATE POLICY "Authenticated users can upload to compliance-documents"
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (bucket_id = 'compliance-documents');

CREATE POLICY "Users can view their own compliance documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents' AND
  (
    -- Suppliers can view their own uploads
    (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM suppliers s WHERE s.profile_id = auth.uid()
    ) OR
    -- Buyers can view documents from their requests
    (storage.foldername(name))[1] IN (
      SELECT s.id::text 
      FROM suppliers s 
      JOIN document_requests dr ON dr.supplier_id = s.id
      JOIN buyers b ON b.id = dr.buyer_id
      WHERE b.profile_id = auth.uid()
    ) OR
    -- Users can view documents from onboarding requests they're involved in
    (storage.foldername(name))[1] IN (
      SELECT sor.id::text 
      FROM supplier_onboarding_requests sor 
      WHERE sor.supplier_email = auth.email() OR 
            sor.buyer_id IN (SELECT b.id FROM buyers b WHERE b.profile_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can update their own compliance documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'compliance-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM suppliers s WHERE s.profile_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own compliance documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'compliance-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM suppliers s WHERE s.profile_id = auth.uid()
  )
);