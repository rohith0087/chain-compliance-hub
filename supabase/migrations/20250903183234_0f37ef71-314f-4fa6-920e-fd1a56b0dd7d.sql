-- storage.objects already has RLS enabled by Supabase's storage bootstrap;
-- the local migration role does not own the table, so this ALTER fails
-- locally with "must be owner of table objects" even though it is a no-op.
-- Omitted for local replay; no schema change.

-- Drop any existing policies to avoid naming conflicts (idempotent)
drop policy if exists "allow_buyer_template_uploads" on storage.objects;
drop policy if exists "allow_supplier_uploads" on storage.objects;
drop policy if exists "allow_read_own_objects" on storage.objects;
drop policy if exists "allow_delete_own_objects" on storage.objects;

-- Allow buyers to upload custom templates under: custom-templates/<buyer_id>/...
create policy "allow_buyer_template_uploads"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and name like ('custom-templates/' || (select id::text from public.buyers where profile_id = auth.uid()) || '/%')
  );

-- Allow suppliers to upload documents under: <supplier_id>/...
create policy "allow_supplier_uploads"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and name like ((select id::text from public.suppliers where profile_id = auth.uid()) || '/%')
  );

-- Allow users to read their own objects in the compliance-documents bucket
create policy "allow_read_own_objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and (
      name like ('custom-templates/' || (select id::text from public.buyers where profile_id = auth.uid()) || '/%')
      or
      name like ((select id::text from public.suppliers where profile_id = auth.uid()) || '/%')
    )
  );

-- Allow users to delete their own objects (needed for cleanup if DB insert fails)
create policy "allow_delete_own_objects"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and (
      name like ('custom-templates/' || (select id::text from public.buyers where profile_id = auth.uid()) || '/%')
      or
      name like ((select id::text from public.suppliers where profile_id = auth.uid()) || '/%')
    )
  );