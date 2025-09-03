
-- Ensure RLS is enabled (safe if already enabled)
ALTER TABLE public.custom_document_templates ENABLE ROW LEVEL SECURITY;

-- Allow buyers to INSERT their own templates.
-- This complements the existing "manage" policy which lacks a WITH CHECK for INSERT.
CREATE POLICY "Buyers can insert custom templates"
  ON public.custom_document_templates
  FOR INSERT
  WITH CHECK (
    buyer_id IN (
      SELECT id FROM buyers WHERE profile_id = auth.uid()
    )
  );
