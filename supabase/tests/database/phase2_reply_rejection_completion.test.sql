begin;
select plan(30);

select has_column('public','document_requests','public_reference','requests have stable public references');
select has_column('public','document_uploads','source_channel','uploads record their ingestion channel');
select has_column('public','document_uploads','source_reference_id','uploads link to their source attachment');
select has_column('public','inbound_routing_tokens','recipient_email','routing tokens are recipient scoped');
select has_column('public','inbound_routing_tokens','superseded_at','routing token rotation is auditable');
select has_column('public','inbound_email_messages','content_purged_at','message purge is tombstoned');
select has_column('public','inbound_email_attachments','content_purged_at','attachment purge is tombstoned');
select has_column('public','inbound_email_attachments','legal_hold','attachment legal hold exists');

select has_table('public','document_review_decisions','append-only document review decisions exist');
select has_table('public','supplier_email_identities','verified supplier mailboxes exist');
select has_table('public','email_recipient_suppressions','recipient suppression ledger exists');
select has_table('public','inbound_retention_policies','inbound retention policy exists');
select has_table('public','inbound_rate_limit_events','inbound rate-limit evidence exists');
select has_table('public','inbound_operational_alerts','inbound operational alerts exist');

select ok((select relrowsecurity from pg_class where oid='public.document_review_decisions'::regclass),'review decisions have RLS');
select ok((select relrowsecurity from pg_class where oid='public.supplier_email_identities'::regclass),'supplier identities have RLS');
select ok((select relrowsecurity from pg_class where oid='public.email_recipient_suppressions'::regclass),'suppressions have RLS');
select ok(not has_table_privilege('anon','public.document_review_decisions','SELECT'),'anonymous users cannot read review decisions');
select ok(not has_table_privilege('authenticated','public.email_recipient_suppressions','SELECT'),'clients cannot read suppression records');

select has_function('public','review_document_submission_v2',array['uuid','uuid','uuid','text','text','text','text'],'service review transaction exists');
select has_function('public','record_inbound_rate_limit_v1',array['uuid','text'],'inbound rate limit is recorded atomically');
select ok(not has_function_privilege('authenticated','public.review_document_submission_v2(uuid,uuid,uuid,text,text,text,text)','EXECUTE'),'browser cannot forge document reviews');
select ok(has_function_privilege('service_role','public.review_document_submission_v2(uuid,uuid,uuid,text,text,text,text)','EXECUTE'),'review Edge Function can execute the transaction');
select ok(not has_function_privilege('authenticated','public.record_inbound_rate_limit_v1(uuid,text)','EXECUTE'),'clients cannot write rate-limit events');

select is((select default_enabled from public.feature_flags where key='email_reply_ingestion_v1'),false,'reply ingestion remains off');
select is((select default_enabled from public.feature_flags where key='email_reply_ai_shadow_v1'),false,'AI shadow matching remains off');
select ok(exists(select 1 from cron.job where jobname='cleanup-inbound-email-v1'),'retention cleanup is scheduled');
select ok(exists(select 1 from pg_trigger where tgname='guard_email_originated_human_review' and not tgisinternal),'email-originated decisions have a database guard');
select ok(exists(select 1 from pg_trigger where tgname='ensure_document_request_public_reference' and not tgisinternal),'new requests receive a public reference');
select ok(exists(select 1 from pg_indexes where schemaname='public' and indexname='document_review_one_terminal_decision_idx'),'one terminal decision per upload is enforced');

select * from finish();
rollback;
