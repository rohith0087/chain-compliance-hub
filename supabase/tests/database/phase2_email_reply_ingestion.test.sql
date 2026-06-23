begin;
select plan(29);

select has_table('public','inbound_routing_tokens','opaque inbound routing tokens exist');
select has_table('public','inbound_email_messages','inbound message provenance exists');
select has_table('public','inbound_email_attachments','quarantined attachment records exist');
select has_table('public','inbound_processing_jobs','durable inbound processing queue exists');
select has_table('public','inbound_review_decisions','human review audit trail exists');

select ok((select relrowsecurity from pg_class where oid='public.inbound_routing_tokens'::regclass),'routing tokens have RLS');
select ok((select relrowsecurity from pg_class where oid='public.inbound_email_messages'::regclass),'messages have RLS');
select ok((select relrowsecurity from pg_class where oid='public.inbound_email_attachments'::regclass),'attachments have RLS');
select ok((select relrowsecurity from pg_class where oid='public.inbound_processing_jobs'::regclass),'processing jobs have RLS');
select ok((select relrowsecurity from pg_class where oid='public.inbound_review_decisions'::regclass),'review decisions have RLS');

select has_column('public','inbound_routing_tokens','token_hash','routing plaintext is not stored');
select has_column('public','inbound_email_messages','raw_sha256','raw email provenance is hashed');
select has_column('public','inbound_email_messages','match_reasons','deterministic match reasons are retained');
select has_column('public','inbound_email_attachments','scan_status','malware scan state is retained');
select has_column('public','inbound_email_attachments','quarantine_storage_path','quarantine object is isolated');
select has_column('public','inbound_email_attachments','final_evidence_version_id','accepted evidence is traceable');

select has_function('public','claim_inbound_processing_jobs_v1',array['integer'],'inbound jobs claim atomically');
select has_function('public','review_inbound_attachment_v1',array['uuid','uuid','text','uuid','text','text','text'],'review transaction exists');
select ok(not has_function_privilege('authenticated','public.claim_inbound_processing_jobs_v1(integer)','EXECUTE'),'users cannot claim inbound jobs');
select ok(has_function_privilege('service_role','public.claim_inbound_processing_jobs_v1(integer)','EXECUTE'),'processor can claim inbound jobs');
select ok(not has_function_privilege('authenticated','public.review_inbound_attachment_v1(uuid,uuid,text,uuid,text,text,text)','EXECUTE'),'browser cannot forge review acceptance');
select ok(has_function_privilege('service_role','public.review_inbound_attachment_v1(uuid,uuid,text,uuid,text,text,text)','EXECUTE'),'review Edge Function can finalize decisions');

select is((select default_enabled from public.feature_flags where key='email_reply_ingestion_v1'),false,'email reply ingestion defaults off');
select is((select lifecycle from public.feature_flags where key='email_reply_ingestion_v1'),'development','email reply ingestion starts in development');
select ok(exists(select 1 from storage.buckets where id='inbound-email-quarantine' and public=false),'quarantine bucket is private');
select ok(exists(select 1 from storage.buckets where id='inbound-email-provenance' and public=false),'provenance bucket is private');
select ok(not has_table_privilege('authenticated','public.inbound_routing_tokens','SELECT'),'users cannot read routing token hashes');
select ok(has_table_privilege('authenticated','public.inbound_processing_jobs','SELECT'),'platform operations can query processor jobs through RLS');
select ok(not has_table_privilege('anon','public.inbound_email_messages','SELECT'),'anonymous users cannot read inbound messages');

select * from finish();
rollback;
