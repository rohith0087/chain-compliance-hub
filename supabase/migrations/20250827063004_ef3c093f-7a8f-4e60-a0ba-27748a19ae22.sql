-- Update storage policy to allow suppliers to upload using their company ID
DROP POLICY IF EXISTS "Suppliers can upload documents" ON storage.objects;

-- Create new policy that allows uploads where the folder name matches the supplier's company ID
CREATE POLICY "Suppliers can upload documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'compliance-documents' AND
  EXISTS (
    SELECT 1 FROM suppliers 
    WHERE suppliers.id::text = (storage.foldername(name))[1] 
    AND suppliers.profile_id = auth.uid()
  )
);