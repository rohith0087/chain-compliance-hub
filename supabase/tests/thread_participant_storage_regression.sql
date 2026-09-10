-- Read-only regression checks against an existing populated project.
-- Requires active members in different threads and an uploaded requested document.
-- Run as postgres; role/JWT changes and temporary tables are rolled back.
BEGIN;
CREATE TEMP TABLE policy_test_context AS
SELECT member.profile_id,
 (SELECT count(*) FROM public.thread_participants target WHERE EXISTS
   (SELECT 1 FROM public.thread_participants own WHERE own.profile_id=member.profile_id AND own.is_active AND own.thread_id=target.thread_id)) AS expected_visible,
 (SELECT count(*) FROM public.thread_participants) AS total_participants
FROM public.thread_participants member WHERE member.is_active ORDER BY member.profile_id LIMIT 1;
GRANT SELECT ON policy_test_context TO authenticated;
CREATE TEMP TABLE storage_test_context AS
SELECT dr.requester_id AS profile_id, o.name
FROM public.document_uploads du
JOIN public.document_requests dr ON dr.id=du.request_id
JOIN storage.objects o ON o.name=du.file_path AND o.bucket_id='compliance-documents'
WHERE dr.requester_id IS NOT NULL LIMIT 1;
GRANT SELECT ON storage_test_context TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',(SELECT profile_id::text FROM policy_test_context),true);
DO $test$ DECLARE actual bigint; expected bigint; total bigint;
BEGIN
 SELECT count(*) INTO actual FROM public.thread_participants;
 SELECT expected_visible,total_participants INTO expected,total FROM policy_test_context;
 IF expected IS NULL OR actual <> expected OR actual=0 OR actual>=total THEN
  RAISE EXCEPTION 'Member visibility test failed: actual %, expected %, total %',actual,expected,total;
 END IF;
END $test$;
SELECT set_config('request.jwt.claim.sub',(SELECT profile_id::text FROM storage_test_context),true);
DO $test$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM storage_test_context) THEN RAISE EXCEPTION 'No storage fixture'; END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='compliance-documents' AND name=(SELECT name FROM storage_test_context)) THEN
 RAISE EXCEPTION 'Authorized document read denied'; END IF;
END $test$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000000',true);
DO $test$ BEGIN
 IF EXISTS(SELECT 1 FROM public.thread_participants) THEN RAISE EXCEPTION 'Nonmember can see participants'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='compliance-documents' AND name=(SELECT name FROM storage_test_context)) THEN RAISE EXCEPTION 'Nonmember can read document'; END IF;
END $test$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $test$ BEGIN
 IF EXISTS(SELECT 1 FROM public.thread_participants) THEN RAISE EXCEPTION 'Anonymous participant access'; END IF;
END $test$;
RESET ROLE;
SELECT 'PASS: member reads, cross-thread isolation, authorized storage read, nonmember and anonymous denial' AS result;
ROLLBACK;
