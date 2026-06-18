-- storage.objects already has RLS enabled by Supabase's storage bootstrap;
-- the local migration role does not own the table, so this ALTER fails
-- locally with "must be owner of table objects" even though it is a no-op.
-- Omitted for local replay; no schema change.

-- Drop and recreate buyer custom-template policies to fix path checks and allow updates
drop policy if exists "Buyers can upload custom templates" on storage.objects;
drop policy if exists "Buyers can read custom templates" on storage.objects;
drop policy if exists "Buyers can delete custom templates" on storage.objects;
drop policy if exists "Buyers can update custom templates" on storage.objects;

-- INSERT: buyers can upload to compliance-documents/custom-templates/<buyer_id>/...
create policy "Buyers can upload custom templates"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and split_part(name, '/', 1) = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = split_part(name, '/', 2)
    )
  );

-- SELECT: buyers can read their files
create policy "Buyers can read custom templates"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and split_part(name, '/', 1) = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = split_part(name, '/', 2)
    )
  );

-- DELETE: buyers can delete their files
create policy "Buyers can delete custom templates"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and split_part(name, '/', 1) = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = split_part(name, '/', 2)
    )
  );

-- UPDATE: needed when clients use upsert/replace semantics
create policy "Buyers can update custom templates"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and split_part(name, '/', 1) = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = split_part(name, '/', 2)
    )
  )
  with check (
    bucket_id = 'compliance-documents'
    and split_part(name, '/', 1) = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = split_part(name, '/', 2)
    )
  );