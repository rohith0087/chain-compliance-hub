-- public.review_document_submission_v2 was declared "security invoker", but
-- its body calls private.review_document_submission_v2(...), and service_role
-- has no direct USAGE grant on schema `private` (by design -- only function
-- owners do). Every caller of this wrapper (the review-document-submission-v2
-- edge function, invoked via the service-role admin client) hit
-- "permission denied for schema private" on every approve/decline, regardless
-- of document source channel. Fix: security definer, matching every other
-- thin RPC wrapper in this codebase.

create or replace function public.review_document_submission_v2(
  p_actor_id uuid,p_request_id uuid,p_upload_id uuid,p_decision text,p_reason_code text,p_reason_notes text,p_idempotency_key text
) returns jsonb language sql security definer set search_path=''
as $$ select private.review_document_submission_v2(p_actor_id,p_request_id,p_upload_id,p_decision,p_reason_code,p_reason_notes,p_idempotency_key) $$;
revoke all on function public.review_document_submission_v2(uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.review_document_submission_v2(uuid,uuid,uuid,text,text,text,text) to service_role;
