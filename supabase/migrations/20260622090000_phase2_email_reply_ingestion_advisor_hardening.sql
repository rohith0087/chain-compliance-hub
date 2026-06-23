-- Phase 2 advisor hardening: cover foreign keys used during review and keep
-- each authenticated SELECT path in one permissive policy per table.

create index if not exists inbound_routing_tokens_buyer_idx
  on public.inbound_routing_tokens(buyer_id);
create index if not exists inbound_routing_tokens_supplier_idx
  on public.inbound_routing_tokens(supplier_id);

create index if not exists inbound_messages_sender_profile_idx
  on public.inbound_email_messages(sender_profile_id);
create index if not exists inbound_messages_routing_token_idx
  on public.inbound_email_messages(routing_token_id);
create index if not exists inbound_messages_candidate_supplier_idx
  on public.inbound_email_messages(candidate_supplier_id);

create index if not exists inbound_attachments_duplicate_asset_idx
  on public.inbound_email_attachments(duplicate_document_asset_id);
create index if not exists inbound_attachments_proposed_request_idx
  on public.inbound_email_attachments(proposed_request_id);
create index if not exists inbound_attachments_final_upload_idx
  on public.inbound_email_attachments(final_document_upload_id);
create index if not exists inbound_attachments_final_evidence_version_idx
  on public.inbound_email_attachments(final_evidence_version_id);

create index if not exists inbound_review_decisions_message_idx
  on public.inbound_review_decisions(message_id);
create index if not exists inbound_review_decisions_attachment_idx
  on public.inbound_review_decisions(attachment_id);
create index if not exists inbound_review_decisions_reviewer_idx
  on public.inbound_review_decisions(reviewer_id);
create index if not exists inbound_review_decisions_buyer_idx
  on public.inbound_review_decisions(buyer_id);
create index if not exists inbound_review_decisions_request_idx
  on public.inbound_review_decisions(selected_request_id);

drop policy if exists "Buyer reviewers can read matched inbound messages" on public.inbound_email_messages;
drop policy if exists "Platform admins can read quarantined inbound messages" on public.inbound_email_messages;
create policy "Authorized reviewers can read inbound messages"
on public.inbound_email_messages for select to authenticated
using (
  (candidate_buyer_id is not null and private.has_organization_access((select auth.uid()),candidate_buyer_id,'buyer'))
  or exists (
    select 1 from public.platform_administrators pa
    where pa.auth_user_id=(select auth.uid()) and pa.is_active
  )
);

drop policy if exists "Buyer reviewers can read inbound attachments" on public.inbound_email_attachments;
drop policy if exists "Platform admins can read quarantined inbound attachments" on public.inbound_email_attachments;
create policy "Authorized reviewers can read inbound attachments"
on public.inbound_email_attachments for select to authenticated
using (
  exists (
    select 1 from public.inbound_email_messages m
    where m.id=message_id
      and m.candidate_buyer_id is not null
      and private.has_organization_access((select auth.uid()),m.candidate_buyer_id,'buyer')
  )
  or exists (
    select 1 from public.platform_administrators pa
    where pa.auth_user_id=(select auth.uid()) and pa.is_active
  )
);

drop policy if exists "Buyer reviewers can read inbound decisions" on public.inbound_review_decisions;
drop policy if exists "Platform admins can read quarantine decisions" on public.inbound_review_decisions;
create policy "Authorized reviewers can read inbound decisions"
on public.inbound_review_decisions for select to authenticated
using (
  (buyer_id is not null and private.has_organization_access((select auth.uid()),buyer_id,'buyer'))
  or exists (
    select 1 from public.platform_administrators pa
    where pa.auth_user_id=(select auth.uid()) and pa.is_active
  )
);
