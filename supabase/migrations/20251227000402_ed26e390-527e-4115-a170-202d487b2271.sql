-- Add sample document columns to document_requests table
ALTER TABLE public.document_requests 
ADD COLUMN IF NOT EXISTS sample_file_path TEXT,
ADD COLUMN IF NOT EXISTS sample_file_name TEXT,
ADD COLUMN IF NOT EXISTS sample_file_size INTEGER,
ADD COLUMN IF NOT EXISTS sample_mime_type TEXT,
ADD COLUMN IF NOT EXISTS sample_uploaded_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS sample_uploaded_at TIMESTAMPTZ;

-- Create index for sample file lookup
CREATE INDEX IF NOT EXISTS idx_document_requests_sample_file 
ON public.document_requests(sample_file_path) 
WHERE sample_file_path IS NOT NULL;

-- Create sample-documents storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('sample-documents', 'sample-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Buyers can upload/manage samples for their requests
CREATE POLICY "Buyers can manage sample documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'sample-documents' AND
  EXISTS (
    SELECT 1 FROM buyers b
    WHERE b.profile_id = auth.uid()
    AND (storage.foldername(name))[1] = b.id::text
  )
)
WITH CHECK (
  bucket_id = 'sample-documents' AND
  EXISTS (
    SELECT 1 FROM buyers b
    WHERE b.profile_id = auth.uid()
    AND (storage.foldername(name))[1] = b.id::text
  )
);

-- Storage policy: Buyer team members can manage sample documents
CREATE POLICY "Buyer team members can manage sample documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'sample-documents' AND
  EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = auth.uid()
    AND cu.company_type = 'buyer'
    AND cu.status = 'active'
    AND (storage.foldername(name))[1] = cu.company_id::text
  )
)
WITH CHECK (
  bucket_id = 'sample-documents' AND
  EXISTS (
    SELECT 1 FROM company_users cu
    WHERE cu.profile_id = auth.uid()
    AND cu.company_type = 'buyer'
    AND cu.status = 'active'
    AND (storage.foldername(name))[1] = cu.company_id::text
  )
);

-- Storage policy: Suppliers can view samples for their assigned requests
CREATE POLICY "Suppliers can view sample documents for their requests"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'sample-documents' AND
  EXISTS (
    SELECT 1 FROM document_requests dr
    JOIN suppliers s ON dr.supplier_id = s.id
    WHERE s.profile_id = auth.uid()
    AND dr.sample_file_path = name
  )
);

-- Storage policy: Supplier team members can view samples for their company's requests
CREATE POLICY "Supplier team members can view sample documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'sample-documents' AND
  EXISTS (
    SELECT 1 FROM document_requests dr
    JOIN company_users cu ON dr.supplier_id = cu.company_id
    WHERE cu.profile_id = auth.uid()
    AND cu.company_type = 'supplier'
    AND cu.status = 'active'
    AND dr.sample_file_path = name
  )
);