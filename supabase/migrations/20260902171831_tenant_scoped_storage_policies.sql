-- ============================================================
-- MIGRATION: Tenant-scoped storage policies
-- Security assessment 2026-09-02 — finding F-05
--
-- communication-attachments
--   * "Users can view comm attachments they have access to" let EVERY signed-in
--     user list and download every attachment (USING was just the bucket id).
--   * "Authenticated users can upload comm attachments" let anyone write anywhere.
--   Files live under <user_id>/...; access now = own folder, or a participant of
--   the thread the attachment belongs to.
--
-- compliance-documents
--   * "Authenticated users can upload to compliance-documents" let any signed-in
--     user write into any tenant's folder. Replaced by a policy that mirrors the
--     paths the app actually writes:
--       <supplier_id>/...                 supplier owner or active member
--       <buyer_id>/...                    buyer owner or active member
--       buyer-<buyer_id>/...              (bulk upload)          buyer side
--       buyers/<buyer_id>/... , spec-uploads/<buyer_id>/...     buyer side
--       <auth.uid()>/...                  personal folder
--     custom-templates/<buyer_id>/... and <onboarding_request_id>/... keep their
--     existing dedicated INSERT policies. Edge functions (service role) bypass RLS.
-- ============================================================

-- ---------- communication-attachments ----------
drop policy if exists "Users can view comm attachments they have access to" on storage.objects;
create policy "Participants can read comm attachments" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'communication-attachments'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1
        from public.message_attachments ma
        join public.communication_messages cm on cm.id = ma.message_id
        join public.thread_participants tp on tp.thread_id = cm.thread_id
        where ma.file_path = objects.name
          and tp.profile_id = auth.uid()
          and tp.is_active
      )
    )
  );

drop policy if exists "Authenticated users can upload comm attachments" on storage.objects;
create policy "Users upload comm attachments into their own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'communication-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- compliance-documents ----------
drop policy if exists "Authenticated users can upload to compliance-documents" on storage.objects;
create policy "Members upload into their own company folders" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'compliance-documents'
    and (
      -- <supplier_id>/...
      (storage.foldername(name))[1] in (
        select s.id::text from public.suppliers s where s.profile_id = auth.uid()
        union
        select cu.company_id::text from public.company_users cu
         where cu.profile_id = auth.uid() and cu.company_type = 'supplier' and cu.status = 'active'
      )
      -- <buyer_id>/...
      or (storage.foldername(name))[1] in (select b.id::text from public.get_user_buyer_ids() as b(id))
      -- buyer-<buyer_id>/...
      or (
        (storage.foldername(name))[1] like 'buyer-%'
        and substring((storage.foldername(name))[1] from 7) in (select b.id::text from public.get_user_buyer_ids() as b(id))
      )
      -- buyers/<buyer_id>/... and spec-uploads/<buyer_id>/...
      or (
        (storage.foldername(name))[1] in ('buyers', 'spec-uploads')
        and (storage.foldername(name))[2] in (select b.id::text from public.get_user_buyer_ids() as b(id))
      )
      -- personal folder
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );
