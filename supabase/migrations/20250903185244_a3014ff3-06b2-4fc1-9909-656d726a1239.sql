-- Create RLS policies for buyer custom template uploads
-- Note: Using the pattern that Supabase allows for storage policies

-- Allow buyers to upload custom templates to compliance-documents/custom-templates/<buyer_id>/
DROP POLICY IF EXISTS "Buyers custom template upload" ON storage.objects;
CREATE POLICY "Buyers custom template upload"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'compliance-documents' 
  AND name LIKE 'custom-templates/%'
  AND EXISTS (
    SELECT 1 FROM buyers 
    WHERE profile_id = auth.uid() 
    AND id::text = split_part(name, '/', 2)
  )
);

-- Allow buyers to read their custom templates
DROP POLICY IF EXISTS "Buyers custom template read" ON storage.objects;
CREATE POLICY "Buyers custom template read"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'compliance-documents' 
  AND name LIKE 'custom-templates/%'
  AND EXISTS (
    SELECT 1 FROM buyers 
    WHERE profile_id = auth.uid() 
    AND id::text = split_part(name, '/', 2)
  )
);

-- Allow buyers to delete their custom templates
DROP POLICY IF EXISTS "Buyers custom template delete" ON storage.objects;
CREATE POLICY "Buyers custom template delete"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'compliance-documents' 
  AND name LIKE 'custom-templates/%'
  AND EXISTS (
    SELECT 1 FROM buyers 
    WHERE profile_id = auth.uid() 
    AND id::text = split_part(name, '/', 2)
  )
);