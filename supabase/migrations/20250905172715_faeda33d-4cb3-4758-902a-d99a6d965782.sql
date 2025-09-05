-- Create bucket for onboarding compliance documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('compliance-documents', 'compliance-documents', false)
ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES: onboarding documents visibility and upload
-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Suppliers can upload onboarding docs" ON storage.objects;
DROP POLICY IF EXISTS "Suppliers and buyers can view onboarding docs" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can delete their onboarding docs" ON storage.objects;

-- Allow suppliers (by auth uid or email) involved in an onboarding request to upload files to a path that starts with that request id
CREATE POLICY "Suppliers can upload onboarding docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'compliance-documents'
  AND EXISTS (
    SELECT 1
    FROM public.supplier_onboarding_requests r
    LEFT JOIN public.suppliers s ON s.id = r.supplier_id
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE r.id::text = (storage.foldername(name))[1]
      AND (
        s.profile_id = auth.uid()
        OR r.supplier_email = p.email
      )
  )
);

-- Allow suppliers and buyers involved in the onboarding request to read the uploaded objects
CREATE POLICY "Suppliers and buyers can view onboarding docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND EXISTS (
    SELECT 1
    FROM public.onboarding_document_submissions sub
    JOIN public.supplier_onboarding_requests r ON r.id = sub.onboarding_request_id
    LEFT JOIN public.suppliers s ON s.id = r.supplier_id
    LEFT JOIN public.buyers b ON b.id = r.buyer_id
    WHERE sub.file_path = name
      AND (
        sub.submitted_by = auth.uid()
        OR s.profile_id = auth.uid()
        OR b.profile_id = auth.uid()
      )
  )
);

-- Optional: allow uploader to delete/replace their own files
CREATE POLICY "Uploaders can delete their onboarding docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'compliance-documents'
  AND EXISTS (
    SELECT 1 FROM public.onboarding_document_submissions sub
    WHERE sub.file_path = name AND sub.submitted_by = auth.uid()
  )
);

-- COMPANY BRANCHES RLS: allow suppliers in onboarding context to view buyer branches
-- Drop existing policy first
DROP POLICY IF EXISTS "Suppliers in onboarding can view buyer branches" ON public.company_branches;

CREATE POLICY "Suppliers in onboarding can view buyer branches"
ON public.company_branches
FOR SELECT
TO authenticated
USING (
  company_type = 'buyer'
  AND EXISTS (
    SELECT 1
    FROM public.supplier_onboarding_requests r
    LEFT JOIN public.suppliers s ON s.id = r.supplier_id
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE r.buyer_id = company_branches.company_id
      AND r.status IN ('pending','onboarding_initiated','under_review')
      AND (
        s.profile_id = auth.uid() OR r.supplier_email = p.email
      )
  )
);

-- ONBOARDING DOCUMENT SUBMISSIONS RLS
-- Drop existing policies first
DROP POLICY IF EXISTS "Supplier can insert onboarding submissions" ON public.onboarding_document_submissions;
DROP POLICY IF EXISTS "Supplier and buyer can view onboarding submissions" ON public.onboarding_document_submissions;

-- Suppliers can insert their own submissions for requests they are attached to (by profile or email)
CREATE POLICY "Supplier can insert onboarding submissions"
ON public.onboarding_document_submissions
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.supplier_onboarding_requests r
    LEFT JOIN public.suppliers s ON s.id = r.supplier_id
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE r.id = onboarding_document_submissions.onboarding_request_id
      AND (
        s.profile_id = auth.uid() OR r.supplier_email = p.email
      )
  )
);

-- Suppliers and buyer can view submissions for requests they are attached to
CREATE POLICY "Supplier and buyer can view onboarding submissions"
ON public.onboarding_document_submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.supplier_onboarding_requests r
    LEFT JOIN public.suppliers s ON s.id = r.supplier_id
    LEFT JOIN public.buyers b ON b.id = r.buyer_id
    LEFT JOIN public.profiles p ON p.id = auth.uid()
    WHERE r.id = onboarding_document_submissions.onboarding_request_id
      AND (
        onboarding_document_submissions.submitted_by = auth.uid()
        OR s.profile_id = auth.uid()
        OR b.profile_id = auth.uid()
        OR r.supplier_email = p.email
      )
  )
);