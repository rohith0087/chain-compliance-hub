-- Explicitly keep security-only ledgers inaccessible to browser clients.
create policy "No client access to recipient suppressions"
on public.email_recipient_suppressions
for all to anon, authenticated
using (false)
with check (false);

create policy "No client access to inbound rate events"
on public.inbound_rate_limit_events
for all to anon, authenticated
using (false)
with check (false);

-- Cover Phase 2 foreign keys used by review, identity, and retention operations.
create index if not exists document_review_decisions_buyer_idx
  on public.document_review_decisions(buyer_id);
create index if not exists document_review_decisions_supplier_idx
  on public.document_review_decisions(supplier_id);
create index if not exists document_review_decisions_reviewer_idx
  on public.document_review_decisions(reviewer_id);
create index if not exists document_review_decisions_evidence_version_idx
  on public.document_review_decisions(evidence_version_id);
create index if not exists document_review_decisions_correction_delivery_idx
  on public.document_review_decisions(correction_delivery_id);
create index if not exists supplier_email_identities_profile_idx
  on public.supplier_email_identities(profile_id);
create index if not exists supplier_email_identities_verified_by_idx
  on public.supplier_email_identities(verified_by);
create index if not exists inbound_retention_policies_updated_by_idx
  on public.inbound_retention_policies(updated_by);
