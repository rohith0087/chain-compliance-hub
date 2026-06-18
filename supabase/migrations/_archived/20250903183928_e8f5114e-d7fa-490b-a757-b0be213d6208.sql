
-- storage.objects already has RLS enabled by Supabase's storage bootstrap;
-- the local migration role does not own the table, so this ALTER fails
-- locally with "must be owner of table objects" even though it is a no-op.
-- Omitted for local replay; no schema change.

-- Drop existing buyer custom-template policies if they exist (idempotent)
drop policy if exists "Buyers can upload custom templates" on storage.objects;
drop policy if exists "Buyers can read custom templates" on storage.objects;
drop policy if exists "Buyers can delete custom templates" on storage.objects;

-- Buyers can upload custom templates under: compliance-documents/custom-templates/<buyer_id>/...
create policy "Buyers can upload custom templates"
  on storage.objects
  for insert
  to public
  with check (
    bucket_id = 'compliance-documents'
    and storage.foldername(name)[1] = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = storage.foldername(name)[2]
    )
  );

-- Buyers can read their custom template files
create policy "Buyers can read custom templates"
  on storage.objects
  for select
  to public
  using (
    bucket_id = 'compliance-documents'
    and storage.foldername(name)[1] = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = storage.foldername(name)[2]
    )
  );

-- Buyers can delete their custom template files (used for cleanup if DB insert fails)
create policy "Buyers can delete custom templates"
  on storage.objects
  for delete
  to public
  using (
    bucket_id = 'compliance-documents'
    and storage.foldername(name)[1] = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = storage.foldername(name)[2]
    )
  );
