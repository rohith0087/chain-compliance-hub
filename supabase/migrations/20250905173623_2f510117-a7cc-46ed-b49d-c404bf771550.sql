
-- Ensure bucket exists (idempotent)
insert into storage.buckets (id, name, public)
values ('compliance-documents', 'compliance-documents', false)
on conflict (id) do nothing;

-- Recreate storage policies for onboarding uploads (safer string split instead of storage.foldername)
drop policy if exists "Suppliers can upload onboarding docs" on storage.objects;
drop policy if exists "Suppliers and buyers can view onboarding docs" on storage.objects;
drop policy if exists "Uploaders can delete their onboarding docs" on storage.objects;

create policy "Suppliers can upload onboarding docs"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'compliance-documents'
  and exists (
    select 1
    from public.supplier_onboarding_requests r
    left join public.suppliers s on s.id = r.supplier_id
    left join public.profiles p on p.id = auth.uid()
    -- first path segment must be the onboarding request id
    where r.id::text = split_part(name, '/', 1)
      and (
        s.profile_id = auth.uid()
        or r.supplier_email = p.email
      )
  )
);

create policy "Suppliers and buyers can view onboarding docs"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'compliance-documents'
  and exists (
    select 1
    from public.onboarding_document_submissions sub
    join public.supplier_onboarding_requests r on r.id = sub.onboarding_request_id
    left join public.suppliers s on s.id = r.supplier_id
    left join public.buyers b on b.id = r.buyer_id
    where sub.file_path = name
      and (
        sub.submitted_by = auth.uid()
        or s.profile_id = auth.uid()
        or b.profile_id = auth.uid()
      )
  )
);

create policy "Uploaders can delete their onboarding docs"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'compliance-documents'
  and exists (
    select 1 from public.onboarding_document_submissions sub
    where sub.file_path = name and sub.submitted_by = auth.uid()
  )
);

-- Re-assert onboarding submissions policies to ensure insert/view compatibility
drop policy if exists "Supplier can insert onboarding submissions" on public.onboarding_document_submissions;
drop policy if exists "Supplier and buyer can view onboarding submissions" on public.onboarding_document_submissions;

create policy "Supplier can insert onboarding submissions"
on public.onboarding_document_submissions
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and exists (
    select 1 from public.supplier_onboarding_requests r
    left join public.suppliers s on s.id = r.supplier_id
    left join public.profiles p on p.id = auth.uid()
    where r.id = onboarding_document_submissions.onboarding_request_id
      and (s.profile_id = auth.uid() or r.supplier_email = p.email)
  )
);

create policy "Supplier and buyer can view onboarding submissions"
on public.onboarding_document_submissions
for select
to authenticated
using (
  exists (
    select 1 from public.supplier_onboarding_requests r
    left join public.suppliers s on s.id = r.supplier_id
    left join public.buyers b on b.id = r.buyer_id
    left join public.profiles p on p.id = auth.uid()
    where r.id = onboarding_document_submissions.onboarding_request_id
      and (
        onboarding_document_submissions.submitted_by = auth.uid()
        or s.profile_id = auth.uid()
        or b.profile_id = auth.uid()
        or r.supplier_email = p.email
      )
  )
);
