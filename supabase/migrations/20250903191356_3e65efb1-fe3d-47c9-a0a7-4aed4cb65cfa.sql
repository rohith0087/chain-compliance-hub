
-- storage.objects already has RLS enabled by Supabase's storage bootstrap;
-- the local migration role does not own the table, so this ALTER fails
-- locally with "must be owner of table objects" even though it is a no-op.
-- Omitted for local replay; no schema change.

-- Allow suppliers to read only the templates that have been requested from them
drop policy if exists "Suppliers can read requested buyer templates" on storage.objects;

create policy "Suppliers can read requested buyer templates"
on storage.objects
for select
to public
using (
  bucket_id = 'compliance-documents'
  and split_part(name, '/', 1) = 'custom-templates'
  and exists (
    select 1
    from public.suppliers s
    join public.document_requests dr on dr.supplier_id = s.id
    join public.custom_document_templates cdt on cdt.id = dr.custom_template_id
    where s.profile_id = auth.uid()
      and cdt.file_path = name
  )
);
