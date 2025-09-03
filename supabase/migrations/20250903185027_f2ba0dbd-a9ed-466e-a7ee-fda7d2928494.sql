
-- Ensure RLS is enabled (idempotent)
alter table storage.objects enable row level security;

-- Replace any previous buyer custom-template policies (idempotent)
drop policy if exists "Buyers can upload custom templates" on storage.objects;
drop policy if exists "Buyers can read custom templates" on storage.objects;
drop policy if exists "Buyers can delete custom templates" on storage.objects;

-- Allow authenticated buyers to upload to: compliance-documents/custom-templates/<buyer_id>/...
create policy "Buyers can upload custom templates"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and split_part(objects.name, '/', 1) = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = split_part(objects.name, '/', 2)
    )
  );

-- Allow authenticated buyers to read their custom-template files
create policy "Buyers can read custom templates"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and split_part(objects.name, '/', 1) = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = split_part(objects.name, '/', 2)
    )
  );

-- Allow authenticated buyers to delete their custom-template files
create policy "Buyers can delete custom templates"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'compliance-documents'
    and split_part(objects.name, '/', 1) = 'custom-templates'
    and exists (
      select 1
      from public.buyers b
      where b.profile_id = auth.uid()
        and b.id::text = split_part(objects.name, '/', 2)
    )
  );
