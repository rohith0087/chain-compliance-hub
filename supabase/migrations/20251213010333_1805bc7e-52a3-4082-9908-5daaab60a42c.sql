-- Allow suppliers to read templates from onboarding requirements
DROP POLICY IF EXISTS "Suppliers can read onboarding templates" ON storage.objects;

CREATE POLICY "Suppliers can read onboarding templates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND split_part(name, '/', 1) = 'custom-templates'
  AND EXISTS (
    SELECT 1
    FROM public.suppliers s
    JOIN public.supplier_onboarding_requests sor ON sor.supplier_id = s.id
    JOIN public.onboarding_document_requirements odr ON odr.onboarding_request_id = sor.id
    WHERE s.profile_id = auth.uid()
      AND odr.template_file_path = name
  )
);